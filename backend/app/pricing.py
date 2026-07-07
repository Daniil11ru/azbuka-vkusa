"""Алгоритм расчёта рекомендованной цены.

Перенос бизнес-логики из ВКР (листинги 3.8-3.9, таблица 3.10):
ценовой коридор из минимальной маржи и максимального шага изменения,
правило для скоропортящихся товаров, перевод в ручную проверку при
высокой ошибке модели, округление до окончания ,90 руб.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal


@dataclass
class PricingPolicy:
    max_up: Decimal = Decimal("0.07")
    max_down: Decimal = Decimal("0.12")
    min_margin_default: Decimal = Decimal("0.22")
    mape_manual_threshold: Decimal = Decimal("0.20")
    price_ending: Decimal = Decimal("0.90")


@dataclass
class PriceContext:
    current_price: Decimal
    purchase_price: Decimal
    min_margin: Decimal
    forecast_qty: Decimal
    expected_qty: Decimal
    elasticity: Decimal  # чувствительность цены к отклонению спроса, > 0
    shelf_life_days: int
    stock_cover_days: Decimal
    model_mape: Decimal
    promo_active: bool = False
    policy: PricingPolicy = field(default_factory=PricingPolicy)


@dataclass
class PriceRecommendationResult:
    price: Decimal
    reason_code: str
    status: str
    lower: Decimal
    upper: Decimal
    constraints: list[str]


def build_price_bounds(context: PriceContext) -> tuple[Decimal, Decimal]:
    margin_bound = context.purchase_price / (Decimal("1.0") - context.min_margin)
    max_decrease_bound = context.current_price * (Decimal("1.0") - context.policy.max_down)
    max_increase_bound = context.current_price * (Decimal("1.0") + context.policy.max_up)
    lower = max(margin_bound, max_decrease_bound)
    upper = max(max_increase_bound, lower)
    return (
        lower.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        upper.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
    )


def round_to_price_ending(price: Decimal, lower: Decimal, upper: Decimal,
                          ending: Decimal = Decimal("0.90")) -> Decimal:
    """Округляет цену к ближайшему окончанию ,90 в пределах коридора."""
    base = int(price)
    candidates = [Decimal(base - 1) + ending, Decimal(base) + ending, Decimal(base + 1) + ending]
    allowed = [c for c in candidates if lower <= c <= upper and c > 0]
    if not allowed:
        return price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return min(allowed, key=lambda c: abs(c - price))


def recommend_price(context: PriceContext) -> PriceRecommendationResult:
    lower, upper = build_price_bounds(context)
    constraints: list[str] = []

    expected = context.expected_qty if context.expected_qty > 0 else Decimal("1")
    demand_gap = (context.forecast_qty - context.expected_qty) / expected
    candidate = context.current_price * (Decimal("1.0") + context.elasticity * demand_gap)

    status = "draft"

    if context.promo_active:
        # Изменение цены вне промоплана блокируется (таблица 3.10)
        constraints.append("Товар участвует в промоакции: пересчёт заблокирован до её завершения")
        return PriceRecommendationResult(
            price=context.current_price,
            reason_code="promo_locked",
            status="review_required",
            lower=lower,
            upper=upper,
            constraints=constraints,
        )

    if context.shelf_life_days <= 2 and context.stock_cover_days > Decimal("1.5"):
        markdown_cap = context.current_price * Decimal("0.94")
        if candidate > markdown_cap:
            candidate = markdown_cap
            constraints.append("Приоритет контроля списаний: срок годности менее 2 дней")
        reason_code = "risk_of_write_off"
    elif context.model_mape > context.policy.mape_manual_threshold:
        reason_code = "manual_review_high_error"
        status = "review_required"
        constraints.append(
            f"MAPE {float(context.model_mape) * 100:.0f}% выше порога 20%: требуется ручная проверка"
        )
    else:
        reason_code = "demand_based_adjustment"

    if candidate < lower:
        margin_bound = context.purchase_price / (Decimal("1.0") - context.min_margin)
        if lower == margin_bound.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP):
            constraints.append(
                f"Минимальная маржа {float(context.min_margin) * 100:.0f}%: снижение ограничено"
            )
        else:
            constraints.append("Максимальный шаг снижения 12% за расчётный цикл")
    if candidate > upper:
        constraints.append("Максимальный шаг повышения 7% за расчётный цикл")

    bounded = min(max(candidate, lower), upper)
    rounded = round_to_price_ending(bounded, lower, upper, context.policy.price_ending)
    if rounded != bounded.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP):
        constraints.append("Округление по правилам сети: окончание ,90 ₽")

    return PriceRecommendationResult(
        price=rounded,
        reason_code=reason_code,
        status=status,
        lower=lower,
        upper=upper,
        constraints=constraints,
    )
