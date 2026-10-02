/**
 * Athena Circulation Desk Engine
 * High-precision ledger, live student & book discovery, condition assessment, and PDF deed generation.
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class CirculationEngine {
    constructor(app) {
        this.app = app;
        this.activePatron = null;
        this.activeItem = null;
        this.activeBook = null;
        this.currentItemLoan = null;
        this.loans = [];
        this.activeFilter = 'all'; // all, active, overdue

        // Autocomplete caches
        this.allPatronsCache = [];
        this.allBooksCache = [];

        // Return inspection state
        this.pendingReturnItem = null;
        this.pendingReturnLoan = null;
        this.selectedReturnCondition = 'good';
        this.conditionCharges = {
            'good': 0.00,
            'fair': 2.00,
            'torn_pages': 8.00,
            'liquid_damage': 15.00,
            'broken_spine': 20.00,
            'severe_damage': 40.00
        };
    }

    init() {
        this.bindEvents();
        this.loadLoans();
        this.preloadSearchCaches();
    }

    async preloadSearchCaches() {
        try {
            const [patrons, books] = await Promise.all([
                api.getPatrons().catch(() => []),
                api.getBooks().catch(() => [])
            ]);
            this.allPatronsCache = patrons || [];
            this.allBooksCache = books || [];
        } catch (e) {
            console.warn('Search cache preloading encountered an error:', e);
        }
    }

    bindEvents() {
        // Universal Scan Bar
        const scanInput = document.getElementById('circulation-universal-scan');
        if (scanInput) {
            scanInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleUniversalScan(scanInput.value.trim());
                }
            });
        }

        // Live Student / Patron Search & Autocomplete
        this.setupPatronAutocomplete();

        // Live Book Search & Autocomplete
        this.setupBookAutocomplete();

        // Action Buttons
        const issueBtn = document.getElementById('btn-issue-loan');
        if (issueBtn) {
            issueBtn.addEventListener('click', () => this.handleCheckout());
        }

        const previewInvoiceBtn = document.getElementById('btn-preview-invoice');
        if (previewInvoiceBtn) {
            previewInvoiceBtn.addEventListener('click', () => this.handlePreviewInvoice());
        }

        const returnBtn = document.getElementById('btn-process-return');
        if (returnBtn) {
            returnBtn.addEventListener('click', () => this.openReturnInspectionModal());
        }

        const clearBtn = document.getElementById('btn-clear-dossiers');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearDossiers());
        }

        // Enrolled Student Presets
        const demoAarav = document.getElementById('demo-load-aarav');
        if (demoAarav) {
            demoAarav.addEventListener('click', () => this.lookupPatron('ATH-8031'));
        }
        const demoSophia = document.getElementById('demo-load-sophia');
        if (demoSophia) {
            demoSophia.addEventListener('click', () => this.lookupPatron('ATH-8032'));
        }
        const demoPatronBtn = document.getElementById('demo-load-patron');
        if (demoPatronBtn) {
            demoPatronBtn.addEventListener('click', () => this.lookupPatron('ATH-8021'));
        }
        const demoBookBtn = document.getElementById('demo-load-book');
        if (demoBookBtn) {
            demoBookBtn.addEventListener('click', () => this.lookupBarcode('LIB-00101'));
        }

        // Return Inspection Modal Form & Condition Picker
        this.setupReturnInspectionEvents();

        // Document Print & PDF Download Buttons
        this.setupDocumentExportEvents();

        // Loans Table Filters
        const filterBtns = document.querySelectorAll('.loan-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.dataset.filter;
                this.renderLoans();
            });
        });
    }

    /* ==========================================================================
       LIVE PATRON / ENROLLED STUDENT AUTOCOMPLETE
       ========================================================================== */
    setupPatronAutocomplete() {
        const input = document.getElementById('scan-patron-input');
        const dropdown = document.getElementById('patron-autocomplete-dropdown');
        const clearBtn = document.getElementById('btn-clear-patron-search');
        if (!input || !dropdown) return;

        const renderList = (filterText = '') => {
            const query = filterText.toLowerCase().trim();
            const list = this.allPatronsCache.filter(p => {
                if (!query) return true;
                const full = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
                const mem = (p.membership_number || '').toLowerCase();
                const email = (p.email || '').toLowerCase();
                return full.includes(query) || mem.includes(query) || email.includes(query);
            });

            if (list.length === 0) {
                dropdown.innerHTML = `
                    <div class="autocomplete-header">Enrolled Students & Patrons (0 found)</div>
                    <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
                        No enrolled student found matching "${this.escape(filterText)}".
                    </div>
                `;
            } else {
                dropdown.innerHTML = `
                    <div class="autocomplete-header">
                        <span>Enrolled Students & Patrons (${list.length})</span>
                        <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">Click to load</span>
                    </div>
                    ${list.slice(0, 10).map(p => {
                        const initials = `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase() || 'ST';
                        const quota = p.borrowing_limit || 5;
                        const activeLoans = p.active_loans_count || 0;
                        const hasFines = (p.outstanding_fines || 0) > 0;
                        return `
                            <div class="autocomplete-item" data-membership="${this.escape(p.membership_number)}">
                                <div class="autocomplete-item-left">
                                    <div class="autocomplete-avatar">${initials}</div>
                                    <div class="autocomplete-meta">
                                        <div class="autocomplete-title">${this.escape(p.first_name)} ${this.escape(p.last_name)}</div>
                                        <div class="autocomplete-sub">${this.escape(p.membership_number)} · ${this.escape(p.email || 'archival.edu')}</div>
                                    </div>
                                </div>
                                <div class="autocomplete-item-right">
                                    <span class="badge-soft badge-soft-active" style="text-transform: capitalize; font-size: 10px;">${this.escape(p.tier || 'Student')}</span>
                                    <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary);">${activeLoans}/${quota} items</span>
                                    ${hasFines ? `<span style="font-size: 10.5px; font-family: var(--font-mono); color: #ef4444; font-weight: 600;">$${p.outstanding_fines.toFixed(2)}</span>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                `;

                dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const membership = item.dataset.membership;
                        this.lookupPatron(membership);
                        dropdown.classList.remove('open');
                        if (clearBtn) clearBtn.style.display = 'block';
                    });
                });
            }
            dropdown.classList.add('open');
        };

        input.addEventListener('focus', () => {
            if (this.allPatronsCache.length === 0) {
                this.preloadSearchCaches().then(() => renderList(input.value));
            } else {
                renderList(input.value);
            }
        });

        input.addEventListener('input', () => {
            renderList(input.value);
            if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dropdown.classList.remove('open');
                this.lookupPatron(input.value.trim());
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('open');
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                input.value = '';
                clearBtn.style.display = 'none';
                dropdown.classList.remove('open');
                this.activePatron = null;
                const pPanel = document.getElementById('patron-dossier-panel');
                if (pPanel) {
                    pPanel.innerHTML = `
                        <div class="dossier-empty">
                            <span class="empty-kicker">Borrower</span>
                            <div class="empty-title">No student or patron selected</div>
                            <div class="empty-desc">Search by student name or scan membership card above.</div>
                        </div>
                    `;
                }
                this.updateActionButtons();
            });
        }

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    /* ==========================================================================
       LIVE BOOK & HOLDING AUTOCOMPLETE
       ========================================================================== */
    setupBookAutocomplete() {
        const input = document.getElementById('scan-barcode-input');
        const dropdown = document.getElementById('book-autocomplete-dropdown');
        const clearBtn = document.getElementById('btn-clear-barcode-search');
        if (!input || !dropdown) return;

        const renderList = (filterText = '') => {
            const query = filterText.toLowerCase().trim();
            const matchingItems = [];

            for (const b of this.allBooksCache) {
                const titleMatch = (b.title || '').toLowerCase().includes(query);
                const authorMatch = (b.authors || []).join(' ').toLowerCase().includes(query);
                const isbnMatch = (b.isbn_13 || '').toLowerCase().includes(query);

                if (b.items && b.items.length > 0) {
                    for (const itm of b.items) {
                        const barcodeMatch = (itm.barcode || '').toLowerCase().includes(query);
                        if (!query || titleMatch || authorMatch || isbnMatch || barcodeMatch) {
                            matchingItems.push({ item: itm, book: b });
                        }
                    }
                } else if (!query || titleMatch || authorMatch || isbnMatch) {
                    matchingItems.push({
                        item: {
                            id: `sim-${b.id}`,
                            barcode: `LIB-00${b.id.replace('book-', '')}01`,
                            status: b.available_copies > 0 ? 'available' : 'loaned',
                            condition: 'good',
                            location_floor: 'Floor 1',
                            location_shelf: 'Main Stack'
                        },
                        book: b
                    });
                }
            }

            if (matchingItems.length === 0) {
                dropdown.innerHTML = `
                    <div class="autocomplete-header">Holdings & Book Catalog (0 found)</div>
                    <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
                        No book or copy found matching "${this.escape(filterText)}".
                    </div>
                `;
            } else {
                dropdown.innerHTML = `
                    <div class="autocomplete-header">
                        <span>Holdings & Book Copies (${matchingItems.length})</span>
                        <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">Click to load</span>
                    </div>
                    ${matchingItems.slice(0, 10).map(({ item, book }) => {
                        const isAvail = item.status === 'available';
                        const statusBadge = isAvail ? 'badge-soft-returned' : 'badge-soft-active';
                        const statusLabel = isAvail ? 'Available' : 'On Loan';
                        return `
                            <div class="autocomplete-item" data-barcode="${this.escape(item.barcode)}">
                                <div class="autocomplete-item-left">
                                    <div class="autocomplete-book-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                        </svg>
                                    </div>
                                    <div class="autocomplete-meta">
                                        <div class="autocomplete-title">${this.escape(book.title)}</div>
                                        <div class="autocomplete-sub">${this.escape(item.barcode)} · ${(book.authors || []).slice(0, 2).join(', ')}</div>
                                    </div>
                                </div>
                                <div class="autocomplete-item-right">
                                    <span class="badge-soft ${statusBadge}" style="font-size: 10px;">${statusLabel}</span>
                                    <span style="font-size: 10.5px; font-family: var(--font-mono); color: var(--text-muted);">${this.escape(item.location_floor || 'Floor 1')}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                `;

                dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const barcode = el.dataset.barcode;
                        this.lookupBarcode(barcode);
                        dropdown.classList.remove('open');
                        if (clearBtn) clearBtn.style.display = 'block';
                    });
                });
            }
            dropdown.classList.add('open');
        };

        input.addEventListener('focus', () => {
            if (this.allBooksCache.length === 0) {
                this.preloadSearchCaches().then(() => renderList(input.value));
            } else {
                renderList(input.value);
            }
        });

        input.addEventListener('input', () => {
            renderList(input.value);
            if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dropdown.classList.remove('open');
                this.lookupBarcode(input.value.trim());
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('open');
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                input.value = '';
                clearBtn.style.display = 'none';
                dropdown.classList.remove('open');
                this.activeItem = null;
                this.activeBook = null;
                this.currentItemLoan = null;
                const iPanel = document.getElementById('item-dossier-panel');
                if (iPanel) {
                    iPanel.innerHTML = `
                        <div class="dossier-empty">
                            <span class="empty-kicker">Book</span>
                            <div class="empty-title">No book selected</div>
                            <div class="empty-desc">Search by title or scan a barcode to view volume details.</div>
                        </div>
                    `;
                }
                this.updateActionButtons();
            });
        }

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    async handleUniversalScan(raw) {
        if (!raw) return;
        try {
            sound.scan();
            const res = await api.quickScan(raw);
            const scanInput = document.getElementById('circulation-universal-scan');
            if (scanInput) scanInput.value = '';

            if (res.entity_type === 'patron') {
                this.setPatronDossier(res.data.patron, res.data.active_loans);
                this.app.toast(`Student loaded: ${res.data.patron.first_name} ${res.data.patron.last_name} (${res.data.patron.membership_number})`, 'success');
            } else if (res.entity_type === 'book_item') {
                this.setItemDossier(res.data.item, res.data.book, res.data.active_loan);
                this.app.toast(`Asset loaded: ${res.data.book.title} [${res.data.item.barcode}]`, 'success');
            } else {
                sound.error();
                this.app.toast(res.message, 'error');
            }
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    async lookupPatron(card) {
        if (!card) return;
        try {
            sound.scan();
            const res = await api.quickScan(card);
            if (res.entity_type === 'patron') {
                this.setPatronDossier(res.data.patron, res.data.active_loans);
                const input = document.getElementById('scan-patron-input');
                if (input) input.value = `${res.data.patron.first_name} ${res.data.patron.last_name} (${res.data.patron.membership_number})`;
                const clearBtn = document.getElementById('btn-clear-patron-search');
                if (clearBtn) clearBtn.style.display = 'block';
                this.app.toast(`Student identified: ${res.data.patron.first_name} ${res.data.patron.last_name}`, 'success');
            } else {
                sound.error();
                this.app.toast(`No student or patron found matching '${card}'`, 'error');
            }
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    async lookupBarcode(barcode) {
        if (!barcode) return;
        try {
            sound.scan();
            const res = await api.quickScan(barcode);
            if (res.entity_type === 'book_item') {
                this.setItemDossier(res.data.item, res.data.book, res.data.active_loan);
                const input = document.getElementById('scan-barcode-input');
                if (input) input.value = `${res.data.book.title} [${res.data.item.barcode}]`;
                const clearBtn = document.getElementById('btn-clear-barcode-search');
                if (clearBtn) clearBtn.style.display = 'block';
                this.app.toast(`Asset loaded: ${res.data.book.title}`, 'success');
            } else {
                sound.error();
                this.app.toast(`No book copy found matching barcode '${barcode}'`, 'error');
            }
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    setPatronDossier(patron, activeLoans = []) {
        this.activePatron = patron;
        const panel = document.getElementById('patron-dossier-panel');
        if (!panel) return;

        const maxLoans = patron.borrowing_limit || 5;
        const currentCount = patron.active_loans_count || 0;

        panel.innerHTML = `
            <div class="dossier-content">
                <div class="dossier-header">
                    <div>
                        <div class="dossier-main-title">${this.escape(patron.first_name)} ${this.escape(patron.last_name)}</div>
                        <div class="dossier-sub">${this.escape(patron.membership_number)} · ${this.escape(patron.email || 'archival.edu')}</div>
                    </div>
                    <span class="badge-soft badge-soft-active" style="text-transform: capitalize;">${this.escape(patron.tier || 'Student')}</span>
                </div>
                <div class="meta-kv-grid">
                    <div class="meta-kv-item">
                        <span class="meta-k">Quota</span>
                        <span class="meta-v">${currentCount} / ${maxLoans} Items</span>
                    </div>
                    <div class="meta-kv-item">
                        <span class="meta-k">Fines</span>
                        <span class="meta-v" style="color: ${patron.outstanding_fines > 0 ? '#ef4444' : '#10b981'}; font-weight: 700;">
                            $${patron.outstanding_fines.toFixed(2)}
                        </span>
                    </div>
                    <div class="meta-kv-item">
                        <span class="meta-k">Standing</span>
                        <span class="meta-v" style="color: ${patron.is_active ? '#10b981' : '#ef4444'}">${patron.is_active ? 'Active Enrolled' : 'Suspended'}</span>
                    </div>
                    <div class="meta-kv-item">
                        <span class="meta-k">Card</span>
                        <span class="meta-v" style="font-family: var(--font-mono);">${this.escape(patron.membership_number)}</span>
                    </div>
                </div>
            </div>
        `;

        this.updateActionButtons();
    }

    setItemDossier(item, book, activeLoan = null) {
        this.activeItem = item;
        this.activeBook = book;
        this.currentItemLoan = activeLoan;
        const panel = document.getElementById('item-dossier-panel');
        if (!panel) return;

        const isAvail = item.status === 'available';
        const isLoaned = item.status === 'loaned';
        const statusClass = isAvail ? 'badge-soft-returned' : (isLoaned ? 'badge-soft-active' : 'badge-soft-overdue');
        const statusLabel = isAvail ? 'Available' : (isLoaned ? 'Loaned' : 'Overdue');

        panel.innerHTML = `
            <div class="dossier-content">
                <div class="dossier-header">
                    <div style="max-width: 75%;">
                        <div class="dossier-main-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escape(book.title)}</div>
                        <div class="dossier-sub">${this.escape(item.barcode)} · ISBN ${this.escape(book.isbn_13 || 'Archival')}</div>
                    </div>
                    <span class="badge-soft ${statusClass}">${statusLabel}</span>
                </div>
                <div class="meta-kv-grid">
                    <div class="meta-kv-item">
                        <span class="meta-k">Authors</span>
                        <span class="meta-v" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escape((book.authors || []).join(', '))}</span>
                    </div>
                    <div class="meta-kv-item">
                        <span class="meta-k">Shelf</span>
                        <span class="meta-v">${this.escape(item.location_floor || 'Floor 1')}, ${this.escape(item.location_shelf || 'CS-01')}</span>
                    </div>
                    <div class="meta-kv-item">
                        <span class="meta-k">Classification</span>
                        <span class="meta-v">${this.escape(book.classification_code || 'General')}</span>
                    </div>
                    <div class="meta-kv-item">
                        <span class="meta-k">Condition</span>
                        <span class="meta-v" style="text-transform: capitalize; color: var(--accent-gold); font-weight: 600;">${this.escape(item.condition || 'Good')}</span>
                    </div>
                </div>
            </div>
        `;

        this.updateActionButtons();
    }

    updateActionButtons() {
        const issueBtn = document.getElementById('btn-issue-loan');
        const previewInvoiceBtn = document.getElementById('btn-preview-invoice');
        const returnBtn = document.getElementById('btn-process-return');
        const summaryText = document.getElementById('circulation-transaction-summary-text');

        const canIssue = this.activePatron && this.activeItem && this.activeItem.status === 'available';
        const canReturn = this.activeItem && (this.activeItem.status === 'loaned' || this.currentItemLoan);

        if (issueBtn) {
            issueBtn.disabled = !canIssue;
            issueBtn.style.opacity = canIssue ? '1' : '0.45';
        }

        if (previewInvoiceBtn) {
            previewInvoiceBtn.disabled = !canIssue;
            previewInvoiceBtn.style.opacity = canIssue ? '1' : '0.45';
        }

        if (returnBtn) {
            returnBtn.disabled = !canReturn;
            returnBtn.style.opacity = canReturn ? '1' : '0.45';
        }

        if (summaryText) {
            if (this.activePatron && this.activeItem) {
                if (canIssue) {
                    summaryText.innerHTML = `Ready to issue: <strong>${this.escape(this.activePatron.first_name)} ${this.escape(this.activePatron.last_name)}</strong> → <strong>${this.escape(this.activeBook ? this.activeBook.title : '')}</strong> (Invoice ready).`;
                } else if (canReturn) {
                    summaryText.innerHTML = `Ready for return & condition check: <strong>${this.escape(this.activeBook ? this.activeBook.title : '')}</strong> (${this.escape(this.activeItem.barcode)}).`;
                } else {
                    summaryText.innerHTML = `Selected: ${this.escape(this.activePatron.first_name)} · ${this.escape(this.activeBook ? this.activeBook.title : '')} (${this.escape(this.activeItem.status)}).`;
                }
            } else if (this.activePatron) {
                summaryText.innerHTML = `Student loaded: <strong>${this.escape(this.activePatron.first_name)} ${this.escape(this.activePatron.last_name)}</strong> (${this.escape(this.activePatron.membership_number)}) · Search or select book.`;
            } else if (this.activeItem) {
                if (canReturn) {
                    summaryText.innerHTML = `Volume on loan: <strong>${this.escape(this.activeBook ? this.activeBook.title : '')}</strong> · Click "Return with Slip" to inspect & check in.`;
                } else {
                    summaryText.innerHTML = `Volume available: <strong>${this.escape(this.activeBook ? this.activeBook.title : '')}</strong> · Search or select enrolled student to issue.`;
                }
            } else {
                summaryText.innerHTML = `Select an enrolled student and book to commence transaction.`;
            }
        }
    }

    clearDossiers() {
        this.activePatron = null;
        this.activeItem = null;
        this.activeBook = null;
        this.currentItemLoan = null;

        const pInput = document.getElementById('scan-patron-input');
        if (pInput) pInput.value = '';
        const bInput = document.getElementById('scan-barcode-input');
        if (bInput) bInput.value = '';

        const pClear = document.getElementById('btn-clear-patron-search');
        if (pClear) pClear.style.display = 'none';
        const bClear = document.getElementById('btn-clear-barcode-search');
        if (bClear) bClear.style.display = 'none';

        const pPanel = document.getElementById('patron-dossier-panel');
        if (pPanel) {
            pPanel.innerHTML = `
                <div class="dossier-empty">
                    <span class="empty-kicker">Borrower</span>
                    <div class="empty-title">No student or patron selected</div>
                    <div class="empty-desc">Search by student name or scan membership card above.</div>
                </div>
            `;
        }

        const iPanel = document.getElementById('item-dossier-panel');
        if (iPanel) {
            iPanel.innerHTML = `
                <div class="dossier-empty">
                    <span class="empty-kicker">Book</span>
                    <div class="empty-title">No book selected</div>
                    <div class="empty-desc">Search by title or scan a barcode to view volume details.</div>
                </div>
            `;
        }

        this.updateActionButtons();
        sound.click();
    }

    /* ==========================================================================
       CHECKOUT & INVOICE GENERATION
       ========================================================================== */
    async handleCheckout() {
        if (!this.activePatron || !this.activeItem) return;
        try {
            sound.click();
            const loan = await api.checkout(this.activePatron.membership_number, this.activeItem.barcode);
            sound.success();
            this.app.toast(`Loan issued successfully: ${loan.book_title} to ${loan.patron_name}`, 'success');

            // Automatically open Invoice Modal and download PDF receipt automatically
            if (loan.invoice) {
                this.displayInvoiceModal(loan.invoice, true);
            } else {
                this.displayInvoiceForLoan(loan, true);
            }

            this.clearDossiers();
            await this.loadLoans();
            await this.preloadSearchCaches();
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    handlePreviewInvoice() {
        if (!this.activePatron || !this.activeItem) return;
        const now = new Date();
        const due = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
        const invNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-PREVIEW`;

        const invoice = {
            invoice_number: invNumber,
            issued_at: now.toISOString(),
            due_date: due.toISOString(),
            patron_name: `${this.activePatron.first_name} ${this.activePatron.last_name}`,
            patron_membership: this.activePatron.membership_number,
            patron_tier: this.activePatron.tier || 'Undergraduate',
            patron_email: this.activePatron.email || 'archival.edu',
            book_title: this.activeBook ? this.activeBook.title : 'Selected Volume',
            barcode: this.activeItem.barcode,
            shelf_location: `${this.activeItem.location_floor || 'Floor 1'}, ${this.activeItem.location_shelf || 'CS-01'}`,
            loan_period_days: 21,
            daily_fine_rate: 0.50,
            issue_fee: 15.00,
            security_deposit: 50.00,
            total_charged: 65.00,
            status: 'PREVIEW'
        };

        this.displayInvoiceModal(invoice);
    }

    displayInvoiceForLoan(loan, autoDownload = false) {
        const inv = loan.invoice || {};
        const tariffBase = (inv.issue_fee !== undefined && inv.issue_fee > 0) ? inv.issue_fee : 15.00;
        const depositBase = (inv.security_deposit !== undefined && inv.security_deposit > 0) ? inv.security_deposit : 50.00;
        const totalCharged = (inv.total_charged !== undefined && inv.total_charged > 0) ? inv.total_charged : (tariffBase + depositBase);

        const invoice = {
            invoice_number: loan.invoice_number || inv.invoice_number || `INV-${loan.id.replace('loan-', '').toUpperCase()}`,
            issued_at: loan.issued_at || inv.issued_at,
            due_date: loan.due_date || inv.due_date,
            patron_name: loan.patron_name || inv.patron_name,
            patron_membership: loan.patron_membership || inv.patron_membership,
            patron_tier: inv.patron_tier || 'Enrolled Scholar',
            patron_email: inv.patron_email || 'scholar@sonam.edu',
            book_title: loan.book_title || inv.book_title,
            barcode: loan.barcode || inv.barcode,
            shelf_location: inv.shelf_location || 'Main Archival Stack, Floor 1',
            loan_period_days: inv.loan_period_days || 21,
            daily_fine_rate: inv.daily_fine_rate || 0.50,
            issue_fee: tariffBase,
            security_deposit: depositBase,
            total_charged: totalCharged,
            status: inv.status || 'ISSUED'
        };
        this.displayInvoiceModal(invoice, autoDownload);
    }

    displayInvoiceModal(invoice, autoDownload = false) {
        sound.click();
        const modal = document.getElementById('loan-invoice-modal');
        if (!modal) return;

        const invNumber = invoice.invoice_number || 'INV-OFFICIAL';
        document.getElementById('inv-view-header-number').textContent = invNumber;
        document.getElementById('inv-meta-id').textContent = invNumber;
        
        const dateStr = invoice.issued_at ? new Date(invoice.issued_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString();
        const dueDateStr = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '21 days from issue';

        document.getElementById('inv-meta-date').textContent = dateStr;
        document.getElementById('inv-patron-name').textContent = invoice.patron_name || 'Enrolled Student';
        document.getElementById('inv-patron-id').textContent = invoice.patron_membership || 'SNM-STUDENT';
        document.getElementById('inv-patron-tier').textContent = `${(invoice.patron_tier || 'Undergraduate')} (Standard Quota)`;
        document.getElementById('inv-patron-email').textContent = invoice.patron_email || 'scholar@sonam.edu';

        document.getElementById('inv-book-title').textContent = invoice.book_title || 'Institutional Volume';
        document.getElementById('inv-barcode').textContent = invoice.barcode || 'LIB-ASSET';
        document.getElementById('inv-location').textContent = invoice.shelf_location || 'Floor 1, Stacks';
        document.getElementById('inv-due-date').textContent = dueDateStr;
        document.getElementById('inv-period-days').textContent = `${invoice.loan_period_days || 21} days`;

        // Dynamic charges & financial grant assessment
        const tariffBase = (invoice.issue_fee !== undefined && invoice.issue_fee > 0) ? invoice.issue_fee : 15.00;
        const depositBase = (invoice.security_deposit !== undefined && invoice.security_deposit > 0) ? invoice.security_deposit : 50.00;
        const totalCharged = (invoice.total_charged !== undefined && invoice.total_charged > 0) ? invoice.total_charged : (tariffBase + depositBase);

        const tariffBaseEl = document.getElementById('inv-fee-tariff-base');
        if (tariffBaseEl) tariffBaseEl.textContent = `$${tariffBase.toFixed(2)}`;

        const accessDescEl = document.getElementById('inv-fee-access-desc');
        if (accessDescEl) accessDescEl.textContent = `Standard Archival Lending Tariff`;

        const accessAmtEl = document.getElementById('inv-fee-access-amt');
        if (accessAmtEl) accessAmtEl.textContent = `$${tariffBase.toFixed(2)}`;

        const depBaseEl = document.getElementById('inv-fee-deposit-base');
        if (depBaseEl) depBaseEl.textContent = `$${depositBase.toFixed(2)}`;

        const depDescEl = document.getElementById('inv-fee-deposit-desc');
        if (depDescEl) depDescEl.textContent = `Asset Security Holding Bond`;

        const depAmtEl = document.getElementById('inv-fee-deposit-amt');
        if (depAmtEl) depAmtEl.textContent = `$${depositBase.toFixed(2)}`;

        const dailyRateEl = document.getElementById('inv-fee-daily-rate');
        if (dailyRateEl) dailyRateEl.textContent = `$${(invoice.daily_fine_rate || 0.50).toFixed(2)} / day`;

        // Check patron standing if active patron exists
        const patronBalance = this.activePatron ? (this.activePatron.outstanding_fines || 0) : 0;
        const patronBalBaseEl = document.getElementById('inv-patron-balance-base');
        if (patronBalBaseEl) patronBalBaseEl.textContent = `$${patronBalance.toFixed(2)}`;

        const patronBalDescEl = document.getElementById('inv-patron-balance-desc');
        if (patronBalDescEl) {
            patronBalDescEl.textContent = patronBalance > 0 ? `Unsettled Fines ($${patronBalance.toFixed(2)})` : 'Good Standing (Zero Arrears)';
            patronBalDescEl.style.color = patronBalance > 0 ? '#b45309' : '#166534';
        }
        const patronBalAmtEl = document.getElementById('inv-patron-balance-amt');
        if (patronBalAmtEl) {
            patronBalAmtEl.textContent = `$${patronBalance.toFixed(2)}`;
            patronBalAmtEl.style.color = patronBalance > 0 ? '#b45309' : '#0f172a';
        }

        const grossValEl = document.getElementById('inv-gross-val');
        if (grossValEl) grossValEl.textContent = `$${totalCharged.toFixed(2)}`;

        const totalAmtEl = document.getElementById('inv-total-amt');
        if (totalAmtEl) totalAmtEl.textContent = `$${totalCharged.toFixed(2)}`;

        const payStatusEl = document.getElementById('inv-payment-status');
        if (payStatusEl) {
            payStatusEl.textContent = `Billed to Scholar Account Ledger ($${totalCharged.toFixed(2)})`;
            payStatusEl.style.color = '#166534';
        }

        modal.classList.add('open');

        // Automatic PDF receipt download
        if (autoDownload) {
            setTimeout(() => {
                this.exportPdf('invoice-document-sheet', `Sonam-Loan-Invoice-${invNumber}.pdf`);
            }, 350);
        }
    }

    /* ==========================================================================
       RETURN INSPECTION, CONDITION & RETURN SLIP MODAL
       ========================================================================== */
    openReturnInspectionModal(loanToReturn = null) {
        sound.click();
        const modal = document.getElementById('return-book-modal');
        if (!modal) return;

        // Determine target item & loan
        let targetLoan = loanToReturn || this.currentItemLoan;
        let barcode = '';
        let title = '';
        let patronName = '';
        let patronId = '';
        let dueDate = '';

        if (targetLoan) {
            barcode = targetLoan.barcode;
            title = targetLoan.book_title;
            patronName = targetLoan.patron_name;
            patronId = targetLoan.patron_membership;
            dueDate = new Date(targetLoan.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            this.pendingReturnLoan = targetLoan;
            this.pendingReturnItem = { barcode: barcode };
        } else if (this.activeItem) {
            barcode = this.activeItem.barcode;
            title = this.activeBook ? this.activeBook.title : 'Holding Volume';
            patronName = this.activePatron ? `${this.activePatron.first_name} ${this.activePatron.last_name}` : 'Recorded Borrower';
            patronId = this.activePatron ? this.activePatron.membership_number : 'ATH-MEMBERSHIP';
            dueDate = 'Active Loan';
            this.pendingReturnItem = this.activeItem;
            this.pendingReturnLoan = null;
        } else {
            this.app.toast('Please select or scan a loaned book copy to check in.', 'info');
            return;
        }

        // Calculate potential overdue fine
        let overdueFine = 0.0;
        if (targetLoan && targetLoan.due_date) {
            const now = new Date();
            const due = new Date(targetLoan.due_date);
            if (now > due) {
                const overdueDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
                if (overdueDays > 2) {
                    overdueFine = Math.round((overdueDays - 2) * 0.50 * 100) / 100;
                }
            }
        }

        document.getElementById('return-modal-book-title').textContent = title;
        document.getElementById('return-modal-book-sub').textContent = `Barcode: ${barcode}`;
        document.getElementById('return-modal-patron-name').textContent = patronName;
        document.getElementById('return-modal-patron-id').textContent = patronId;
        document.getElementById('return-modal-due-date').textContent = dueDate;

        document.getElementById('return-input-overdue-fee').value = overdueFine.toFixed(2);
        document.getElementById('return-input-damage-fee').value = '0.00';
        document.getElementById('return-input-notes').value = '';

        // Reset condition picker to Good
        this.selectedReturnCondition = 'good';
        const pickerItems = document.querySelectorAll('#return-condition-picker .condition-picker-item');
        pickerItems.forEach(p => p.classList.toggle('selected', p.dataset.condition === 'good'));

        this.updateReturnModalTotal();
        modal.classList.add('open');
    }

    setupReturnInspectionEvents() {
        const pickerItems = document.querySelectorAll('#return-condition-picker .condition-picker-item');
        const damageInput = document.getElementById('return-input-damage-fee');
        const form = document.getElementById('form-return-inspection');

        pickerItems.forEach(item => {
            item.addEventListener('click', () => {
                pickerItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedReturnCondition = item.dataset.condition;

                const presetFee = parseFloat(item.dataset.fee || 0);
                if (damageInput) damageInput.value = presetFee.toFixed(2);
                this.updateReturnModalTotal();
            });
        });

        if (damageInput) {
            damageInput.addEventListener('input', () => this.updateReturnModalTotal());
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.executeReturnInspection();
            });
        }
    }

    updateReturnModalTotal() {
        const damage = parseFloat(document.getElementById('return-input-damage-fee')?.value || 0) || 0;
        const overdue = parseFloat(document.getElementById('return-input-overdue-fee')?.value || 0) || 0;
        const total = (damage + overdue).toFixed(2);
        const display = document.getElementById('return-modal-total-display');
        if (display) display.textContent = `$${total}`;
    }

    async executeReturnInspection() {
        if (!this.pendingReturnItem) return;
        const barcode = this.pendingReturnItem.barcode;
        const condition = this.selectedReturnCondition || 'good';
        const damageFee = parseFloat(document.getElementById('return-input-damage-fee')?.value || 0) || 0.0;
        const notes = document.getElementById('return-input-notes')?.value.trim() || null;
        const paymentMethod = document.getElementById('return-select-payment-method')?.value || 'account_billed';

        try {
            sound.click();
            const res = await api.returnItem(barcode, condition, damageFee, notes, paymentMethod);
            sound.success();

            // Close inspection modal
            document.getElementById('return-book-modal').classList.remove('open');

            this.app.toast(`Item returned successfully! Condition: ${condition.replace('_', ' ')}`, 'success');

            // Open Archival Return Slip Modal & trigger automatic receipt download
            if (res.return_slip) {
                this.displayReturnSlipModal(res.return_slip, true);
            }

            this.clearDossiers();
            await this.loadLoans();
            await this.preloadSearchCaches();
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    displayReturnSlipModal(slip, autoDownload = false) {
        sound.click();
        const modal = document.getElementById('return-slip-modal');
        if (!modal) return;

        const slipNumber = slip.slip_number || 'RET-OFFICIAL';
        document.getElementById('slip-view-header-number').textContent = slipNumber;
        document.getElementById('slip-meta-id').textContent = slipNumber;

        const returnDateStr = slip.return_date ? new Date(slip.return_date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString();
        document.getElementById('slip-meta-date').textContent = returnDateStr;

        // Condition Banner styling
        const condBanner = document.getElementById('slip-condition-banner');
        const condTitle = document.getElementById('slip-condition-title');
        const condFee = document.getElementById('slip-condition-fee');

        const condClean = (slip.condition || 'good').replace('_', ' ').toUpperCase();
        condTitle.textContent = `${condClean} Physical Condition`;
        condFee.textContent = `$${(slip.damage_charge || 0).toFixed(2)}`;

        if (condBanner) {
            condBanner.className = 'doc-condition-banner ' + ((slip.damage_charge || 0) > 0 ? 'condition-damaged' : 'condition-good');
        }

        // Student & Book
        document.getElementById('slip-patron-name').textContent = slip.patron_name || 'Enrolled Student';
        document.getElementById('slip-patron-id').textContent = slip.patron_membership || 'SNM-STUDENT';
        document.getElementById('slip-book-title').textContent = slip.book_title || 'Institutional Asset';
        document.getElementById('slip-barcode').textContent = slip.barcode || 'LIB-ASSET';
        document.getElementById('slip-issued-at').textContent = slip.issued_at ? new Date(slip.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Archived';

        // Financials
        document.getElementById('slip-overdue-days').textContent = `${slip.overdue_days || 0} days`;
        document.getElementById('slip-overdue-amt').textContent = `$${(slip.overdue_fine || 0).toFixed(2)}`;
        document.getElementById('slip-damage-amt').textContent = `$${(slip.damage_charge || 0).toFixed(2)}`;
        document.getElementById('slip-total-amt').textContent = `$${(slip.total_charges || 0).toFixed(2)}`;

        const payStatusEl = document.getElementById('slip-payment-status');
        if (payStatusEl) {
            payStatusEl.textContent = slip.payment_status || 'Cleared';
            payStatusEl.style.color = (slip.balance_due || 0) > 0 ? '#ef4444' : '#166534';
        }

        const remarksEl = document.getElementById('slip-remarks');
        if (remarksEl) {
            remarksEl.textContent = `"${slip.condition_notes || 'Item inspected by registrar and restored to stacks.'}"`;
        }

        modal.classList.add('open');

        // Automatic PDF receipt download
        if (autoDownload) {
            setTimeout(() => {
                this.exportPdf('return-slip-document-sheet', `Sonam-Return-Slip-${slipNumber}.pdf`);
            }, 350);
        }
    }

    /* ==========================================================================
       PDF GENERATION & DOCUMENT PRINT CONTROLLERS
       ========================================================================== */
    setupDocumentExportEvents() {
        // Return Slip PDF & Print
        const dlSlipBtn = document.getElementById('btn-download-return-slip-pdf');
        if (dlSlipBtn) {
            dlSlipBtn.addEventListener('click', () => {
                const slipNum = document.getElementById('slip-meta-id')?.textContent || 'RET-SLIP';
                this.exportPdf('return-slip-document-sheet', `Sonam-Return-Slip-${slipNum}.pdf`);
            });
        }

        const printSlipBtn = document.getElementById('btn-print-return-slip');
        if (printSlipBtn) {
            printSlipBtn.addEventListener('click', () => {
                this.printDocument('return-slip-document-sheet');
            });
        }

        // Invoice PDF & Print
        const dlInvBtn = document.getElementById('btn-download-invoice-pdf');
        if (dlInvBtn) {
            dlInvBtn.addEventListener('click', () => {
                const invNum = document.getElementById('inv-meta-id')?.textContent || 'INVOICE';
                this.exportPdf('invoice-document-sheet', `Sonam-Loan-Invoice-${invNum}.pdf`);
            });
        }

        const printInvBtn = document.getElementById('btn-print-invoice');
        if (printInvBtn) {
            printInvBtn.addEventListener('click', () => {
                this.printDocument('invoice-document-sheet');
            });
        }
    }

    exportPdf(elementId, filename) {
        sound.click();
        const element = document.getElementById(elementId);
        if (!element) {
            this.app.toast('Document canvas could not be found.', 'error');
            return;
        }

        // Ensure filename strictly ends with .pdf
        let cleanFilename = (filename || 'Sonam-Official-Document.pdf').trim();
        if (!cleanFilename.toLowerCase().endsWith('.pdf')) {
            cleanFilename += '.pdf';
        }

        this.app.toast(`Generating high-fidelity PDF (${cleanFilename})...`, 'info');
        element.classList.add('pdf-export-mode');

        if (window.html2pdf) {
            const opt = {
                margin: [6, 6, 6, 6],
                filename: cleanFilename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    backgroundColor: '#ffffff',
                    scrollY: 0,
                    scrollX: 0
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            window.html2pdf()
                .from(element)
                .set(opt)
                .toPdf()
                .get('pdf')
                .then((pdf) => {
                    element.classList.remove('pdf-export-mode');
                    // Create direct binary PDF blob with application/pdf MIME type
                    const blob = pdf.output('blob');
                    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(pdfBlob);
                    
                    const downloadLink = document.createElement('a');
                    downloadLink.style.display = 'none';
                    downloadLink.href = blobUrl;
                    downloadLink.download = cleanFilename;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();

                    setTimeout(() => {
                        document.body.removeChild(downloadLink);
                        URL.revokeObjectURL(blobUrl);
                    }, 2500);

                    sound.success();
                    this.app.toast(`PDF download complete: ${cleanFilename}`, 'success');
                })
                .catch((err) => {
                    console.warn('PDF stream extraction warning, attempting direct save:', err);
                    window.html2pdf()
                        .from(element)
                        .set(opt)
                        .save(cleanFilename)
                        .then(() => {
                            element.classList.remove('pdf-export-mode');
                            sound.success();
                            this.app.toast(`PDF saved successfully: ${cleanFilename}`, 'success');
                        })
                        .catch((fallbackErr) => {
                            element.classList.remove('pdf-export-mode');
                            console.error('All PDF export methods failed:', fallbackErr);
                            this.app.toast(`PDF export error: ${fallbackErr.message}`, 'error');
                        });
                });
        } else {
            element.classList.remove('pdf-export-mode');
            this.app.toast('PDF generation engine not available.', 'error');
        }
    }

    printDocument(elementId) {
        sound.click();
        const sheet = document.getElementById(elementId);
        if (!sheet) return;

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sonam Official Archival Record</title>
                <link rel="stylesheet" href="/static/css/components.css">
                <style>
                    body { margin: 0; padding: 20px; background: #fff; font-family: 'Times New Roman', serif; }
                    .official-document-sheet { width: 100% !important; max-width: 100% !important; box-shadow: none !important; padding: 0 !important; }
                </style>
            </head>
            <body>
                ${sheet.outerHTML}
            </body>
            </html>
        `);
        frameDoc.close();

        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            setTimeout(() => document.body.removeChild(printFrame), 2000);
        }, 500);
    }

    /* ==========================================================================
       LOANS LEDGER & ACTIONS
       ========================================================================== */
    async loadLoans() {
        try {
            this.loans = await api.getLoans();
            this.renderLoans();
        } catch (e) {
            this.app.toast(`Failed to load loans: ${e.message}`, 'error');
        }
    }

    renderLoans() {
        // Calculate real summary statistics from loans
        const activeCount = this.loans.filter(l => l.status === 'active').length;
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueSoonCount = this.loans.filter(l => {
            if (l.status !== 'active') return false;
            const d = new Date(l.due_date);
            return d >= now && d <= in7Days;
        }).length;
        const overdueCount = this.loans.filter(l => l.status === 'overdue').length;
        const returnedCount = this.loans.filter(l => l.status === 'returned').length;

        const elActive = document.getElementById('stat-active-loans');
        if (elActive) elActive.textContent = activeCount;
        const elDueSoon = document.getElementById('stat-due-soon');
        if (elDueSoon) elDueSoon.textContent = dueSoonCount;
        const elOverdue = document.getElementById('stat-overdue-loans');
        if (elOverdue) elOverdue.textContent = overdueCount;
        const elReturned = document.getElementById('stat-returned-loans');
        if (elReturned) elReturned.textContent = returnedCount;

        const tbody = document.getElementById('circulation-loans-tbody');
        if (!tbody) return;

        let filtered = this.loans;
        if (this.activeFilter === 'active') {
            filtered = this.loans.filter(l => l.status === 'active');
        } else if (this.activeFilter === 'overdue') {
            filtered = this.loans.filter(l => l.status === 'overdue');
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 24px; font-size: 13.5px;">No circulation records matching current filter.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(l => {
            const isOverdue = l.status === 'overdue';
            const isReturned = l.status === 'returned';
            const statusClass = isOverdue ? 'badge-soft-overdue' : (isReturned ? 'badge-soft-returned' : 'badge-soft-active');
            const statusLabel = isOverdue ? 'Overdue' : (isReturned ? 'Returned' : 'Active');
            const dueDateFormatted = new Date(l.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            return `
                <tr ${isOverdue ? 'style="background: rgba(196, 50, 50, 0.02);"' : ''}>
                    <td style="max-width: 320px;">
                        <div style="font-weight: 650; color: var(--text-primary); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escape(l.book_title)}">
                            ${this.escape(l.book_title)}
                        </div>
                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                            <span style="font-family: var(--font-mono);">${this.escape(l.barcode)}</span>
                            ${l.book_isbn ? ` · <span style="font-family: var(--font-mono);">ISBN ${this.escape(l.book_isbn)}</span>` : ''}
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 13.5px;">${this.escape(l.patron_name)}</div>
                        <div style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${this.escape(l.patron_membership)}</div>
                    </td>
                    <td><span class="badge-soft ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <div style="font-weight: 500; font-size: 13px; color: ${isOverdue ? 'var(--status-danger-text)' : 'var(--text-primary)'};">${dueDateFormatted}</div>
                        ${isOverdue ? `<div style="font-size: 11px; font-weight: 600; color: var(--status-danger-text); margin-top: 2px;">${l.overdue_days}d overdue</div>` : ''}
                    </td>
                    <td style="font-size: 13px; color: var(--text-secondary);">${l.renewals_count} / 2</td>
                    <td style="font-size: 13px;">
                        ${isOverdue ? `
                            <div style="font-family: var(--font-mono); font-weight: 700; color: #ef4444; font-size: 12.5px;">$${(l.calculated_fine || 0).toFixed(2)}</div>
                            <div style="font-size: 10.5px; color: #ef4444;">late fine</div>
                        ` : (isReturned ? `
                            <div style="font-family: var(--font-mono); font-weight: 600; color: ${(l.total_charges || 0) > 0 ? '#b45309' : '#10b981'}; font-size: 12.5px;">
                                $${(l.total_charges || 0).toFixed(2)}
                            </div>
                            <div style="font-size: 10.5px; color: ${(l.total_charges || 0) > 0 ? '#b45309' : 'var(--text-muted)'};">
                                ${(l.total_charges || 0) > 0 ? 'assessed' : 'cleared'}
                            </div>
                        ` : `
                            <div style="font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); font-size: 12.5px;">$${((l.invoice && l.invoice.total_charged) || 65.00).toFixed(2)}</div>
                            <div style="font-size: 10.5px; color: var(--text-muted);">invoice val</div>
                        `)}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; gap: 6px; justify-content: flex-end; align-items: center;">
                            <!-- Invoice PDF Button for every loan -->
                            <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" onclick="(window.sonamApp || window.athenaApp).circulation.showInvoiceForLoanId('${l.id}')" title="View & Download Invoice PDF">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span>Invoice PDF</span>
                            </button>

                            ${l.status === 'active' ? `
                                <button class="btn-table-renew" onclick="(window.sonamApp || window.athenaApp).circulation.renew('${l.id}')">
                                    Renew
                                </button>
                                <button class="btn-table-return" onclick="(window.sonamApp || window.athenaApp).circulation.promptReturnModal('${l.barcode}')" style="display: inline-flex; align-items: center; gap: 4px;">
                                    <span>Return</span>
                                </button>
                            ` : ''}

                            ${l.status === 'overdue' ? `
                                <button class="btn-table-return" onclick="(window.sonamApp || window.athenaApp).circulation.promptReturnModal('${l.barcode}')" style="background: #dc2626; border-color: #dc2626; display: inline-flex; align-items: center; gap: 4px;">
                                    <span>Check In</span>
                                </button>
                            ` : ''}

                            ${l.status === 'returned' ? `
                                <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; background: #059669; border-color: #059669; display: inline-flex; align-items: center; gap: 4px;" onclick="(window.sonamApp || window.athenaApp).circulation.showReturnSlipForLoanId('${l.id}')" title="View & Download Return Slip PDF">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span>Return Slip PDF</span>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    promptReturnModal(barcode) {
        const loan = this.loans.find(l => l.barcode === barcode && l.status !== 'returned');
        if (loan) {
            this.openReturnInspectionModal(loan);
        } else {
            this.lookupBarcode(barcode);
            setTimeout(() => this.openReturnInspectionModal(), 150);
        }
    }

    async showInvoiceForLoanId(loanId) {
        sound.click();
        const loan = this.loans.find(l => l.id === loanId);
        if (loan) {
            if (loan.invoice) {
                this.displayInvoiceModal(loan.invoice);
            } else {
                try {
                    const inv = await api.getInvoice(loan.invoice_number || loanId);
                    this.displayInvoiceModal(inv);
                } catch {
                    this.displayInvoiceForLoan(loan);
                }
            }
        }
    }

    async showReturnSlipForLoanId(loanId) {
        sound.click();
        const loan = this.loans.find(l => l.id === loanId);
        if (loan) {
            if (loan.return_slip) {
                this.displayReturnSlipModal(loan.return_slip);
            } else {
                try {
                    const slip = await api.getReturnSlip(loan.return_slip_number || loanId);
                    this.displayReturnSlipModal(slip);
                } catch {
                    // Fallback synthesis
                    const slip = {
                        slip_number: loan.return_slip_number || `RET-${loan.id.replace('loan-', '').toUpperCase()}`,
                        return_date: loan.returned_at || new Date().toISOString(),
                        patron_name: loan.patron_name,
                        patron_membership: loan.patron_membership,
                        book_title: loan.book_title,
                        barcode: loan.barcode,
                        issued_at: loan.issued_at,
                        condition: loan.returned_condition || 'good',
                        condition_notes: loan.notes || 'Verified and archived.',
                        overdue_fine: loan.overdue_fine || 0.0,
                        damage_charge: loan.damage_charge || 0.0,
                        total_charges: loan.total_charges || 0.0,
                        payment_status: 'Completed & Cleared'
                    };
                    this.displayReturnSlipModal(slip);
                }
            }
        }
    }

    async renew(loanId) {
        try {
            sound.click();
            await api.renewLoan(loanId);
            sound.success();
            this.app.toast('Loan renewed for +14 days', 'success');
            await this.loadLoans();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    escape(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
