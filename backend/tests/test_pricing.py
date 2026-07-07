"""Тесты ценового модуля — по образцу листинга 3.11 из ВКР."""

from decimal import Decimal

from app.pricing import PriceContext, recommend_price


def make_context(**overrides) -> PriceContext:
    params = dict(
        current_price=Decimal("219.90"),
        purchase_price=Decimal("151.00"),
        min_margin=Decimal("0.22"),
        forecast_qty=Decimal("87.0"),
        expected_qty=Decimal("92.0"),
        elasticity=Decimal("0.31"),
        shelf_life_days=5,
        stock_cover_days=Decimal("1.10"),
        model_mape=Decimal("0.108"),
    )
    params.update(overrides)
    return PriceContext(**params)


def test_price_is_not_lower_than_margin_limit():
    context = make_context()
    recommendation = recommend_price(context)
    margin = (recommendation.price - context.purchase_price) / recommendation.price
    assert margin >= context.min_margin
    assert recommendation.price <= context.current_price * Decimal("1.07")


def test_price_respects_max_step_bounds():
    context = make_context(forecast_qty=Decimal("200.0"))
    recommendation = recommend_price(context)
    assert recommendation.price <= context.current_price * Decimal("1.07")

    context = make_context(forecast_qty=Decimal("10.0"), purchase_price=Decimal("100.0"))
    recommendation = recommend_price(context)
    assert recommendation.price >= context.current_price * Decimal("0.88")


def test_price_ends_with_90_kopecks():
    recommendation = recommend_price(make_context())
    assert recommendation.price % Decimal("1") == Decimal("0.90")


def test_write_off_risk_triggers_markdown():
    context = make_context(shelf_life_days=2, stock_cover_days=Decimal("3.0"),
                           forecast_qty=Decimal("70.0"))
    recommendation = recommend_price(context)
    assert recommendation.reason_code == "risk_of_write_off"
    assert recommendation.price < context.current_price


def test_high_mape_requires_manual_review():
    recommendation = recommend_price(make_context(model_mape=Decimal("0.24")))
    assert recommendation.reason_code == "manual_review_high_error"
    assert recommendation.status == "review_required"


def test_promo_locks_price():
    context = make_context(promo_active=True)
    recommendation = recommend_price(context)
    assert recommendation.reason_code == "promo_locked"
    assert recommendation.price == context.current_price
