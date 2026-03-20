"""LangGraph state definition for the Twelfth Man chatbot."""

from typing import Annotated, Any

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class ChatState(dict):
    """State that flows through the Twelfth Man graph.

    Using a dict subclass so LangGraph can merge partial updates.
    """

    messages: Annotated[list[BaseMessage], add_messages]
    """Full conversation messages (managed by add_messages reducer)."""

    intent: str
    """Classified intent: sql_query | analytics | clarification | off_topic | greeting"""

    sql_query: str
    """Generated SQL query (empty if not applicable)."""

    query_result: list[dict[str, Any]]
    """Rows returned from PostgreSQL."""

    analysis_code: str
    """Generated pandas code (Phase 2)."""

    analysis_result: str
    """Result of pandas analysis (Phase 2)."""

    chart_spec: dict[str, Any] | None
    """Chart specification for the frontend (None if no chart needed)."""

    response_text: str
    """Final formatted text response."""

    followup_suggestions: list[str]
    """Suggested follow-up questions."""

    error: str
    """Error message if something went wrong."""
