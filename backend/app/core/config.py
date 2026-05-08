import json
from pydantic import AliasChoices, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = Field(default="DressMe API", alias="BACKEND_APP_NAME")
    env: str = Field(default="development", alias="BACKEND_ENV")
    debug: bool = Field(default=True, alias="BACKEND_DEBUG")
    secret_key: str = Field(
        default="change-me-replace-with-a-strong-random-secret",
        validation_alias=AliasChoices("BACKEND_SECRET_KEY", "JWT_SECRET_KEY"),
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60,
        validation_alias=AliasChoices(
            "BACKEND_ACCESS_TOKEN_EXPIRE_MINUTES",
            "ACCESS_TOKEN_EXPIRE_MINUTES",
        ),
    )
    refresh_token_expire_days: int = Field(
        default=7, alias="BACKEND_REFRESH_TOKEN_EXPIRE_DAYS"
    )

    mongodb_url: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URL")
    mongodb_db_name: str = Field(default="dressmechat", alias="MONGODB_DB_NAME")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")

    auto_create_indexes: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "BACKEND_AUTO_CREATE_INDEXES",
            "BACKEND_AUTO_CREATE_TABLES",
            "AUTO_CREATE_TABLES",
        ),
    )
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    api_base_url: str = Field(default="http://localhost:8000", alias="API_BASE_URL")
    frontend_url: str = Field(default="http://localhost:8081", alias="FRONTEND_URL")
    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")
    media_upload_max_mb: int = Field(default=50, alias="MEDIA_UPLOAD_MAX_MB")

    email_verification_token_expire_hours: int = Field(
        default=24, alias="EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS"
    )
    password_reset_token_expire_minutes: int = Field(
        default=30, alias="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES"
    )
    otp_expire_minutes: int = Field(default=5, alias="OTP_EXPIRE_MINUTES")
    otp_length: int = Field(default=6, ge=4, le=8, alias="OTP_LENGTH")

    smtp_host: str = Field(default="localhost", alias="SMTP_HOST")
    smtp_port: int = Field(default=1025, alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: EmailStr = Field(default="no-reply@dressme.app", alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(default="DressMe", alias="SMTP_FROM_NAME")
    smtp_use_tls: bool = Field(default=False, alias="SMTP_USE_TLS")
    smtp_timeout_seconds: int = Field(default=10, alias="SMTP_TIMEOUT_SECONDS")

    # Keep the raw env value to support comma-separated CORS origins.
    cors_origins_raw: str = Field(
        default="http://localhost:8081,http://localhost:19006",
        validation_alias=AliasChoices("CORS_ORIGINS", "BACKEND_CORS_ORIGINS"),
    )

    use_mock_ai: bool = Field(default=True, alias="USE_MOCK_AI")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    @property
    def cors_origins(self) -> list[str]:
        value = self.cors_origins_raw.strip()
        if value.startswith("["):
            try:
                parsed = json.loads(value)
            except Exception:
                pass
            else:
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [o.strip() for o in value.split(",") if o.strip()]


settings = Settings()
