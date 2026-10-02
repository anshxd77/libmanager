import re
import os
import hmac
import hashlib
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple

from app.config import settings
from app.services.email_service import generate_otp, send_otp_email

logger = logging.getLogger(__name__)

# In-memory store for pending OTPs (and accounts)
# In production, can be persisted in Firestore or JSON store
PENDING_SIGNUPS: Dict[str, Dict[str, Any]] = {}
PENDING_RESETS: Dict[str, Dict[str, Any]] = {}

def validate_password_criteria(password: str) -> Tuple[bool, str]:
    """
    Simplified password criteria for smooth user access:
    - Minimum 4 characters
    """
    if len(password) < 4:
        return False, "Password must be at least 4 characters in length."
    if len(password) > 128:
        return False, "Password must not exceed 128 characters."
    return True, "Password accepted."

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """PBKDF2 HMAC SHA-256 password hashing."""
    if not salt:
        salt = uuid.uuid4().hex[:16]
    derived = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}${derived}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies a plain password against the stored salt$hash string."""
    try:
        salt, expected = stored_hash.split("$")
        actual = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False
