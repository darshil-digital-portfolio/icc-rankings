"""Shared fixtures for the Twelfth Man test suite."""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure tests don't use real API keys or databases.
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-fake-key")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:47017")
os.environ.setdefault("MONGO_DB", "icc_ranking_test")


@pytest.fixture
def mock_llm_response():
    """Factory fixture to create a mock LLM response with given content."""

    def _make(content: str):
        response = MagicMock()
        response.content = content
        return response

    return _make


@pytest.fixture
def sample_query_result():
    """Sample query result mimicking PostgreSQL rows."""
    return [
        {"name": "Australia", "flag_emoji": "🇦🇺", "total_points": 320, "slug": "australia"},
        {"name": "India", "flag_emoji": "🇮🇳", "total_points": 280, "slug": "india"},
        {"name": "England", "flag_emoji": "🏴", "total_points": 210, "slug": "england"},
    ]


@pytest.fixture
def sample_event_results():
    """Sample event results for analytics tests."""
    return [
        {"team_slug": "india", "total_points": 40, "year": 2011, "name": "WC 2011"},
        {"team_slug": "india", "total_points": 8, "year": 2015, "name": "WC 2015"},
        {"team_slug": "india", "total_points": 24, "year": 2019, "name": "WC 2019"},
        {"team_slug": "india", "total_points": 32, "year": 2023, "name": "WC 2023"},
    ]
