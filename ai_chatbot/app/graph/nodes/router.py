"""Router node — classifies user intent using Haiku."""

import json
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.graph.prompts.router import ROUTER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

_llm: ChatAnthropic | None = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        _llm = ChatAnthropic(
            model=settings.router_model,
            api_key=settings.anthropic_api_key,
            max_tokens=256,
            temperature=0,
        )
    return _llm


async def router_node(state: dict[str, Any]) -> dict[str, Any]:
    """Classify the user's intent and route to the appropriate agent."""
    llm = _get_llm()

    messages = state.get("messages", [])
    if not messages:
        return {"intent": "off_topic", "error": "No messages to process"}

    # Build conversation context for the router (last few messages for context).
    llm_messages = [SystemMessage(content=ROUTER_SYSTEM_PROMPT)]

    # Include recent conversation for context.
    recent = messages[-6:]  # last 3 exchanges
    for msg in recent:
        llm_messages.append(msg)

    response = await llm.ainvoke(llm_messages)
    content = response.content

    try:
        # Strip markdown code fences if present.
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        logger.warning("Router failed to parse response: %s", content)
        return {"intent": "sql_query", "error": ""}

    intent = parsed.get("intent", "off_topic")
    logger.info("Router classified intent: %s — %s", intent, parsed.get("reasoning", ""))

    result: dict[str, Any] = {"intent": intent, "error": ""}

    # If clarification, store the question in response_text directly.
    if intent == "clarification":
        result["response_text"] = parsed.get(
            "clarification_question",
            "Could you provide more details about what you'd like to know?",
        )

    return result
