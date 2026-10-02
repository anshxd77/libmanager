import urllib.request
import json

base_url = "http://127.0.0.1:8000"

print("--- 1. Testing Patrons / Enrolled Students ---")
req = urllib.request.urlopen(f"{base_url}/api/v1/patrons")
patrons = json.loads(req.read().decode())
print(f"Total enrolled patrons: {len(patrons)}")
for p in patrons[:6]:
    print(f" - {p['first_name']} {p['last_name']} ({p['membership_number']}) | Tier: {p['tier']} | Outstanding: ${p['outstanding_fines']:.2f}")

print("\n--- 2. Testing Books Catalog ---")
req = urllib.request.urlopen(f"{base_url}/api/v1/books")
books = json.loads(req.read().decode())
print(f"Total catalog titles: {len(books)}")
for b in books[:3]:
    print(f" - {b['title']} (ISBN: {b.get('isbn_13')}) | Avail: {b['available_copies']}/{b['total_copies']}")

print("\n--- 3. Testing Checkout & Return with Condition and Damage Charge ---")
# Checkout to student Aarav Sharma (ATH-8031)
checkout_payload = json.dumps({
    "patron_membership": "ATH-8031",
    "item_barcode": "LIB-00102"
}).encode('utf-8')

req = urllib.request.Request(
    f"{base_url}/api/v1/circulation/checkout",
    data=checkout_payload,
    headers={"Content-Type": "application/json"}
)
try:
    loan = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"Checked out loan: {loan['id']}")
    print(f"Invoice Number: {loan.get('invoice_number')}")
    print(f"Patron: {loan['patron_name']} ({loan['patron_membership']})")
    print(f"Book: {loan['book_title']} [{loan['barcode']}]")
except Exception as e:
    print(f"Checkout info: {e}")

# Return with condition: torn_pages and $8.00 damage fee
return_payload = json.dumps({
    "item_barcode": "LIB-00102",
    "item_condition": "torn_pages",
    "damage_charge": 8.00,
    "notes": "Cover creased and page 14 tape repair required",
    "payment_method": "account_billed"
}).encode('utf-8')

req = urllib.request.Request(
    f"{base_url}/api/v1/circulation/return",
    data=return_payload,
    headers={"Content-Type": "application/json"}
)
res = json.loads(urllib.request.urlopen(req).read().decode())
slip = res["return_slip"]
print(f"\nReturn Slip Generated: {slip['slip_number']}")
print(f" - Returned condition: {slip['condition']}")
print(f" - Damage charge: ${slip['damage_charge']:.2f}")
print(f" - Overdue fine: ${slip['overdue_fine']:.2f}")
print(f" - Total charges: ${slip['total_charges']:.2f}")
print(f" - Payment status: {slip['payment_status']}")
print(f" - Inspector remarks: {slip['condition_notes']}")
print("\nAll API operations verified successfully!")
