import os
from typing import List, Union

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql://perksu:perksu_secret_2024@localhost:5432/perksu"
    )

    # Frontend URL (for constructing invite links)
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # JWT Settings
    secret_key: str = os.getenv(
        "SECRET_KEY", "perksu-super-secret-key-change-in-production"
    )
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )

    # Tenant Settings
    default_invite_expiry_hours: int = int(
        os.getenv("DEFAULT_INVITE_EXPIRY_HOURS", "168")
    )

    # CORS - accept string or list
    cors_origins: Union[str, List[str]] = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5180"
    )

    # SMTP Settings
    smtp_email: str = os.getenv("SMTP_EMAIL", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))

    # Aggregator / Voucher provider settings
    aggregator_provider: str = os.getenv(
        "AGGREGATOR_PROVIDER", "mock"
    )  # mock | tangocard | xoxoday
    tango_api_base: str = os.getenv("TANGO_API_BASE", "https://api.tangocard.com")
    tango_api_key: str = os.getenv("TANGO_API_KEY", "")
    tango_account_identifier: str = os.getenv("TANGO_ACCOUNT_ID", "")
    xoxoday_api_key: str = os.getenv("XOXODAY_API_KEY", "")
    xoxoday_api_base: str = os.getenv("XOXODAY_API_BASE", "https://api.xoxoday.com")
    # Celery / Redis
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    celery_result_backend: str = os.getenv("CELERY_RESULT_BACKEND", celery_broker_url)

    # SMS (Twilio or generic provider)
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_from_number: str = os.getenv("TWILIO_FROM_NUMBER", "")
    sms_api_url: str = os.getenv("SMS_API_URL", "")
    sms_api_key: str = os.getenv("SMS_API_KEY", "")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
