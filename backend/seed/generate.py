"""Детерминированные данные.

Выделяет 130 дней истории продаж, остатков и промоакций по каждой паре
SKU-магазин: недельная сезонность, плавный тренд, промо-всплески,
редкие дни out-of-stock. Seed фиксирован — данные воспроизводимы.
"""

import hashlib
from datetime import date, timedelta

import numpy as np
from sqlalchemy.orm import Session

from app.security import hash_password
from app.models import (
    Category,
    Product,
    PromoCalendar,
    SalesDaily,
    StockDaily,
    Store,
    User,
)
from seed.catalog import CATEGORIES, DOW_FACTORS, PRODUCTS, STORES, USERS

HISTORY_DAYS = 130
SEED = 42


def sku_hash(sku_id: int, salt: str = "") -> float:
    """Детерминированное число 0..1 из идентификатора SKU."""
    digest = hashlib.md5(f"{sku_id}:{salt}".encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def seed_database(db: Session) -> None:
    rng = np.random.RandomState(SEED)
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)

    for username, password, full_name, role in USERS:
        db.add(User(username=username, password_hash=hash_password(password),
                    full_name=full_name, role=role))

    for cat_id, name, icon, elasticity in CATEGORIES:
        db.add(Category(category_id=cat_id, name=name, icon=icon, elasticity=elasticity))

    products = []
    for idx, (name, cat_id, brand, pl, shelf, price, margin, base_qty) in enumerate(PRODUCTS, start=1):
        sku_id = 100000 + idx
        products.append({
            "sku_id": sku_id, "cat_id": cat_id, "shelf": shelf,
            "price": price, "margin": margin, "base_qty": base_qty,
        })
        db.add(Product(
            sku_id=sku_id,
            sku_name=name,
            category_id=cat_id,
            brand=brand,
            is_private_label=pl,
            unit="шт",
            shelf_life_days=shelf,
            base_price=price,
            purchase_price=round(price * (1 - margin), 2),
            min_margin=round(max(0.18, margin - 0.16), 2),
            in_dynamic_pricing=True,
        ))

    store_traffic = {}
    for store_id, name, fmt, region, cluster, traffic in STORES:
        store_traffic[store_id] = traffic
        db.add(Store(store_id=store_id, name=name, format=fmt,
                     region=region, demand_cluster=cluster))
    db.flush()

    # Промоокна: у ~40% SKU 1-2 акции за период, у части — активная сейчас
    promo_windows: dict[int, list[tuple[date, date, float]]] = {}
    for p in products:
        windows = []
        n_promo = rng.choice([0, 1, 1, 2], p=[0.45, 0.25, 0.2, 0.1])
        for _ in range(n_promo):
            offset = int(rng.randint(5, HISTORY_DAYS - 12))
            length = int(rng.randint(5, 11))
            depth = float(rng.uniform(0.15, 0.30))
            d_from = start + timedelta(days=offset)
            windows.append((d_from, d_from + timedelta(days=length), round(depth, 2)))
        # несколько SKU получают акцию, действующую на завтрашнюю дату расчёта
        if sku_hash(p["sku_id"], "promo-now") > 0.93:
            windows.append((today - timedelta(days=2), today + timedelta(days=5), 0.20))
        promo_windows[p["sku_id"]] = windows
        for d_from, d_to, depth in windows:
            db.add(PromoCalendar(sku_id=p["sku_id"], date_from=d_from, date_to=d_to,
                                 promo_type="скидка", discount_depth=depth))

    sales_rows, stock_rows = [], []
    for p in products:
        sku_id = p["sku_id"]
        dow_f = DOW_FACTORS[p["cat_id"]]
        # у каждого SKU свой плавный тренд за период: от -25% до +25%
        trend_total = (sku_hash(sku_id, "trend") - 0.5) * 0.5
        for store_id, traffic in store_traffic.items():
            base = p["base_qty"] * traffic * (0.85 + 0.3 * sku_hash(sku_id, f"s{store_id}"))
            oos_days = set(
                int(x) for x in rng.choice(HISTORY_DAYS, size=max(1, int(HISTORY_DAYS * 0.03)),
                                           replace=False)
            )
            for day_offset in range(HISTORY_DAYS):
                d = start + timedelta(days=day_offset)
                promo = next(
                    (w for w in promo_windows[sku_id] if w[0] <= d <= w[1]), None
                )
                price = p["price"]
                demand = base * dow_f[d.weekday()]
                demand *= 1 + trend_total * (day_offset / HISTORY_DAYS - 0.5)
                if promo:
                    price = round(p["price"] * (1 - promo[2]), 2)
                    demand *= 1 + promo[2] * 2.2
                qty = float(max(0, rng.poisson(max(demand, 0.3))))
                if day_offset in oos_days:
                    qty = 0.0
                    stock = 0.0
                else:
                    stock = float(np.round(qty * rng.uniform(0.8, 4.5) + rng.randint(0, 5), 0))
                sales_rows.append({
                    "date": d, "sku_id": sku_id, "store_id": store_id,
                    "qty": qty, "price": price, "revenue": round(qty * price, 2),
                })
                stock_rows.append({
                    "date": d, "sku_id": sku_id, "store_id": store_id, "stock_qty": stock,
                })

    db.bulk_insert_mappings(SalesDaily, sales_rows)
    db.bulk_insert_mappings(StockDaily, stock_rows)
    db.commit()
