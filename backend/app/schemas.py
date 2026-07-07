from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

RecommendationStatus = Literal["draft", "review_required", "approved", "rejected", "exported"]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: int
    username: str
    full_name: str
    role: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class CategoryOut(BaseModel):
    category_id: int
    name: str
    icon: str
    sku_count: int
    needs_attention: int
    write_off_risk: int
    avg_mape: float


class StoreOut(BaseModel):
    store_id: int
    name: str
    format: str
    region: str
    demand_cluster: str


class ProductOut(BaseModel):
    sku_id: int
    sku_name: str
    brand: str
    is_private_label: bool
    shelf_life_days: int
    current_price: float
    mean_7: float
    trend_pct: float
    stock_qty: float
    stock_cover_days: float
    model_mape: float
    signals: list[str]


class CalculateRequest(BaseModel):
    store_id: int
    target_date: date
    sku_ids: list[int] = Field(min_length=1, max_length=40)


class RecommendationOut(BaseModel):
    recommendation_id: int
    batch_id: str
    recommendation_date: date
    sku_id: int
    sku_name: str
    category_name: str
    store_id: int
    current_price: float
    recommended_price: float
    change_pct: float
    forecast_qty: float
    expected_margin: float
    model_mape: float
    status: RecommendationStatus
    reason_code: str
    reason: str


class PricePoint(BaseModel):
    date: str
    qty: float | None = None
    price: float | None = None
    promo: bool = False
    forecast_qty: float | None = None


class FactorOut(BaseModel):
    feature: str
    label: str
    impact: float
    detail: str


class FinancialEffect(BaseModel):
    revenue_current: float
    revenue_recommended: float
    revenue_delta_pct: float
    margin_current_pct: float
    margin_recommended_pct: float
    profit_current: float
    profit_recommended: float


class RecommendationDetail(RecommendationOut):
    expected_qty: float
    price_lower: float
    price_upper: float
    stock_qty: float
    stock_cover_days: float
    shelf_life_days: int
    brand: str
    unit: str
    store_name: str
    model_version: str
    promo_active: bool
    constraints: list[str]
    factors: list[FactorOut]
    series: list[PricePoint]
    financials: FinancialEffect
    created_at: datetime


class RejectRequest(BaseModel):
    reason_code: Literal[
        "disagree_with_forecast",
        "category_restriction",
        "planned_promo",
        "price_sensitivity",
        "data_error",
    ]
    comment: str | None = None


class BatchSummary(BaseModel):
    batch_id: str
    store: StoreOut
    target_date: date
    model_version: str
    counts: dict[str, int]
    items: list[RecommendationOut]


class MetricsOut(BaseModel):
    model_version: str
    model_mape: float
    trained_at: date
    next_retrain_at: date
    sku_total: int
    sku_manual_review: int
    approved_share_pct: float
    category_mape: list[dict]
