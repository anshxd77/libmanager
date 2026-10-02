import os
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
import firebase_admin
from firebase_admin import credentials, firestore

from app.config import settings

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
try:
    DATA_DIR.mkdir(exist_ok=True)
except Exception:
    pass
LOCAL_STORE_PATH = DATA_DIR / "library_store.json"

# Dewey Decimal Category Reference Map
DEWEY_CATEGORIES = {
    "000": "Computer Science, Information & General Works",
    "100": "Philosophy & Psychology",
    "200": "Religion & Theology",
    "300": "Social Sciences, Law & Education",
    "400": "Language & Linguistics",
    "500": "Natural Sciences & Mathematics",
    "600": "Technology & Applied Sciences",
    "700": "Arts, Architecture & Recreation",
    "800": "Literature, Rhetoric & Criticism",
    "900": "History, Geography & Biography"
}

def get_dewey_category_name(code: str) -> str:
    if not code:
        return "General Works"
    prefix = str(code).strip()[:1] + "00"
    return DEWEY_CATEGORIES.get(prefix, "General Works")

def seed_default_data() -> Dict[str, Any]:
    """Generates a rich, realistic institutional dataset for immediate out-of-the-box operation."""
    now = datetime.now(timezone.utc).isoformat()
    
    books = [
        {
            "id": "book-001",
            "isbn_13": "9780131103627",
            "isbn_10": "0131103628",
            "title": "The C Programming Language",
            "subtitle": "Second Edition",
            "authors": ["Brian W. Kernighan", "Dennis M. Ritchie"],
            "publisher": "Prentice Hall",
            "publication_year": 1988,
            "edition": "2nd",
            "language": "English",
            "classification_code": "005.133",
            "dewey_category": "Computer Science, Information & General Works",
            "summary": "The definitive guide to ANSI standard C by the original designers of the language. Essential reference for systems engineers and computer scientists.",
            "cover_image_url": "https://covers.openlibrary.org/b/id/8231996-L.jpg",
            "total_copies": 4,
            "available_copies": 3,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "book-002",
            "isbn_13": "9780201896831",
            "isbn_10": "0201896834",
            "title": "The Art of Computer Programming: Fundamental Algorithms",
            "subtitle": "Volume 1, Third Edition",
            "authors": ["Donald E. Knuth"],
            "publisher": "Addison-Wesley Professional",
            "publication_year": 1997,
            "edition": "3rd",
            "language": "English",
            "classification_code": "005.1",
            "dewey_category": "Computer Science, Information & General Works",
            "summary": "The bible of algorithmic computer science. Beginning with basic programming concepts and information structures, this work investigates mathematical foundations.",
            "cover_image_url": "https://covers.openlibrary.org/b/id/6513470-L.jpg",
            "total_copies": 3,
            "available_copies": 2,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "book-003",
            "isbn_13": "9780262033848",
            "isbn_10": "0262033844",
            "title": "Introduction to Algorithms",
            "subtitle": "Third Edition",
            "authors": ["Thomas H. Cormen", "Charles E. Leiserson", "Ronald L. Rivest", "Clifford Stein"],
            "publisher": "MIT Press",
            "publication_year": 2009,
            "edition": "3rd",
            "language": "English",
            "classification_code": "518.1",
            "dewey_category": "Natural Sciences & Mathematics",
            "summary": "Comprehensive textbook covering a broad range of algorithms in depth, making their design and analysis accessible to all levels of readers.",
            "cover_image_url": "https://covers.openlibrary.org/b/id/6979861-L.jpg",
            "total_copies": 5,
            "available_copies": 4,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "book-004",
            "isbn_13": "9780521876582",
            "isbn_10": "0521876587",
            "title": "Principia Mathematica",
            "subtitle": "to *56",
            "authors": ["Alfred North Whitehead", "Bertrand Russell"],
            "publisher": "Cambridge University Press",
            "publication_year": 1927,
            "edition": "2nd",
            "language": "English",
            "classification_code": "510.1",
            "dewey_category": "Natural Sciences & Mathematics",
            "summary": "Monolithic treatise on the foundations of mathematics, reconstructing mathematical concepts from a minimal set of logical axioms and rules of inference.",
            "cover_image_url": "https://covers.openlibrary.org/b/id/7946132-L.jpg",
            "total_copies": 2,
            "available_copies": 1,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "book-005",
            "isbn_13": "9780143105954",
            "isbn_10": "0143105959",
            "title": "The Republic",
            "subtitle": "Penguin Classics Deluxe Edition",
            "authors": ["Plato"],
            "publisher": "Penguin Books",
            "publication_year": 2007,
            "edition": "Revised",
            "language": "English",
            "classification_code": "184",
            "dewey_category": "Philosophy & Psychology",
            "summary": "Plato's quintessential philosophical dialogue concerning justice, the order and character of the just city-state, and the nature of the philosopher-king.",
            "cover_image_url": "https://covers.openlibrary.org/b/id/8305096-L.jpg",
            "total_copies": 3,
            "available_copies": 3,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "book-006",
            "isbn_13": "9780441172719",
            "isbn_10": "0441172717",
            "title": "Dune",
            "subtitle": "40th Anniversary Collector's Edition",
            "authors": ["Frank Herbert"],
            "publisher": "Ace Books",
            "publication_year": 1965,
            "edition": "Anniversary",
            "language": "English",
            "classification_code": "813.54",
            "dewey_category": "Literature, Rhetoric & Criticism",
            "summary": "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world.",
            "cover_image_url": "https://covers.openlibrary.org/b/id/9124441-L.jpg",
            "total_copies": 4,
            "available_copies": 4,
            "created_at": now,
            "updated_at": now
        }
    ]

    items = [
        # Book 1 items
        {"id": "item-001", "book_id": "book-001", "barcode": "LIB-00101", "rfid_tag": "RF-8801", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-01", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-002", "book_id": "book-001", "barcode": "LIB-00102", "rfid_tag": "RF-8802", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-01", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-003", "book_id": "book-001", "barcode": "LIB-00103", "rfid_tag": "RF-8803", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-01", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-004", "book_id": "book-001", "barcode": "LIB-00104", "rfid_tag": "RF-8804", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-01", "condition": "good", "status": "loaned", "is_circulating": True, "created_at": now},
        # Book 2 items
        {"id": "item-005", "book_id": "book-002", "barcode": "LIB-00201", "rfid_tag": "RF-8805", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-02", "condition": "new", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-006", "book_id": "book-002", "barcode": "LIB-00202", "rfid_tag": "RF-8806", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-02", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-007", "book_id": "book-002", "barcode": "LIB-00203", "rfid_tag": "RF-8807", "location_floor": "Floor 2", "location_aisle": "Aisle 03", "location_shelf": "Shelf CS-02", "condition": "good", "status": "loaned", "is_circulating": True, "created_at": now},
        # Book 3 items
        {"id": "item-008", "book_id": "book-003", "barcode": "LIB-00301", "rfid_tag": "RF-8808", "location_floor": "Floor 3", "location_aisle": "Aisle 01", "location_shelf": "Shelf MA-04", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-009", "book_id": "book-003", "barcode": "LIB-00302", "rfid_tag": "RF-8809", "location_floor": "Floor 3", "location_aisle": "Aisle 01", "location_shelf": "Shelf MA-04", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-010", "book_id": "book-003", "barcode": "LIB-00303", "rfid_tag": "RF-8810", "location_floor": "Floor 3", "location_aisle": "Aisle 01", "location_shelf": "Shelf MA-04", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-011", "book_id": "book-003", "barcode": "LIB-00304", "rfid_tag": "RF-8811", "location_floor": "Floor 3", "location_aisle": "Aisle 01", "location_shelf": "Shelf MA-04", "condition": "fair", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-012", "book_id": "book-003", "barcode": "LIB-00305", "rfid_tag": "RF-8812", "location_floor": "Floor 3", "location_aisle": "Aisle 01", "location_shelf": "Shelf MA-04", "condition": "good", "status": "loaned", "is_circulating": True, "created_at": now},
        # Book 4 items
        {"id": "item-013", "book_id": "book-004", "barcode": "LIB-00401", "rfid_tag": "RF-8813", "location_floor": "Special Collections", "location_aisle": "Vault B", "location_shelf": "Archive 01", "condition": "fair", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-014", "book_id": "book-004", "barcode": "LIB-00402", "rfid_tag": "RF-8814", "location_floor": "Special Collections", "location_aisle": "Vault B", "location_shelf": "Archive 01", "condition": "good", "status": "loaned", "is_circulating": True, "created_at": now},
        # Book 5 items
        {"id": "item-015", "book_id": "book-005", "barcode": "LIB-00501", "rfid_tag": "RF-8815", "location_floor": "Floor 1", "location_aisle": "Aisle 04", "location_shelf": "Shelf PH-08", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-016", "book_id": "book-005", "barcode": "LIB-00502", "rfid_tag": "RF-8816", "location_floor": "Floor 1", "location_aisle": "Aisle 04", "location_shelf": "Shelf PH-08", "condition": "new", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-017", "book_id": "book-005", "barcode": "LIB-00503", "rfid_tag": "RF-8817", "location_floor": "Floor 1", "location_aisle": "Aisle 04", "location_shelf": "Shelf PH-08", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        # Book 6 items
        {"id": "item-018", "book_id": "book-006", "barcode": "LIB-00601", "rfid_tag": "RF-8818", "location_floor": "Floor 1", "location_aisle": "Aisle 02", "location_shelf": "Shelf LT-15", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-019", "book_id": "book-006", "barcode": "LIB-00602", "rfid_tag": "RF-8819", "location_floor": "Floor 1", "location_aisle": "Aisle 02", "location_shelf": "Shelf LT-15", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-020", "book_id": "book-006", "barcode": "LIB-00603", "rfid_tag": "RF-8820", "location_floor": "Floor 1", "location_aisle": "Aisle 02", "location_shelf": "Shelf LT-15", "condition": "new", "status": "available", "is_circulating": True, "created_at": now},
        {"id": "item-021", "book_id": "book-006", "barcode": "LIB-00604", "rfid_tag": "RF-8821", "location_floor": "Floor 1", "location_aisle": "Aisle 02", "location_shelf": "Shelf LT-15", "condition": "good", "status": "available", "is_circulating": True, "created_at": now},
    ]

    patrons = [
        {
            "id": "patron-001",
            "membership_number": "ATH-8021",
            "first_name": "Eleanor",
            "last_name": "Vance",
            "email": "e.vance@archival.edu",
            "phone": "+1 (555) 234-8901",
            "tier": "researcher",
            "borrowing_limit": 10,
            "active_loans_count": 2,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-01-15T09:00:00Z"
        },
        {
            "id": "patron-002",
            "membership_number": "ATH-8022",
            "first_name": "Julian",
            "last_name": "Sterling",
            "email": "j.sterling@archival.edu",
            "phone": "+1 (555) 345-6789",
            "tier": "faculty",
            "borrowing_limit": 15,
            "active_loans_count": 1,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-02-01T10:30:00Z"
        },
        {
            "id": "patron-003",
            "membership_number": "ATH-8023",
            "first_name": "Marcus",
            "last_name": "Holloway",
            "email": "m.holloway@archival.edu",
            "phone": "+1 (555) 456-7890",
            "tier": "undergraduate",
            "borrowing_limit": 5,
            "active_loans_count": 1,
            "outstanding_fines": 4.50,
            "is_active": True,
            "joined_at": "2026-03-10T14:15:00Z"
        },
        {
            "id": "patron-004",
            "membership_number": "ATH-8024",
            "first_name": "Dr. Beatrice",
            "last_name": "Thornton",
            "email": "b.thornton@archival.edu",
            "phone": "+1 (555) 567-8901",
            "tier": "faculty",
            "borrowing_limit": 15,
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-01-20T11:00:00Z"
        },
        {
            "id": "patron-aarav-8031",
            "membership_number": "ATH-8031",
            "first_name": "Aarav",
            "last_name": "Sharma",
            "email": "aarav.sharma@archival.edu",
            "phone": "+1 (555) 782-9011",
            "tier": "undergraduate",
            "borrowing_limit": 5,
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-10-02T09:10:00Z"
        },
        {
            "id": "patron-sophia-8032",
            "membership_number": "ATH-8032",
            "first_name": "Sophia",
            "last_name": "Chen",
            "email": "sophia.chen@archival.edu",
            "phone": "+1 (555) 641-3829",
            "tier": "postgraduate",
            "borrowing_limit": 8,
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-10-02T09:12:00Z"
        },
        {
            "id": "patron-liam-8033",
            "membership_number": "ATH-8033",
            "first_name": "Liam",
            "last_name": "O'Connor",
            "email": "liam.oconnor@archival.edu",
            "phone": "+1 (555) 912-4402",
            "tier": "undergraduate",
            "borrowing_limit": 5,
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-10-02T09:14:00Z"
        },
        {
            "id": "patron-ananya-8034",
            "membership_number": "ATH-8034",
            "first_name": "Ananya",
            "last_name": "Patel",
            "email": "ananya.patel@archival.edu",
            "phone": "+1 (555) 834-1190",
            "tier": "postgraduate",
            "borrowing_limit": 8,
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-10-02T09:16:00Z"
        },
        {
            "id": "patron-lucas-8035",
            "membership_number": "ATH-8035",
            "first_name": "Lucas",
            "last_name": "Moreau",
            "email": "lucas.moreau@archival.edu",
            "phone": "+1 (555) 523-7744",
            "tier": "undergraduate",
            "borrowing_limit": 5,
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": "2026-10-02T09:18:00Z"
        }
    ]

    due_soon = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    overdue_date = (datetime.now(timezone.utc) - timedelta(days=9)).isoformat()
    past_issued = (datetime.now(timezone.utc) - timedelta(days=23)).isoformat()
    recent_issued = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    loans = [
        {
            "id": "loan-001",
            "book_id": "book-001",
            "book_item_id": "item-004",
            "book_title": "The C Programming Language",
            "book_isbn": "9780131103627",
            "barcode": "LIB-00104",
            "patron_id": "patron-001",
            "patron_name": "Eleanor Vance",
            "patron_membership": "ATH-8021",
            "issued_at": recent_issued,
            "due_date": due_soon,
            "returned_at": None,
            "renewals_count": 0,
            "status": "active"
        },
        {
            "id": "loan-002",
            "book_id": "book-002",
            "book_item_id": "item-007",
            "book_title": "The Art of Computer Programming: Fundamental Algorithms",
            "book_isbn": "9780201896831",
            "barcode": "LIB-00203",
            "patron_id": "patron-001",
            "patron_name": "Eleanor Vance",
            "patron_membership": "ATH-8021",
            "issued_at": recent_issued,
            "due_date": due_soon,
            "returned_at": None,
            "renewals_count": 0,
            "status": "active"
        },
        {
            "id": "loan-003",
            "book_id": "book-004",
            "book_item_id": "item-014",
            "book_title": "Principia Mathematica",
            "book_isbn": "9780521876582",
            "barcode": "LIB-00402",
            "patron_id": "patron-002",
            "patron_name": "Julian Sterling",
            "patron_membership": "ATH-8022",
            "issued_at": recent_issued,
            "due_date": due_soon,
            "returned_at": None,
            "renewals_count": 0,
            "status": "active"
        },
        {
            "id": "loan-004",
            "book_id": "book-003",
            "book_item_id": "item-012",
            "book_title": "Introduction to Algorithms",
            "book_isbn": "9780262033848",
            "barcode": "LIB-00305",
            "patron_id": "patron-003",
            "patron_name": "Marcus Holloway",
            "patron_membership": "ATH-8023",
            "issued_at": past_issued,
            "due_date": overdue_date,
            "returned_at": None,
            "renewals_count": 0,
            "status": "overdue"
        }
    ]

    fines = [
        {
            "id": "fine-001",
            "loan_id": "loan-004",
            "patron_id": "patron-003",
            "patron_name": "Marcus Holloway",
            "patron_membership": "ATH-8023",
            "book_title": "Introduction to Algorithms",
            "amount": 4.50,
            "paid_amount": 0.00,
            "status": "outstanding",
            "reason": "Overdue loan (9 days overdue beyond 2-day grace period)",
            "assessed_at": overdue_date,
            "settled_at": None,
            "waived_by": None,
            "waived_reason": None
        }
    ]

    audit_logs = [
        {"id": "log-001", "action": "INITIAL_SEED", "entity": "system", "entity_id": "root", "details": "Institutional seed catalog and circulation loaded", "timestamp": now},
        {"id": "log-002", "action": "CIRCULATION_ISSUE", "entity": "loan", "entity_id": "loan-004", "details": "Issued LIB-00305 to ATH-8023", "timestamp": past_issued},
        {"id": "log-003", "action": "CIRCULATION_ISSUE", "entity": "loan", "entity_id": "loan-001", "details": "Issued LIB-00104 to ATH-8021", "timestamp": recent_issued},
    ]

    users = [
        {
            "id": "user-admin-01",
            "email": "admin@athena.edu",
            "full_name": "Chief Librarian Eleanor Vance",
            "password_hash": "athenasalt1$5f5f0b4bba6fdb6b719917db1d1af28a31286884eac5427e598f98509e38f069",
            "role": "admin",
            "membership_number": "ATH-ADMIN-01",
            "created_at": now
        },
        {
            "id": "user-patron-01",
            "email": "patron@athena.edu",
            "full_name": "Julian Sterling",
            "password_hash": "athenasalt2$8ea8766bbe203c0d77ad3712232f73b7cf99800f7238bc681c7f4e2854bf3949",
            "role": "patron",
            "membership_number": "ATH-8022",
            "created_at": now
        }
    ]

    return {
        "books": books,
        "items": items,
        "patrons": patrons,
        "loans": loans,
        "fines": fines,
        "audit_logs": audit_logs,
        "users": users
    }

class RepositoryManager:
    """
    Manages dual-mode data storage:
    - Direct Google Cloud Firestore if Firebase is initialized.
    - Resilient local JSON datastore if Firebase credentials are pending or offline.
    """
    def __init__(self):
        self.firebase_app = None
        self.firestore_db = None
        self.is_firebase_connected = False
        self.project_id = None
        self.local_data: Dict[str, List[Dict[str, Any]]] = {}

        self._load_local_data()
        self._init_firebase()

    def _load_local_data(self):
        """Loads or initializes local JSON state."""
        tmp_path = Path("/tmp/library_store.json")
        target_path = tmp_path if tmp_path.exists() else LOCAL_STORE_PATH
        if target_path.exists():
            try:
                with open(target_path, "r", encoding="utf-8") as f:
                    self.local_data = json.load(f)
                    logger.info(f"Loaded local library store from {target_path}.")
                    return
            except Exception as e:
                logger.error(f"Failed to read local store, regenerating: {e}")
        
        self.local_data = seed_default_data()
        self._save_local_data()

    def _save_local_data(self):
        try:
            with open(LOCAL_STORE_PATH, "w", encoding="utf-8") as f:
                json.dump(self.local_data, f, indent=2, ensure_ascii=False)
        except Exception:
            # Fallback for read-only serverless environments (Vercel)
            try:
                tmp_path = Path("/tmp/library_store.json")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(self.local_data, f, indent=2, ensure_ascii=False)
            except Exception as e2:
                logger.error(f"Failed to persist local store: {e2}")

    def _init_firebase(self):
        """Attempts to initialize Firebase Admin SDK from environment or serviceAccountKey.json."""
        creds_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
        if not creds_path.is_absolute():
            creds_path = Path(__file__).resolve().parent.parent / creds_path

        if creds_path.exists():
            try:
                cred = credentials.Certificate(str(creds_path))
                self.firebase_app = firebase_admin.initialize_app(cred)
                self.firestore_db = firestore.client()
                self.is_firebase_connected = True
                self.project_id = cred.project_id
                logger.info(f"Connected to Firebase Firestore project: {self.project_id}")
                return
            except Exception as e:
                logger.warning(f"Found credentials file but failed to connect to Firestore: {e}")

        # Check if already initialized by another module
        try:
            default_app = firebase_admin.get_app()
            self.firebase_app = default_app
            self.firestore_db = firestore.client()
            self.is_firebase_connected = True
            logger.info("Connected to existing Firebase default app.")
        except ValueError:
            self.is_firebase_connected = False
            logger.info("Running in Resilient Local Storage mode (Firebase credentials pending).")

    def connect_with_credentials_json(self, json_content_or_dict: Any) -> bool:
        """Dynamically link Firebase using raw JSON string or parsed dictionary."""
        try:
            if isinstance(json_content_or_dict, str):
                data = json.loads(json_content_or_dict)
            else:
                data = json_content_or_dict

            cred = credentials.Certificate(data)
            
            # Clean up old app if any
            if self.firebase_app:
                try:
                    firebase_admin.delete_app(self.firebase_app)
                except Exception:
                    pass

            self.firebase_app = firebase_admin.initialize_app(cred)
            self.firestore_db = firestore.client()
            self.is_firebase_connected = True
            self.project_id = cred.project_id
            
            # Save to serviceAccountKey.json for future boots
            key_file = Path(__file__).resolve().parent.parent / "serviceAccountKey.json"
            with open(key_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            logger.info(f"Successfully dynamically connected to Firebase: {self.project_id}")
            return True
        except Exception as e:
            logger.error(f"Failed dynamic Firebase connection: {e}")
            raise e

    def get_firebase_status(self) -> Dict[str, Any]:
        creds_path = Path(__file__).resolve().parent.parent / "serviceAccountKey.json"
        return {
            "connected": self.is_firebase_connected,
            "mode": "live_firestore" if self.is_firebase_connected else "local_resilient_store",
            "project_id": self.project_id,
            "credentials_file_found": creds_path.exists(),
            "details": f"Connected to Firestore project '{self.project_id}'" if self.is_firebase_connected else "Using high-performance local store (no cloud credentials loaded)"
        }

    # ==========================
    # BOOKS & CATALOG
    # ==========================
    def get_books(self, search: Optional[str] = None, dewey_prefix: Optional[str] = None) -> List[Dict[str, Any]]:
        books = list(self.local_data.get("books", []))
        items_map = {}
        for item in self.local_data.get("items", []):
            b_id = item["book_id"]
            if b_id not in items_map:
                items_map[b_id] = []
            items_map[b_id].append(item)

        results = []
        for b in books:
            b_copy = dict(b)
            b_copy["items"] = items_map.get(b["id"], [])
            
            # Filters
            if search:
                term = search.lower().strip()
                matches_title = term in b_copy.get("title", "").lower()
                matches_author = any(term in a.lower() for a in b_copy.get("authors", []))
                matches_isbn = term in b_copy.get("isbn_13", "") or term in (b_copy.get("isbn_10") or "")
                matches_desc = term in (b_copy.get("summary") or "").lower()
                if not (matches_title or matches_author or matches_isbn or matches_desc):
                    continue

            if dewey_prefix:
                clean_dewey = dewey_prefix.strip()
                code = b_copy.get("classification_code", "")
                if not code.startswith(clean_dewey[:1]):
                    continue

            results.append(b_copy)

        return results

    def get_book_by_id(self, book_id: str) -> Optional[Dict[str, Any]]:
        for b in self.local_data.get("books", []):
            if b["id"] == book_id:
                b_copy = dict(b)
                b_copy["items"] = [i for i in self.local_data.get("items", []) if i["book_id"] == book_id]
                return b_copy
        return None

    def get_book_by_isbn(self, isbn: str) -> Optional[Dict[str, Any]]:
        clean = isbn.replace("-", "").replace(" ", "").strip()
        for b in self.local_data.get("books", []):
            if b.get("isbn_13", "").replace("-", "") == clean or (b.get("isbn_10") and b["isbn_10"].replace("-", "") == clean):
                b_copy = dict(b)
                b_copy["items"] = [i for i in self.local_data.get("items", []) if i["book_id"] == b["id"]]
                return b_copy
        return None

    def save_book(self, book_data: Dict[str, Any], initial_copies: int = 1, copy_loc: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        book_id = f"book-{uuid.uuid4().hex[:8]}"
        
        # Ensure ISBN-13 is valid and never empty
        isbn_val = book_data.get("isbn_13")
        if not isbn_val or not str(isbn_val).strip():
            isbn_val = f"9780{uuid.uuid4().int % 1000000000:09d}"
        else:
            isbn_val = str(isbn_val).strip()

        # Handle potential duplicate ISBN gracefully by appending suffix if already in database
        existing = self.get_book_by_isbn(isbn_val)
        if existing and existing.get("id") != book_id:
            isbn_val = f"{isbn_val}-{uuid.uuid4().hex[:4].upper()}"

        # Normalize authors to list
        authors_val = book_data.get("authors", [])
        if isinstance(authors_val, str):
            authors_val = [a.strip() for a in authors_val.split(",") if a.strip()]
        if not authors_val:
            authors_val = ["Unknown Author"]

        book_entry = {
            "id": book_id,
            "isbn_13": isbn_val,
            "isbn_10": book_data.get("isbn_10"),
            "title": str(book_data.get("title", "Untitled Archival Work")).strip(),
            "subtitle": book_data.get("subtitle"),
            "authors": authors_val,
            "publisher": book_data.get("publisher") or "Institutional Press",
            "publication_year": book_data.get("publication_year") or datetime.now().year,
            "edition": book_data.get("edition") or "1st",
            "language": book_data.get("language", "English"),
            "classification_code": book_data.get("classification_code", "000"),
            "dewey_category": get_dewey_category_name(book_data.get("classification_code", "000")),
            "summary": book_data.get("summary") or "Cataloged institutional volume.",
            "cover_image_url": book_data.get("cover_image_url"),
            "total_copies": initial_copies,
            "available_copies": initial_copies,
            "created_at": now,
            "updated_at": now
        }
        
        self.local_data.setdefault("books", []).insert(0, book_entry)

        # Generate physical inventory copies
        loc = copy_loc or {}
        created_items = []
        for idx in range(initial_copies):
            barcode_num = len(self.local_data.get("items", [])) + 101
            barcode = f"LIB-{barcode_num:05d}"
            item = {
                "id": f"item-{uuid.uuid4().hex[:8]}",
                "book_id": book_id,
                "barcode": barcode,
                "rfid_tag": f"RF-{uuid.uuid4().hex[:6].upper()}",
                "location_floor": loc.get("location_floor", "Floor 1"),
                "location_aisle": loc.get("location_aisle", "Aisle 01"),
                "location_shelf": loc.get("location_shelf", "Shelf A-01"),
                "condition": "new",
                "status": "available",
                "is_circulating": True,
                "created_at": now
            }
            self.local_data.setdefault("items", []).append(item)
            created_items.append(item)

        self._save_local_data()
        self.log_audit("CATALOG_CREATE", "book", book_id, f"Added '{book_entry['title']}' with {initial_copies} copies.")

        # Sync to Firestore if live
        if self.is_firebase_connected and self.firestore_db:
            try:
                self.firestore_db.collection("books").document(book_id).set(book_entry)
                for itm in created_items:
                    self.firestore_db.collection("book_items").document(itm["id"]).set(itm)
            except Exception as e:
                logger.error(f"Firestore sync error on save_book: {e}")

        result = dict(book_entry)
        result["items"] = created_items
        return result

    def add_copy_to_book(self, book_id: str, floor: str = "Floor 1", aisle: str = "Aisle 01", shelf: str = "Shelf A-01") -> Optional[Dict[str, Any]]:
        book = self.get_book_by_id(book_id)
        if not book:
            return None

        now = datetime.now(timezone.utc).isoformat()
        barcode_num = len(self.local_data.get("items", [])) + 101
        barcode = f"LIB-{barcode_num:05d}"
        item = {
            "id": f"item-{uuid.uuid4().hex[:8]}",
            "book_id": book_id,
            "barcode": barcode,
            "rfid_tag": f"RF-{uuid.uuid4().hex[:6].upper()}",
            "location_floor": floor,
            "location_aisle": aisle,
            "location_shelf": shelf,
            "condition": "new",
            "status": "available",
            "is_circulating": True,
            "created_at": now
        }
        self.local_data.setdefault("items", []).append(item)

        for b in self.local_data["books"]:
            if b["id"] == book_id:
                b["total_copies"] += 1
                b["available_copies"] += 1
                b["updated_at"] = now
                break

        self._save_local_data()
        self.log_audit("CATALOG_ADD_COPY", "book_item", item["id"], f"Added copy {barcode} to {book['title']}")
        return item

    # ==========================
    # PHYSICAL ITEMS
    # ==========================
    def get_book_item_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        clean_barcode = barcode.strip().upper()
        for itm in self.local_data.get("items", []):
            if itm["barcode"].upper() == clean_barcode:
                return dict(itm)
        return None

    # ==========================
    # USERS & ACCOUNTS
    # ==========================
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.lower().strip()
        for u in self.local_data.get("users", []):
            if u.get("email", "").lower() == clean_email:
                return dict(u)
        # Aliases for Sonam rebranding
        if clean_email == "admin@sonam.edu":
            for u in self.local_data.get("users", []):
                if u.get("email", "").lower() in ("admin@athena.edu", "admin@sonam.edu"):
                    res = dict(u)
                    res["email"] = "admin@sonam.edu"
                    return res
        elif clean_email == "patron@sonam.edu":
            for u in self.local_data.get("users", []):
                if u.get("email", "").lower() in ("patron@athena.edu", "patron@sonam.edu"):
                    res = dict(u)
                    res["email"] = "patron@sonam.edu"
                    return res
        return None

    def create_user(self, user_dict: Dict[str, Any]) -> Dict[str, Any]:
        entry = dict(user_dict)
        if "id" not in entry:
            entry["id"] = f"user-{uuid.uuid4().hex[:8]}"
        if "created_at" not in entry:
            entry["created_at"] = datetime.now(timezone.utc).isoformat()
        
        # Check if already exists and update
        clean_email = entry["email"].lower().strip()
        for idx, u in enumerate(self.local_data.get("users", [])):
            if u.get("email", "").lower() == clean_email:
                self.local_data["users"][idx] = entry
                self._save_local_data()
                return entry

        self.local_data.setdefault("users", []).append(entry)
        self._save_local_data()
        self.log_audit("USER_REGISTER", "user", entry["id"], f"User {entry.get('full_name')} registered ({entry.get('email')})")
        return entry

    def update_user_password(self, email: str, new_hash: str) -> bool:
        clean_email = email.lower().strip()
        for u in self.local_data.get("users", []):
            if u.get("email", "").lower() == clean_email:
                u["password_hash"] = new_hash
                u["updated_at"] = datetime.now(timezone.utc).isoformat()
                self._save_local_data()
                return True
        return False

    # ==========================
    # ADMIN APPROVALS
    # ==========================
    def get_admin_approvals(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        approvals = list(self.local_data.get("admin_approvals", []))
        if status:
            approvals = [a for a in approvals if a.get("status") == status]
        return approvals

    def get_admin_approval_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        for a in self.local_data.get("admin_approvals", []):
            if a.get("token") == token:
                return dict(a)
        return None

    def create_admin_approval_request(self, applicant_name: str, applicant_email: str, user_id: str, token: str) -> Dict[str, Any]:
        entry = {
            "id": f"appr-{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "applicant_name": applicant_name,
            "applicant_email": applicant_email,
            "requested_role": "admin",
            "token": token,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewed_by": None
        }
        self.local_data.setdefault("admin_approvals", []).insert(0, entry)
        self._save_local_data()
        self.log_audit("ADMIN_APPROVAL_REQUEST", "user", user_id, f"Admin petition submitted for {applicant_email}")
        return entry

    def review_admin_approval(self, identifier: str, decision: str, reviewer_email: str = "super_admin") -> Optional[Dict[str, Any]]:
        target = None
        for a in self.local_data.get("admin_approvals", []):
            if a.get("token") == identifier or a.get("id") == identifier:
                target = a
                break

        if not target:
            return None

        now = datetime.now(timezone.utc).isoformat()
        target["status"] = "approved" if decision == "approve" else "rejected"
        target["reviewed_at"] = now
        target["reviewed_by"] = reviewer_email

        # Update the user record status
        for u in self.local_data.get("users", []):
            if u.get("id") == target["user_id"] or u.get("email").lower() == target["applicant_email"].lower():
                u["status"] = "active" if decision == "approve" else "rejected"
                u["reviewed_at"] = now
                break

        self._save_local_data()
        self.log_audit(f"ADMIN_APPROVAL_{decision.upper()}", "admin_approval", target["id"], f"{decision.capitalize()}d admin access for {target['applicant_email']}")
        return target

    # ==========================
    # PATRONS
    # ==========================
    def get_patrons(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        patrons = list(self.local_data.get("patrons", []))
        if not search:
            return patrons

        term = search.lower().strip()
        filtered = []
        for p in patrons:
            name = f"{p.get('first_name', '')} {p.get('last_name', '')}".lower()
            if term in name or term in p.get("membership_number", "").lower() or term in p.get("email", "").lower():
                filtered.append(p)
        return filtered

    def get_patron_by_id(self, patron_id: str) -> Optional[Dict[str, Any]]:
        for p in self.local_data.get("patrons", []):
            if p["id"] == patron_id:
                return dict(p)
        return None

    def get_patron_by_membership(self, membership_number: str) -> Optional[Dict[str, Any]]:
        clean = membership_number.strip().upper()
        for p in self.local_data.get("patrons", []):
            if p["membership_number"].upper() == clean:
                return dict(p)
        return None

    def save_patron(self, patron_data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        patron_id = f"patron-{uuid.uuid4().hex[:8]}"
        
        # Auto-generate membership card if absent
        membership = patron_data.get("membership_number")
        if not membership:
            num = len(self.local_data.get("patrons", [])) + 8025
            membership = f"ATH-{num}"

        entry = {
            "id": patron_id,
            "membership_number": membership,
            "first_name": patron_data["first_name"],
            "last_name": patron_data["last_name"],
            "email": patron_data["email"],
            "phone": patron_data.get("phone"),
            "tier": patron_data.get("tier", "undergraduate"),
            "borrowing_limit": patron_data.get("borrowing_limit", 5),
            "active_loans_count": 0,
            "outstanding_fines": 0.00,
            "is_active": True,
            "joined_at": now
        }
        self.local_data.setdefault("patrons", []).insert(0, entry)
        self._save_local_data()
        self.log_audit("PATRON_REGISTER", "patron", patron_id, f"Registered patron {entry['first_name']} {entry['last_name']} ({membership})")
        return entry

    # ==========================
    # CIRCULATION & LOANS
    # ==========================
    def get_loans(self, status: Optional[str] = None, patron_id: Optional[str] = None) -> List[Dict[str, Any]]:
        loans = list(self.local_data.get("loans", []))
        results = []
        now = datetime.now(timezone.utc)

        for l in loans:
            l_copy = dict(l)
            # Recompute dynamic overdue flag
            due = datetime.fromisoformat(l["due_date"].replace("Z", "+00:00"))
            if l["status"] == "active" and now > due:
                l_copy["status"] = "overdue"
                l_copy["is_overdue"] = True
                delta = now - due
                l_copy["overdue_days"] = delta.days
                if delta.days > settings.GRACE_PERIOD_DAYS:
                    chargeable_days = delta.days - settings.GRACE_PERIOD_DAYS
                    l_copy["calculated_fine"] = round(chargeable_days * settings.DAILY_FINE_RATE, 2)
                else:
                    l_copy["calculated_fine"] = 0.0
            else:
                l_copy["is_overdue"] = (l["status"] == "overdue")
                l_copy["overdue_days"] = 0
                l_copy["calculated_fine"] = 0.0

            if status and l_copy["status"] != status:
                continue
            if patron_id and l_copy["patron_id"] != patron_id:
                continue

            results.append(l_copy)

        return results

    def get_loan_by_id(self, loan_id: str) -> Optional[Dict[str, Any]]:
        for l in self.get_loans():
            if l["id"] == loan_id:
                return l
        return None

    def issue_loan(self, patron_membership: str, item_barcode: str, custom_days: Optional[int] = None, notes: Optional[str] = None) -> Dict[str, Any]:
        """
        Atomic checkout execution:
        - Validates patron existence and status
        - Checks borrowing limit
        - Verifies item existence and circulating availability
        - Adjusts book copy availability
        - Generates loan ledger record
        """
        patron = self.get_patron_by_membership(patron_membership)
        if not patron:
            raise ValueError(f"No patron found with membership number: '{patron_membership}'")
        if not patron.get("is_active", True):
            raise ValueError("Patron account is suspended or inactive.")
        if patron.get("active_loans_count", 0) >= patron.get("borrowing_limit", 5):
            raise ValueError(f"Patron has reached borrowing quota limit of {patron.get('borrowing_limit')} items.")
        if patron.get("outstanding_fines", 0) > 15.00:
            raise ValueError(f"Patron has outstanding fines (${patron['outstanding_fines']:.2f}) exceeding the allowable threshold.")

        item = self.get_book_item_by_barcode(item_barcode)
        if not item:
            raise ValueError(f"Item with barcode '{item_barcode}' not found in catalog.")
        if item.get("status") != "available":
            raise ValueError(f"Item {item_barcode} is currently {item.get('status')}. Cannot issue.")
        if not item.get("is_circulating", True):
            raise ValueError(f"Item {item_barcode} is designated as non-circulating archive reference.")

        book = self.get_book_by_id(item["book_id"])
        if not book:
            raise ValueError("Bibliographic book record not found for this item.")

        now = datetime.now(timezone.utc)
        
        # Determine loan duration based on tier or custom override
        if custom_days and custom_days > 0:
            loan_days = custom_days
        else:
            tier = patron.get("tier", "undergraduate")
            if tier == "researcher":
                loan_days = settings.RESEARCHER_LOAN_DAYS
            elif tier == "faculty":
                loan_days = settings.FACULTY_LOAN_DAYS
            else:
                loan_days = settings.DEFAULT_LOAN_DAYS

        due_date = (now + timedelta(days=loan_days)).isoformat()
        loan_id = f"loan-{uuid.uuid4().hex[:8]}"

        invoice_number = f"INV-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        invoice_record = {
            "invoice_number": invoice_number,
            "loan_id": loan_id,
            "issued_at": now.isoformat(),
            "due_date": due_date,
            "patron_id": patron["id"],
            "patron_name": f"{patron['first_name']} {patron['last_name']}",
            "patron_membership": patron["membership_number"],
            "patron_email": patron.get("email", ""),
            "patron_tier": patron.get("tier", "undergraduate"),
            "book_id": book["id"],
            "book_title": book["title"],
            "book_authors": book.get("authors", []),
            "book_isbn": book.get("isbn_13") or book.get("isbn_10") or "",
            "barcode": item["barcode"],
            "shelf_location": f"{item.get('location_floor', '')}, {item.get('location_shelf', '')}".strip(" ,"),
            "condition": item.get("condition", "good"),
            "daily_fine_rate": settings.DAILY_FINE_RATE,
            "loan_period_days": loan_days,
            "issue_fee": 15.00,
            "security_deposit": 50.00,
            "total_charged": 65.00,
            "status": "ISSUED",
            "station": "Circulation Desk 01",
            "librarian": "Dr. Eleanor Vance (Archivist)"
        }

        loan_record = {
            "id": loan_id,
            "book_id": book["id"],
            "book_item_id": item["id"],
            "book_title": book["title"],
            "book_isbn": book["isbn_13"],
            "barcode": item["barcode"],
            "patron_id": patron["id"],
            "patron_name": f"{patron['first_name']} {patron['last_name']}",
            "patron_membership": patron["membership_number"],
            "issued_at": now.isoformat(),
            "due_date": due_date,
            "returned_at": None,
            "renewals_count": 0,
            "status": "active",
            "notes": notes,
            "invoice_number": invoice_number,
            "invoice": invoice_record
        }

        # Update physical item status
        for itm in self.local_data["items"]:
            if itm["id"] == item["id"]:
                itm["status"] = "loaned"
                break

        # Decrement available copies on book
        for b in self.local_data["books"]:
            if b["id"] == book["id"]:
                b["available_copies"] = max(0, b["available_copies"] - 1)
                b["updated_at"] = now.isoformat()
                break

        # Increment patron active loans count
        for p in self.local_data["patrons"]:
            if p["id"] == patron["id"]:
                p["active_loans_count"] += 1
                break

        # Add to loans and invoices
        self.local_data.setdefault("loans", []).insert(0, loan_record)
        self.local_data.setdefault("invoices", []).insert(0, invoice_record)
        self._save_local_data()

        self.log_audit("CIRCULATION_ISSUE", "loan", loan_id, f"Issued {item['barcode']} ({book['title']}) to {patron['membership_number']} [Invoice {invoice_number}]")
        return loan_record

    def return_loan(
        self,
        item_barcode: str,
        condition: str = "good",
        damage_charge: float = 0.0,
        notes: Optional[str] = None,
        payment_method: Optional[str] = "account_billed"
    ) -> Dict[str, Any]:
        """
        Executes check-in return with condition inspection and damage assessment:
        - Locates active loan for item
        - Calculates overdue fine if applicable
        - Assesses physical damage/condition penalties
        - Updates copy status, condition and increments available copies
        - Generates archival return slip with breakdown
        - Decrements patron active loan count and updates ledger
        """
        clean_barcode = item_barcode.strip().upper()
        active_loan = None
        for l in self.local_data.get("loans", []):
            if l["barcode"].upper() == clean_barcode and l["status"] in ("active", "overdue"):
                active_loan = l
                break

        if not active_loan:
            raise ValueError(f"No active loan found for barcode: '{item_barcode}'")

        now = datetime.now(timezone.utc)
        due = datetime.fromisoformat(active_loan["due_date"].replace("Z", "+00:00"))
        
        # Calculate overdue fine
        fine_amount = 0.0
        assessed_fine = None
        overdue_days = 0
        if now > due:
            overdue_days = (now - due).days
            if overdue_days > settings.GRACE_PERIOD_DAYS:
                chargeable = overdue_days - settings.GRACE_PERIOD_DAYS
                fine_amount = round(chargeable * settings.DAILY_FINE_RATE, 2)
                
                fine_id = f"fine-{uuid.uuid4().hex[:8]}"
                assessed_fine = {
                    "id": fine_id,
                    "loan_id": active_loan["id"],
                    "patron_id": active_loan["patron_id"],
                    "patron_name": active_loan["patron_name"],
                    "patron_membership": active_loan["patron_membership"],
                    "book_title": active_loan["book_title"],
                    "amount": fine_amount,
                    "paid_amount": fine_amount if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else 0.00,
                    "status": "settled" if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else "outstanding",
                    "reason": f"Overdue return ({overdue_days} days overdue beyond grace period)",
                    "assessed_at": now.isoformat(),
                    "settled_at": now.isoformat() if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else None,
                    "waived_by": None,
                    "waived_reason": None
                }
                self.local_data.setdefault("fines", []).insert(0, assessed_fine)

        # Damage assessment
        assessed_damage_fine = None
        damage_charge = max(0.0, round(float(damage_charge or 0.0), 2))
        if damage_charge > 0:
            dfine_id = f"fine-dmg-{uuid.uuid4().hex[:8]}"
            assessed_damage_fine = {
                "id": dfine_id,
                "loan_id": active_loan["id"],
                "patron_id": active_loan["patron_id"],
                "patron_name": active_loan["patron_name"],
                "patron_membership": active_loan["patron_membership"],
                "book_title": active_loan["book_title"],
                "amount": damage_charge,
                "paid_amount": damage_charge if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else 0.00,
                "status": "settled" if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else "outstanding",
                "reason": f"Condition penalty / repair charge: {condition.replace('_', ' ').title()}",
                "assessed_at": now.isoformat(),
                "settled_at": now.isoformat() if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else None,
                "waived_by": None,
                "waived_reason": None
            }
            self.local_data.setdefault("fines", []).insert(0, assessed_damage_fine)

        # Generate Return Slip
        slip_number = f"RET-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        total_charges = round(fine_amount + damage_charge, 2)
        paid_now = total_charges if payment_method in ("paid_on_spot", "paid_cash", "paid_card") else 0.00
        balance_due = 0.00 if payment_method in ("paid_on_spot", "paid_cash", "paid_card", "waived") else total_charges

        return_slip = {
            "slip_number": slip_number,
            "loan_id": active_loan["id"],
            "return_date": now.isoformat(),
            "patron_name": active_loan["patron_name"],
            "patron_membership": active_loan["patron_membership"],
            "patron_id": active_loan["patron_id"],
            "book_title": active_loan["book_title"],
            "book_isbn": active_loan.get("book_isbn", ""),
            "barcode": active_loan["barcode"],
            "issued_at": active_loan["issued_at"],
            "due_date": active_loan["due_date"],
            "overdue_days": overdue_days,
            "condition": condition,
            "condition_notes": notes or "Item returned in evaluated state.",
            "overdue_fine": fine_amount,
            "damage_charge": damage_charge,
            "total_charges": total_charges,
            "paid_amount": paid_now,
            "balance_due": balance_due,
            "payment_status": "Settled in Full (Desk Payment)" if paid_now > 0 else ("Waived by Librarian" if payment_method == "waived" else ("Cleared — No Charges" if total_charges == 0 else "Added to Student Account Balance")),
            "payment_method": payment_method or "account_billed",
            "station": "Archival Circulation Desk 01",
            "inspector": "Dr. Eleanor Vance (Archivist & Curator)"
        }

        # Mark loan as returned
        active_loan["status"] = "returned"
        active_loan["returned_at"] = now.isoformat()
        active_loan["returned_condition"] = condition
        active_loan["damage_charge"] = damage_charge
        active_loan["overdue_fine"] = fine_amount
        active_loan["total_charges"] = total_charges
        active_loan["return_notes"] = notes
        active_loan["return_slip_number"] = slip_number
        active_loan["return_slip"] = return_slip
        if notes:
            active_loan["notes"] = f"{active_loan.get('notes') or ''} [Return: {notes}]".strip()

        # Update physical item condition and status
        for itm in self.local_data["items"]:
            if itm["id"] == active_loan["book_item_id"]:
                itm["status"] = "available"
                itm["condition"] = condition
                break

        # Increment book available copies
        for b in self.local_data["books"]:
            if b["id"] == active_loan["book_id"]:
                b["available_copies"] = min(b["total_copies"], b["available_copies"] + 1)
                b["updated_at"] = now.isoformat()
                break

        # Update patron stats
        for p in self.local_data["patrons"]:
            if p["id"] == active_loan["patron_id"]:
                p["active_loans_count"] = max(0, p.get("active_loans_count", 1) - 1)
                if balance_due > 0:
                    p["outstanding_fines"] = round(p.get("outstanding_fines", 0.0) + balance_due, 2)
                break

        self.local_data.setdefault("return_slips", []).insert(0, return_slip)
        self._save_local_data()
        self.log_audit("CIRCULATION_RETURN", "loan", active_loan["id"], f"Returned {active_loan['barcode']} ({active_loan['book_title']}). Condition: {condition}, Damage: ${damage_charge:.2f}, Fine: ${fine_amount:.2f}")

        return {
            "loan": active_loan,
            "fine_assessed": assessed_fine,
            "damage_fine": assessed_damage_fine,
            "fine_amount": fine_amount,
            "damage_charge": damage_charge,
            "total_charges": total_charges,
            "return_slip": return_slip
        }

    def get_invoice(self, identifier: str) -> Optional[Dict[str, Any]]:
        clean = identifier.strip().upper()
        for inv in self.local_data.get("invoices", []):
            if inv["invoice_number"].upper() == clean or inv["loan_id"] == identifier:
                return inv
        # Fallback to loan
        for l in self.local_data.get("loans", []):
            loan_inv_num = (l.get("invoice_number") or f"INV-{l['id'].replace('loan-', '').upper()}").strip().upper()
            if loan_inv_num == clean or l["id"].upper() == clean or l.get("invoice_number", "").upper() == clean:
                if l.get("invoice"):
                    return l["invoice"]
                # Synthesize a complete invoice record if not explicitly stored
                patron = self.get_patron_by_id(l.get("patron_id", "")) or self.get_patron_by_membership(l.get("patron_membership", ""))
                inv_num = l.get("invoice_number") or f"INV-{l['id'].replace('loan-', '').upper()}"
                return {
                    "invoice_number": inv_num,
                    "loan_id": l["id"],
                    "issued_at": l.get("issued_at"),
                    "due_date": l.get("due_date"),
                    "patron_id": l.get("patron_id", "patron-001"),
                    "patron_name": l.get("patron_name", "Enrolled Student"),
                    "patron_membership": l.get("patron_membership", "SNM-STUDENT"),
                    "patron_tier": (patron.get("tier") if patron else "Undergraduate") or "Undergraduate",
                    "patron_email": (patron.get("email") if patron else "scholar@sonam.edu") or "scholar@sonam.edu",
                    "book_id": l.get("book_id", ""),
                    "book_title": l.get("book_title", "Institutional Volume"),
                    "barcode": l.get("barcode", "LIB-ASSET"),
                    "shelf_location": "Main Archival Stack, Floor 1",
                    "loan_period_days": 21,
                    "daily_fine_rate": settings.DAILY_FINE_RATE,
                    "issue_fee": 15.00,
                    "security_deposit": 50.00,
                    "total_charged": 65.00,
                    "status": "ISSUED",
                    "station": "Circulation Desk 01",
                    "librarian": "Dr. Eleanor Vance (Archivist)"
                }
        return None

    def get_return_slip(self, identifier: str) -> Optional[Dict[str, Any]]:
        clean = identifier.strip().upper()
        for s in self.local_data.get("return_slips", []):
            if s["slip_number"].upper() == clean or s["loan_id"].upper() == clean:
                return s
        for l in self.local_data.get("loans", []):
            loan_slip_num = (l.get("return_slip_number") or f"RET-{l['id'].replace('loan-', '').upper()}").strip().upper()
            if loan_slip_num == clean or l["id"].upper() == clean or l.get("return_slip_number", "").upper() == clean:
                if l.get("return_slip"):
                    return l["return_slip"]
                slip_num = l.get("return_slip_number") or f"RET-{l['id'].replace('loan-', '').upper()}"
                return {
                    "slip_number": slip_num,
                    "loan_id": l["id"],
                    "return_date": l.get("returned_at") or datetime.now(timezone.utc).isoformat(),
                    "patron_name": l.get("patron_name", "Enrolled Student"),
                    "patron_membership": l.get("patron_membership", "SNM-STUDENT"),
                    "patron_id": l.get("patron_id", "patron-001"),
                    "book_title": l.get("book_title", "Institutional Volume"),
                    "barcode": l.get("barcode", "LIB-ASSET"),
                    "issued_at": l.get("issued_at"),
                    "due_date": l.get("due_date"),
                    "overdue_days": l.get("overdue_days", 0),
                    "condition": l.get("returned_condition", "good"),
                    "condition_notes": l.get("return_notes", "Returned in verified good condition."),
                    "overdue_fine": l.get("overdue_fine", 0.0),
                    "damage_charge": l.get("damage_charge", 0.0),
                    "total_charges": l.get("total_charges", 0.0),
                    "paid_amount": l.get("total_charges", 0.0),
                    "balance_due": 0.0,
                    "payment_status": "Cleared — No Balance",
                    "payment_method": "account_billed",
                    "station": "Archival Circulation Desk 01",
                    "inspector": "Dr. Eleanor Vance (Archivist & Curator)"
                }
        return None

    def renew_loan(self, loan_id: str) -> Dict[str, Any]:
        """Extends loan duration if renewals limit has not been breached."""
        for l in self.local_data.get("loans", []):
            if l["id"] == loan_id:
                if l["status"] != "active":
                    raise ValueError("Only active loans can be renewed.")
                if l.get("renewals_count", 0) >= settings.MAX_RENEWALS:
                    raise ValueError(f"Maximum renewals limit of {settings.MAX_RENEWALS} reached.")

                now = datetime.now(timezone.utc)
                due = datetime.fromisoformat(l["due_date"].replace("Z", "+00:00"))
                new_due = (max(now, due) + timedelta(days=settings.DEFAULT_LOAN_DAYS)).isoformat()

                l["renewals_count"] = l.get("renewals_count", 0) + 1
                l["due_date"] = new_due
                self._save_local_data()
                self.log_audit("CIRCULATION_RENEW", "loan", loan_id, f"Renewed loan for {l['barcode']} to {new_due}")
                return l

        raise ValueError(f"Loan with ID '{loan_id}' not found.")

    # ==========================
    # FINES
    # ==========================
    def get_fines(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        fines = list(self.local_data.get("fines", []))
        if status:
            fines = [f for f in fines if f.get("status") == status]
        return fines

    def settle_fine(self, fine_id: str, amount: float, method: str = "Cash") -> Dict[str, Any]:
        for f in self.local_data.get("fines", []):
            if f["id"] == fine_id:
                if f["status"] == "settled":
                    raise ValueError("This fine is already settled.")
                
                remaining = f["amount"] - f.get("paid_amount", 0.0)
                pay = min(amount, remaining)
                f["paid_amount"] = round(f.get("paid_amount", 0.0) + pay, 2)
                
                if f["paid_amount"] >= f["amount"]:
                    f["status"] = "settled"
                    f["settled_at"] = datetime.now(timezone.utc).isoformat()

                # Deduct from patron's outstanding fines
                for p in self.local_data.get("patrons", []):
                    if p["id"] == f["patron_id"]:
                        p["outstanding_fines"] = max(0.0, round(p.get("outstanding_fines", 0.0) - pay, 2))
                        break

                self._save_local_data()
                self.log_audit("FINE_SETTLE", "fine", fine_id, f"Collected ${pay:.2f} via {method} for {f['patron_name']}")
                return f

        raise ValueError(f"Fine '{fine_id}' not found.")

    def waive_fine(self, fine_id: str, authorized_by: str, reason: str) -> Dict[str, Any]:
        for f in self.local_data.get("fines", []):
            if f["id"] == fine_id:
                if f["status"] != "outstanding":
                    raise ValueError("Only outstanding fines can be waived.")
                
                unpaid = f["amount"] - f.get("paid_amount", 0.0)
                f["status"] = "waived"
                f["waived_by"] = authorized_by
                f["waived_reason"] = reason
                f["settled_at"] = datetime.now(timezone.utc).isoformat()

                # Deduct from patron's outstanding fines
                for p in self.local_data.get("patrons", []):
                    if p["id"] == f["patron_id"]:
                        p["outstanding_fines"] = max(0.0, round(p.get("outstanding_fines", 0.0) - unpaid, 2))
                        break

                self._save_local_data()
                self.log_audit("FINE_WAIVE", "fine", fine_id, f"Waived fine of ${unpaid:.2f} by {authorized_by}: {reason}")
                return f

        raise ValueError(f"Fine '{fine_id}' not found.")

    # ==========================
    # AUDIT LOGS & TELEMETRY
    # ==========================
    def log_audit(self, action: str, entity: str, entity_id: str, details: str):
        entry = {
            "id": f"log-{uuid.uuid4().hex[:8]}",
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.local_data.setdefault("audit_logs", []).insert(0, entry)
        if len(self.local_data["audit_logs"]) > 100:
            self.local_data["audit_logs"] = self.local_data["audit_logs"][:100]

    def get_telemetry(self) -> Dict[str, Any]:
        books = self.local_data.get("books", [])
        items = self.local_data.get("items", [])
        patrons = self.local_data.get("patrons", [])
        loans = self.get_loans()
        fines = self.local_data.get("fines", [])

        active_loans = [l for l in loans if l["status"] == "active"]
        overdue_loans = [l for l in loans if l["status"] == "overdue"]

        total_outstanding_fines = sum(f["amount"] - f.get("paid_amount", 0.0) for f in fines if f["status"] == "outstanding")
        total_collected_fines = sum(f.get("paid_amount", 0.0) for f in fines)

        # Dewey distribution
        distribution = {}
        for b in books:
            cat = b.get("dewey_category", "General Works")
            distribution[cat] = distribution.get(cat, 0) + b.get("total_copies", 1)

        return {
            "total_titles": len(books),
            "total_holdings": len(items),
            "available_copies": sum(1 for i in items if i.get("status") == "available"),
            "active_loans": len(active_loans),
            "overdue_loans": len(overdue_loans),
            "total_patrons": len(patrons),
            "total_fines_outstanding": round(total_outstanding_fines, 2),
            "total_fines_collected": round(total_collected_fines, 2),
            "recent_activity": self.local_data.get("audit_logs", [])[:8],
            "dewey_distribution": distribution,
            "firebase_connected": self.is_firebase_connected,
            "firebase_project_id": self.project_id
        }

# Global singleton instance
repo = RepositoryManager()
