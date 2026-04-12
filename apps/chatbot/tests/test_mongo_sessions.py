"""Tests for user_id tagging and session listing in MongoDB layer."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_append_message_stores_user_id():
    """When user_id is provided, it is stored in the conversation document."""
    from app.db.mongo import append_message

    mock_coll = AsyncMock()
    mock_coll.update_one = AsyncMock()

    with patch("app.db.mongo._get_collection", return_value=mock_coll):
        await append_message("sess-1", "user", "Hello", user_id="sub-123")

    call_args = mock_coll.update_one.call_args
    update_doc = call_args[0][1]
    # user_id should be in $setOnInsert so it's stored once when created
    assert update_doc["$setOnInsert"]["user_id"] == "sub-123"


@pytest.mark.asyncio
async def test_get_user_sessions_returns_sorted_list():
    """get_user_sessions returns sessions for a user sorted newest first."""
    from app.db.mongo import get_user_sessions

    t1 = datetime(2026, 4, 1, tzinfo=timezone.utc)
    t2 = datetime(2026, 4, 12, tzinfo=timezone.utc)

    fake_docs = [
        {
            "session_id": "sess-a",
            "messages": [{"role": "user", "text": "First question"}],
            "updated_at": t2,
        },
        {
            "session_id": "sess-b",
            "messages": [{"role": "user", "text": "Old question"}],
            "updated_at": t1,
        },
    ]

    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=fake_docs)

    mock_coll = MagicMock()
    mock_coll.find.return_value = mock_cursor

    with patch("app.db.mongo._get_collection", return_value=mock_coll):
        sessions = await get_user_sessions("sub-123", limit=20)

    mock_coll.find.assert_called_once_with(
        {"user_id": "sub-123"},
        {"session_id": 1, "messages": {"$slice": 1}, "updated_at": 1},
    )
    assert sessions[0]["session_id"] == "sess-a"
    assert sessions[1]["session_id"] == "sess-b"
