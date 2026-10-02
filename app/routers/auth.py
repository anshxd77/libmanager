import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional, Dict, Any

from app.schemas import (
    SignupRequest, VerifyOtpRequest, ResendOtpRequest, 
    LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, 
    AuthResponse, UserOut
)
from app.firebase_service import repo
from app.services.auth_service import (
    validate_password_criteria, hash_password, verify_password,
    PENDING_SIGNUPS, PENDING_RESETS
)
from app.services.email_service import generate_otp, send_otp_email
from app.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Verification"])

@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest):
    email = payload.email.lower().strip()
    
    # 1. Check if user already registered
    existing = repo.get_user_by_email(email)
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"An account with email '{email}' already exists. Please sign in instead."
        )

    # 2. Smooth password validation
    is_valid, msg = validate_password_criteria(payload.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    now = datetime.now(timezone.utc)
    role_val = payload.role.value if hasattr(payload.role, "value") else str(payload.role)

    smtp_active = bool(settings.SMTP_ENABLED and settings.SMTP_USER and settings.SMTP_PASSWORD)

    if not smtp_active:
        # Instant direct enrollment without email friction
        membership_num = None
        if role_val in ("patron", "student"):
            all_patrons = repo.get_patrons()
            max_num = 8035
            for p in all_patrons:
                num_str = p.get("membership_number", "").replace("ATH-", "")
                if num_str.isdigit():
                    max_num = max(max_num, int(num_str))
            membership_num = f"ATH-{max_num + 1}"

            parts = payload.full_name.strip().split()
            first_name = parts[0] if parts else "Student"
            last_name = " ".join(parts[1:]) if len(parts) > 1 else "Scholar"

            repo.save_patron({
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": payload.phone,
                "tier": "undergraduate",
                "membership_number": membership_num,
                "borrowing_limit": 5,
                "active_loans_count": 0,
                "outstanding_fines": 0.0,
                "is_active": True
            })
        elif role_val in ("admin", "librarian"):
            membership_num = f"ATH-STAFF-{uuid.uuid4().hex[:4].upper()}"

        user_id = f"user-{uuid.uuid4().hex[:8]}"
        user_record = {
            "id": user_id,
            "email": email,
            "full_name": payload.full_name.strip(),
            "password_hash": hash_password(payload.password),
            "role": role_val,
            "membership_number": membership_num,
            "avatar_url": None,
            "created_at": now.isoformat()
        }
        created = repo.create_user(user_record)
        token = f"token_{uuid.uuid4().hex}_{user_id}"

        user_out = UserOut(
            id=created["id"],
            email=created["email"],
            full_name=created["full_name"],
            role=created["role"],
            membership_number=created.get("membership_number"),
            avatar_url=created.get("avatar_url"),
            created_at=created["created_at"]
        )

        return AuthResponse(
            success=True,
            message=f"Welcome {payload.full_name}! Account created and enrolled as {membership_num}.",
            token=token,
            user=user_out,
            otp_required=False,
            dev_otp_preview=None
        )

    # 3. Generate 6-digit OTP code & stage pending registration if SMTP is active
    otp_code = generate_otp(6)
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    PENDING_SIGNUPS[email] = {
        "full_name": payload.full_name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": role_val,
        "phone": payload.phone,
        "otp": otp_code,
        "expires_at": expires_at
    }

    # 4. Dispatch verification email via Gmail SMTP
    mail_res = send_otp_email(
        recipient_email=email,
        otp_code=otp_code,
        full_name=payload.full_name.strip(),
        purpose="account verification"
    )

    dev_otp = mail_res.get("dev_otp_preview")
    delivered = mail_res.get("delivered_via_smtp", False)

    msg = f"Verification code sent to {email}." if delivered else f"Verification code generated ({otp_code})."

    return AuthResponse(
        success=True,
        message=msg,
        token=None,
        user=None,
        otp_required=True,
        dev_otp_preview=dev_otp
    )

@router.post("/verify-otp", response_model=AuthResponse)
def verify_signup_otp(payload: VerifyOtpRequest):
    email = payload.email.lower().strip()
    submitted_otp = payload.otp.strip()

    pending = PENDING_SIGNUPS.get(email)
    if not pending:
        raise HTTPException(
            status_code=400, 
            detail="No pending verification found for this email. Please request a new registration."
        )

    now = datetime.now(timezone.utc)
    if now > pending["expires_at"]:
        PENDING_SIGNUPS.pop(email, None)
        raise HTTPException(
            status_code=400, 
            detail="Verification code has expired. Please request a new one."
        )

    if pending["otp"] != submitted_otp:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check and re-enter.")

    # OTP is verified! Create active user record
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    membership_num = None
    
    # If patron role, auto-generate membership card
    if pending["role"] in ("patron", "student"):
        all_patrons = repo.get_patrons()
        max_num = 8035
        for p in all_patrons:
            num_str = p.get("membership_number", "").replace("ATH-", "")
            if num_str.isdigit():
                max_num = max(max_num, int(num_str))
        membership_num = f"ATH-{max_num + 1}"
        
        # Split name for patron profile
        parts = pending["full_name"].strip().split()
        first_name = parts[0] if parts else "Student"
        last_name = " ".join(parts[1:]) if len(parts) > 1 else "Scholar"
        
        repo.save_patron({
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": pending.get("phone"),
            "tier": "undergraduate",
            "membership_number": membership_num,
            "borrowing_limit": 5,
            "active_loans_count": 0,
            "outstanding_fines": 0.0,
            "is_active": True
        })
    elif pending["role"] in ("admin", "librarian"):
        membership_num = f"ATH-STAFF-{uuid.uuid4().hex[:4].upper()}"

    user_record = {
        "id": user_id,
        "email": email,
        "full_name": pending["full_name"],
        "password_hash": pending["password_hash"],
        "role": pending["role"],
        "membership_number": membership_num,
        "avatar_url": None,
        "created_at": now.isoformat()
    }

    created = repo.create_user(user_record)
    PENDING_SIGNUPS.pop(email, None)

    token = f"token_{uuid.uuid4().hex}_{user_id}"

    user_out = UserOut(
        id=created["id"],
        email=created["email"],
        full_name=created["full_name"],
        role=created["role"],
        membership_number=created.get("membership_number"),
        avatar_url=created.get("avatar_url"),
        created_at=created["created_at"]
    )

    return AuthResponse(
        success=True,
        message="Account verified and registered successfully!",
        token=token,
        user=user_out,
        otp_required=False
    )

@router.post("/resend-otp", response_model=AuthResponse)
def resend_otp(payload: ResendOtpRequest):
    email = payload.email.lower().strip()
    pending = PENDING_SIGNUPS.get(email) or PENDING_RESETS.get(email)
    if not pending:
        raise HTTPException(status_code=400, detail="No active pending request found for this email.")

    otp_code = generate_otp(6)
    pending["otp"] = otp_code
    pending["expires_at"] = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    mail_res = send_otp_email(
        recipient_email=email,
        otp_code=otp_code,
        full_name=pending.get("full_name", "Scholar"),
        purpose="verification"
    )

    return AuthResponse(
        success=True,
        message=f"Fresh verification code sent to {email}.",
        otp_required=True,
        dev_otp_preview=mail_res.get("dev_otp_preview")
    )

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = repo.get_user_by_email(email)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = f"token_{uuid.uuid4().hex}_{user['id']}"

    user_out = UserOut(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "patron"),
        membership_number=user.get("membership_number"),
        avatar_url=user.get("avatar_url"),
        created_at=user.get("created_at", "")
    )

    return AuthResponse(
        success=True,
        message=f"Welcome back, {user['full_name']}.",
        token=token,
        user=user_out,
        otp_required=False
    )

