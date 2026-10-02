# Athena Institutional Library Management System

An executive-grade, web-based Library Management & Archival Circulation platform engineered with **Python (FastAPI)** and **Firebase (Firestore & Cloud Storage)**. 

Built with an editorial aesthetic suited for university archives, research institutions, and corporate collections. Completely **free of unicode emojis**, utilizing custom SVG vector strokes, refined typography, and tactile Web Audio feedback.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                               |
|   Single-Page Web Application (Vanilla CSS Design System + Modern JS)   |
|   - Real-time Circulation Desk (Barcode Scanner Compatible)             |
|   - Deep Catalog Search & Filter Engine with Dewey Decimal Classification|
|   - Patron Registry, Financial Ledger & Institutional Telemetry         |
|   - Keyboard Shortcuts (Ctrl+K, F2, F3, Esc) & Web Audio Synthesizer   |
+------------------------------------+------------------------------------+
                                     |
                          HTTPS / REST / JSON
                                     |
+------------------------------------v------------------------------------+
|                         BACKEND SERVICE LAYER                           |
|                    Python 3.12+ / FastAPI Framework                     |
|   - Business Rule Validation (Borrowing Limits, Grace Periods, Fines)   |
|   - Circulation State Machine (Checkouts, Renewals, Returns, Holds)     |
|   - Open Library & Google Books Bibliographic ISBN Auto-Discovery       |
|   - Dual-Mode Storage: Live Firebase Firestore + Resilient Local Store  |
+------------------------------------+------------------------------------+
                                     |
                          Firebase Admin SDK / gRPC
                                     |
+------------------------------------v------------------------------------+
|                         FIREBASE CLOUD LAYER                            |
|   - Google Cloud Firestore (Document & Collection Storage)              |
|   - Firebase Authentication & Row-Level Authorization                   |
|   - Firebase Cloud Storage (Asset Covers & Digitized Records)           |
+-------------------------------------------------------------------------+
```

---

## Features

- **Circulation Desk**:
  - Instant barcode scan dispatcher for patron cards (`F2`) and item barcodes (`F3`).
  - Active checkout validation against borrower limits, active holds, and outstanding fines.
  - Check-in return processor with automated overdue fine assessment and grace period policies.
  - Single-click 14-day renewal with maximum renewal enforcement.
- **Bibliographic Catalog**:
  - Deep faceted search across title, author, ISBN, and Dewey Decimal classification ranges.
  - **Instant ISBN Auto-Discovery**: Enter an ISBN-10 or ISBN-13 and click *Auto-Fetch Metadata* to automatically fetch title, authors, publisher, year, summary, and cover image from Open Library and Google Books.
  - Physical copy inventory tracking with shelf coordinates (`Floor`, `Aisle`, `Shelf`) and barcode generation.
  - Toggle between High-Density Table and Visual Grid views.
- **Authentication & Scholar Signup (with Gmail OTP)**:
  - Complete institutional Sign In and Sign Up modal with Gmail OTP delivery.
  - **Strict Institutional Password Security Criteria**:
    - Minimum 8 characters (up to 64)
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one numerical digit (0-9)
    - At least one special symbol (`!@#$%^&*...`)
    - Live interactive real-time checklist and dynamic strength meter bar.
  - **6-Digit Gmail OTP Verification**: Dispatches real emails via Gmail SMTP, plus development code preview so testing is seamless even before configuring email credentials.
  - 1-Click quick demo access buttons (`Administrator` and `Scholar / Patron`).
- **Effortless Cataloging for Administrators**:
  - ISBN is now optional — auto-generates valid institutional ISBN-13 if blank.
  - **1-Click Pre-fill Demo Book** button for instantaneous testing.
  - **Auto-Generate ISBN** button.
  - Automatically merges copies if the same title is cataloged again instead of throwing errors.
- **Patron & Scholar Registry**:
  - Tier-based privilege management (`Undergraduate: 5`, `Postgraduate: 8`, `Researcher: 12`, `Faculty: 15`, `General: 3`).
  - Dynamic borrowing quota visualization and account standing metrics.
- **Financial Assessments & Fines**:
  - Transparent fee ledger tracking daily overdue tariffs beyond grace periods.
  - Receipt recording with payment method selection (Cash, Card, Department Ledger).
  - Regulatory fine waivers requiring authorizing officer documentation and justification.
- **Institutional Telemetry & KPIs**:
  - Real-time stock velocity, cataloged holdings, active loans, and overdue counts.
  - Visual distribution bars across Dewey Decimal 000–900 classes.
  - Immutable audit trail of operational system events.
- **Universal Command Palette (`Ctrl+K` or `/`)**:
  - Instant keyboard search across the entire institutional catalog, patron directory, and shortcuts.
- **Tactile Web Audio Synthesizer**:
  - Built-in Web Audio API mechanical feedback (15ms sine/triangle clicks and chimes) without external sound files. Mute toggle included.
- **Zero Emojis / Anti-AI Design System**:
  - Clean monochromatic surfaces (`#0a0c10`), warm brushed archival brass accents (`#c5a880`), and *Plus Jakarta Sans* + *Cinzel* + *JetBrains Mono* typography.

---

## Quickstart

### 1. Requirements
- Python 3.10+ (Tested on Python 3.12)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### 2. Installation
Dependencies are already configured. To re-install or verify:
```bash
pip install -r requirements.txt
```

### 3. Running the Server
Launch the FastAPI server with hot-reload:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Navigate to **`http://127.0.0.1:8000`** in your browser.

Interactive OpenAPI Documentation: **`http://127.0.0.1:8000/docs`**

---

## Firebase Configuration

Athena operates in **Dual-Mode**:
1. **Out-of-the-Box**: Boots immediately with a pre-seeded, realistic institutional archive store in `data/library_store.json` so you can use the software with zero configuration.
2. **Live Firebase Firestore**:
   - Obtain a Service Account Key JSON from the [Firebase Console](https://console.firebase.google.com/) (*Project Settings* -> *Service accounts* -> *Generate new private key*).
   - Place the file as `serviceAccountKey.json` in the project root, **or**
   - Click the **Firebase Status Capsule** in the bottom-left sidebar of the web application and upload/paste your JSON credentials directly. Athena connects and switches to live cloud Firestore instantly!

---

## Keyboard Navigation

| Keybinding | Action |
| :--- | :--- |
| **`Ctrl+K`** or **`Cmd+K`** or **`/`** | Open Universal Command Palette |
| **`F2`** | Focus Rapid Patron Card Scanner |
| **`F3`** | Focus Book Copy Barcode Scanner |
| **`Enter`** | Commit Scan / Submit Form |
| **`Esc`** | Dismiss Modals & Command Palette |
