/**
 * Athena Command Palette (Ctrl+K) Controller
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class CommandPaletteEngine {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.selectedIndex = 0;
        this.items = [];
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const trigger = document.getElementById('topbar-command-trigger');
        if (trigger) {
            trigger.addEventListener('click', () => this.open());
        }

        const input = document.getElementById('palette-search-input');
        if (input) {
            input.addEventListener('input', (e) => this.handleSearch(e.target.value.trim()));
            input.addEventListener('keydown', (e) => this.handleKeydown(e));
        }

        const backdrop = document.getElementById('command-palette-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) this.close();
            });
        }
    }

    open() {
        sound.click();
        const backdrop = document.getElementById('command-palette-backdrop');
        const input = document.getElementById('palette-search-input');
        if (!backdrop || !input) return;

        backdrop.classList.add('open');
        this.isOpen = true;
        input.value = '';
        input.focus();
        this.loadDefaultShortcuts();
    }

    close() {
        const backdrop = document.getElementById('command-palette-backdrop');
        if (backdrop) backdrop.classList.remove('open');
        this.isOpen = false;
    }

    loadDefaultShortcuts() {
        this.items = [
            { type: 'action', title: 'Open Circulation Desk', sub: 'Issue & return books', action: () => this.app.switchTab('circulation') },
            { type: 'action', title: 'Catalog New Title', sub: 'Add book with ISBN lookup', action: () => this.app.catalog.openAddBookModal() },
            { type: 'action', title: 'Register New Scholar / Patron', sub: 'Issue new membership card', action: () => document.getElementById('add-patron-modal').classList.add('open') },
            { type: 'action', title: 'View Outstanding Fines', sub: 'Inspect institutional assessments', action: () => this.app.switchTab('fines') },
            { type: 'action', title: 'Institutional Telemetry & KPIs', sub: 'Circulation metrics & Dewey distribution', action: () => this.app.switchTab('telemetry') },
            { type: 'action', title: 'Firebase Cloud Connection', sub: 'Configure Firestore service account', action: () => this.app.firebaseModal.openModal() }
        ];
        this.selectedIndex = 0;
        this.renderItems();
    }

    async handleSearch(query) {
        if (!query) {
            this.loadDefaultShortcuts();
            return;
        }

        try {
            const [books, patrons] = await Promise.all([
                api.getBooks(query),
                api.getPatrons(query)
            ]);

            const results = [];

            // Add book matches
            books.slice(0, 5).forEach(b => {
                results.push({
                    type: 'book',
                    title: b.title,
                    sub: `ISBN: ${b.isbn_13} | Call No: ${b.classification_code} | ${b.available_copies}/${b.total_copies} available`,
                    action: () => {
                        this.app.switchTab('catalog');
                        this.app.catalog.inspectBook(b.id);
                    }
                });
            });

            // Add patron matches
            patrons.slice(0, 4).forEach(p => {
                results.push({
                    type: 'patron',
                    title: `${p.first_name} ${p.last_name}`,
                    sub: `Card: ${p.membership_number} | Tier: ${p.tier} | Fines: $${p.outstanding_fines.toFixed(2)}`,
                    action: () => {
                        this.app.patrons.loadToCirculation(p.membership_number);
                    }
                });
            });

            this.items = results;
            this.selectedIndex = 0;
            this.renderItems();
        } catch (e) {
            console.error('Palette search error:', e);
        }
    }

    handleKeydown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.items.length);
            this.renderItems();
            sound.click();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % Math.max(1, this.items.length);
            this.renderItems();
            sound.click();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.items[this.selectedIndex]) {
                const item = this.items[this.selectedIndex];
                this.close();
                item.action();
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    renderItems() {
        const container = document.getElementById('palette-results-list');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px;">No results found.</div>`;
            return;
        }

        container.innerHTML = this.items.map((item, idx) => {
            const isSelected = idx === this.selectedIndex;
            return `
                <div class="palette-item ${isSelected ? 'selected' : ''}" onclick="window.athenaApp.commandPalette.executeItem(${idx})">
                    <div class="palette-item-main">
                        <span class="palette-item-title">${this.escape(item.title)}</span>
                        <span class="palette-item-sub">${this.escape(item.sub)}</span>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); text-transform: uppercase;">
                        ${this.escape(item.type)}
                    </span>
                </div>
            `;
        }).join('');
    }

    executeItem(idx) {
        if (this.items[idx]) {
            this.close();
            this.items[idx].action();
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
