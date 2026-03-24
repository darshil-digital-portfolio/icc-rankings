"""Twelfth Man — FastAPI application for the ICC Rankings AI chatbot."""

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage

from app.config import settings
from app.db.mongo import (
    append_message,
    cleanup_old_conversations,
    close_mongo,
    get_recent_messages,
    init_mongo,
)
from app.db.postgres import close_pool, init_pool
from app.graph.graph import get_graph
from app.models import ChatRequest, ChatResponse, HistoryMessage, HistoryResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting Twelfth Man chatbot service...")
    await init_pool()
    await init_mongo()

    # Clean up old conversations on startup.
    deleted = await cleanup_old_conversations()
    if deleted:
        logger.info("Cleaned up %d expired conversations", deleted)

    logger.info(
        "Twelfth Man ready on %s:%d [%s] (router=%s, sql=%s)",
        settings.host,
        settings.port,
        settings.app_env,
        settings.router_model,
        settings.sql_model,
    )
    yield

    await close_pool()
    await close_mongo()
    logger.info("Twelfth Man shut down")


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Twelfth Man",
    description="AI chatbot for ICC Cricket Rankings",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5237",
        "http://localhost:3000",
        "http://127.0.0.1:5237",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _sanitise_chart(raw: Any) -> dict[str, Any] | None:
    """Return the chart dict only if it has the required ChartSpec fields; else None."""
    if not isinstance(raw, dict):
        return None
    required = {"chart_type", "data", "x_key", "y_key"}
    if not required.issubset(raw.keys()):
        logger.warning("Discarding malformed chart spec (missing fields: %s)", required - raw.keys())
        return None
    if not isinstance(raw.get("data"), list):
        logger.warning("Discarding malformed chart spec (data is not a list)")
        return None
    return raw


# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "twelfth-man"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process a chat message and return a response."""
    session_id = request.session_id
    user_message = request.message.strip()

    # Save user message to history.
    await append_message(session_id, "user", user_message)

    # Load recent conversation history for context.
    recent = await get_recent_messages(
        session_id, limit=settings.context_window_messages
    )

    # Build LangGraph messages from history.
    graph_messages: list[HumanMessage | AIMessage] = []
    for msg in recent:
        if msg["role"] == "user":
            graph_messages.append(HumanMessage(content=msg["text"]))
        else:
            graph_messages.append(AIMessage(content=msg["text"]))

    # Invoke the graph.
    graph = get_graph()
    result = await graph.ainvoke(
        {
            "messages": graph_messages,
            "intent": "",
            "sql_query": "",
            "query_result": [],
            "analysis_code": "",
            "analysis_result": "",
            "chart_spec": None,
            "response_text": "",
            "followup_suggestions": [],
            "error": "",
        }
    )

    response_text = result.get("response_text", "I'm not sure how to answer that.")
    raw_chart = result.get("chart_spec")
    followups = result.get("followup_suggestions", [])

    # Validate chart spec — discard if it doesn't match ChartSpec schema.
    chart_spec: dict[str, Any] | None = _sanitise_chart(raw_chart)

    # Save assistant response to history.
    await append_message(
        session_id,
        "assistant",
        response_text,
        chart=chart_spec,
    )

    return ChatResponse(
        text=response_text,
        chart=chart_spec,
        followup_suggestions=followups,
        session_id=session_id,
    )


@app.get("/history/{session_id}", response_model=HistoryResponse)
async def get_history(session_id: str):
    """Retrieve conversation history for a session."""
    messages = await get_recent_messages(session_id)

    return HistoryResponse(
        session_id=session_id,
        messages=[
            HistoryMessage(
                role=msg["role"],
                text=msg["text"],
                chart=msg.get("chart"),
                timestamp=msg["timestamp"],
            )
            for msg in messages
        ],
    )


@app.post("/session")
async def create_session(response: Response):
    """Create a new anonymous session and return the session ID."""
    session_id = str(uuid.uuid4())
    return {"session_id": session_id}


# ── Entry point ─────────────────────────────────────────────────────────────

def run():
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )


if __name__ == "__main__":
    run()
