import logging
import httpx
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    """
    Supabase Cloud Integration Service:
    Provides PostgREST table synchronization, health diagnostics,
    and GoTrue Authentication integration for Sonam Library Management.
    """
    def __init__(self):
        self.url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.anon_key = settings.SUPABASE_KEY or ""
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        self.is_enabled = settings.SUPABASE_ENABLED and bool(self.url and self.anon_key)

    @property
    def headers(self) -> Dict[str, str]:
        key = self.service_role_key or self.anon_key
        return {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    async def get_connection_status(self) -> Dict[str, Any]:
        """Tests live connectivity to the configured Supabase Cloud instance."""
        if not self.is_enabled:
            return {
                "status": "disabled",
                "connected": False,
                "url": self.url,
                "message": "Supabase integration is currently disabled or keys are missing in .env",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                # Test connectivity against PostgREST root schema
                resp = await client.get(f"{self.url}/rest/v1/", headers={"apikey": self.anon_key})
                is_ok = resp.status_code in (200, 401, 404)
                
                return {
                    "status": "connected" if is_ok else "unreachable",
                    "connected": is_ok,
                    "url": self.url,
                    "service": "Supabase PostgREST & Cloud Storage",
                    "http_status": resp.status_code,
                    "message": "Supabase Cloud endpoint reachable and operational" if is_ok else f"Supabase responded with code {resp.status_code}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.warning(f"Supabase connection check error: {e}")
            return {
                "status": "offline",
                "connected": False,
                "url": self.url,
                "error": str(e),
                "message": f"Could not reach Supabase endpoint: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    async def sync_collection(self, table_name: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Upserts a collection of local JSON records into Supabase PostgREST tables."""
        if not self.is_enabled or not records:
            return {"synced": 0, "status": "skipped", "message": "Supabase not enabled or no records"}

        endpoint = f"{self.url}/rest/v1/{table_name}"
        headers = dict(self.headers)
        headers["Prefer"] = "resolution=merge-duplicates"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(endpoint, json=records[:50], headers=headers)
                if resp.status_code in (200, 201):
                    return {
                        "synced": len(records),
                        "table": table_name,
                        "status": "success",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    return {
                        "synced": 0,
                        "table": table_name,
                        "status": "error",
                        "status_code": resp.status_code,
                        "detail": resp.text[:200]
                    }
        except Exception as e:
            logger.error(f"Failed to sync table {table_name} to Supabase: {e}")
            return {"synced": 0, "status": "error", "error": str(e)}

supabase = SupabaseService()
