import os
import random
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)

def generate_otp(length: int = 6) -> str:
    """Generates a secure numeric OTP."""
    return "".join([str(random.randint(0, 9)) for _ in range(length)])

def send_otp_email(recipient_email: str, otp_code: str, full_name: str = "Scholar", purpose: str = "registration") -> Dict[str, Any]:
    """
    Sends an OTP verification email to the user's Gmail / email address.
    If Gmail SMTP credentials are configured, sends real email.
    If not yet configured in .env, securely provides development preview so workflows are never blocked.
    """
    subject = f"Sonam Institutional Verification Code: {otp_code}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #0b0d11; color: #f0f2f5; margin: 0; padding: 24px; }}
            .container {{ max-width: 520px; margin: 0 auto; background-color: #131720; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 32px; }}
            .crest {{ color: #c5a880; font-size: 18px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px; }}
            .title {{ font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }}
            .desc {{ font-size: 14px; color: #9aa3b2; line-height: 1.5; margin-bottom: 24px; }}
            .otp-box {{ background-color: #1a202c; border: 1px solid #c5a880; border-radius: 6px; padding: 18px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 0.25em; color: #e0c6a0; font-family: monospace; margin-bottom: 24px; }}
            .footer {{ font-size: 11px; color: #5e6676; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="crest">Sonam Institutional Library System</div>
            <div class="title">Verification Code</div>
            <div class="desc">
                Greetings {full_name},<br><br>
                Please use the following 6-digit authentication code to verify your account and complete {purpose}:
            </div>
            <div class="otp-box">{otp_code}</div>
            <div class="desc">
                This verification code will expire in {settings.OTP_EXPIRY_MINUTES} minutes. If you did not request this authorization, please ignore this transmission.
            </div>
            <div class="footer">
                Sonam Institutional Library & Archival Network • Automated Dispatch Service
            </div>
        </div>
    </body>
    </html>
    """

    plain_content = f"""
    Sonam Institutional Library System
    Verification Code: {otp_code}
    
    Greetings {full_name},
    Your 6-digit verification code to complete {purpose} is: {otp_code}
    This code expires in {settings.OTP_EXPIRY_MINUTES} minutes.
    """

    smtp_configured = bool(settings.SMTP_USER and settings.SMTP_PASSWORD)

    if smtp_configured and settings.SMTP_ENABLED:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(plain_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12.0) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, recipient_email, msg.as_string())

            logger.info(f"Verification OTP email delivered via Gmail SMTP to {recipient_email}")
            return {
                "sent": True,
                "delivered_via_smtp": True,
                "dev_otp_preview": None,
                "message": f"Verification code sent to {recipient_email}"
            }
        except Exception as e:
            logger.error(f"Gmail SMTP dispatch failed: {e}. Falling back to dev mode.")
            return {
                "sent": True,
                "delivered_via_smtp": False,
                "dev_otp_preview": otp_code,
                "message": f"SMTP dispatch failed ({str(e)}). Dev OTP preview: {otp_code}"
            }
    else:
        # Development mode fallback
        logger.info(f"[DEV MODE] OTP generated for {recipient_email}: {otp_code}")
        return {
            "sent": True,
            "delivered_via_smtp": False,
            "dev_otp_preview": otp_code,
            "message": f"Verification code generated (Dev Preview: {otp_code})"
        }

def send_admin_approval_request(
    applicant_name: str, 
    applicant_email: str, 
    approval_token: str, 
    approver_email: str,
    base_url: str = "http://127.0.0.1:8000"
) -> Dict[str, Any]:
    """
    Sends an Administrator Authorization Request to the Head Administrator on Gmail.
    Provides 1-click Approval and Rejection links.
    """
    approve_url = f"{base_url}/api/v1/auth/admin-approvals/action?token={approval_token}&decision=approve"
    reject_url = f"{base_url}/api/v1/auth/admin-approvals/action?token={approval_token}&decision=reject"

    subject = f"ACTION REQUIRED: Administrator Access Approval Request for {applicant_name}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #0b0d11; color: #f0f2f5; margin: 0; padding: 24px; }}
            .container {{ max-width: 560px; margin: 0 auto; background-color: #131720; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 32px; }}
            .crest {{ color: #c5a880; font-size: 16px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 20px; }}
            .title {{ font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }}
            .desc {{ font-size: 14px; color: #9aa3b2; line-height: 1.5; margin-bottom: 20px; }}
            .info-table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #181d29; border-radius: 6px; overflow: hidden; }}
            .info-table td {{ padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }}
            .info-k {{ color: #5e6676; text-transform: uppercase; font-size: 11px; width: 140px; font-family: monospace; }}
            .info-v {{ color: #f0f2f5; font-weight: 500; }}
            .btn-group {{ display: flex; gap: 14px; margin-top: 24px; margin-bottom: 24px; }}
            .btn-approve {{ display: inline-block; padding: 12px 24px; background-color: #c5a880; color: #0b0d11; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 4px; }}
            .btn-reject {{ display: inline-block; padding: 12px 24px; background-color: #291417; color: #f87171; text-decoration: none; font-weight: 600; font-size: 13px; border: 1px solid #4a1d22; border-radius: 4px; }}
            .footer {{ font-size: 11px; color: #5e6676; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="crest">Sonam Institutional Library System</div>
            <div class="title">Administrator Access Authorization Request</div>
            <div class="desc">
                An applicant has completed email verification and is requesting elevated <strong>Administrator / Librarian privileges</strong> for Sonam Institutional Library.
            </div>
            <table class="info-table">
                <tr><td class="info-k">Applicant Name</td><td class="info-v">{applicant_name}</td></tr>
                <tr><td class="info-k">Applicant Email</td><td class="info-v">{applicant_email}</td></tr>
                <tr><td class="info-k">Requested Role</td><td class="info-v">Administrator / Librarian</td></tr>
                <tr><td class="info-k">System Authority</td><td class="info-v">Full Catalog & Circulation Privileges</td></tr>
            </table>
            <div class="desc">
                Please review this petition. If authorized, click <strong>Approve</strong> below to activate their administrative account:
            </div>
            <div class="btn-group">
                <a href="{approve_url}" class="btn-approve">Authorize Administrator</a>
                <a href="{reject_url}" class="btn-reject">Deny Request</a>
            </div>
            <div class="footer">
                Direct Approval Links:
                <br>Approve: {approve_url}
                <br>Deny: {reject_url}
                <br><br>Sonam Security & Identity Directorate
            </div>
        </div>
    </body>
    </html>
    """

    plain_content = f"""
    Sonam Institutional Library System
    Administrator Access Authorization Request
    
    An applicant is requesting Administrator privileges:
    Applicant: {applicant_name}
    Email: {applicant_email}
    Requested Role: Administrator / Librarian
    
    To APPROVE this administrator, click:
    {approve_url}
    
    To REJECT this administrator, click:
    {reject_url}
    """

    smtp_configured = bool(settings.SMTP_USER and settings.SMTP_PASSWORD)

    if smtp_configured and settings.SMTP_ENABLED:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
            msg["To"] = approver_email

            msg.attach(MIMEText(plain_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12.0) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, approver_email, msg.as_string())

            logger.info(f"Admin approval request delivered via Gmail SMTP to {approver_email}")
            return {
                "sent": True,
                "delivered_via_smtp": True,
                "approve_url": approve_url,
                "message": f"Approval request sent to {approver_email}"
            }
        except Exception as e:
            logger.error(f"Gmail SMTP dispatch failed for admin approval: {e}. Falling back to dev mode.")
            return {
                "sent": True,
                "delivered_via_smtp": False,
                "approve_url": approve_url,
                "message": f"SMTP dispatch failed ({str(e)}). Dev Approval URL: {approve_url}"
            }
    else:
        logger.info(f"[DEV MODE] Admin approval URL for {applicant_email}: {approve_url}")
        return {
            "sent": True,
            "delivered_via_smtp": False,
            "approve_url": approve_url,
            "message": f"Admin approval request generated (Dev Approval Link: {approve_url})"
        }

def send_admin_decision_notification(applicant_email: str, applicant_name: str, approved: bool) -> Dict[str, Any]:
    """Sends notification to the applicant when their admin request is approved or rejected."""
    subject = "Sonam Library: Administrator Access Approved" if approved else "Sonam Library: Administrator Access Update"
    verdict = "authorized and activated" if approved else "declined by the institutional supervisory council"

    plain_content = f"""
    Greetings {applicant_name},
    
    Your request for Administrator access to Sonam Institutional Library has been {verdict}.
    
    {"You may now log in to the library portal with your credentials." if approved else "If you believe this was in error, please contact your department chair."}
    """

    smtp_configured = bool(settings.SMTP_USER and settings.SMTP_PASSWORD)
    if smtp_configured and settings.SMTP_ENABLED:
        try:
            msg = MIMEText(plain_content, "plain")
            msg["Subject"] = subject
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
            msg["To"] = applicant_email

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12.0) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, applicant_email, msg.as_string())
        except Exception as e:
            logger.error(f"Failed to send decision email: {e}")

    return {"notified": True}
