from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1, max_length=128)


class ChartSpec(BaseModel):
    chart_type: str  # "bar", "line", "pie"
    data: list[dict[str, Any]]
    x_key: str
    y_key: str
    title: str = ""
    x_label: str = ""
    y_label: str = ""


class ChatResponse(BaseModel):
    text: str
    chart: ChartSpec | None = None
    followup_suggestions: list[str] = Field(default_factory=list)
    session_id: str


class HistoryMessage(BaseModel):
    role: str  # "user" or "assistant"
    text: str
    chart: ChartSpec | None = None
    timestamp: datetime


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]


# ─── User / preferences models ────────────────────────────────────────────────


class UserPreferences(BaseModel):
    theme: str | None = None  # "dark", "light", or null
    event_filters: list[str] = Field(default_factory=list)


class UserProfile(BaseModel):
    google_sub: str
    email: str
    name: str
    picture: str
    preferences: UserPreferences
    is_admin: bool
    is_new_user: bool = False


class UpdatePreferencesRequest(BaseModel):
    theme: str | None = None
    event_filters: list[str] | None = None
