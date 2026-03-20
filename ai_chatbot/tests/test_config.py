"""Tests for configuration and settings."""

import os

import pytest


class TestConfig:

    def test_default_settings(self):
        from app.config import Settings

        s = Settings(
            anthropic_api_key="sk-ant-test",
            database_url="postgresql://test:test@localhost/test",
        )
        assert s.port == 8100
        assert s.host == "0.0.0.0"
        assert s.max_query_rows == 100
        assert s.query_timeout_seconds == 5
        assert s.context_window_messages == 10
        assert s.history_retention_days == 90

    def test_model_defaults(self):
        from app.config import Settings

        s = Settings(
            anthropic_api_key="sk-ant-test",
            database_url="postgresql://test:test@localhost/test",
        )
        assert "haiku" in s.router_model
        assert "sonnet" in s.sql_model
        assert "sonnet" in s.analytics_model
        assert "haiku" in s.formatter_model

    def test_custom_settings(self):
        from app.config import Settings

        s = Settings(
            anthropic_api_key="sk-ant-test",
            database_url="postgresql://test:test@localhost/test",
            max_query_rows=50,
            query_timeout_seconds=10,
            port=9000,
        )
        assert s.max_query_rows == 50
        assert s.query_timeout_seconds == 10
        assert s.port == 9000


class TestDBSchema:
    """Verify the schema description string is well-formed."""

    def test_schema_contains_all_tables(self):
        from app.db.postgres import DB_SCHEMA

        assert "teams" in DB_SCHEMA
        assert "events" in DB_SCHEMA
        assert "event_results" in DB_SCHEMA

    def test_schema_contains_enums(self):
        from app.db.postgres import DB_SCHEMA

        assert "event_type_enum" in DB_SCHEMA
        assert "stage_enum" in DB_SCHEMA
        assert "men_world_cup" in DB_SCHEMA
        assert "champion" in DB_SCHEMA

    def test_schema_contains_scoring_info(self):
        from app.db.postgres import DB_SCHEMA

        assert "total_points" in DB_SCHEMA
        assert "base_points" in DB_SCHEMA
        assert "multiplier" in DB_SCHEMA

    def test_schema_contains_relationships(self):
        from app.db.postgres import DB_SCHEMA

        assert "FK" in DB_SCHEMA
        assert "team_slug" in DB_SCHEMA
        assert "event_id" in DB_SCHEMA
