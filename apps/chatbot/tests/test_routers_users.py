"""Tests for the /api/users/* endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

VALID_TOKEN = "test-service-token-abc123"

SAMPLE_USER_DOC = {
    "google_sub": "109876543210",
    "email": "test@example.com",
    "name": "Test User",
    "picture": "https://lh3.googleusercontent.com/test",
    "preferences": {"theme": "dark", "event_filters": ["men_world_cup"]},
    "is_admin": False,
}

ADMIN_USER_DOC = {**SAMPLE_USER_DOC, "is_admin": True}


# ──────────────────────────────────────────────────────────────────────────────
# Shared fixtures
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def set_service_token():
    """Inject a known service token into the settings singleton for every test."""
    from app.routers import auth_middleware
    original = auth_middleware.settings.service_api_token
    auth_middleware.settings.service_api_token = VALID_TOKEN
    yield
    auth_middleware.settings.service_api_token = original


@pytest.fixture
def mock_db_dependencies():
    """Mock all startup dependencies so the ASGI app starts cleanly."""
    with (
        patch("app.main.init_pool", new_callable=AsyncMock),
        patch("app.main.close_pool", new_callable=AsyncMock),
        patch("app.main.init_mongo", new_callable=AsyncMock),
        patch("app.main.close_mongo", new_callable=AsyncMock),
        patch("app.main.cleanup_old_conversations", new_callable=AsyncMock, return_value=0),
    ):
        yield


@pytest.fixture
async def client(mock_db_dependencies):
    from app.main import app
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/users/me
# ──────────────────────────────────────────────────────────────────────────────


class TestGetMe:

    @pytest.mark.asyncio
    async def test_get_me_upserts_and_returns_profile(self, client):
        with patch(
            "app.routers.users.get_or_create_user",
            new_callable=AsyncMock,
            return_value=SAMPLE_USER_DOC,
        ):
            resp = await client.get(
                "/api/users/me",
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "109876543210",
                    "X-User-Email": "test@example.com",
                    "X-User-Name": "Test User",
                    "X-User-Picture": "https://lh3.googleusercontent.com/test",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["google_sub"] == "109876543210"
        assert data["email"] == "test@example.com"
        assert data["preferences"]["theme"] == "dark"
        assert data["preferences"]["event_filters"] == ["men_world_cup"]
        assert data["is_admin"] is False

    @pytest.mark.asyncio
    async def test_get_me_missing_sub_returns_400(self, client):
        resp = await client.get(
            "/api/users/me",
            headers={"X-Service-Token": VALID_TOKEN},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_get_me_invalid_token_returns_401(self, client):
        resp = await client.get(
            "/api/users/me",
            headers={
                "X-Service-Token": "wrong-token",
                "X-User-Sub": "109876543210",
            },
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_no_token_returns_401(self, client):
        resp = await client.get(
            "/api/users/me",
            headers={"X-User-Sub": "109876543210"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_admin_user(self, client):
        with patch(
            "app.routers.users.get_or_create_user",
            new_callable=AsyncMock,
            return_value=ADMIN_USER_DOC,
        ):
            resp = await client.get(
                "/api/users/me",
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "109876543210",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["is_admin"] is True


# ──────────────────────────────────────────────────────────────────────────────
# PATCH /api/users/preferences
# ──────────────────────────────────────────────────────────────────────────────


class TestPatchPreferences:

    @pytest.mark.asyncio
    async def test_update_theme(self, client):
        updated_doc = {
            **SAMPLE_USER_DOC,
            "preferences": {"theme": "light", "event_filters": ["men_world_cup"]},
        }
        with patch(
            "app.routers.users.update_preferences",
            new_callable=AsyncMock,
            return_value=updated_doc,
        ):
            resp = await client.patch(
                "/api/users/preferences",
                json={"theme": "light"},
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "109876543210",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["preferences"]["theme"] == "light"

    @pytest.mark.asyncio
    async def test_update_event_filters(self, client):
        updated_doc = {
            **SAMPLE_USER_DOC,
            "preferences": {
                "theme": "dark",
                "event_filters": ["men_world_cup", "test_championship"],
            },
        }
        with patch(
            "app.routers.users.update_preferences",
            new_callable=AsyncMock,
            return_value=updated_doc,
        ):
            resp = await client.patch(
                "/api/users/preferences",
                json={"event_filters": ["men_world_cup", "test_championship"]},
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "109876543210",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["preferences"]["event_filters"] == [
            "men_world_cup",
            "test_championship",
        ]

    @pytest.mark.asyncio
    async def test_update_user_not_found_returns_404(self, client):
        with patch(
            "app.routers.users.update_preferences",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.patch(
                "/api/users/preferences",
                json={"theme": "light"},
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "nonexistent",
                },
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_missing_sub_returns_400(self, client):
        resp = await client.patch(
            "/api/users/preferences",
            json={"theme": "light"},
            headers={"X-Service-Token": VALID_TOKEN},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_update_invalid_token_returns_401(self, client):
        resp = await client.patch(
            "/api/users/preferences",
            json={"theme": "light"},
            headers={
                "X-Service-Token": "bad-token",
                "X-User-Sub": "109876543210",
            },
        )
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/users/admin-check
# ──────────────────────────────────────────────────────────────────────────────


class TestAdminCheck:

    @pytest.mark.asyncio
    async def test_non_admin_user(self, client):
        with patch(
            "app.routers.users.get_user",
            new_callable=AsyncMock,
            return_value=SAMPLE_USER_DOC,
        ):
            resp = await client.get(
                "/api/users/admin-check",
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "109876543210",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["is_admin"] is False

    @pytest.mark.asyncio
    async def test_admin_user(self, client):
        with patch(
            "app.routers.users.get_user",
            new_callable=AsyncMock,
            return_value=ADMIN_USER_DOC,
        ):
            resp = await client.get(
                "/api/users/admin-check",
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "109876543210",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["is_admin"] is True

    @pytest.mark.asyncio
    async def test_unknown_user_returns_false(self, client):
        with patch(
            "app.routers.users.get_user",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get(
                "/api/users/admin-check",
                headers={
                    "X-Service-Token": VALID_TOKEN,
                    "X-User-Sub": "unknown-sub",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["is_admin"] is False

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, client):
        resp = await client.get(
            "/api/users/admin-check",
            headers={
                "X-Service-Token": "wrong",
                "X-User-Sub": "109876543210",
            },
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_sub_returns_400(self, client):
        resp = await client.get(
            "/api/users/admin-check",
            headers={"X-Service-Token": VALID_TOKEN},
        )
        assert resp.status_code == 400
