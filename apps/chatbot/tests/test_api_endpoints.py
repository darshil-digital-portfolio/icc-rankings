"""Integration tests for the FastAPI endpoints (with mocked DB + LLM)."""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.models import ChatResponse


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_dependencies():
    """Mock all external dependencies so the app starts without real DB/LLM."""
    with (
        patch("app.main.init_pool", new_callable=AsyncMock),
        patch("app.main.close_pool", new_callable=AsyncMock),
        patch("app.db.mongo.init_mongo", new_callable=AsyncMock),
        patch("app.db.mongo.close_mongo", new_callable=AsyncMock),
        patch("app.db.mongo.cleanup_old_conversations", new_callable=AsyncMock, return_value=0),
    ):
        yield


@pytest.fixture
async def client(mock_dependencies):
    """AsyncClient that talks to the app via ASGI transport (no real server)."""
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ──────────────────────────────────────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────────────────────────────────────


class TestHealthEndpoint:

    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "twelfth-man"


# ──────────────────────────────────────────────────────────────────────────────
# Session
# ──────────────────────────────────────────────────────────────────────────────


class TestSessionEndpoint:

    @pytest.mark.asyncio
    async def test_create_session(self, client):
        resp = await client.post("/session")
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert len(data["session_id"]) > 0


# ──────────────────────────────────────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────────────────────────────────────