@router.post("/forgot-password", response_model=AuthResponse)
def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.lower().strip()
    user = repo.get_user_by_email(email)
    if not user:
        # Avoid user enumeration while being clear
        return AuthResponse(
            success=True,
            message="If an account exists with this email, an OTP has been dispatched."
        )

    otp_code = generate_otp(6)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    PENDING_RESETS[email] = {
        "email": email,
        "otp": otp_code,
        "expires_at": expiry
    }

    mail_res = send_otp_email(
        recipient_email=email,
        otp_code=otp_code,
        full_name=user.get("full_name", "Scholar"),
        purpose="password recovery"
    )

    return AuthResponse(
        success=True,
        message=f"Password recovery OTP sent to {email}.",
        otp_required=True,
        dev_otp_preview=mail_res.get("dev_otp_preview")
    )

@router.post("/reset-password", response_model=AuthResponse)
def reset_password(payload: ResetPasswordRequest):
    email = payload.email.lower().strip()
    pending = PENDING_RESETS.get(email)
    if not pending:
        raise HTTPException(status_code=400, detail="No active password reset request for this email.")

    now = datetime.now(timezone.utc)
    if now > pending["expires_at"]:
        PENDING_RESETS.pop(email, None)
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    if pending["otp"] != payload.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid reset code.")

    # Validate new password criteria
    is_valid, msg = validate_password_criteria(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    new_hash = hash_password(payload.new_password)
    updated = repo.update_user_password(email, new_hash)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update password.")

    PENDING_RESETS.pop(email, None)
    return AuthResponse(
        success=True,
        message="Your password has been successfully reset. Please log in with your new credentials."
    )
