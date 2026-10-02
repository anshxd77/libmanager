from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.services.supabase_service import supabase
from app.firebase_service import repo

router = APIRouter(prefix="/api/v1/supabase", tags=["Supabase Cloud Integration"])

@router.get("/status")
async def get_supabase_status():
    """Returns current live connectivity and configuration for Supabase Cloud."""
    return await supabase.get_connection_status()

@router.post("/sync")
async def sync_data_to_supabase():
    """Syncs local books, patrons, and loans to Supabase PostgREST tables."""
    if not supabase.is_enabled:
        raise HTTPException(status_code=400, detail="Supabase integration is not enabled in .env")

    books = repo.get_books()
    patrons = repo.get_patrons()
    loans = repo.get_loans()

    res_books = await supabase.sync_collection("books", books)
    res_patrons = await supabase.sync_collection("patrons", patrons)
    res_loans = await supabase.sync_collection("loans", loans)

    return {
        "status": "completed",
        "sync_results": {
            "books": res_books,
            "patrons": res_patrons,
            "loans": res_loans
        }
    }
