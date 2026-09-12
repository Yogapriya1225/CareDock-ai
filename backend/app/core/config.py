"""
Application configuration loaded from environment variables (.env).
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://caredock:caredock@localhost:5432/caredock_db"
    JWT_SECRET_KEY: str = "change_this_secret_key_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma3"

    ESP32_SHARED_SECRET: str = "change_this_device_secret"

    class Config:
        env_file = ".env"


settings = Settings()
