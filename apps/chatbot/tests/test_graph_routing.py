"""Tests for the LangGraph routing logic and graph structure."""

import pytest
from langgraph.graph import END

from app.graph.graph import build_graph, route_by_intent


# ──────────────────────────────────────────────────────────────────────────────
# route_by_intent
# ──────────────────────────────────────────────────────────────────────────────


class TestRouteByIntent:
    """Test the conditional routing function."""

    def test_sql_query_routes_to_sql_agent(self):
        assert route_by_intent({"intent": "sql_query"}) == "sql_agent"

    def test_analytics_routes_to_analytics(self):
        assert route_by_intent({"intent": "analytics"}) == "analytics"

    def test_clarification_routes_to_end(self):
        assert route_by_intent({"intent": "clarification"}) == END

    def test_greeting_routes_to_greeting(self):
        assert route_by_intent({"intent": "greeting"}) == "greeting"

    def test_off_topic_routes_to_off_topic(self):
        assert route_by_intent({"intent": "off_topic"}) == "off_topic"

    def test_unknown_intent_defaults_to_off_topic(self):
        assert route_by_intent({"intent": "something_weird"}) == "off_topic"

    def test_missing_intent_defaults_to_off_topic(self):
        assert route_by_intent({}) == "off_topic"

    def test_empty_intent_defaults_to_off_topic(self):
        assert route_by_intent({"intent": ""}) == "off_topic"


# ──────────────────────────────────────────────────────────────────────────────
# Graph structure
# ──────────────────────────────────────────────────────────────────────────────


class TestGraphStructure:
    """Verify the graph compiles and has expected nodes/edges."""

    def test_graph_builds_without_error(self):
        graph = build_graph()
        assert graph is not None

    def test_graph_compiles(self):
        graph = build_graph()
        compiled = graph.compile()
        assert compiled is not None

    def test_graph_has_all_nodes(self):
        graph = build_graph()
        compiled = graph.compile()
        # LangGraph exposes nodes in the graph's internal representation.
        graph_dict = compiled.get_graph().to_json()
        node_ids = [n["id"] for n in graph_dict["nodes"]]
        for expected_node in ["router", "sql_agent", "analytics", "formatter", "greeting", "off_topic"]:
            assert expected_node in node_ids, f"Missing node: {expected_node}"
