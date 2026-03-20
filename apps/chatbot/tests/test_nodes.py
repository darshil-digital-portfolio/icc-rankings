"""Tests for individual graph nodes (router, sql_agent, formatter, analytics)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest
from langchain_core.messages import AIMessage, HumanMessage

from app.graph.nodes.analytics import _execute_pandas_code
from app.graph.nodes.formatter import formatter_node, greeting_node, off_topic_node


# ──────────────────────────────────────────────────────────────────────────────
# Router node
# ──────────────────────────────────────────────────────────────────────────────


class TestRouterNode:

    @pytest.mark.asyncio
    async def test_classifies_sql_query(self, mock_llm_response):
        response = mock_llm_response('{"intent": "sql_query", "reasoning": "wants data"}')
        with patch("app.graph.nodes.router._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.router import router_node

            result = await router_node({
                "messages": [HumanMessage(content="What team has the most points?")]
            })
            assert result["intent"] == "sql_query"

    @pytest.mark.asyncio
    async def test_classifies_greeting(self, mock_llm_response):
        response = mock_llm_response('{"intent": "greeting", "reasoning": "hello"}')
        with patch("app.graph.nodes.router._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.router import router_node

            result = await router_node({
                "messages": [HumanMessage(content="Hello!")]
            })
            assert result["intent"] == "greeting"

    @pytest.mark.asyncio
    async def test_classifies_clarification(self, mock_llm_response):
        response = mock_llm_response(
            '{"intent": "clarification", "reasoning": "ambiguous", '
            '"clarification_question": "Which team do you mean?"}'
        )
        with patch("app.graph.nodes.router._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.router import router_node

            result = await router_node({
                "messages": [HumanMessage(content="Tell me about the team")]
            })
            assert result["intent"] == "clarification"
            assert "Which team" in result["response_text"]

    @pytest.mark.asyncio
    async def test_handles_malformed_json(self, mock_llm_response):
        response = mock_llm_response("not json at all")
        with patch("app.graph.nodes.router._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.router import router_node

            result = await router_node({
                "messages": [HumanMessage(content="Hello")]
            })
            # Falls back to sql_query
            assert result["intent"] == "sql_query"

    @pytest.mark.asyncio
    async def test_handles_empty_messages(self):
        from app.graph.nodes.router import router_node

        result = await router_node({"messages": []})
        assert result["intent"] == "off_topic"

    @pytest.mark.asyncio
    async def test_strips_markdown_code_fences(self, mock_llm_response):
        response = mock_llm_response('```json\n{"intent": "analytics", "reasoning": "stats"}\n```')
        with patch("app.graph.nodes.router._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.router import router_node

            result = await router_node({
                "messages": [HumanMessage(content="What is the std dev?")]
            })
            assert result["intent"] == "analytics"


# ──────────────────────────────────────────────────────────────────────────────
# SQL Agent node
# ──────────────────────────────────────────────────────────────────────────────


class TestSQLAgentNode:

    @pytest.mark.asyncio
    async def test_generates_and_executes_sql(self, mock_llm_response, sample_query_result):
        response = mock_llm_response(json.dumps({
            "sql": "SELECT name, total_points FROM teams ORDER BY total_points DESC",
            "explanation": "Top teams by points",
        }))
        with (
            patch("app.graph.nodes.sql_agent._get_llm") as mock_get,
            patch("app.graph.nodes.sql_agent.execute_query", new_callable=AsyncMock) as mock_exec,
        ):
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm
            mock_exec.return_value = sample_query_result

            from app.graph.nodes.sql_agent import sql_agent_node

            result = await sql_agent_node({
                "messages": [HumanMessage(content="Top teams by points")]
            })
            assert result["error"] == ""
            assert len(result["query_result"]) == 3
            assert "SELECT" in result["sql_query"]

    @pytest.mark.asyncio
    async def test_rejects_unsafe_sql(self, mock_llm_response):
        response = mock_llm_response(json.dumps({
            "sql": "DROP TABLE teams",
            "explanation": "drop it",
        }))
        with patch("app.graph.nodes.sql_agent._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.sql_agent import sql_agent_node

            result = await sql_agent_node({
                "messages": [HumanMessage(content="Drop the teams table")]
            })
            assert result["error"]  # Should have an error
            assert result["query_result"] == []

    @pytest.mark.asyncio
    async def test_handles_db_error(self, mock_llm_response):
        response = mock_llm_response(json.dumps({
            "sql": "SELECT * FROM teams",
            "explanation": "get teams",
        }))
        with (
            patch("app.graph.nodes.sql_agent._get_llm") as mock_get,
            patch("app.graph.nodes.sql_agent.execute_query", new_callable=AsyncMock) as mock_exec,
        ):
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm
            mock_exec.side_effect = RuntimeError("connection refused")

            from app.graph.nodes.sql_agent import sql_agent_node

            result = await sql_agent_node({
                "messages": [HumanMessage(content="Show teams")]
            })
            assert "failed" in result["error"].lower() or "connection" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_handles_malformed_llm_response(self, mock_llm_response):
        response = mock_llm_response("I can't generate SQL for that")
        with patch("app.graph.nodes.sql_agent._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            from app.graph.nodes.sql_agent import sql_agent_node

            result = await sql_agent_node({
                "messages": [HumanMessage(content="nonsense")]
            })
            assert result["error"]
            assert result["query_result"] == []

    @pytest.mark.asyncio
    async def test_handles_empty_messages(self):
        from app.graph.nodes.sql_agent import sql_agent_node

        result = await sql_agent_node({"messages": []})
        assert result["error"]


# ──────────────────────────────────────────────────────────────────────────────
# Formatter node
# ──────────────────────────────────────────────────────────────────────────────


class TestFormatterNode:

    @pytest.mark.asyncio
    async def test_formats_error(self):
        result = await formatter_node({"error": "Query timed out"})
        assert "timed out" in result["response_text"]
        assert len(result["followup_suggestions"]) > 0

    @pytest.mark.asyncio
    async def test_formats_data(self, mock_llm_response, sample_query_result):
        response = mock_llm_response(json.dumps({
            "text": "Here are the top teams:\n| Team | Points |\n|---|---|\n| Australia | 320 |",
            "chart": {
                "chart_type": "bar",
                "data": [{"label": "Australia", "value": 320}],
                "x_key": "label",
                "y_key": "value",
                "title": "Top Teams",
                "x_label": "Team",
                "y_label": "Points",
            },
            "followup_suggestions": ["Show breakdown?"],
        }))
        with patch("app.graph.nodes.formatter._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            result = await formatter_node({
                "error": "",
                "intent": "sql_query",
                "query_result": sample_query_result,
                "analysis_result": "",
                "messages": [HumanMessage(content="Top teams?")],
            })
            assert "top teams" in result["response_text"].lower()
            assert result["chart_spec"] is not None
            assert result["chart_spec"]["chart_type"] == "bar"

    @pytest.mark.asyncio
    async def test_handles_malformed_formatter_response(self, mock_llm_response):
        response = mock_llm_response("Just a plain text response, no JSON.")
        with patch("app.graph.nodes.formatter._get_llm") as mock_get:
            mock_llm = AsyncMock()
            mock_llm.ainvoke = AsyncMock(return_value=response)
            mock_get.return_value = mock_llm

            result = await formatter_node({
                "error": "",
                "intent": "sql_query",
                "query_result": [{"name": "India"}],
                "analysis_result": "",
                "messages": [HumanMessage(content="Teams?")],
            })
            # Falls back to raw text
            assert "plain text response" in result["response_text"]


# ──────────────────────────────────────────────────────────────────────────────
# Greeting and Off-topic nodes
# ──────────────────────────────────────────────────────────────────────────────


class TestStaticNodes:

    @pytest.mark.asyncio
    async def test_greeting_response(self):
        result = await greeting_node({})
        assert "Twelfth Man" in result["response_text"]
        assert len(result["followup_suggestions"]) == 3

    @pytest.mark.asyncio
    async def test_off_topic_response(self):
        result = await off_topic_node({})
        assert "outside my crease" in result["response_text"]
        assert len(result["followup_suggestions"]) == 3


# ──────────────────────────────────────────────────────────────────────────────
# Pandas sandbox (_execute_pandas_code)
# ──────────────────────────────────────────────────────────────────────────────


class TestPandasSandbox:

    def test_basic_computation(self):
        df = pd.DataFrame({"points": [10, 20, 30]})
        code = "result = df['points'].mean()"
        result = _execute_pandas_code(code, df)
        assert result == 20.0

    def test_std_dev(self):
        df = pd.DataFrame({"points": [10, 20, 30, 40]})
        code = "result = round(df['points'].std(), 2)"
        result = _execute_pandas_code(code, df)
        assert isinstance(result, float)

    def test_groupby_aggregation(self):
        df = pd.DataFrame({
            "team": ["india", "india", "australia", "australia"],
            "points": [10, 20, 30, 40],
        })
        code = "result = df.groupby('team')['points'].sum().to_dict()"
        result = _execute_pandas_code(code, df)
        assert result["india"] == 30
        assert result["australia"] == 70

    def test_cumulative_sum(self):
        df = pd.DataFrame({"points": [10, 20, 30]})
        code = "df['cumulative'] = df['points'].cumsum()\nresult = df['cumulative'].tolist()"
        result = _execute_pandas_code(code, df)
        assert result == [10, 30, 60]

    def test_percentage_change(self):
        df = pd.DataFrame({"year": [2010, 2020], "points": [100, 150]})
        code = "result = ((df['points'].iloc[-1] - df['points'].iloc[0]) / df['points'].iloc[0] * 100)"
        result = _execute_pandas_code(code, df)
        assert result == 50.0

    def test_dict_result(self):
        df = pd.DataFrame({"a": [1, 2, 3]})
        code = "result = {'mean': df['a'].mean(), 'sum': df['a'].sum()}"
        result = _execute_pandas_code(code, df)
        assert result["mean"] == 2.0
        assert result["sum"] == 6

    def test_dataframe_result(self):
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        code = "result = df.describe()"
        result = _execute_pandas_code(code, df)
        assert isinstance(result, pd.DataFrame)

    def test_missing_result_variable(self):
        df = pd.DataFrame({"a": [1]})
        code = "x = 42"
        with pytest.raises(RuntimeError, match="result"):
            _execute_pandas_code(code, df)

    def test_syntax_error(self):
        df = pd.DataFrame({"a": [1]})
        code = "result = def bad_syntax"
        with pytest.raises(RuntimeError, match="failed"):
            _execute_pandas_code(code, df)

    def test_runtime_error(self):
        df = pd.DataFrame({"a": [1]})
        code = "result = df['nonexistent_column'].mean()"
        with pytest.raises(RuntimeError, match="failed"):
            _execute_pandas_code(code, df)

    def test_no_file_io(self):
        df = pd.DataFrame({"a": [1]})
        code = "result = open('/etc/passwd').read()"
        with pytest.raises(RuntimeError):
            _execute_pandas_code(code, df)

    def test_no_os_import(self):
        df = pd.DataFrame({"a": [1]})
        code = "import os; result = os.listdir('/')"
        with pytest.raises(RuntimeError):
            _execute_pandas_code(code, df)

    def test_no_subprocess(self):
        df = pd.DataFrame({"a": [1]})
        code = "import subprocess; result = subprocess.run(['ls'])"
        with pytest.raises(RuntimeError):
            _execute_pandas_code(code, df)

    def test_original_df_not_mutated(self):
        df = pd.DataFrame({"a": [1, 2, 3]})
        original_values = df["a"].tolist()
        code = "df['a'] = df['a'] * 100\nresult = df['a'].tolist()"
        result = _execute_pandas_code(code, df)
        assert result == [100, 200, 300]
        assert df["a"].tolist() == original_values  # Original unchanged

    def test_numpy_available(self):
        df = pd.DataFrame({"a": [1, 4, 9]})
        code = "result = np.sqrt(df['a']).tolist()"
        result = _execute_pandas_code(code, df)
        assert result == [1.0, 2.0, 3.0]

    def test_empty_dataframe(self):
        df = pd.DataFrame({"a": []})
        code = "result = len(df)"
        result = _execute_pandas_code(code, df)
        assert result == 0
