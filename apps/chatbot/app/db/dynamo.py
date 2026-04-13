"""DynamoDB adapter — same public API as mongo.py.

Uses IAM role credentials automatically (no keys in env).
In local dev, falls back to ~/.aws/credentials.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any

import aioboto3

from app.config import settings

logger = logging.getLogger(__name__)

_session: aioboto3.Session | None = None


def _get_session() -> aioboto3.Session:
    global _session
    if _session is None:
        _session = aioboto3.Session()
    return _session


async def init_dynamo() -> None:
    _get_session()
    logger.info(
        "DynamoDB ready (conversations=%s, users=%s, region=%s)",
        settings.dynamo_conversations_table,
        settings.dynamo_users_table,
        settings.aws_region,
    )


async def close_dynamo() -> None:
    global _session
    _session = None
    logger.info("DynamoDB session closed")


def _ttl(days: int) -> int:
    """Unix timestamp N days from now — DynamoDB uses this for auto-expiry."""
    return int(time.time()) + days * 86_400


async def get_conversation(session_id: str) -> dict[str, Any] | None:
    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_conversations_table)
        resp = await table.get_item(Key={"session_id": session_id})
        return resp.get("Item")


async def append_message(
    session_id: str,
    role: str,
    text: str,
    chart: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    message: dict[str, Any] = {"role": role, "text": text, "timestamp": now}
    if chart is not None:
        message["chart"] = chart

    # Build the update expression
    update_expr = (
        "SET updated_at = :now, #ttl = :ttl, "
        "messages = list_append(if_not_exists(messages, :empty), :msg), "
        "created_at = if_not_exists(created_at, :now)"
    )
    expr_names: dict[str, str] = {"#ttl": "ttl"}
    expr_values: dict[str, Any] = {
        ":now": now,
        ":ttl": _ttl(settings.history_retention_days),
        ":empty": [],
        ":msg": [message],
    }

    # Set user_id only on insert (if_not_exists prevents overwriting)
    if user_id:
        update_expr += ", user_id = if_not_exists(user_id, :uid)"
        expr_values[":uid"] = user_id

    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_conversations_table)
        await table.update_item(
            Key={"session_id": session_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )


async def get_recent_messages(
    session_id: str, limit: int | None = None
) -> list[dict[str, Any]]:
    conv = await get_conversation(session_id)
    if not conv:
        return []
    messages = conv.get("messages", [])
    if limit:
        messages = messages[-limit:]
    return messages


async def cleanup_old_conversations() -> int:
    """No-op in production — DynamoDB TTL handles this automatically."""
    logger.info("Conversation cleanup handled by DynamoDB TTL")
    return 0


async def get_user_sessions(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Return up to `limit` sessions for a user, newest first."""
    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_conversations_table)
        resp = await table.query(
            IndexName="user_id-updated_at-index",
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id},
            ScanIndexForward=False,  # Descending — newest first
            Limit=limit,
        )
        return resp.get("Items", [])
