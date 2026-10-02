from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from app.schemas import BookOut, BookCreate, BookItemOut
from app.firebase_service import repo
from app.services.isbn_lookup import fetch_isbn_metadata

router = APIRouter(prefix="/api/v1/books", tags=["Bibliographic Catalog"])

@router.get("", response_model=List[BookOut])
def list_books(
    search: Optional[str] = Query(None, description="Fuzzy search across title, author, ISBN"),
    dewey: Optional[str] = Query(None, description="Dewey classification prefix (e.g. 000, 500)")
):
    return repo.get_books(search=search, dewey_prefix=dewey)

@router.get("/isbn/lookup")
async def lookup_isbn(isbn: str = Query(..., description="ISBN-10 or ISBN-13")):
    metadata = await fetch_isbn_metadata(isbn)
    if not metadata:
        raise HTTPException(status_code=404, detail=f"No bibliographic record found for ISBN {isbn}")
    return metadata

@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: str):
    book = repo.get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book title not found.")
    return book

@router.post("", response_model=BookOut, status_code=201)
def create_book(payload: BookCreate):
    import uuid
    copy_loc = {
        "location_floor": payload.copy_location_floor or "Floor 1",
        "location_aisle": payload.copy_location_aisle or "Aisle 01",
        "location_shelf": payload.copy_location_shelf or "Shelf A-01",
    }
    
    book_dict = payload.model_dump()
    
    # Auto-generate ISBN if empty
    if not book_dict.get("isbn_13") or not str(book_dict["isbn_13"]).strip():
        book_dict["isbn_13"] = f"9780{uuid.uuid4().int % 1000000000:09d}"
    else:
        book_dict["isbn_13"] = str(book_dict["isbn_13"]).strip()

    # If already cataloged with the same title, increment copy inventory instead of throwing error!
    existing = repo.get_book_by_isbn(book_dict["isbn_13"])
    if existing:
        if existing["title"].lower().strip() == payload.title.lower().strip():
            for _ in range(payload.initial_copies):
                repo.add_copy_to_book(
                    existing["id"],
                    floor=copy_loc["location_floor"],
                    aisle=copy_loc["location_aisle"],
                    shelf=copy_loc["location_shelf"]
                )
            return repo.get_book_by_id(existing["id"])
        else:
            # Different title with duplicate ISBN: create unique identifier
            book_dict["isbn_13"] = f"{book_dict['isbn_13']}-{uuid.uuid4().hex[:4].upper()}"

    created = repo.save_book(book_dict, initial_copies=payload.initial_copies, copy_loc=copy_loc)
    return created

@router.post("/{book_id}/copies", response_model=BookItemOut, status_code=201)
def add_copy(
    book_id: str,
    floor: str = Query("Floor 1"),
    aisle: str = Query("Aisle 01"),
    shelf: str = Query("Shelf A-01")
):
    item = repo.add_copy_to_book(book_id, floor=floor, aisle=aisle, shelf=shelf)
    if not item:
        raise HTTPException(status_code=404, detail="Book not found.")
    return item
