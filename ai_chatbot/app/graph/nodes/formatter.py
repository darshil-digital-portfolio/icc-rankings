"""Formatter node — formats query results into a user-friendly response."""

import json
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.graph.prompts.formatter import (
    ANALYTICS_FORMATTER_SYSTEM_PROMPT,
    FORMATTER_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)

_llm: ChatAnthropic | None = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        _llm = ChatAnthropic(
            model=settings.formatter_model,
            api_key=settings.anthropic_api_key,
            max_tokens=4096,
            temperature=0.3,  # Slight creativity for commentary.
        )
    return _llm


_MAX_ANALYSIS_ITEMS = 30  # Cap list-style results sent to the formatter LLM.


def _truncate_analysis_result(analysis_result: str) -> str:
    """Truncate analysis_result if it's a large JSON list to avoid token overflows."""
    try:
        parsed = json.loads(analysis_result)
    except (json.JSONDecodeError, ValueError):
        return analysis_result  # Not JSON, pass through as-is.

    if isinstance(parsed, dict) and "data" in parsed and isinstance(parsed["data"], list):
        data = parsed["data"]
        if len(data) > _MAX_ANALYSIS_ITEMS:
            parsed["data"] = data[:_MAX_ANALYSIS_ITEMS]
            parsed["_truncated"] = f"Showing top {_MAX_ANALYSIS_ITEMS} of {len(data)} results"
            return json.dumps(parsed, default=str)
    elif isinstance(parsed, list) and len(parsed) > _MAX_ANALYSIS_ITEMS:
        truncated = parsed[:_MAX_ANALYSIS_ITEMS]
        return json.dumps(
            {"data": truncated, "_truncated": f"Showing top {_MAX_ANALYSIS_ITEMS} of {len(parsed)} results"},
            default=str,
        )

    return analysis_result


async def formatter_node(state: dict[str, Any]) -> dict[str, Any]:
    """Format raw data into a user-friendly response with optional chart spec."""
    llm = _get_llm()

    # If there's an error, format it nicely.
    error = state.get("error", "")
    if error:
        return {
            "response_text": f"Sorry, I ran into an issue: {error}\n\nCould you try rephrasing your question?",
            "followup_suggestions": [
                "What teams are in the rankings?",
                "Show me the top 5 teams by total points",
                "Which team has won the most World Cups?",
            ],
        }

    intent = state.get("intent", "")
    query_result = state.get("query_result", [])
    analysis_result = state.get("analysis_result", "")
    messages = state.get("messages", [])

    # Get the user's original question.
    user_question = ""
    for msg in reversed(messages):
        if hasattr(msg, "type") and msg.type == "human":
            user_question = msg.content
            break

    # Choose prompt based on intent.
    if intent == "analytics" and analysis_result:
        system_prompt = ANALYTICS_FORMATTER_SYSTEM_PROMPT
        # Truncate large analysis results to avoid hitting token limits.
        truncated_result = _truncate_analysis_result(analysis_result)
        data_context = (
            f"User question: {user_question}\n\n"
            f"Analysis result:\n{truncated_result}\n\n"
            f"Raw data sample (first 5 rows):\n{json.dumps(query_result[:5], default=str)}"
        )
    else:
        system_prompt = FORMATTER_SYSTEM_PROMPT
        data_context = (
            f"User question: {user_question}\n\n"
            f"Query returned {len(query_result)} rows.\n"
            f"Data:\n{json.dumps(query_result, default=str)}"
        )

    llm_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=data_context),
    ]

    response = await llm.ainvoke(llm_messages)
    content = response.content

    # Parse JSON response.
    try:
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        # Fall back to using the raw text as the response.
        logger.warning("Formatter failed to parse JSON, using raw response")
        return {
            "response_text": content,
            "followup_suggestions": [],
            "chart_spec": None,
        }

    return {
        "response_text": parsed.get("text", content),
        "chart_spec": parsed.get("chart"),
        "followup_suggestions": parsed.get("followup_suggestions", []),
    }


async def greeting_node(state: dict[str, Any]) -> dict[str, Any]:
    """Handle greetings and small talk."""
    return {
        "response_text": (
            "Hey there! 🏏 I'm **Twelfth Man**, your ICC Cricket Rankings assistant. "
            "I can help you explore team rankings, tournament history, points breakdowns, "
            "and even crunch some numbers with statistical analysis.\n\n"
            "What would you like to know?"
        ),
        "followup_suggestions": [
            "Who has the most all-time ICC points?",
            "Show me all Men's World Cup champions",
            "Compare India and Australia's performance",
        ],
    }


async def off_topic_node(state: dict[str, Any]) -> dict[str, Any]:
    """Handle off-topic questions."""
    return {
        "response_text": (
            "That's a bit outside my crease! 🏏 I'm **Twelfth Man**, specialising in "
            "ICC cricket tournament data — team rankings, event history, points, and stats.\n\n"
            "Try asking me something about cricket tournaments!"
        ),
        "followup_suggestions": [
            "What are the all-time ICC rankings?",
            "Which team has the most World Cup titles?",
            "Show me India's tournament history",
        ],
    }
