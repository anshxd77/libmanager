from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class PatronTier(str, Enum):
    UNDERGRADUATE = "undergraduate"
    POSTGRADUATE = "postgraduate"
    FACULTY = "faculty"
    RESEARCHER = "researcher"
    GENERAL = "general"

class BookCondition(str, Enum):
    NEW = "new"
    GOOD = "good"
    FAIR = "fair"
    DAMAGED = "damaged"
    TORN_PAGES = "torn_pages"
    LIQUID_DAMAGE = "liquid_damage"
    BROKEN_SPINE = "broken_spine"
    SEVERE_DAMAGE = "severe_damage"
    LOST = "lost"

class LoanStatus(str, Enum):
    ACTIVE = "active"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"

class FineStatus(str, Enum):
    OUTSTANDING = "outstanding"
    SETTLED = "settled"
    WAIVED = "waived"

# Physical Copy Schema
class BookItemBase(BaseModel):
    barcode: str
    rfid_tag: Optional[str] = None
    location_floor: str = "Floor 1"
    location_aisle: str = "Aisle 01"
    location_shelf: str = "Shelf A-01"
    condition: BookCondition = BookCondition.GOOD
    is_circulating: bool = True

class BookItemCreate(BookItemBase):
    pass

class BookItemOut(BookItemBase):
    id: str
    book_id: str
    status: str = "available"
    created_at: str

# Bibliographic Book Schema
class BookBase(BaseModel):
    isbn_13: Optional[str] = None
    isbn_10: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    authors: List[str] = ["Unknown Author"]
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    edition: Optional[str] = None
    language: str = "English"
    classification_code: str = "000"
    dewey_category: Optional[str] = "General Works"
    summary: Optional[str] = None
    cover_image_url: Optional[str] = None

class BookCreate(BookBase):
    initial_copies: int = Field(default=1, ge=1, le=50)
    copy_location_floor: Optional[str] = "Floor 1"
    copy_location_aisle: Optional[str] = "Aisle 01"
    copy_location_shelf: Optional[str] = "Shelf A-01"

# ==========================
# AUTH & USER SCHEMAS
# ==========================
class UserRole(str, Enum):
    ADMIN = "admin"
    LIBRARIAN = "librarian"
    PATRON = "patron"

class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole = UserRole.PATRON
    phone: Optional[str] = None

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResendOtpRequest(BaseModel):
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    membership_number: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[UserOut] = None
    otp_required: bool = False
    dev_otp_preview: Optional[str] = None

class BookUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    authors: Optional[List[str]] = None
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    edition: Optional[str] = None
    classification_code: Optional[str] = None
    summary: Optional[str] = None
    cover_image_url: Optional[str] = None

class BookOut(BookBase):
    id: str
    total_copies: int
    available_copies: int
    items: List[BookItemOut] = []
    created_at: str
    updated_at: str

# Patron Schema
class PatronBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    tier: PatronTier = PatronTier.UNDERGRADUATE
    borrowing_limit: int = 5

class PatronCreate(PatronBase):
    membership_number: Optional[str] = None

class PatronUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tier: Optional[PatronTier] = None
    borrowing_limit: Optional[int] = None
    is_active: Optional[bool] = None

class PatronOut(PatronBase):
    id: str
    membership_number: str
    active_loans_count: int = 0
    outstanding_fines: float = 0.0
    is_active: bool = True
    joined_at: str

# Circulation & Loan Schemas
class LoanIssueRequest(BaseModel):
    patron_membership: str
    item_barcode: str
    custom_loan_days: Optional[int] = None
    notes: Optional[str] = None

class LoanReturnRequest(BaseModel):
    item_barcode: str
    item_condition: Optional[str] = "good"
    damage_charge: Optional[float] = 0.0
    notes: Optional[str] = None
    payment_method: Optional[str] = "account_billed"

class LoanRenewRequest(BaseModel):
    loan_id: str

class LoanOut(BaseModel):
    id: str
    book_id: str
    book_item_id: str
    book_title: str
    book_isbn: str
    barcode: str
    patron_id: str
    patron_name: str
    patron_membership: str
    issued_at: str
    due_date: str
    returned_at: Optional[str] = None
    renewals_count: int = 0
    status: LoanStatus
    is_overdue: bool = False
    overdue_days: int = 0
    calculated_fine: float = 0.0
    invoice_number: Optional[str] = None
    invoice: Optional[Dict[str, Any]] = None
    returned_condition: Optional[str] = None
    damage_charge: Optional[float] = 0.0
    overdue_fine: Optional[float] = 0.0
    total_charges: Optional[float] = 0.0
    return_slip_number: Optional[str] = None
    return_slip: Optional[Dict[str, Any]] = None

# Fine Schemas
class FineSettleRequest(BaseModel):
    amount: float
    payment_method: str = "Cash"
    notes: Optional[str] = None

class FineWaiveRequest(BaseModel):
    authorized_by: str
    reason: str

class FineOut(BaseModel):
    id: str
    loan_id: str
    patron_id: str
    patron_name: str
    patron_membership: str
    book_title: str
    amount: float
    paid_amount: float
    status: FineStatus
    reason: str
    assessed_at: str
    settled_at: Optional[str] = None
    waived_by: Optional[str] = None
    waived_reason: Optional[str] = None

# Quick Scan Universal Action
class QuickScanRequest(BaseModel):
    barcode_or_membership: str

class QuickScanResponse(BaseModel):
    entity_type: str # "book_item", "patron", "not_found"
    data: Optional[Dict[str, Any]] = None
    message: str

# Telemetry
class SystemTelemetryOut(BaseModel):
    total_titles: int
    total_holdings: int
    available_copies: int
    active_loans: int
    overdue_loans: int
    total_patrons: int
    total_fines_outstanding: float
    total_fines_collected: float
    recent_activity: List[Dict[str, Any]]
    dewey_distribution: Dict[str, int]
    firebase_connected: bool
    firebase_project_id: Optional[str] = None

# Firebase Management
class FirebaseConfigIn(BaseModel):
    project_id: Optional[str] = None
    credentials_json: Optional[str] = None

class FirebaseStatusOut(BaseModel):
    connected: bool
    mode: str # "live_firestore" or "local_resilient_store"
    project_id: Optional[str] = None
    credentials_file_found: bool
    details: str
