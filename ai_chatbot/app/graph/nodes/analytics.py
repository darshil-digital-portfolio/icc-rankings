"""Analytics Agent node — generates SQL + pandas code for statistical analysis."""

import json
import logging
from typing import Any

import numpy as np
import pandas as pd
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage

from app.config import settings
from app.db.postgres import execute_query
from app.graph.prompts.analytics import ANALYTICS_SYSTEM_PROMPT
from app.guardrails.sql_validator import SQLValidationError, validate_sql

logger = logging.getLogger(__name__)

_llm: ChatAnthropic | None = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        _llm = ChatAnthropic(
            model=settings.analytics_model,
            api_key=settings.anthropic_api_key,
            max_tokens=2048,
            temperature=0,
        )
    return _llm


# Restricted namespace for pandas code execution.
SAFE_GLOBALS: dict[str, Any] = {
    "__builtins__": {
        "range": range,
        "len": len,
        "min": min,
        "max": max,
        "sum": sum,
        "abs": abs,
        "round": round,
        "sorted": sorted,
        "enumerate": enumerate,
        "zip": zip,
        "map": map,
        "filter": filter,
        "int": int,
        "float": float,
        "str": str,
        "bool": bool,
        "list": list,
        "dict": dict,
        "tuple": tuple,
        "set": set,
    },
    "pd": pd,
    "np": np,
}


def _execute_pandas_code(code: str, df: pd.DataFrame) -> Any:
    """Execute pandas code in a restricted namespace.

    The code must assign its final output to a variable called `result`.
    """
    local_ns: dict[str, Any] = {"df": df.copy()}

    try:
        exec(code, SAFE_GLOBALS.copy(), local_ns)  # noqa: S102
    except Exception as e:
        raise RuntimeError(f"Analytics code execution failed: {e}") from e

    if "result" not in local_ns:
        raise RuntimeError("Analytics code did not produce a 'result' variable")

    return local_ns["result"]


async def analytics_node(state: dict[str, Any]) -> dict[str, Any]:
    """Generate SQL + pandas code and execute analysis."""
    llm = _get_llm()

    messages = state.get("messages", [])
    if not messages:
        return {"error": "No messages to process", "query_result": []}

    llm_messages = [SystemMessage(content=ANALYTICS_SYSTEM_PROMPT)]
    recent = messages[-6:]
    for msg in recent:
        llm_messages.append(msg)

    response = await llm.ainvoke(llm_messages)
    content = response.content

    # Parse JSON.
    try:
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        logger.error("Analytics agent failed to parse response: %s", content)
        return {
            "error": "I had trouble setting up the analysis. Could you rephrase?",
            "query_result": [],
            "analysis_result": "",
        }

    raw_sql = parsed.get("sql", "")
    pandas_code = parsed.get("pandas_code", "")

    # Validate and execute SQL.
    try:
        safe_sql = validate_sql(raw_sql, max_rows=500)  # Analytics may need more rows
    except SQLValidationError as e:
        return {
            "error": f"Safety check failed for data query: {e}",
            "query_result": [],
            "sql_query": raw_sql,
            "analysis_result": "",
        }

    try:
        rows = await execute_query(safe_sql)
    except Exception as e:
        return {
            "error": f"Data fetch failed: {e}",
            "query_result": [],
            "sql_query": safe_sql,
            "analysis_result": "",
        }

    if not rows:
        return {
            "query_result": [],
            "sql_query": safe_sql,
            "analysis_result": "No data found for this analysis.",
            "error": "",
        }

    # Execute pandas code.
    df = pd.DataFrame(rows)
    try:
        result = _execute_pandas_code(pandas_code, df)
    except RuntimeError as e:
        logger.error("Pandas execution failed: %s", e)
        return {
            "error": f"Analysis computation failed: {e}",
            "query_result": rows,
            "sql_query": safe_sql,
            "analysis_result": "",
        }

    # Normalise result to string/dict.
    if isinstance(result, dict):
        analysis_result = json.dumps(result, default=str)
    elif isinstance(result, pd.DataFrame):
        analysis_result = result.to_json(orient="records", default_handler=str)
    else:
        analysis_result = str(result)

    logger.info("Analytics completed. Result length: %d", len(analysis_result))
    return {
        "query_result": rows,
        "sql_query": safe_sql,
        "analysis_result": analysis_result,
        "analysis_code": pandas_code,
        "error": "",
    }
