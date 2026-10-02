/**
 * Athena Firebase Live Integration Modal Controller
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class FirebaseModalEngine {
    constructor(app) {
        this.app = app;
        this.status = null;
    }

    init() {
        this.bindEvents();
        this.checkStatus();
    }

    bindEvents() {
        const trigger = document.getElementById('firebase-status-capsule');
        if (trigger) {
            trigger.addEventListener('click', () => {
                sound.click();
                this.openModal();
            });
        }

        const topbarTrigger = document.getElementById('topbar-firebase-btn');
        if (topbarTrigger) {
            topbarTrigger.addEventListener('click', () => {
                sound.click();
                this.openModal();
            });
        }

        const fileInput = document.getElementById('firebase-key-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('firebase-json-textarea').value = event.target.result;
                };
                reader.readAsText(file);
            });
        }

        const form = document.getElementById('form-connect-firebase');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleConnect();
            });
        }
    }

    async checkStatus() {
        try {
            this.status = await api.getFirebaseStatus();
            this.updateBadge();
        } catch (e) {
            console.error('Failed to get Firebase status:', e);
        }
    }

    updateBadge() {
        if (!this.status) return;

        const dot = document.getElementById('firebase-indicator-dot');
        const text = document.getElementById('firebase-indicator-text');
        const topbarDot = document.getElementById('topbar-firebase-dot');

        if (this.status.connected) {
            if (dot) dot.classList.add('online');
            if (topbarDot) topbarDot.classList.add('online');
            if (text) text.textContent = `Firebase: ${this.status.project_id || 'Cloud Sync'}`;
        } else {
            if (dot) dot.classList.add('online');
            if (topbarDot) topbarDot.classList.add('online');
            if (text) text.textContent = 'Local Archival DB (Active)';
        }
    }

    openModal() {
        const modal = document.getElementById('firebase-connection-modal');
        if (!modal) return;

        const statusDetail = document.getElementById('firebase-status-details');
        if (statusDetail && this.status) {
            statusDetail.innerHTML = `
                <div style="font-family: var(--font-mono); font-size: 12px; color: ${this.status.connected ? 'var(--status-success-text)' : 'var(--accent-gold)'};">
                    Mode: ${this.status.mode.toUpperCase()}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                    ${this.escape(this.status.details)}
                </div>
            `;
        }

        modal.classList.add('open');
    }

    async handleConnect() {
        const jsonText = document.getElementById('firebase-json-textarea').value.trim();
        if (!jsonText) {
            this.app.toast('Please select a serviceAccountKey.json or paste its JSON content', 'error');
            return;
        }

        const btn = document.getElementById('btn-connect-firebase-submit');
        const original = btn.textContent;
        btn.textContent = 'Authenticating & Connecting...';
        btn.disabled = true;

        try {
            sound.click();
            const res = await api.connectFirebase(jsonText);
            sound.success();
            this.status = res;
            this.updateBadge();
            this.app.toast(`Successfully connected to Firebase project: ${res.project_id}!`, 'success');
            document.getElementById('firebase-connection-modal').classList.remove('open');
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        } finally {
            btn.textContent = original;
            btn.disabled = false;
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
