from pydantic import BaseSettings

class Settings(BaseSettings):
    RESEND_API_KEY: str
    RESEND_FROM: str
    PORT: int = 8000
    DEBUG: bool = True
    OTP_TTL_SECONDS: int = 300
    ENV_FILE: str = ".env"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
