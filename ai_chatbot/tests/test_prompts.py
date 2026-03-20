"""Tests to verify prompt templates are well-formed and contain required content."""

import pytest


class TestRouterPrompt:

    def test_contains_all_intents(self):
        from app.graph.prompts.router import ROUTER_SYSTEM_PROMPT

        for intent in ["sql_query", "analytics", "clarification", "greeting", "off_topic"]:
            assert intent in ROUTER_SYSTEM_PROMPT, f"Missing intent: {intent}"

    def test_contains_schema(self):
        from app.graph.prompts.router import ROUTER_SYSTEM_PROMPT

        assert "teams" in ROUTER_SYSTEM_PROMPT
        assert "events" in ROUTER_SYSTEM_PROMPT
        assert "event_results" in ROUTER_SYSTEM_PROMPT

    def test_contains_json_format_instruction(self):
        from app.graph.prompts.router import ROUTER_SYSTEM_PROMPT

        assert "JSON" in ROUTER_SYSTEM_PROMPT


class TestSQLAgentPrompt:

    def test_contains_schema(self):
        from app.graph.prompts.sql_agent import SQL_AGENT_SYSTEM_PROMPT

        assert "teams" in SQL_AGENT_SYSTEM_PROMPT
        assert "event_results" in SQL_AGENT_SYSTEM_PROMPT
        assert "events" in SQL_AGENT_SYSTEM_PROMPT

    def test_contains_safety_rules(self):
        from app.graph.prompts.sql_agent import SQL_AGENT_SYSTEM_PROMPT

        assert "SELECT" in SQL_AGENT_SYSTEM_PROMPT
        # Should mention not to INSERT/UPDATE/DELETE
        assert "INSERT" in SQL_AGENT_SYSTEM_PROMPT

    def test_contains_examples(self):
        from app.graph.prompts.sql_agent import SQL_AGENT_SYSTEM_PROMPT

        assert "EXAMPLES" in SQL_AGENT_SYSTEM_PROMPT or "Example" in SQL_AGENT_SYSTEM_PROMPT

    def test_contains_json_format(self):
        from app.graph.prompts.sql_agent import SQL_AGENT_SYSTEM_PROMPT

        assert '"sql"' in SQL_AGENT_SYSTEM_PROMPT


class TestAnalyticsPrompt:

    def test_contains_schema(self):
        from app.graph.prompts.analytics import ANALYTICS_SYSTEM_PROMPT

        assert "teams" in ANALYTICS_SYSTEM_PROMPT
        assert "event_results" in ANALYTICS_SYSTEM_PROMPT

    def test_mentions_pandas(self):
        from app.graph.prompts.analytics import ANALYTICS_SYSTEM_PROMPT

        assert "pandas" in ANALYTICS_SYSTEM_PROMPT or "DataFrame" in ANALYTICS_SYSTEM_PROMPT

    def test_mentions_result_variable(self):
        from app.graph.prompts.analytics import ANALYTICS_SYSTEM_PROMPT

        assert "result" in ANALYTICS_SYSTEM_PROMPT

    def test_contains_examples(self):
        from app.graph.prompts.analytics import ANALYTICS_SYSTEM_PROMPT

        assert "std" in ANALYTICS_SYSTEM_PROMPT.lower() or "deviation" in ANALYTICS_SYSTEM_PROMPT.lower()


class TestFormatterPrompt:

    def test_contains_chart_types(self):
        from app.graph.prompts.formatter import FORMATTER_SYSTEM_PROMPT

        assert "bar" in FORMATTER_SYSTEM_PROMPT
        assert "line" in FORMATTER_SYSTEM_PROMPT
        assert "pie" in FORMATTER_SYSTEM_PROMPT

    def test_contains_followup_instruction(self):
        from app.graph.prompts.formatter import FORMATTER_SYSTEM_PROMPT

        assert "follow-up" in FORMATTER_SYSTEM_PROMPT.lower() or "followup" in FORMATTER_SYSTEM_PROMPT.lower()

    def test_contains_json_format(self):
        from app.graph.prompts.formatter import FORMATTER_SYSTEM_PROMPT

        assert '"text"' in FORMATTER_SYSTEM_PROMPT
        assert '"chart"' in FORMATTER_SYSTEM_PROMPT

    def test_analytics_formatter_exists(self):
        from app.graph.prompts.formatter import ANALYTICS_FORMATTER_SYSTEM_PROMPT

        assert len(ANALYTICS_FORMATTER_SYSTEM_PROMPT) > 50
