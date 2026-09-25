from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App-wide settings, loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",          # load vars from backend/.env
        env_file_encoding="utf-8",
        extra="ignore",           # ignore unknown vars in .env
    )

    # GitHub API token (needed to raise rate limits for private repos)
    GITHUB_TOKEN: str = ""

    # LLM provider settings (works with OpenAI, Groq, Ollama, etc.)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_VISION_MODEL: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # SQLite database file path
    DATABASE_URL: str = "sqlite:///./reviews.db"


# Single shared instance — import this everywhere instead of re-reading env
settings = Settings()