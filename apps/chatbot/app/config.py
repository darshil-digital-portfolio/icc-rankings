from pydantic_settings import BaseSettings


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

    # LLM models
    router_model: str = "claude-haiku-4-5-20251001"
    sql_model: str = "claude-sonnet-4-20250514"
    analytics_model: str = "claude-sonnet-4-20250514"
    formatter_model: str = "claude-haiku-4-5-20251001"

    # Guardrails
    max_query_rows: int = 100
    query_timeout_seconds: int = 5

    # Conversation
    context_window_messages: int = 10
    history_retention_days: int = 90

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
