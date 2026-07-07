import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import Product
from app.routers import auth, catalog, metrics, recommendations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Азбука Вкуса · Динамическое ценообразование",
    description="Демонстрационный контур системы ценовых рекомендаций (пилот)",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(recommendations.router)
app.include_router(metrics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if db.scalars(select(Product).limit(1)).first() is None:
            logger.info("База пуста — генерируем демо-данные (~130 дней истории)...")
            from seed.generate import seed_database

            seed_database(db)
            logger.info("Демо-данные загружены")
    finally:
        db.close()
