from fastapi import APIRouter
from app.schemas import SystemTelemetryOut
from app.firebase_service import repo

router = APIRouter(prefix="/api/v1/stats", tags=["Institutional Telemetry"])

@router.get("", response_model=SystemTelemetryOut)
def get_stats():
    return repo.get_telemetry()
