/**
 * Athena Bibliographic Catalog Engine
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class CatalogEngine {
    constructor(app) {
        this.app = app;
        this.books = [];
        this.activeDewey = '';
        this.searchQuery = '';
        this.viewMode = 'grid'; // grid or table
        this.selectedBook = null;
    }

    init() {
        this.bindEvents();
        this.loadBooks();
    }

    bindEvents() {
        // Search input with debounce
        const searchInput = document.getElementById('catalog-search-input');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.loadBooks();
                }, 250);
            });
        }

        // Dewey filter pills
        const pills = document.querySelectorAll('.dewey-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.activeDewey = pill.dataset.dewey || '';
                this.loadBooks();
            });
        });

        // View toggle buttons
        const gridBtn = document.getElementById('view-toggle-grid');
        const tableBtn = document.getElementById('view-toggle-table');
        if (gridBtn && tableBtn) {
            gridBtn.addEventListener('click', () => {
                this.viewMode = 'grid';
                gridBtn.classList.add('active');
                tableBtn.classList.remove('active');
                this.renderBooks();
            });
            tableBtn.addEventListener('click', () => {
                this.viewMode = 'table';
                tableBtn.classList.add('active');
                gridBtn.classList.remove('active');
                this.renderBooks();
            });
        }

        // Catalog New Book Modal triggers
        const addBtn = document.getElementById('btn-open-add-book-modal');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddBookModal());
        }

        const fetchIsbnBtn = document.getElementById('btn-fetch-isbn-meta');
        if (fetchIsbnBtn) {
            fetchIsbnBtn.addEventListener('click', () => this.fetchIsbnMetadata());
        }

        const submitBookForm = document.getElementById('form-add-book');
        if (submitBookForm) {
            submitBookForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateBook();
            });
        }

        const prefillBtn = document.getElementById('btn-prefill-sample-book');
        if (prefillBtn) {
            prefillBtn.addEventListener('click', () => this.prefillSampleBook());
        }

        const autoIsbnBtn = document.getElementById('btn-auto-gen-isbn');
        if (autoIsbnBtn) {
            autoIsbnBtn.addEventListener('click', () => this.autoGenerateIsbn());
        }

        // Hero Banner Quick Actions
        const heroCatalogBtn = document.getElementById('hero-btn-catalog-title');
        if (heroCatalogBtn) {
            heroCatalogBtn.addEventListener('click', () => this.openAddBookModal());
        }

        const heroCircBtn = document.getElementById('hero-btn-circulation-desk');
        if (heroCircBtn) {
            heroCircBtn.addEventListener('click', () => this.app.switchTab('circulation'));
        }

        const heroCmdBtn = document.getElementById('hero-btn-command-palette');
        if (heroCmdBtn) {
            heroCmdBtn.addEventListener('click', () => this.app.commandPalette.open());
        }
    }

    async loadBooks() {
        try {
            this.books = await api.getBooks(this.searchQuery, this.activeDewey);
            this.renderBooks();

            // Update Hero Banner stats
            const statTitles = document.getElementById('hero-stat-titles');
            if (statTitles && this.books) statTitles.textContent = `${this.books.length}+`;
            const statHoldings = document.getElementById('hero-stat-holdings');
            if (statHoldings && this.books) {
                const total = this.books.reduce((sum, b) => sum + (b.total_copies || (b.items ? b.items.length : 0)), 0);
                statHoldings.textContent = total || 27;
            }
        } catch (e) {
            this.app.toast(`Failed to load catalog: ${e.message}`, 'error');
        }
    }

    renderBooks() {
        const gridEl = document.getElementById('catalog-book-grid');
        const tableEl = document.getElementById('catalog-book-table-wrap');

        if (!gridEl || !tableEl) return;

        if (this.viewMode === 'grid') {
            gridEl.style.display = 'grid';
            tableEl.style.display = 'none';
            this.renderGridView(gridEl);
        } else {
            gridEl.style.display = 'none';
            tableEl.style.display = 'block';
            this.renderTableView();
        }
    }

    renderGridView(container) {
        if (this.books.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 48px;">No titles found matching criteria.</div>`;
            return;
        }

        container.innerHTML = this.books.map(b => {
            const availClass = b.available_copies > 0 ? 'badge-available' : 'badge-overdue';
            const coverImg = b.cover_image_url ? 
                `<img class="book-cover-img" src="${this.escape(b.cover_image_url)}" alt="Cover" loading="lazy" />` : 
                `<div class="book-cover-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <span style="font-family: var(--font-mono); font-size: 10px;">ARCHIVAL VOLUME</span>
                </div>`;

            return `
                <div class="book-card" onclick="window.athenaApp.catalog.inspectBook('${b.id}')">
                    <div class="book-cover-wrap">${coverImg}</div>
                    <div class="book-card-body">
                        <div class="book-card-classification">${this.escape(b.classification_code || '000')}</div>
                        <div class="book-card-title">${this.escape(b.title)}</div>
                        <div class="book-card-authors">${this.escape((b.authors || []).join(', '))}</div>
                        <div class="book-card-footer">
                            <span class="badge ${availClass}">
                                ${b.available_copies} / ${b.total_copies} Available
                            </span>
                            <span style="color: var(--text-muted); font-size: 10px;">${b.publication_year || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTableView() {
        const tbody = document.getElementById('catalog-book-tbody');
        if (!tbody) return;

        if (this.books.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">No titles found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.books.map(b => {
            const availClass = b.available_copies > 0 ? 'badge-available' : 'badge-overdue';
            return `
                <tr onclick="window.athenaApp.catalog.inspectBook('${b.id}')" style="cursor: pointer;">
                    <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-gold);">${this.escape(b.classification_code || '000')}</td>
                    <td style="font-weight: 600; color: var(--text-primary);">${this.escape(b.title)}</td>
                    <td>${this.escape((b.authors || []).join(', '))}</td>
                    <td style="font-family: var(--font-mono); font-size: 11px;">${this.escape(b.isbn_13)}</td>
                    <td style="font-size: 12px; color: var(--text-muted);">${this.escape(b.dewey_category || 'General Works')}</td>
                    <td style="text-align: right;">
                        <span class="badge ${availClass}">${b.available_copies} / ${b.total_copies} Available</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    inspectBook(bookId) {
        sound.click();
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
        this.selectedBook = book;

        const modal = document.getElementById('book-detail-modal');
        const content = document.getElementById('book-detail-content');
        if (!modal || !content) return;

        const itemsList = (book.items || []).map(itm => `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-gold);">${this.escape(itm.barcode)}</td>
                <td>${this.escape(itm.location_floor)}, ${this.escape(itm.location_shelf)}</td>
                <td><span class="badge ${itm.status === 'available' ? 'badge-available' : 'badge-loaned'}">${this.escape(itm.status)}</span></td>
                <td>${this.escape(itm.condition)}</td>
                <td style="text-align: right;">
                    <button class="btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="window.athenaApp.catalog.loadCopyToCirculation('${this.escape(itm.barcode)}')">
                        Select in Desk
                    </button>
                </td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div style="display: flex; gap: 24px; margin-bottom: 24px;">
                ${book.cover_image_url ? `
                    <img src="${this.escape(book.cover_image_url)}" style="width: 140px; height: 190px; object-fit: cover; border-radius: 4px; box-shadow: var(--shadow-md);" />
                ` : ''}
                <div style="flex: 1;">
                    <div style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-gold); margin-bottom: 4px;">
                        CALL NO: ${this.escape(book.classification_code || '000')}
                    </div>
                    <h2 style="font-family: var(--font-serif); font-size: 20px; color: var(--text-primary); margin-bottom: 8px;">
                        ${this.escape(book.title)}
                    </h2>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                        By ${this.escape((book.authors || []).join(', '))}
                    </div>
                    <div class="meta-kv-grid">
                        <div class="meta-kv-item"><span class="meta-k">ISBN-13</span><span class="meta-v">${this.escape(book.isbn_13)}</span></div>
                        <div class="meta-kv-item"><span class="meta-k">Publisher</span><span class="meta-v">${this.escape(book.publisher || 'Unknown')}</span></div>
                        <div class="meta-kv-item"><span class="meta-k">Publication Year</span><span class="meta-v">${book.publication_year || 'N/A'}</span></div>
                        <div class="meta-kv-item"><span class="meta-k">Holdings</span><span class="meta-v">${book.available_copies} of ${book.total_copies} available</span></div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div class="meta-k" style="margin-bottom: 6px;">Bibliographic Abstract</div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; background: var(--bg-surface-raised); padding: 14px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                    ${this.escape(book.summary || 'No abstract registered in institutional catalog record.')}
                </div>
            </div>

            <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div style="font-family: var(--font-serif); font-size: 14px; color: var(--text-primary);">Physical Holdings (${(book.items || []).length} Copies)</div>
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="window.athenaApp.catalog.addPhysicalCopy('${book.id}')">
                        + Add Physical Copy
                    </button>
                </div>
                <div class="table-container">
                    <table class="archival-table">
                        <thead>
                            <tr>
                                <th>Barcode</th>
                                <th>Shelf Location</th>
                                <th>Status</th>
                                <th>Condition</th>
                                <th style="text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>${itemsList}</tbody>
                    </table>
                </div>
            </div>
        `;

        modal.classList.add('open');
    }

    loadCopyToCirculation(barcode) {
        sound.click();
        const modal = document.getElementById('book-detail-modal');
        if (modal) modal.classList.remove('open');
        this.app.switchTab('circulation');
        setTimeout(() => {
            this.app.circulation.lookupBarcode(barcode);
        }, 120);
    }

    async addPhysicalCopy(bookId) {
        try {
            sound.click();
            await api.addCopy(bookId, 'Floor 2', 'Aisle 03', 'Shelf CS-01');
            sound.success();
            this.app.toast('New physical copy tagged with barcode and added to catalog', 'success');
            await this.loadBooks();
            this.inspectBook(bookId);
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    openAddBookModal() {
        sound.click();
        const modal = document.getElementById('add-book-modal');
        if (modal) modal.classList.add('open');
    }

    async fetchIsbnMetadata() {
        const isbnInput = document.getElementById('book-input-isbn');
        if (!isbnInput || !isbnInput.value.trim()) {
            this.app.toast('Enter an ISBN-10 or ISBN-13 first', 'error');
            return;
        }

        const btn = document.getElementById('btn-fetch-isbn-meta');
        const originalText = btn.textContent;
        btn.textContent = 'Fetching...';
        btn.disabled = true;

        try {
            sound.click();
            const meta = await api.lookupIsbn(isbnInput.value.trim());
            sound.success();

            document.getElementById('book-input-title').value = meta.title || '';
            document.getElementById('book-input-subtitle').value = meta.subtitle || '';
            document.getElementById('book-input-authors').value = (meta.authors || []).join(', ');
            document.getElementById('book-input-publisher').value = meta.publisher || '';
            document.getElementById('book-input-year').value = meta.publication_year || '';
            document.getElementById('book-input-dewey').value = meta.classification_code || '000';
            document.getElementById('book-input-summary').value = meta.summary || '';
            document.getElementById('book-input-cover').value = meta.cover_image_url || '';

            this.app.toast(`Bibliographic metadata retrieved from ${meta.source || 'Open Library'}!`, 'success');
        } catch (e) {
            sound.error();
            this.app.toast(`ISBN lookup: ${e.message}`, 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    autoGenerateIsbn() {
        sound.click();
        const randNum = Math.floor(100000000 + Math.random() * 900000000);
        const isbn = `9780${randNum}`;
        document.getElementById('book-input-isbn').value = isbn;
        this.app.toast(`Generated institutional ISBN: ${isbn}`, 'info');
    }

    prefillSampleBook() {
        sound.click();
        const samples = [
            {
                title: "Structure and Interpretation of Computer Programs",
                subtitle: "Second Edition",
                authors: "Harold Abelson, Gerald Jay Sussman, Julie Sussman",
                publisher: "MIT Press",
                year: 1996,
                dewey: "005.133",
                summary: "A computer science classic teaching the fundamental principles of computation, recursion, interpreters, and abstraction.",
                cover: "https://covers.openlibrary.org/b/id/8305096-L.jpg"
            },
            {
                title: "Design Patterns: Elements of Reusable Object-Oriented Software",
                subtitle: "Professional Computing Series",
                authors: "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
                publisher: "Addison-Wesley Professional",
                year: 1994,
                dewey: "005.117",
                summary: "Captures a wealth of experience in object-oriented software design, presenting 23 classic software engineering design patterns.",
                cover: "https://covers.openlibrary.org/b/id/6513470-L.jpg"
            },
            {
                title: "Clean Architecture: A Craftsman's Guide to Software Structure",
                subtitle: "Robert C. Martin Series",
                authors: "Robert C. Martin",
                publisher: "Prentice Hall",
                year: 2017,
                dewey: "005.1",
                summary: "Universal rules of software architecture to improve developer productivity throughout the life of any software system.",
                cover: "https://covers.openlibrary.org/b/id/8231996-L.jpg"
            }
        ];

        const pick = samples[Math.floor(Math.random() * samples.length)];
        const randNum = Math.floor(100000000 + Math.random() * 900000000);

        document.getElementById('book-input-isbn').value = `9780${randNum}`;
        document.getElementById('book-input-title').value = pick.title;
        document.getElementById('book-input-subtitle').value = pick.subtitle;
        document.getElementById('book-input-authors').value = pick.authors;
        document.getElementById('book-input-publisher').value = pick.publisher;
        document.getElementById('book-input-year').value = pick.year;
        document.getElementById('book-input-dewey').value = pick.dewey;
        document.getElementById('book-input-summary').value = pick.summary;
        document.getElementById('book-input-cover').value = pick.cover;

        this.app.toast(`Sample book '${pick.title}' loaded. Click 'Catalog Title' to add!`, 'success');
    }

    async handleCreateBook() {
        let isbn13 = document.getElementById('book-input-isbn').value.trim();
        const title = document.getElementById('book-input-title').value.trim();
        const authorsRaw = document.getElementById('book-input-authors').value.trim();
        const publisher = document.getElementById('book-input-publisher').value.trim();
        const year = parseInt(document.getElementById('book-input-year').value.trim()) || new Date().getFullYear();
        const dewey = document.getElementById('book-input-dewey').value.trim() || '000';
        const summary = document.getElementById('book-input-summary').value.trim();
        const cover = document.getElementById('book-input-cover').value.trim();
        const copies = parseInt(document.getElementById('book-input-copies').value.trim()) || 1;
        const floor = document.getElementById('book-input-floor').value.trim() || 'Floor 1';
        const shelf = document.getElementById('book-input-shelf').value.trim() || 'Shelf A-01';

        if (!title) {
            this.app.toast('Work Title is required to catalog a book.', 'error');
            return;
        }

        // Auto-generate ISBN if empty
        if (!isbn13) {
            const randNum = Math.floor(100000000 + Math.random() * 900000000);
            isbn13 = `9780${randNum}`;
        }

        const authorsList = authorsRaw ? 
            authorsRaw.split(',').map(a => a.trim()).filter(Boolean) : 
            ["Unknown Author"];

        const payload = {
            isbn_13: isbn13,
            title: title,
            authors: authorsList,
            publisher: publisher || "Institutional Press",
            publication_year: year,
            classification_code: dewey,
            summary: summary || "Cataloged archival volume.",
            cover_image_url: cover || null,
            initial_copies: copies,
            copy_location_floor: floor,
            copy_location_shelf: shelf
        };

        const submitBtn = document.getElementById('btn-submit-catalog-book');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving to Catalog...';
        }

        try {
            sound.click();
            const created = await api.createBook(payload);
            sound.success();
            this.app.toast(`Title '${created.title}' successfully added with ${copies} copies!`, 'success');
            
            document.getElementById('add-book-modal').classList.remove('open');
            document.getElementById('form-add-book').reset();
            await this.loadBooks();
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Complete Cataloging';
            }
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
