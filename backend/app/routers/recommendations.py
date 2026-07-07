from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ApprovalLog, Category, PriceRecommendation, Product, Store, User
from app.reco_service import build_detail, calculate_batch, recommendation_to_dict
from app.schemas import (
    BatchSummary,
    CalculateRequest,
    RecommendationDetail,
    RejectRequest,
)
from app.security import get_current_user

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

REJECT_REASONS = {
    "disagree_with_forecast": "Несогласие с прогнозом",
    "category_restriction": "Категорийное ограничение",
    "planned_promo": "Запланированная акция",
    "price_sensitivity": "Чувствительность цены для покупателя",
    "data_error": "Ошибка данных",
}


@router.post("/calculate")
def calculate(payload: CalculateRequest, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    store = db.get(Store, payload.store_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    batch_id = calculate_batch(db, payload.store_id, payload.target_date, payload.sku_ids)
    return {"batch_id": batch_id}


def _load_batch(db: Session, batch_id: str) -> list[PriceRecommendation]:
    recs = db.scalars(
        select(PriceRecommendation)
        .where(PriceRecommendation.batch_id == batch_id)
        .order_by(PriceRecommendation.recommendation_id)
    ).all()
    if not recs:
        raise HTTPException(status_code=404, detail="Расчёт не найден или ещё не завершён")
    return recs


@router.get("/batch/{batch_id}", response_model=BatchSummary)
def get_batch(batch_id: str, db: Session = Depends(get_db),
              _: User = Depends(get_current_user)):
    recs = _load_batch(db, batch_id)
    store = db.get(Store, recs[0].store_id)
    items = []
    counts: dict[str, int] = {}
    for rec in recs:
        product = db.get(Product, rec.sku_id)
        category = db.get(Category, product.category_id)
        items.append(recommendation_to_dict(rec, product, category))
        counts[rec.status] = counts.get(rec.status, 0) + 1
    return {
        "batch_id": batch_id,
        "store": store,
        "target_date": recs[0].recommendation_date,
        "model_version": recs[0].model_version,
        "counts": counts,
        "items": items,
    }


@router.get("/{recommendation_id}", response_model=RecommendationDetail)
def get_detail(recommendation_id: int, db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    rec = db.get(PriceRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена")
    return build_detail(db, rec)


def _change_status(db: Session, rec: PriceRecommendation, user: User,
                   new_status: str, reason_code: str | None = None,
                   comment: str | None = None) -> None:
    db.add(ApprovalLog(
        recommendation_id=rec.recommendation_id,
        user_id=user.user_id,
        old_status=rec.status,
        new_status=new_status,
        reason_code=reason_code,
        comment=comment,
    ))
    rec.status = new_status
    db.commit()


@router.post("/{recommendation_id}/approve")
def approve(recommendation_id: int, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):
    rec = db.get(PriceRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена")
    if rec.status in ("approved", "exported"):
        raise HTTPException(status_code=409, detail="Рекомендация уже утверждена")
    _change_status(db, rec, user, "approved")
    return {"status": "approved"}


@router.post("/{recommendation_id}/reject")
def reject(recommendation_id: int, payload: RejectRequest,
           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.get(PriceRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена")
    if rec.status == "exported":
        raise HTTPException(status_code=409, detail="Цена уже выгружена во внешний контур")
    _change_status(db, rec, user, "rejected", payload.reason_code, payload.comment)
    return {"status": "rejected", "reason": REJECT_REASONS[payload.reason_code]}
