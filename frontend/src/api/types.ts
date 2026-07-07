export interface User {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
}

export interface Category {
  category_id: number;
  name: string;
  icon: string;
  sku_count: number;
  needs_attention: number;
  write_off_risk: number;
  avg_mape: number;
}

export interface Store {
  store_id: number;
  name: string;
  format: string;
  region: string;
  demand_cluster: string;
}

export interface Product {
  sku_id: number;
  sku_name: string;
  brand: string;
  is_private_label: boolean;
  shelf_life_days: number;
  current_price: number;
  mean_7: number;
  trend_pct: number;
  stock_qty: number;
  stock_cover_days: number;
  model_mape: number;
  signals: string[];
}

export type RecommendationStatus =
  | "draft"
  | "review_required"
  | "approved"
  | "rejected"
  | "exported";

export interface Recommendation {
  recommendation_id: number;
  batch_id: string;
  recommendation_date: string;
  sku_id: number;
  sku_name: string;
  category_name: string;
  store_id: number;
  current_price: number;
  recommended_price: number;
  change_pct: number;
  forecast_qty: number;
  expected_margin: number;
  model_mape: number;
  status: RecommendationStatus;
  reason_code: string;
  reason: string;
}

export interface SeriesPoint {
  date: string;
  qty?: number | null;
  price?: number | null;
  promo?: boolean;
  forecast_qty?: number | null;
}

export interface Factor {
  feature: string;
  label: string;
  impact: number;
  detail: string;
}

export interface FinancialEffect {
  revenue_current: number;
  revenue_recommended: number;
  revenue_delta_pct: number;
  margin_current_pct: number;
  margin_recommended_pct: number;
  profit_current: number;
  profit_recommended: number;
}

export interface RecommendationDetail extends Recommendation {
  expected_qty: number;
  price_lower: number;
  price_upper: number;
  stock_qty: number;
  stock_cover_days: number;
  shelf_life_days: number;
  brand: string;
  unit: string;
  store_name: string;
  model_version: string;
  promo_active: boolean;
  constraints: string[];
  factors: Factor[];
  series: SeriesPoint[];
  financials: FinancialEffect;
  created_at: string;
}

export interface BatchSummary {
  batch_id: string;
  store: Store;
  target_date: string;
  model_version: string;
  counts: Record<string, number>;
  items: Recommendation[];
}

export interface Metrics {
  model_version: string;
  model_mape: number;
  trained_at: string;
  next_retrain_at: string;
  sku_total: number;
  sku_manual_review: number;
  approved_share_pct: number;
  category_mape: { category: string; mape: number; sku_count: number }[];
}

export type RejectReasonCode =
  | "disagree_with_forecast"
  | "category_restriction"
  | "planned_promo"
  | "price_sensitivity"
  | "data_error";

export const REJECT_REASONS: { code: RejectReasonCode; label: string }[] = [
  { code: "disagree_with_forecast", label: "Несогласие с прогнозом" },
  { code: "category_restriction", label: "Категорийное ограничение" },
  { code: "planned_promo", label: "Запланированная акция" },
  { code: "price_sensitivity", label: "Чувствительность цены для покупателя" },
  { code: "data_error", label: "Ошибка данных" },
];
