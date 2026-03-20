"""SQL Agent node — generates and executes SQL queries using Sonnet."""

import json
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.db.postgres import execute_query
from app.graph.prompts.sql_agent import SQL_AGENT_SYSTEM_PROMPT
from app.guardrails.sql_validator import SQLValidationError, validate_sql

logger = logging.getLogger(__name__)

_llm: ChatAnthropic | None = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        _llm = ChatAnthropic(
            model=settings.sql_model,
            api_key=settings.anthropic_api_key,
            max_tokens=1024,
            temperature=0,
        )
    return _llm


async def sql_agent_node(state: dict[str, Any]) -> dict[str, Any]:
    """Generate a SQL query from the user's question and execute it."""
    llm = _get_llm()

    messages = state.get("messages", [])
    if not messages:
        return {"error": "No messages to process", "query_result": []}

    # Build prompt with conversation context.
    llm_messages = [SystemMessage(content=SQL_AGENT_SYSTEM_PROMPT)]
    recent = messages[-6:]
    for msg in recent:
        llm_messages.append(msg)

    response = await llm.ainvoke(llm_messages)
    content = response.content

    # Parse the JSON response.
    try:
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        logger.error("SQL agent failed to parse LLM response: %s", content)
        return {
            "error": "I had trouble understanding how to query the database for that. Could you rephrase?",
            "query_result": [],
            "sql_query": "",
        }

    raw_sql = parsed.get("sql", "")
    explanation = parsed.get("explanation", "")
    logger.info("SQL agent generated: %s — %s", raw_sql, explanation)

    # Validate the SQL.
    try:
        safe_sql = validate_sql(raw_sql, max_rows=settings.max_query_rows)
    except SQLValidationError as e:
        logger.warning("SQL validation failed: %s — query: %s", e, raw_sql)
        return {
            "error": f"The generated query didn't pass safety checks: {e}",
            "query_result": [],
            "sql_query": raw_sql,
        }

    # Execute the query.
    try:
        rows = await execute_query(safe_sql)
    except Exception as e:
        logger.error("Query execution failed: %s — query: %s", e, safe_sql)
        return {
            "error": f"Database query failed: {e}",
            "query_result": [],
            "sql_query": safe_sql,
        }

    logger.info("SQL agent returned %d rows", len(rows))
    return {
        "sql_query": safe_sql,
        "query_result": rows,
        "error": "",
    }
