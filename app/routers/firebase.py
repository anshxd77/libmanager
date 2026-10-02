from fastapi import APIRouter, HTTPException
from app.schemas import FirebaseStatusOut, FirebaseConfigIn
from app.firebase_service import repo

router = APIRouter(prefix="/api/v1/firebase", tags=["Firebase Integration"])

@router.get("/status", response_model=FirebaseStatusOut)
def firebase_status():
    return repo.get_firebase_status()

@router.post("/connect", response_model=FirebaseStatusOut)
def connect_firebase(payload: FirebaseConfigIn):
    if not payload.credentials_json:
        raise HTTPException(status_code=400, detail="Missing Firebase service account credentials JSON string.")
    
    try:
        repo.connect_with_credentials_json(payload.credentials_json)
        return repo.get_firebase_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to Firebase: {str(e)}")
