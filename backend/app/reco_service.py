"""Сборка ценовой рекомендации: прогноз -> ценовая политика -> запись в БД."""

import json
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import build_factors, build_snapshot, sku_mape
from app.config import settings
from app.models import Category, PriceRecommendation, Product, Store
from app.pricing import PriceContext, recommend_price

REASON_LABELS = {
    "demand_based_adjustment": "корректировка по спросу",
    "risk_of_write_off": "риск списаний",
    "manual_review_high_error": "высокая ошибка прогноза",
    "promo_locked": "действующая промоакция",
}


def _fmt_pct(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


def _reason_text(code: str, change_pct: float, snapshot, product: Product) -> str:
    """Человеческое объяснение в формате из ВКР:
    «снижение на 5,4% из-за высокого запаса и падения недельного спроса»."""
    # причины подбираются согласованно с направлением изменения цены
    down_causes, up_causes = [], []
    if snapshot.trend_pct <= -8:
        down_causes.append("падения недельного спроса")
    elif snapshot.trend_pct >= 8:
        up_causes.append("роста недельного спроса")
    if snapshot.stock_cover_days >= 3:
        down_causes.append("высокого запаса")
    elif snapshot.stock_cover_days <= 1:
        up_causes.append("низкого остатка")
    if product.shelf_life_days <= 2 and snapshot.stock_cover_days > 1.5:
        down_causes.append("приближения срока годности")
    causes = down_causes if change_pct < 0 else up_causes

    if code == "promo_locked":
        return (f"Цена сохранена: до {snapshot.promo_depth * 100:.0f}% действует промоакция, "
                "пересмотр заблокирован до её завершения")
    if code == "manual_review_high_error":
        base = "Требуется ручная проверка: ошибка прогноза по позиции выше порога 20%"
        return base + (", " + " и ".join(causes) if causes else "")

    if abs(change_pct) < 0.5:
        return "Цена без изменений: спрос стабилен, ограничения не нарушены"
    direction = "Снижение" if change_pct < 0 else "Повышение"
    cause_text = " и ".join(causes) if causes else "отклонения прогноза спроса от базового уровня"
    return f"{direction} на {_fmt_pct(abs(change_pct))}% из-за {cause_text}"


def calculate_batch(db: Session, store_id: int, target_date: date,
                    sku_ids: list[int]) -> str:
    batch_id = str(uuid.uuid4())
    products = db.scalars(select(Product).where(Product.sku_id.in_(sku_ids))).all()

    for product in products:
        snapshot = build_snapshot(db, product.sku_id, store_id, target_date)
        mape = sku_mape(product.sku_id, store_id)
        category = db.get(Category, product.category_id)

        context = PriceContext(
            current_price=Decimal(str(snapshot.current_price)),
            purchase_price=Decimal(str(float(product.purchase_price))),
            min_margin=Decimal(str(product.min_margin)),
            forecast_qty=Decimal(str(snapshot.forecast_qty)),
            expected_qty=Decimal(str(snapshot.expected_qty)),
            elasticity=Decimal(str(category.elasticity)),
            shelf_life_days=product.shelf_life_days,
            stock_cover_days=Decimal(str(snapshot.stock_cover_days)),
            model_mape=Decimal(str(mape)),
            promo_active=snapshot.promo_active,
        )
        result = recommend_price(context)

        new_price = float(result.price)
        change_pct = (new_price - snapshot.current_price) / snapshot.current_price * 100 \
            if snapshot.current_price else 0.0
        purchase = float(product.purchase_price)

        db.add(PriceRecommendation(
            batch_id=batch_id,
            recommendation_date=target_date,
            sku_id=product.sku_id,
            store_id=store_id,
            model_version=settings.model_version,
            current_price=snapshot.current_price,
            recommended_price=new_price,
            forecast_qty=snapshot.forecast_qty,
            expected_qty=snapshot.expected_qty,
            expected_margin=round((new_price - purchase) / new_price, 4) if new_price else 0,
            current_margin=round((snapshot.current_price - purchase) / snapshot.current_price, 4)
            if snapshot.current_price else 0,
            price_lower=float(result.lower),
            price_upper=float(result.upper),
            stock_qty=snapshot.stock_qty,
            stock_cover_days=snapshot.stock_cover_days,
            model_mape=mape,
            status=result.status,
            reason_code=result.reason_code,
            reason=_reason_text(result.reason_code, change_pct, snapshot, product),
            constraints=json.dumps(result.constraints, ensure_ascii=False),
            factors=json.dumps(build_factors(snapshot, product.shelf_life_days),
                               ensure_ascii=False),
        ))

    db.commit()
    return batch_id


def recommendation_to_dict(rec: PriceRecommendation, product: Product,
                           category: Category) -> dict:
    current = float(rec.current_price)
    new = float(rec.recommended_price)
    return {
        "recommendation_id": rec.recommendation_id,
        "batch_id": rec.batch_id,
        "recommendation_date": rec.recommendation_date,
        "sku_id": rec.sku_id,
        "sku_name": product.sku_name,
        "category_name": category.name,
        "store_id": rec.store_id,
        "current_price": current,
        "recommended_price": new,
        "change_pct": round((new - current) / current * 100, 1) if current else 0.0,
        "forecast_qty": rec.forecast_qty,
        "expected_margin": rec.expected_margin,
        "model_mape": rec.model_mape,
        "status": rec.status,
        "reason_code": rec.reason_code,
        "reason": rec.reason,
    }


def build_detail(db: Session, rec: PriceRecommendation) -> dict:
    product = db.get(Product, rec.sku_id)
    category = db.get(Category, product.category_id)
    store = db.get(Store, rec.store_id)
    snapshot = build_snapshot(db, rec.sku_id, rec.store_id, rec.recommendation_date)

    series = [
        {"date": h["date"], "qty": h["qty"], "price": h["price"], "promo": h["promo"]}
        for h in snapshot.history
    ]
    series += [
        {"date": f["date"], "forecast_qty": f["qty"]}
        for f in snapshot.forecast
    ]

    current, new = float(rec.current_price), float(rec.recommended_price)
    purchase = float(product.purchase_price)
    revenue_current = round(current * rec.expected_qty, 0)
    revenue_recommended = round(new * rec.forecast_qty, 0)

    base = recommendation_to_dict(rec, product, category)
    base.update({
        "expected_qty": rec.expected_qty,
        "price_lower": float(rec.price_lower),
        "price_upper": float(rec.price_upper),
        "stock_qty": rec.stock_qty,
        "stock_cover_days": rec.stock_cover_days,
        "shelf_life_days": product.shelf_life_days,
        "brand": product.brand,
        "unit": product.unit,
        "store_name": store.name,
        "model_version": rec.model_version,
        "promo_active": snapshot.promo_active,
        "constraints": json.loads(rec.constraints),
        "factors": json.loads(rec.factors),
        "series": series,
        "financials": {
            "revenue_current": revenue_current,
            "revenue_recommended": revenue_recommended,
            "revenue_delta_pct": round(
                (revenue_recommended - revenue_current) / revenue_current * 100, 1
            ) if revenue_current else 0.0,
            "margin_current_pct": round(rec.current_margin * 100, 1),
            "margin_recommended_pct": round(rec.expected_margin * 100, 1),
            "profit_current": round((current - purchase) * rec.expected_qty, 0),
            "profit_recommended": round((new - purchase) * rec.forecast_qty, 0),
        },
        "created_at": rec.created_at,
    })
    return base
