"""Tests for is_new_user detection in get_or_create_user."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from pymongo import ReturnDocument


@pytest.mark.asyncio
async def test_get_or_create_user_new_user_returns_is_new_true():
    """First call for a google_sub should set is_new_user=True."""
    from app.db.users import get_or_create_user

    mock_coll = AsyncMock()
    mock_coll.find_one_and_update = AsyncMock(return_value={
        "google_sub": "sub-123",
        "email": "a@b.com",
        "name": "Alice",
        "picture": "",
        "preferences": {"theme": None, "event_filters": []},
        "is_admin": False,
        "created_at": "2026-04-12T00:00:00Z",
        "updated_at": "2026-04-12T00:00:00Z",
        "_is_new": True,
    })

    with patch("app.db.users._get_collection", return_value=mock_coll):
        doc = await get_or_create_user("sub-123", "a@b.com", "Alice", "")
        assert doc["is_new_user"] is True


@pytest.mark.asyncio
async def test_get_or_create_user_returning_user_returns_is_new_false():
    """Subsequent call for same google_sub should set is_new_user=False."""
    from app.db.users import get_or_create_user

    mock_coll = AsyncMock()
    mock_coll.find_one_and_update = AsyncMock(return_value={
        "google_sub": "sub-123",
        "email": "a@b.com",
        "name": "Alice",
        "picture": "",
        "preferences": {"theme": None, "event_filters": []},
        "is_admin": False,
        "created_at": "2026-04-01T00:00:00Z",
        "updated_at": "2026-04-12T00:00:00Z",
    })

    with patch("app.db.users._get_collection", return_value=mock_coll):
        doc = await get_or_create_user("sub-123", "a@b.com", "Alice", "")
        assert doc["is_new_user"] is False
