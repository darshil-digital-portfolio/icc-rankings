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
from app.db.postgres import close_pool, init_pool
from app.graph.graph import get_graph
from app.models import ChatRequest, ChatResponse, HistoryMessage, HistoryResponse
from app.routers.users import router as users_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ── DB backend helpers ───────────────────────────────────────────────────────

def _db():
    """Return the correct conversations DB module based on APP_ENV."""
    if settings.app_env == "production":
        import app.db.dynamo as mod
    else:
        import app.db.mongo as mod
    return mod


def _users_db():
    """Return the correct users DB module based on APP_ENV."""
    if settings.app_env == "production":
        import app.db.users_dynamo as mod
    else:
        import app.db.users as mod
    return mod


# ── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting Twelfth Man chatbot service [env=%s]...", settings.app_env)
    await init_pool()

    if settings.app_env == "production":
        from app.db.dynamo import init_dynamo, close_dynamo
        await init_dynamo()
        yield
        await close_dynamo()
    else:
        from app.db.mongo import init_mongo, close_mongo, cleanup_old_conversations
        await init_mongo()
        deleted = await cleanup_old_conversations()
        if deleted:
            logger.info("Cleaned up %d expired conversations", deleted)
        yield
        await close_mongo()

    await close_pool()
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

app.include_router(users_router)


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
    await _db().append_message(session_id, "user", user_message, user_id=request.user_id)

    # Load recent conversation history for context.
    recent = await _db().get_recent_messages(
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
    await _db().append_message(
        session_id,
        "assistant",
        response_text,
        chart=chart_spec,
        user_id=request.user_id,
    )

    return ChatResponse(
        text=response_text,
        chart=chart_spec,
        followup_suggestions=followups,
        session_id=session_id,
    )


def _normalize_chart(raw: Any) -> dict | None:
    """Normalize a stored chart dict to the current ChartSpec shape.

    Old format: {type, title, labels: [...], values: [...], orientation}
    New format: {chart_type, data: [{x_key: ..., y_key: ...}], x_key, y_key, title}
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return None
    # Already in new format — has required fields
    if "chart_type" in raw and "data" in raw and isinstance(raw["data"], list):
        return raw
    # Legacy format migration
    labels = raw.get("labels", [])
    values = raw.get("values", [])
    if not isinstance(labels, list) or not isinstance(values, list):
        return None
    data = [{"label": lbl, "value": val} for lbl, val in zip(labels, values)]
    return {
        "chart_type": raw.get("type", "bar"),
        "data": data,
        "x_key": "label",
        "y_key": "value",
        "title": raw.get("title", ""),
        "x_label": raw.get("x_label", ""),
        "y_label": raw.get("y_label", ""),
    }


@app.get("/history/{session_id}", response_model=HistoryResponse)
async def get_history(session_id: str):
    """Retrieve conversation history for a session."""
    messages = await _db().get_recent_messages(session_id)

    return HistoryResponse(
        session_id=session_id,
        messages=[
            HistoryMessage(
                role=msg["role"],
                text=msg["text"],
                chart=_normalize_chart(msg.get("chart")),
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
