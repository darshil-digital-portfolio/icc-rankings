"""Main LangGraph graph definition for the Twelfth Man chatbot."""

import logging
from typing import Annotated, Any

from langchain_core.messages import BaseMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.graph.nodes.analytics import analytics_node
from app.graph.nodes.formatter import formatter_node, greeting_node, off_topic_node
from app.graph.nodes.router import router_node
from app.graph.nodes.sql_agent import sql_agent_node

logger = logging.getLogger(__name__)


# ── State schema ────────────────────────────────────────────────────────────

class GraphState(dict):
    """Typed state flowing through the Twelfth Man graph."""

    messages: Annotated[list[BaseMessage], add_messages]
    intent: str
    sql_query: str
    query_result: list[dict[str, Any]]
    analysis_code: str
    analysis_result: str
    chart_spec: dict[str, Any] | None
    response_text: str
    followup_suggestions: list[str]
    error: str


# ── Routing logic ───────────────────────────────────────────────────────────

def route_by_intent(state: dict[str, Any]) -> str:
    """Route to the appropriate node based on the classified intent."""
    intent = state.get("intent", "off_topic")

    if intent == "sql_query":
        return "sql_agent"
    elif intent == "analytics":
        return "analytics"
    elif intent == "clarification":
        return END  # Router already set response_text
    elif intent == "greeting":
        return "greeting"
    else:
        return "off_topic"


def route_after_data(state: dict[str, Any]) -> str:
    """After SQL/analytics, decide if we need formatting or have an error."""
    error = state.get("error", "")
    if error:
        return "formatter"  # Formatter handles error display too

    return "formatter"


# ── Build the graph ─────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """Construct and compile the Twelfth Man LangGraph."""
    graph = StateGraph(GraphState)

    # Add nodes.
    graph.add_node("router", router_node)
    graph.add_node("sql_agent", sql_agent_node)
    graph.add_node("analytics", analytics_node)
    graph.add_node("formatter", formatter_node)
    graph.add_node("greeting", greeting_node)
    graph.add_node("off_topic", off_topic_node)

    # Entry point.
    graph.set_entry_point("router")

    # Router → conditional branching.
    graph.add_conditional_edges(
        "router",
        route_by_intent,
        {
            "sql_agent": "sql_agent",
            "analytics": "analytics",
            "greeting": "greeting",
            "off_topic": "off_topic",
            END: END,
        },
    )

    # SQL agent → formatter.
    graph.add_edge("sql_agent", "formatter")

    # Analytics → formatter.
    graph.add_edge("analytics", "formatter")

    # Terminal nodes → END.
    graph.add_edge("formatter", END)
    graph.add_edge("greeting", END)
    graph.add_edge("off_topic", END)

    return graph


# Compiled graph (singleton).
_compiled_graph = None


def get_graph():
    """Get or create the compiled graph."""
    global _compiled_graph
    if _compiled_graph is None:
        graph = build_graph()
        _compiled_graph = graph.compile()
        logger.info("Twelfth Man graph compiled")
    return _compiled_graph
