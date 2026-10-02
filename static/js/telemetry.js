/**
 * Athena Institutional Telemetry & Analytics Engine
 */

import { api } from './api.js';

export class TelemetryEngine {
    constructor(app) {
        this.app = app;
        this.data = null;
    }

    init() {
        this.refresh();
    }

    async refresh() {
        try {
            this.data = await api.getStats();
            this.render();
        } catch (e) {
            console.error('Failed to load telemetry:', e);
        }
    }

    render() {
        if (!this.data) return;

        // Metric values
        this.setVal('telemetry-titles', this.data.total_titles);
        this.setVal('telemetry-holdings', this.data.total_holdings);
        this.setVal('telemetry-available', this.data.available_copies);
        this.setVal('telemetry-active-loans', this.data.active_loans);
        this.setVal('telemetry-overdue-loans', this.data.overdue_loans);
        this.setVal('telemetry-patrons', this.data.total_patrons);
        this.setVal('telemetry-fines-outstanding', `$${this.data.total_fines_outstanding.toFixed(2)}`);
        this.setVal('telemetry-fines-collected', `$${this.data.total_fines_collected.toFixed(2)}`);

        // Update badge counts in sidebar
        const circBadge = document.getElementById('badge-circulation-count');
        if (circBadge) circBadge.textContent = this.data.active_loans;

        const fineBadge = document.getElementById('badge-fines-count');
        if (fineBadge && this.data.total_fines_outstanding > 0) {
            fineBadge.textContent = `$${Math.round(this.data.total_fines_outstanding)}`;
        }

        // Render Dewey Distribution Bars
        const deweyContainer = document.getElementById('telemetry-dewey-bars');
        if (deweyContainer && this.data.dewey_distribution) {
            const entries = Object.entries(this.data.dewey_distribution);
            const maxVal = Math.max(...entries.map(([_, v]) => v), 1);

            deweyContainer.innerHTML = entries.map(([category, count]) => {
                const pct = Math.round((count / maxVal) * 100);
                return `
                    <div class="dewey-bar-row">
                        <div class="dewey-bar-label-group">
                            <span class="dewey-bar-name">${this.escape(category)}</span>
                            <span class="dewey-bar-count">${count} Volumes</span>
                        </div>
                        <div class="dewey-track">
                            <div class="dewey-fill" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render Activity Trail
        const activityList = document.getElementById('telemetry-activity-list');
        if (activityList && this.data.recent_activity) {
            activityList.innerHTML = this.data.recent_activity.map(act => {
                const timeStr = new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `
                    <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); font-size: 12px;">
                        <div>
                            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--accent-gold); margin-right: 8px;">[${this.escape(act.action)}]</span>
                            <span style="color: var(--text-primary);">${this.escape(act.details)}</span>
                        </div>
                        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">${timeStr}</span>
                    </div>
                `;
            }).join('');
        }
    }

    setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
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
