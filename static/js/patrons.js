/**
 * Athena Patron Registry Engine
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class PatronEngine {
    constructor(app) {
        this.app = app;
        this.patrons = [];
        this.searchQuery = '';
    }

    init() {
        this.bindEvents();
        this.loadPatrons();
    }

    bindEvents() {
        const searchInput = document.getElementById('patron-search-input');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.loadPatrons();
                }, 250);
            });
        }

        const openBtn = document.getElementById('btn-open-add-patron-modal');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                sound.click();
                document.getElementById('add-patron-modal').classList.add('open');
            });
        }

        const form = document.getElementById('form-add-patron');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreatePatron();
            });
        }
    }

    async loadPatrons() {
        try {
            this.patrons = await api.getPatrons(this.searchQuery);
            this.renderPatrons();
        } catch (e) {
            this.app.toast(`Failed to load patrons: ${e.message}`, 'error');
        }
    }

    renderPatrons() {
        const tbody = document.getElementById('patron-table-tbody');
        if (!tbody) return;

        if (this.patrons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No scholars or patrons found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.patrons.map(p => {
            const hasFines = p.outstanding_fines > 0;
            const quota = p.borrowing_limit || 5;
            const current = p.active_loans_count || 0;
            const pct = Math.min(100, Math.round((current / quota) * 100));

            return `
                <tr>
                    <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-gold);">${this.escape(p.membership_number)}</td>
                    <td style="font-weight: 600; color: var(--text-primary);">${this.escape(p.first_name)} ${this.escape(p.last_name)}</td>
                    <td><span class="badge badge-tier">${this.escape(p.tier)}</span></td>
                    <td style="color: var(--text-secondary);">${this.escape(p.email)}</td>
                    <td style="font-family: var(--font-mono);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>${current} / ${quota}</span>
                            <div style="flex: 1; max-width: 60px; height: 4px; background: var(--bg-surface-raised); border-radius: 2px; overflow: hidden;">
                                <div style="width: ${pct}%; height: 100%; background: var(--accent-gold);"></div>
                            </div>
                        </div>
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 600; color: ${hasFines ? 'var(--status-danger-text)' : 'var(--status-success-text)'};">
                        $${p.outstanding_fines.toFixed(2)}
                    </td>
                    <td style="text-align: right;">
                        <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.athenaApp.patrons.loadToCirculation('${p.membership_number}')">
                            Load in Desk
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    loadToCirculation(membershipNumber) {
        sound.click();
        this.app.switchTab('circulation');
        setTimeout(() => {
            this.app.circulation.lookupPatron(membershipNumber);
        }, 100);
    }

    async handleCreatePatron() {
        const first = document.getElementById('patron-input-first').value.trim();
        const last = document.getElementById('patron-input-last').value.trim();
        const email = document.getElementById('patron-input-email').value.trim();
        const phone = document.getElementById('patron-input-phone').value.trim();
        const tier = document.getElementById('patron-input-tier').value;
        const membership = document.getElementById('patron-input-membership').value.trim();

        if (!first || !last || !email) {
            this.app.toast('First name, last name, and institutional email are required.', 'error');
            return;
        }

        const limits = {
            undergraduate: 5,
            postgraduate: 8,
            faculty: 15,
            researcher: 12,
            general: 3
        };

        const payload = {
            first_name: first,
            last_name: last,
            email: email,
            phone: phone || null,
            tier: tier,
            membership_number: membership || null,
            borrowing_limit: limits[tier] || 5
        };

        try {
            sound.click();
            const created = await api.createPatron(payload);
            sound.success();
            this.app.toast(`Patron ${created.first_name} ${created.last_name} enrolled (${created.membership_number})`, 'success');

            document.getElementById('add-patron-modal').classList.remove('open');
            document.getElementById('form-add-patron').reset();
            await this.loadPatrons();
            this.app.telemetry.refresh();
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
