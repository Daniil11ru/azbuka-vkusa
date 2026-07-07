from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics import sku_mape
from app.cache import cache_get, cache_set
from app.config import settings
from app.db import get_db
from app.models import Category, PriceRecommendation, Product, User
from app.schemas import MetricsOut
from app.security import get_current_user

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics", response_model=MetricsOut)
def metrics(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cached = cache_get("metrics:v1")
    if cached:
        return cached

    categories = db.scalars(select(Category).order_by(Category.category_id)).all()
    category_mape = []
    sku_total, manual = 0, 0
    for category in categories:
        skus = db.scalars(
            select(Product.sku_id).where(Product.category_id == category.category_id)
        ).all()
        mapes = [sku_mape(s, 1) for s in skus]
        sku_total += len(skus)
        manual += sum(1 for m in mapes if m > 0.20)
        category_mape.append({
            "category": category.name,
            "mape": round(sum(mapes) / len(mapes) * 100, 1) if mapes else 0.0,
            "sku_count": len(skus),
        })

    decided = db.scalar(
        select(func.count()).select_from(PriceRecommendation)
        .where(PriceRecommendation.status.in_(["approved", "rejected", "exported"]))
    ) or 0
    approved = db.scalar(
        select(func.count()).select_from(PriceRecommendation)
        .where(PriceRecommendation.status.in_(["approved", "exported"]))
    ) or 0

    # дата последнего еженедельного переобучения (понедельник)
    today = date.today()
    trained_at = today - timedelta(days=today.weekday())

    result = {
        "model_version": settings.model_version,
        "model_mape": 10.8,  # значение с пилотной валидации (ВКР, таблица 3.9)
        "trained_at": trained_at,
        "next_retrain_at": trained_at + timedelta(days=7),
        "sku_total": sku_total,
        "sku_manual_review": manual,
        "approved_share_pct": round(approved / decided * 100, 1) if decided else 0.0,
        "category_mape": category_mape,
    }
    cache_set("metrics:v1", result, ttl_seconds=120)
    return result
