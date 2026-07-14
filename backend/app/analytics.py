"""Аналитический контур: статистика продаж и мок-прогноз спроса.

Прогноз выделяет поведение модели CatBoost: берёт скользящее
среднее за 28 дней, поправку на день недели, тренд последних недель и
промо-фактор. Ошибка модели (MAPE) по SKU детерминирована — интерфейс
стабильно показывает одни и те же значения.
"""

import hashlib
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PromoCalendar, SalesDaily, StockDaily


def sku_mape(sku_id: int, store_id: int) -> float:
    """Детерминированная ошибка модели по SKU: большинство 7-16%, хвост до 25%."""
    digest = hashlib.md5(f"mape:{sku_id}:{store_id}".encode()).hexdigest()
    u = int(digest[:8], 16) / 0xFFFFFFFF
    return round(0.07 + (u ** 2.2) * 0.18, 3)


@dataclass
class DemandSnapshot:
    history: list[dict]          # последние 8 недель: date, qty, price, promo
    forecast: list[dict]         # 7 дней от завтра: date, qty
    expected_qty: float          # ожидаемый спрос при сохранении цены
    forecast_qty: float          # прогноз на целевую дату
    mean_28: float
    mean_7: float
    trend_pct: float             # изменение недельного спроса к среднему, %
    dow_factor: float
    current_price: float
    stock_qty: float
    stock_cover_days: float
    promo_active: bool
    promo_depth: float


def _dow_factors(rows: list[SalesDaily]) -> dict[int, float]:
    sums: dict[int, list[float]] = {i: [] for i in range(7)}
    for r in rows:
        if r.qty > 0:
            sums[r.date.weekday()].append(r.qty)
    overall = [q for v in sums.values() for q in v]
    base = (sum(overall) / len(overall)) if overall else 1.0
    return {
        dow: (sum(v) / len(v) / base) if v else 1.0
        for dow, v in sums.items()
    }


def build_snapshot(db: Session, sku_id: int, store_id: int, target_date: date) -> DemandSnapshot:
    since = date.today() - timedelta(days=60)
    rows = db.scalars(
        select(SalesDaily)
        .where(SalesDaily.sku_id == sku_id, SalesDaily.store_id == store_id,
               SalesDaily.date >= since)
        .order_by(SalesDaily.date)
    ).all()

    promos = db.scalars(
        select(PromoCalendar).where(PromoCalendar.sku_id == sku_id)
    ).all()

    def promo_on(d: date):
        return next((p for p in promos if p.date_from <= d <= p.date_to), None)

    nonzero = [r for r in rows if r.qty > 0]
    last_28 = [r for r in nonzero if r.date >= date.today() - timedelta(days=28)]
    last_7 = [r for r in nonzero if r.date >= date.today() - timedelta(days=7)]
    mean_28 = sum(r.qty for r in last_28) / len(last_28) if last_28 else 1.0
    mean_7 = sum(r.qty for r in last_7) / len(last_7) if last_7 else mean_28
    trend_pct = (mean_7 - mean_28) / mean_28 * 100 if mean_28 else 0.0

    dow = _dow_factors(rows)
    current_price = float(rows[-1].price) if rows else 0.0

    stock_row = db.scalars(
        select(StockDaily)
        .where(StockDaily.sku_id == sku_id, StockDaily.store_id == store_id)
        .order_by(StockDaily.date.desc())
        .limit(1)
    ).first()
    stock_qty = float(stock_row.stock_qty) if stock_row else 0.0
    stock_cover = stock_qty / mean_28 if mean_28 > 0 else 0.0

    target_promo = promo_on(target_date)

    def forecast_for(d: date) -> float:
        value = mean_28 * dow.get(d.weekday(), 1.0)
        value *= 1 + (mean_7 - mean_28) / mean_28 * 0.6 if mean_28 else 1.0
        p = promo_on(d)
        if p:
            value *= 1 + p.discount_depth * 2.0
        # детерминированный «модельный шум» ±4%
        digest = hashlib.md5(f"f:{sku_id}:{store_id}:{d}".encode()).hexdigest()
        value *= 0.96 + (int(digest[:6], 16) / 0xFFFFFF) * 0.08
        return round(max(value, 0.0), 1)

    expected = round(mean_28 * dow.get(target_date.weekday(), 1.0), 1)
    forecast_days = [
        {"date": (date.today() + timedelta(days=i)).isoformat(),
         "qty": forecast_for(date.today() + timedelta(days=i))}
        for i in range(1, 8)
    ]

    history_56 = [
        {
            "date": r.date.isoformat(),
            "qty": r.qty,
            "price": float(r.price),
            "promo": promo_on(r.date) is not None,
        }
        for r in rows
        if r.date >= date.today() - timedelta(days=56)
    ]

    return DemandSnapshot(
        history=history_56,
        forecast=forecast_days,
        expected_qty=max(expected, 0.1),
        forecast_qty=forecast_for(target_date),
        mean_28=round(mean_28, 1),
        mean_7=round(mean_7, 1),
        trend_pct=round(trend_pct, 1),
        dow_factor=round(dow.get(target_date.weekday(), 1.0), 2),
        current_price=current_price,
        stock_qty=stock_qty,
        stock_cover_days=round(stock_cover, 1),
        promo_active=target_promo is not None,
        promo_depth=target_promo.discount_depth if target_promo else 0.0,
    )


def build_factors(snapshot: DemandSnapshot, shelf_life_days: int) -> list[dict]:
    """Вклад факторов в решение — аналог важности признаков CatBoost."""
    factors = [
        {
            "feature": "lag_7",
            "label": "Продажи за 7 дней",
            "impact": max(min(snapshot.trend_pct / 25, 1.0), -1.0),
            "detail": f"{snapshot.mean_7:.0f} шт/день, {snapshot.trend_pct:+.1f}% к месяцу",
        },
        {
            "feature": "rolling_mean_28",
            "label": "Средний спрос 28 дней",
            "impact": 0.35,
            "detail": f"{snapshot.mean_28:.0f} шт/день",
        },
        {
            "feature": "day_of_week",
            "label": "День недели",
            "impact": max(min((snapshot.dow_factor - 1.0) * 2.2, 1.0), -1.0),
            "detail": f"сезонный коэффициент {snapshot.dow_factor:.2f}",
        },
        {
            "feature": "stock_cover_days",
            "label": "Запас в днях продаж",
            "impact": max(min((2.5 - snapshot.stock_cover_days) / 3, 1.0), -1.0),
            "detail": f"{snapshot.stock_cover_days:.1f} дн. ({snapshot.stock_qty:.0f} шт)",
        },
    ]
    if snapshot.promo_active:
        factors.append({
            "feature": "promo_flag",
            "label": "Промоакция",
            "impact": 0.9,
            "detail": f"скидка {snapshot.promo_depth * 100:.0f}% действует на дату расчёта",
        })
    if shelf_life_days <= 3:
        factors.append({
            "feature": "shelf_life",
            "label": "Срок годности",
            "impact": -0.6 if snapshot.stock_cover_days > 1.5 else -0.2,
            "detail": f"{shelf_life_days} дн. — свежая категория",
        })
    factors.sort(key=lambda f: abs(f["impact"]), reverse=True)
    for f in factors:
        f["impact"] = round(f["impact"], 2)
    return factors
