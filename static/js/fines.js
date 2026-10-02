/**
 * Athena Financial Ledger & Fines Engine
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class FinesEngine {
    constructor(app) {
        this.app = app;
        this.fines = [];
        this.activeFilter = 'outstanding'; // outstanding, settled, all
        this.selectedFine = null;
    }

    init() {
        this.bindEvents();
        this.loadFines();
    }

    bindEvents() {
        const filterBtns = document.querySelectorAll('.fine-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.dataset.filter;
                this.renderFines();
            });
        });

        // Settle fine form
        const settleForm = document.getElementById('form-settle-fine');
        if (settleForm) {
            settleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSettleFine();
            });
        }

        // Waive fine form
        const waiveForm = document.getElementById('form-waive-fine');
        if (waiveForm) {
            waiveForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleWaiveFine();
            });
        }
    }

    async loadFines() {
        try {
            this.fines = await api.getFines();
            this.renderFines();
        } catch (e) {
            this.app.toast(`Failed to load fines: ${e.message}`, 'error');
        }
    }

    renderFines() {
        const tbody = document.getElementById('fines-table-tbody');
        if (!tbody) return;

        let filtered = this.fines;
        if (this.activeFilter === 'outstanding') {
            filtered = this.fines.filter(f => f.status === 'outstanding');
        } else if (this.activeFilter === 'settled') {
            filtered = this.fines.filter(f => f.status === 'settled');
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No fine records matching current filter.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(f => {
            const isOutstanding = f.status === 'outstanding';
            const statusClass = isOutstanding ? 'badge-overdue' : (f.status === 'settled' ? 'badge-available' : 'badge-loaned');
            const assessedFormatted = new Date(f.assessed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <tr>
                    <td style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-gold);">${this.escape(f.patron_membership)}</td>
                    <td style="font-weight: 500; color: var(--text-primary);">${this.escape(f.patron_name)}</td>
                    <td style="color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${this.escape(f.book_title)}
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 600; color: ${isOutstanding ? 'var(--status-danger-text)' : 'var(--text-primary)'};">
                        $${f.amount.toFixed(2)}
                    </td>
                    <td><span class="badge ${statusClass}">${this.escape(f.status)}</span></td>
                    <td style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">${assessedFormatted}</td>
                    <td style="text-align: right;">
                        ${isOutstanding ? `
                            <div style="display: inline-flex; gap: 8px;">
                                <button class="btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="window.athenaApp.fines.openSettleModal('${f.id}')">
                                    Settle
                                </button>
                                <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.athenaApp.fines.openWaiveModal('${f.id}')">
                                    Waive
                                </button>
                            </div>
                        ` : `
                            <span style="font-size: 11px; color: var(--text-muted);">
                                ${f.status === 'settled' ? 'Settled in Full' : `Waived: ${this.escape(f.waived_reason || 'Administrative')}`}
                            </span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    }

    openSettleModal(fineId) {
        sound.click();
        const fine = this.fines.find(f => f.id === fineId);
        if (!fine) return;
        this.selectedFine = fine;

        const remaining = fine.amount - (fine.paid_amount || 0);
        document.getElementById('settle-fine-amount').value = remaining.toFixed(2);
        document.getElementById('settle-fine-details').textContent = 
            `Patron: ${fine.patron_name} (${fine.patron_membership}) | Title: ${fine.book_title} | Outstanding: $${remaining.toFixed(2)}`;

        document.getElementById('settle-fine-modal').classList.add('open');
    }

    openWaiveModal(fineId) {
        sound.click();
        const fine = this.fines.find(f => f.id === fineId);
        if (!fine) return;
        this.selectedFine = fine;

        document.getElementById('waive-fine-details').textContent = 
            `Waiving $${fine.amount.toFixed(2)} for ${fine.patron_name} (${fine.patron_membership})`;

        document.getElementById('waive-fine-modal').classList.add('open');
    }

    async handleSettleFine() {
        if (!this.selectedFine) return;
        const amount = parseFloat(document.getElementById('settle-fine-amount').value);
        const method = document.getElementById('settle-fine-method').value;

        if (isNaN(amount) || amount <= 0) {
            this.app.toast('Please enter a valid payment amount', 'error');
            return;
        }

        try {
            sound.click();
            await api.settleFine(this.selectedFine.id, amount, method);
            sound.success();
            this.app.toast(`Fine payment of $${amount.toFixed(2)} recorded via ${method}`, 'success');

            document.getElementById('settle-fine-modal').classList.remove('open');
            await this.loadFines();
            this.app.patrons.loadPatrons();
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    async handleWaiveFine() {
        if (!this.selectedFine) return;
        const auth = document.getElementById('waive-fine-authorized').value.trim();
        const reason = document.getElementById('waive-fine-reason').value.trim();

        if (!auth || !reason) {
            this.app.toast('Authorizing officer name and justification are required', 'error');
            return;
        }

        try {
            sound.click();
            await api.waiveFine(this.selectedFine.id, auth, reason);
            sound.success();
            this.app.toast(`Fine waived by ${auth}`, 'info');

            document.getElementById('waive-fine-modal').classList.remove('open');
            await this.loadFines();
            this.app.patrons.loadPatrons();
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
