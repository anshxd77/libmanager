from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas import FineOut, FineSettleRequest, FineWaiveRequest
from app.firebase_service import repo

router = APIRouter(prefix="/api/v1/fines", tags=["Financial Assessments & Fines"])

@router.get("", response_model=List[FineOut])
def list_fines(status: Optional[str] = Query(None, description="outstanding, settled, or waived")):
    return repo.get_fines(status=status)

@router.post("/{fine_id}/settle", response_model=FineOut)
def settle_fine(fine_id: str, payload: FineSettleRequest):
    try:
        updated = repo.settle_fine(fine_id, amount=payload.amount, method=payload.payment_method)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{fine_id}/waive", response_model=FineOut)
def waive_fine(fine_id: str, payload: FineWaiveRequest):
    try:
        updated = repo.waive_fine(fine_id, authorized_by=payload.authorized_by, reason=payload.reason)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
