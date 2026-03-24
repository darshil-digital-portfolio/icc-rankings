from pydantic import model_validator
from pydantic_settings import BaseSettings

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-20250514"


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""

    # PostgreSQL (read-only)
    database_url: str = (
        "postgresql://icc_readonly:icc_readonly_secret@localhost:5432/icc_ranking"
    )

    # MongoDB
    mongo_url: str = "mongodb://localhost:47017"
    mongo_db: str = "icc_ranking"

    # Server
    host: str = "0.0.0.0"
    port: int = 8100

    # Environment — controls default model tier
    app_env: str = "development"  # "development" | "production"

    # LLM models — empty string means "use env-based default"
    router_model: str = ""
    sql_model: str = ""
    analytics_model: str = ""
    formatter_model: str = ""

    # Guardrails
    max_query_rows: int = 100
    query_timeout_seconds: int = 5

    # Conversation
    context_window_messages: int = 10
    history_retention_days: int = 90

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def _apply_env_model_defaults(self) -> "Settings":
        is_prod = self.app_env == "production"
        if not self.router_model:
            self.router_model = HAIKU
        if not self.sql_model:
            self.sql_model = SONNET if is_prod else HAIKU
        if not self.analytics_model:
            self.analytics_model = SONNET if is_prod else HAIKU
        if not self.formatter_model:
            self.formatter_model = HAIKU
        return self


settings = Settings()