class TestChatEndpoint:

    @pytest.mark.asyncio
    async def test_chat_greeting(self, client):
        """Simulate a greeting going through the full graph (mocked LLM)."""
        mock_graph_result = {
            "response_text": "Hey there! I'm Twelfth Man.",
            "chart_spec": None,
            "followup_suggestions": ["Top teams?", "World cup?"],
        }
        with (
            patch("app.db.mongo.append_message", new_callable=AsyncMock),
            patch("app.db.mongo.get_recent_messages", new_callable=AsyncMock, return_value=[
                {"role": "user", "text": "Hello!"},
            ]),
            patch("app.main.get_graph") as mock_get_graph,
        ):
            mock_graph = AsyncMock()
            mock_graph.ainvoke = AsyncMock(return_value=mock_graph_result)
            mock_get_graph.return_value = mock_graph

            resp = await client.post("/chat", json={
                "message": "Hello!",
                "session_id": "test-session-123",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "Twelfth Man" in data["text"]
            assert data["session_id"] == "test-session-123"
            assert len(data["followup_suggestions"]) == 2

    @pytest.mark.asyncio
    async def test_chat_with_chart(self, client):
        """Test a response that includes a chart spec."""
        mock_graph_result = {
            "response_text": "Here are the top teams.",
            "chart_spec": {
                "chart_type": "bar",
                "data": [{"label": "India", "value": 280}],
                "x_key": "label",
                "y_key": "value",
                "title": "Top Teams",
                "x_label": "Team",
                "y_label": "Points",
            },
            "followup_suggestions": [],
        }
        with (
            patch("app.db.mongo.append_message", new_callable=AsyncMock),
            patch("app.db.mongo.get_recent_messages", new_callable=AsyncMock, return_value=[
                {"role": "user", "text": "Top teams?"},
            ]),
            patch("app.main.get_graph") as mock_get_graph,
        ):
            mock_graph = AsyncMock()
            mock_graph.ainvoke = AsyncMock(return_value=mock_graph_result)
            mock_get_graph.return_value = mock_graph

            resp = await client.post("/chat", json={
                "message": "Top teams?",
                "session_id": "test-session-123",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["chart"] is not None
            assert data["chart"]["chart_type"] == "bar"

    @pytest.mark.asyncio
    async def test_chat_validation_empty_message(self, client):
        resp = await client.post("/chat", json={
            "message": "",
            "session_id": "test-session-123",
        })
        assert resp.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_chat_validation_missing_session(self, client):
        resp = await client.post("/chat", json={
            "message": "Hello",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_chat_validation_message_too_long(self, client):
        resp = await client.post("/chat", json={
            "message": "a" * 2001,
            "session_id": "test-session-123",
        })
        assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# History
# ──────────────────────────────────────────────────────────────────────────────


class TestHistoryEndpoint:

    @pytest.mark.asyncio
    async def test_get_history_empty(self, client):
        with patch("app.db.mongo.get_recent_messages", new_callable=AsyncMock, return_value=[]):
            resp = await client.get("/history/test-session-123")
            assert resp.status_code == 200
            data = resp.json()
            assert data["session_id"] == "test-session-123"
            assert data["messages"] == []

    @pytest.mark.asyncio
    async def test_get_history_with_messages(self, client):
        mock_messages = [
            {
                "role": "user",
                "text": "Hello",
                "chart": None,
                "timestamp": datetime(2025, 1, 1, tzinfo=timezone.utc),
            },
            {
                "role": "assistant",
                "text": "Hi there!",
                "chart": None,
                "timestamp": datetime(2025, 1, 1, 0, 0, 1, tzinfo=timezone.utc),
            },
        ]
        with patch("app.db.mongo.get_recent_messages", new_callable=AsyncMock, return_value=mock_messages):
            resp = await client.get("/history/test-session-123")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["messages"]) == 2
            assert data["messages"][0]["role"] == "user"
            assert data["messages"][1]["role"] == "assistant"


# ──────────────────────────────────────────────────────────────────────────────
# Quota enforcement
# ──────────────────────────────────────────────────────────────────────────────


class TestChatQuotaEnforcement:

    @pytest.mark.asyncio
    async def test_quota_exceeded_returns_200_with_flag(self, client):
        """When quota is exceeded, /chat returns 200 with quota_exceeded=True."""
        with (
            patch("app.db.users.check_and_increment_usage", new_callable=AsyncMock, return_value=False),
            patch("app.db.mongo.append_message", new_callable=AsyncMock),
        ):
            resp = await client.post("/chat", json={
                "message": "Who won the 2023 World Cup?",
                "session_id": "test-session-quota",
                "user_id": "google-sub-xyz",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["quota_exceeded"] is True
            assert "30" in data["text"] or "limit" in data["text"].lower() or "sorry" in data["text"].lower()
            assert data["followup_suggestions"] == []

    @pytest.mark.asyncio
    async def test_quota_exceeded_saves_both_messages_to_history(self, client):
        """When quota is exceeded, user message AND apology are both saved."""
        mock_append = AsyncMock()
        with (
            patch("app.db.users.check_and_increment_usage", new_callable=AsyncMock, return_value=False),
            patch("app.db.mongo.append_message", mock_append),
        ):
            await client.post("/chat", json={
                "message": "Any question",
                "session_id": "test-session-quota",
                "user_id": "google-sub-xyz",
            })
            assert mock_append.call_count == 2
            assert mock_append.call_args_list[0][0][1] == "user"
            assert mock_append.call_args_list[1][0][1] == "assistant"

    @pytest.mark.asyncio
    async def test_no_user_id_skips_quota_check(self, client):
        """Requests without user_id bypass quota and proceed normally."""
        mock_graph_result = {
            "response_text": "Hello!",
            "chart_spec": None,
            "followup_suggestions": [],
        }
        with (
            patch("app.db.mongo.append_message", new_callable=AsyncMock),
            patch("app.db.mongo.get_recent_messages", new_callable=AsyncMock, return_value=[]),
            patch("app.main.get_graph") as mock_get_graph,
        ):
            mock_graph = AsyncMock()
            mock_graph.ainvoke = AsyncMock(return_value=mock_graph_result)
            mock_get_graph.return_value = mock_graph

            resp = await client.post("/chat", json={
                "message": "Hello!",
                "session_id": "anon-session",
            })
            assert resp.status_code == 200
            assert resp.json()["quota_exceeded"] is False
