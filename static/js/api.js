/**
 * Athena Library Management System - API Client
 */

const API_BASE = '/api/v1';

export const api = {
    // Auth & Accounts
    async signup(fullName, email, password, role = 'patron', phone = null) {
        const res = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password,
                role: role,
                phone: phone
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
            throw new Error(err.detail || 'Registration failed');
        }
        return res.json();
    },

    async verifyOtp(email, otp) {
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Verification failed' }));
            throw new Error(err.detail || 'Verification failed');
        }
        return res.json();
    },

    async resendOtp(email) {
        const res = await fetch(`${API_BASE}/auth/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Resend failed' }));
            throw new Error(err.detail || 'Resend failed');
        }
        return res.json();
    },

    async login(email, password) {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
            throw new Error(err.detail || 'Invalid credentials');
        }
        return res.json();
    },

    async forgotPassword(email) {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(err.detail || 'Request failed');
        }
        return res.json();
    },

    async resetPassword(email, otp, newPassword) {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, new_password: newPassword })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Reset failed' }));
            throw new Error(err.detail || 'Reset failed');
        }
        return res.json();
    },

    // Books & Bibliographic
    async getBooks(search = '', dewey = '') {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (dewey) params.append('dewey', dewey);
        const res = await fetch(`${API_BASE}/books?${params.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async getBookById(id) {
        const res = await fetch(`${API_BASE}/books/${id}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async lookupIsbn(isbn) {
        const res = await fetch(`${API_BASE}/books/isbn/lookup?isbn=${encodeURIComponent(isbn)}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Metadata lookup failed' }));
            throw new Error(err.detail || 'Metadata lookup failed');
        }
        return res.json();
    },

    async createBook(data) {
        const res = await fetch(`${API_BASE}/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Creation failed' }));
            throw new Error(err.detail || 'Creation failed');
        }
        return res.json();
    },

    async addCopy(bookId, floor, aisle, shelf) {
        const params = new URLSearchParams({ floor, aisle, shelf });
        const res = await fetch(`${API_BASE}/books/${bookId}/copies?${params.toString()}`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Circulation & Loans
    async getLoans(status = '') {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const res = await fetch(`${API_BASE}/circulation/loans?${params.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async checkout(patronMembership, itemBarcode, customDays = null, notes = null) {
        const res = await fetch(`${API_BASE}/circulation/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patron_membership: patronMembership,
                item_barcode: itemBarcode,
                custom_loan_days: customDays,
                notes: notes
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Checkout failed' }));
            throw new Error(err.detail || 'Checkout failed');
        }
        return res.json();
    },

    async returnItem(itemBarcode, condition = 'good', damageCharge = 0.0, notes = null, paymentMethod = 'account_billed') {
        const res = await fetch(`${API_BASE}/circulation/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                item_barcode: itemBarcode,
                item_condition: condition,
                damage_charge: damageCharge,
                notes: notes,
                payment_method: paymentMethod
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Return failed' }));
            throw new Error(err.detail || 'Return failed');
        }
        return res.json();
    },

    async getInvoice(identifier) {
        const res = await fetch(`${API_BASE}/circulation/invoices/${encodeURIComponent(identifier)}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async getReturnSlip(identifier) {
        const res = await fetch(`${API_BASE}/circulation/return-slips/${encodeURIComponent(identifier)}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async renewLoan(loanId) {
        const res = await fetch(`${API_BASE}/circulation/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loan_id: loanId })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Renewal failed' }));
            throw new Error(err.detail || 'Renewal failed');
        }
        return res.json();
    },

    async quickScan(barcodeOrMembership) {
        const res = await fetch(`${API_BASE}/circulation/quick-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode_or_membership: barcodeOrMembership })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Quick scan failed' }));
            throw new Error(err.detail || 'Quick scan failed');
        }
        return res.json();
    },

    // Patrons
    async getPatrons(search = '') {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        const res = await fetch(`${API_BASE}/patrons?${params.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async createPatron(data) {
        const res = await fetch(`${API_BASE}/patrons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
            throw new Error(err.detail || 'Registration failed');
        }
        return res.json();
    },

    // Fines
    async getFines(status = '') {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const res = await fetch(`${API_BASE}/fines?${params.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async settleFine(fineId, amount, method = 'Cash') {
        const res = await fetch(`${API_BASE}/fines/${fineId}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, payment_method: method })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Settlement failed' }));
            throw new Error(err.detail || 'Settlement failed');
        }
        return res.json();
    },

    async waiveFine(fineId, authorizedBy, reason) {
        const res = await fetch(`${API_BASE}/fines/${fineId}/waive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorized_by: authorizedBy, reason: reason })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Waiver failed' }));
            throw new Error(err.detail || 'Waiver failed');
        }
        return res.json();
    },

    // Telemetry
    async getStats() {
        const res = await fetch(`${API_BASE}/stats`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Firebase
    async getFirebaseStatus() {
        const res = await fetch(`${API_BASE}/firebase/status`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async connectFirebase(credentialsJson) {
        const res = await fetch(`${API_BASE}/firebase/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credentials_json: credentialsJson })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Firebase connection failed' }));
            throw new Error(err.detail || 'Firebase connection failed');
        }
        return res.json();
    }
};
