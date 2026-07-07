from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    full_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32))  # analyst | category_manager | admin


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    icon: Mapped[str] = mapped_column(String(32))
    elasticity: Mapped[float] = mapped_column(Float)  # чувствительность спроса к цене


class Product(Base):
    __tablename__ = "products"

    sku_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku_name: Mapped[str] = mapped_column(String(160))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.category_id"))
    brand: Mapped[str] = mapped_column(String(64))
    is_private_label: Mapped[bool] = mapped_column(Boolean, default=False)
    unit: Mapped[str] = mapped_column(String(16), default="шт")
    shelf_life_days: Mapped[int] = mapped_column(Integer)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2))
    purchase_price: Mapped[float] = mapped_column(Numeric(10, 2))
    min_margin: Mapped[float] = mapped_column(Float)  # доля, например 0.22
    in_dynamic_pricing: Mapped[bool] = mapped_column(Boolean, default=True)


class Store(Base):
    __tablename__ = "stores"

    store_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(96))
    format: Mapped[str] = mapped_column(String(32))
    region: Mapped[str] = mapped_column(String(64))
    demand_cluster: Mapped[str] = mapped_column(String(32))


class SalesDaily(Base):
    __tablename__ = "sales_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date)
    sku_id: Mapped[int] = mapped_column(ForeignKey("products.sku_id"))
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.store_id"))
    qty: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    revenue: Mapped[float] = mapped_column(Numeric(12, 2))

    __table_args__ = (Index("idx_sales_lookup", "sku_id", "store_id", "date"),)


class StockDaily(Base):
    __tablename__ = "stock_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date)
    sku_id: Mapped[int] = mapped_column(ForeignKey("products.sku_id"))
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.store_id"))
    stock_qty: Mapped[float] = mapped_column(Float)

    __table_args__ = (Index("idx_stock_lookup", "sku_id", "store_id", "date"),)


class PromoCalendar(Base):
    __tablename__ = "promo_calendar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("products.sku_id"))
    date_from: Mapped[date] = mapped_column(Date)
    date_to: Mapped[date] = mapped_column(Date)
    promo_type: Mapped[str] = mapped_column(String(32))
    discount_depth: Mapped[float] = mapped_column(Float)  # доля, например 0.20

    __table_args__ = (Index("idx_promo_lookup", "sku_id", "date_from", "date_to"),)


class PriceRecommendation(Base):
    __tablename__ = "price_recommendations"

    recommendation_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[str] = mapped_column(String(36), index=True)
    recommendation_date: Mapped[date] = mapped_column(Date)
    sku_id: Mapped[int] = mapped_column(ForeignKey("products.sku_id"))
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.store_id"))
    model_version: Mapped[str] = mapped_column(String(32))
    current_price: Mapped[float] = mapped_column(Numeric(10, 2))
    recommended_price: Mapped[float] = mapped_column(Numeric(10, 2))
    forecast_qty: Mapped[float] = mapped_column(Float)
    expected_qty: Mapped[float] = mapped_column(Float)
    expected_margin: Mapped[float] = mapped_column(Float)
    current_margin: Mapped[float] = mapped_column(Float)
    price_lower: Mapped[float] = mapped_column(Numeric(10, 2))
    price_upper: Mapped[float] = mapped_column(Numeric(10, 2))
    stock_qty: Mapped[float] = mapped_column(Float)
    stock_cover_days: Mapped[float] = mapped_column(Float)
    model_mape: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    reason_code: Mapped[str] = mapped_column(String(48))
    reason: Mapped[str] = mapped_column(Text)
    constraints: Mapped[str] = mapped_column(Text)  # JSON: список сработавших ограничений
    factors: Mapped[str] = mapped_column(Text)  # JSON: вклад факторов для карточки
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_price_rec_lookup", "recommendation_date", "store_id", "sku_id"),
    )


class ApprovalLog(Base):
    __tablename__ = "approval_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recommendation_id: Mapped[int] = mapped_column(
        ForeignKey("price_recommendations.recommendation_id")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))
    old_status: Mapped[str] = mapped_column(String(32))
    new_status: Mapped[str] = mapped_column(String(32))
    reason_code: Mapped[str] = mapped_column(String(48), nullable=True)
    comment: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
