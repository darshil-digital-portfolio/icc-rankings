"""Tests for Pydantic request/response models."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.models import (
    ChartSpec,
    ChatRequest,
    ChatResponse,
    HistoryMessage,
    HistoryResponse,
)


# ──────────────────────────────────────────────────────────────────────────────
# ChatRequest
# ──────────────────────────────────────────────────────────────────────────────


class TestChatRequest:

    def test_valid_request(self):
        req = ChatRequest(message="Hello", session_id="abc-123")
        assert req.message == "Hello"
        assert req.session_id == "abc-123"

    def test_empty_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="", session_id="abc")

    def test_empty_session_id_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="Hello", session_id="")

    def test_message_max_length(self):
        long_msg = "a" * 2000
        req = ChatRequest(message=long_msg, session_id="abc")
        assert len(req.message) == 2000

    def test_message_exceeds_max_length(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="a" * 2001, session_id="abc")

    def test_session_id_max_length(self):
        long_sid = "x" * 128
        req = ChatRequest(message="hi", session_id=long_sid)
        assert len(req.session_id) == 128

    def test_session_id_exceeds_max_length(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="hi", session_id="x" * 129)

    def test_whitespace_message_is_valid(self):
        # Single space is min_length=1, so it's valid at model level.
        req = ChatRequest(message=" ", session_id="abc")
        assert req.message == " "


# ──────────────────────────────────────────────────────────────────────────────
# ChartSpec
# ──────────────────────────────────────────────────────────────────────────────


class TestChartSpec:

    def test_valid_bar_chart(self):
        spec = ChartSpec(
            chart_type="bar",
            data=[{"label": "India", "value": 280}],
            x_key="label",
            y_key="value",
            title="Top Teams",
        )
        assert spec.chart_type == "bar"
        assert len(spec.data) == 1

    def test_valid_line_chart(self):
        spec = ChartSpec(
            chart_type="line",
            data=[{"year": 2020, "points": 40}, {"year": 2021, "points": 55}],
            x_key="year",
            y_key="points",
        )
        assert spec.chart_type == "line"
        assert spec.title == ""  # Default

    def test_valid_pie_chart(self):
        spec = ChartSpec(
            chart_type="pie",
            data=[{"name": "Group", "value": 30}, {"name": "Champion", "value": 70}],
            x_key="name",
            y_key="value",
        )
        assert spec.chart_type == "pie"

    def test_defaults(self):
        spec = ChartSpec(
            chart_type="bar",
            data=[],
            x_key="x",
            y_key="y",
        )
        assert spec.title == ""
        assert spec.x_label == ""
        assert spec.y_label == ""

    def test_empty_data_is_valid(self):
        spec = ChartSpec(chart_type="bar", data=[], x_key="x", y_key="y")
        assert spec.data == []


# ──────────────────────────────────────────────────────────────────────────────
# ChatResponse
# ──────────────────────────────────────────────────────────────────────────────


class TestChatResponse:

    def test_text_only_response(self):
        resp = ChatResponse(text="Here are the rankings", session_id="abc")
        assert resp.chart is None
        assert resp.followup_suggestions == []

    def test_response_with_chart(self):
        chart = ChartSpec(
            chart_type="bar",
            data=[{"label": "India", "value": 280}],
            x_key="label",
            y_key="value",
        )
        resp = ChatResponse(
            text="Top teams",
            chart=chart,
            followup_suggestions=["Show more?"],
            session_id="abc",
        )
        assert resp.chart is not None
        assert resp.chart.chart_type == "bar"
        assert len(resp.followup_suggestions) == 1

    def test_serialization_roundtrip(self):
        resp = ChatResponse(
            text="Hello",
            followup_suggestions=["Q1", "Q2"],
            session_id="abc",
        )
        data = resp.model_dump()
        reconstructed = ChatResponse(**data)
        assert reconstructed.text == resp.text
        assert reconstructed.followup_suggestions == resp.followup_suggestions


# ──────────────────────────────────────────────────────────────────────────────
# HistoryMessage and HistoryResponse
# ──────────────────────────────────────────────────────────────────────────────


class TestHistoryModels:

    def test_history_message(self):
        msg = HistoryMessage(
            role="user",
            text="Hello",
            timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        assert msg.role == "user"
        assert msg.chart is None

    def test_history_message_with_chart(self):
        chart = ChartSpec(
            chart_type="line",
            data=[{"x": 1, "y": 2}],
            x_key="x",
            y_key="y",
        )
        msg = HistoryMessage(
            role="assistant",
            text="Chart data",
            chart=chart,
            timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        assert msg.chart is not None

    def test_history_response(self):
        resp = HistoryResponse(session_id="abc", messages=[])
        assert resp.messages == []

    def test_history_response_with_messages(self):
        msgs = [
            HistoryMessage(
                role="user",
                text="Hi",
                timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
            ),
            HistoryMessage(
                role="assistant",
                text="Hello!",
                timestamp=datetime(2025, 1, 1, 0, 0, 1, tzinfo=timezone.utc),
            ),
        ]
        resp = HistoryResponse(session_id="abc", messages=msgs)
        assert len(resp.messages) == 2
        assert resp.messages[0].role == "user"
        assert resp.messages[1].role == "assistant"
