import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None  # type: ignore[type-arg]
_db: AsyncIOMotorDatabase | None = None  # type: ignore[type-arg]

CONVERSATIONS_COLLECTION = "conversations"
USERS_COLLECTION = "users"


def get_db() -> AsyncIOMotorDatabase:  # type: ignore[type-arg]
    """Return the active Motor database; raises if not yet initialised."""
    if _db is None:
        raise RuntimeError("MongoDB not initialised")
    return _db


async def init_mongo() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongo_url)
    _db = _client[settings.mongo_db]

    # Conversations indexes
    coll = _db[CONVERSATIONS_COLLECTION]
    await coll.create_index("session_id", unique=True)
    await coll.create_index("updated_at")
    # user_id index for listing sessions per user
    await coll.create_index("user_id")

    # Users indexes
    users = _db[USERS_COLLECTION]
    await users.create_index("google_sub", unique=True)

    logger.info("MongoDB connection initialised")


async def close_mongo() -> None:
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed")


def _get_collection():  # type: ignore[no-untyped-def]
    if _db is None:
        raise RuntimeError("MongoDB not initialised")
    return _db[CONVERSATIONS_COLLECTION]


async def get_conversation(session_id: str) -> dict[str, Any] | None:
    coll = _get_collection()
    return await coll.find_one({"session_id": session_id})


async def append_message(
    session_id: str,
    role: str,
    text: str,
    chart: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    coll = _get_collection()
    message = {
        "role": role,
        "text": text,
        "chart": chart,
        "timestamp": datetime.now(timezone.utc),
    }
    set_on_insert: dict[str, Any] = {"created_at": datetime.now(timezone.utc)}
    if user_id:
        set_on_insert["user_id"] = user_id

    await coll.update_one(
        {"session_id": session_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": datetime.now(timezone.utc)},
            "$setOnInsert": set_on_insert,
        },
        upsert=True,
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
    coll = _get_collection()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.history_retention_days)
    result = await coll.delete_many({"updated_at": {"$lt": cutoff}})
    return result.deleted_count


async def get_user_sessions(
    user_id: str, limit: int = 20
) -> list[dict[str, Any]]:
    """Return up to `limit` conversation summaries for a user, newest first.

    Only fetches the first message per session to use as a preview.
    """
    coll = _get_collection()
    cursor = coll.find(
        {"user_id": user_id},
        {"session_id": 1, "messages": {"$slice": 1}, "updated_at": 1},
    )
    cursor = cursor.sort("updated_at", -1).limit(limit)
    return await cursor.to_list(length=limit)
