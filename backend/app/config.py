import os


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://pricing:pricing@localhost:5432/pricing",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    jwt_secret: str = os.getenv("JWT_SECRET", "demo-secret-not-for-production")
    jwt_ttl_hours: int = int(os.getenv("JWT_TTL_HOURS", "12"))
    model_version: str = os.getenv("MODEL_VERSION", "catboost-2026.06.28-r3")


settings = Settings()
