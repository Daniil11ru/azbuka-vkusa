from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics import sku_mape
from app.cache import cache_get, cache_set
from app.db import get_db
from app.models import Category, Product, PromoCalendar, SalesDaily, StockDaily, Store, User
from app.schemas import CategoryOut, ProductOut, StoreOut
from app.security import get_current_user

router = APIRouter(prefix="/api", tags=["catalog"])

DEFAULT_STORE_ID = 1


def _product_signals(db: Session, product: Product, store_id: int) -> dict:
    """Сигналы для списка SKU: спрос за 7/28 дней, остаток, промо, MAPE."""
    today = date.today()
    mean = {}
    for days in (7, 28):
        mean[days] = db.scalar(
            select(func.avg(SalesDaily.qty)).where(
                SalesDaily.sku_id == product.sku_id,
                SalesDaily.store_id == store_id,
                SalesDaily.date >= today - timedelta(days=days),
                SalesDaily.qty > 0,
            )
        ) or 0.0
    trend_pct = (mean[7] - mean[28]) / mean[28] * 100 if mean[28] else 0.0

    last_price = db.scalar(
        select(SalesDaily.price)
        .where(SalesDaily.sku_id == product.sku_id, SalesDaily.store_id == store_id)
        .order_by(SalesDaily.date.desc())
        .limit(1)
    ) or product.base_price

    stock = db.scalar(
        select(StockDaily.stock_qty)
        .where(StockDaily.sku_id == product.sku_id, StockDaily.store_id == store_id)
        .order_by(StockDaily.date.desc())
        .limit(1)
    ) or 0.0
    cover = stock / mean[28] if mean[28] else 0.0

    promo_now = db.scalar(
        select(func.count()).select_from(PromoCalendar).where(
            PromoCalendar.sku_id == product.sku_id,
            PromoCalendar.date_from <= today + timedelta(days=1),
            PromoCalendar.date_to >= today + timedelta(days=1),
        )
    ) or 0

    mape = sku_mape(product.sku_id, store_id)

    signals = []
    if trend_pct <= -10:
        signals.append("падение спроса")
    elif trend_pct >= 10:
        signals.append("рост спроса")
    if cover >= 3.5:
        signals.append("высокий запас")
    if product.shelf_life_days <= 2 and cover > 2.5:
        signals.append("риск списаний")
    if promo_now:
        signals.append("промо")
    if mape > 0.20:
        signals.append("ручная проверка")

    return {
        "current_price": round(float(last_price), 2),
        "mean_7": round(mean[7], 1),
        "trend_pct": round(trend_pct, 1),
        "stock_qty": round(stock, 0),
        "stock_cover_days": round(cover, 1),
        "model_mape": mape,
        "signals": signals,
    }


@router.get("/stores", response_model=list[StoreOut])
def list_stores(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Store).order_by(Store.store_id)).all()


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cached = cache_get("categories:v1")
    if cached:
        return cached

    result = []
    for category in db.scalars(select(Category).order_by(Category.category_id)).all():
        products = db.scalars(
            select(Product).where(Product.category_id == category.category_id)
        ).all()
        needs_attention, write_off_risk, mapes = 0, 0, []
        for p in products:
            info = _product_signals(db, p, DEFAULT_STORE_ID)
            mapes.append(info["model_mape"])
            if info["signals"]:
                needs_attention += 1
            if "риск списаний" in info["signals"]:
                write_off_risk += 1
        result.append({
            "category_id": category.category_id,
            "name": category.name,
            "icon": category.icon,
            "sku_count": len(products),
            "needs_attention": needs_attention,
            "write_off_risk": write_off_risk,
            "avg_mape": round(sum(mapes) / len(mapes), 3) if mapes else 0.0,
        })

    cache_set("categories:v1", result, ttl_seconds=600)
    return result


@router.get("/products", response_model=list[ProductOut])
def list_products(
    category_id: int,
    store_id: int = DEFAULT_STORE_ID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"products:v1:{category_id}:{store_id}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    products = db.scalars(
        select(Product)
        .where(Product.category_id == category_id, Product.in_dynamic_pricing)
        .order_by(Product.sku_name)
    ).all()
    result = []
    for p in products:
        info = _product_signals(db, p, store_id)
        result.append({
            "sku_id": p.sku_id,
            "sku_name": p.sku_name,
            "brand": p.brand,
            "is_private_label": p.is_private_label,
            "shelf_life_days": p.shelf_life_days,
            **info,
        })

    cache_set(cache_key, result, ttl_seconds=600)
    return result
