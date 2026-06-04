from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    database_url: str = "sqlite:///./data/memory_market.db"
    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    app_timezone: str = "Asia/Shanghai"
    daily_run_cron_hour: int = 8
    daily_run_cron_minute: int = 30
    weekly_run_cron_day_of_week: str = "wednesday"
    weekly_run_cron_hour: int = 10
    weekly_run_cron_minute: int = 0

    serper_api_key: str | None = None
    serper_base_url: str = "https://google.serper.dev"
    serper_gl: str = "us"
    serper_hl: str = "en"
    serper_num_results: int = 10
    github_token: str | None = None

    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4.1-mini"
    anthropic_api_key: str | None = None
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-3-5-sonnet-latest"
    llm_provider: str = "openai"
    report_language: str = "zh-CN"
    admin_token: str | None = None


settings = Settings()
