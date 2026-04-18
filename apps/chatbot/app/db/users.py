"""MongoDB helpers for the `users` collection."""

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo import ReturnDocument

from app.db.mongo import USERS_COLLECTION, get_db

logger = logging.getLogger(__name__)


def _get_collection():  # type: ignore[no-untyped-def]
    return get_db()[USERS_COLLECTION]


async def get_or_create_user(
    google_sub: str,
    email: str,
    name: str,
    picture: str,
) -> dict[str, Any]:
    """Upsert a user by google_sub and return the full document (after).

    Adds a synthetic `is_new_user` key: True when this is the first sign-in.
    """
    coll = _get_collection()
    now = datetime.now(timezone.utc)
    doc = await coll.find_one_and_update(
        {"google_sub": google_sub},
        {
            "$set": {
                "email": email,
                "name": name,
                "picture": picture,
                "updated_at": now,
            },
            "$setOnInsert": {
                "google_sub": google_sub,
                "preferences": {"theme": None, "event_filters": []},
                "is_admin": False,
                "created_at": now,
                "_is_new": True,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    is_new = bool(doc.get("_is_new", False))  # type: ignore[union-attr]
    doc.pop("_is_new", None)  # type: ignore[union-attr]
    doc["is_new_user"] = is_new  # type: ignore[index]
    return doc  # type: ignore[return-value]


async def get_user(google_sub: str) -> dict[str, Any] | None:
    """Return the user document for the given google_sub, or None."""
    coll = _get_collection()
    return await coll.find_one({"google_sub": google_sub})  # type: ignore[return-value]


async def update_preferences(
    google_sub: str,
    theme: str | None = None,
    event_filters: list[str] | None = None,
) -> dict[str, Any] | None:
    """Partially update the user's preferences. None values are skipped."""
    coll = _get_collection()
    set_fields: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if theme is not None:
        set_fields["preferences.theme"] = theme
    if event_filters is not None:
        set_fields["preferences.event_filters"] = event_filters
    doc = await coll.find_one_and_update(
        {"google_sub": google_sub},
        {"$set": set_fields},
        return_document=ReturnDocument.AFTER,
    )
    return doc  # type: ignore[return-value]


async def check_and_increment_usage(
    google_sub: str,
    month: str,
    limit: int,
) -> bool:
    """No-op stub — quota is only enforced in production (DynamoDB)."""
    return True
