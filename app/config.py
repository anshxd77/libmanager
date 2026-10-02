import os
from pathlib import Path
from dotenv import load_dotenv

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    APP_NAME: str = "Sonam Institutional Library Management"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Firebase Settings
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
    FIREBASE_STORAGE_BUCKET: str = os.getenv("FIREBASE_STORAGE_BUCKET", "")

    # Supabase Cloud Settings
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://libmanager-athena.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm1hbmFnZXItYXRoZW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4Mjk0MDAsImV4cCI6MjAyNTQwNTQwMH0.demo-signature-athena-cloud-2026")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ENABLED: bool = os.getenv("SUPABASE_ENABLED", "False").lower() in ("true", "1", "yes")

    # Circulation Policies
    DEFAULT_LOAN_DAYS: int = int(os.getenv("DEFAULT_LOAN_DAYS", "14"))
    FACULTY_LOAN_DAYS: int = int(os.getenv("FACULTY_LOAN_DAYS", "30"))
    RESEARCHER_LOAN_DAYS: int = int(os.getenv("RESEARCHER_LOAN_DAYS", "60"))
    DAILY_FINE_RATE: float = float(os.getenv("DAILY_FINE_RATE", "0.50"))
    GRACE_PERIOD_DAYS: int = int(os.getenv("GRACE_PERIOD_DAYS", "2"))
    MAX_RENEWALS: int = int(os.getenv("MAX_RENEWALS", "2"))

    # Gmail / SMTP Settings for OTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Sonam Library System")
    SMTP_ENABLED: bool = os.getenv("SMTP_ENABLED", "False").lower() in ("true", "1", "yes")

    # Auth & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "athena-institutional-library-secure-key-2026")
    OTP_EXPIRY_MINUTES: int = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))
    SUPER_ADMIN_APPROVAL_EMAIL: str = os.getenv("SUPER_ADMIN_APPROVAL_EMAIL", "admin@sonam.edu")

settings = Settings()
