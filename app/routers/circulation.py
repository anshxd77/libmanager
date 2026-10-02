from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from app.schemas import LoanOut, LoanIssueRequest, LoanReturnRequest, LoanRenewRequest, QuickScanRequest, QuickScanResponse
from app.firebase_service import repo

router = APIRouter(prefix="/api/v1/circulation", tags=["Circulation Desk"])

@router.get("/loans", response_model=List[LoanOut])
def list_loans(
    status: Optional[str] = Query(None, description="active, overdue, or returned"),
    patron_id: Optional[str] = Query(None)
):
    return repo.get_loans(status=status, patron_id=patron_id)

@router.post("/checkout", response_model=LoanOut)
def checkout_item(payload: LoanIssueRequest):
    try:
        loan = repo.issue_loan(
            patron_membership=payload.patron_membership,
            item_barcode=payload.item_barcode,
            custom_days=payload.custom_loan_days,
            notes=payload.notes
        )
        return loan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/return")
def return_item(payload: LoanReturnRequest):
    try:
        result = repo.return_loan(
            item_barcode=payload.item_barcode,
            condition=payload.item_condition.value if hasattr(payload.item_condition, 'value') else str(payload.item_condition or "good"),
            damage_charge=float(payload.damage_charge or 0.0),
            notes=payload.notes,
            payment_method=payload.payment_method or "account_billed"
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/invoices/{identifier}")
def get_invoice_document(identifier: str):
    inv = repo.get_invoice(identifier)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invoice document '{identifier}' not found.")
    return inv

@router.get("/return-slips/{identifier}")
def get_return_slip_document(identifier: str):
    slip = repo.get_return_slip(identifier)
    if not slip:
        raise HTTPException(status_code=404, detail=f"Return slip document '{identifier}' not found.")
    return slip

@router.post("/renew", response_model=LoanOut)
def renew_item(payload: LoanRenewRequest):
    try:
        loan = repo.renew_loan(payload.loan_id)
        return loan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/quick-scan", response_model=QuickScanResponse)
def quick_scan(payload: QuickScanRequest):
    """
    Universal scanner dispatcher: accepts whatever is scanned (patron barcode/card
    or item barcode/RFID) and determines its identity immediately.
    """
    query = payload.barcode_or_membership.strip().upper()
    if not query:
        raise HTTPException(status_code=400, detail="Empty scan input.")

    # 1. Test if it's a patron membership card (starts with ATH or matches patron format)
    patron = repo.get_patron_by_membership(query)
    if patron:
        patron_loans = repo.get_loans(patron_id=patron["id"])
        patron_active = [l for l in patron_loans if l["status"] in ("active", "overdue")]
        return QuickScanResponse(
            entity_type="patron",
            data={
                "patron": patron,
                "active_loans": patron_active
            },
            message=f"Patron identified: {patron['first_name']} {patron['last_name']} ({patron['membership_number']})"
        )

    # 2. Test if it's a book copy barcode
    item = repo.get_book_item_by_barcode(query)
    if item:
        book = repo.get_book_by_id(item["book_id"])
        active_loans = repo.get_loans()
        current_loan = None
        for l in active_loans:
            if l["book_item_id"] == item["id"] and l["status"] in ("active", "overdue"):
                current_loan = l
                break

        return QuickScanResponse(
            entity_type="book_item",
            data={
                "item": item,
                "book": book,
                "active_loan": current_loan
            },
            message=f"Asset identified: {book['title'] if book else 'Unknown'} [{item['barcode']}]"
        )

    return QuickScanResponse(
        entity_type="not_found",
        data=None,
        message=f"No asset or patron card found matching barcode '{query}'."
    )
