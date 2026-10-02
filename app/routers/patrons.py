from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas import PatronOut, PatronCreate
from app.firebase_service import repo

router = APIRouter(prefix="/api/v1/patrons", tags=["Patron Registry"])

@router.get("", response_model=List[PatronOut])
def list_patrons(search: Optional[str] = Query(None, description="Search by name, membership, email")):
    return repo.get_patrons(search=search)

@router.get("/{patron_id}", response_model=PatronOut)
def get_patron(patron_id: str):
    patron = repo.get_patron_by_id(patron_id)
    if not patron:
        raise HTTPException(status_code=404, detail="Patron profile not found.")
    return patron

@router.post("", response_model=PatronOut, status_code=201)
def register_patron(payload: PatronCreate):
    # Check if membership already exists if provided
    if payload.membership_number:
        existing = repo.get_patron_by_membership(payload.membership_number)
        if existing:
            raise HTTPException(status_code=400, detail=f"Membership number '{payload.membership_number}' is already registered.")

    patron_dict = payload.model_dump()
    created = repo.save_patron(patron_dict)
    return created
