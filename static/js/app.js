/**
 * Athena Institutional Library Management System
 * Master Application Coordinator
 */

import { sound } from './audio.js';
import { AuthEngine } from './auth.js';
import { CirculationEngine } from './circulation.js';
import { CatalogEngine } from './catalog.js';
import { PatronEngine } from './patrons.js';
import { FinesEngine } from './fines.js';
import { TelemetryEngine } from './telemetry.js';
import { FirebaseModalEngine } from './firebase_modal.js';
import { CommandPaletteEngine } from './command_palette.js';

class AthenaApplication {
    constructor() {
        this.activeTab = 'circulation';
        this.auth = new AuthEngine(this);
        this.circulation = new CirculationEngine(this);
        this.catalog = new CatalogEngine(this);
        this.patrons = new PatronEngine(this);
        this.fines = new FinesEngine(this);
        this.telemetry = new TelemetryEngine(this);
        this.firebaseModal = new FirebaseModalEngine(this);
        this.commandPalette = new CommandPaletteEngine(this);
    }

    init() {
        this.setupNavigation();
        this.setupClock();
        this.setupKeybindings();
        this.setupModalDismissals();
        this.setupAudioToggle();
        this.setupTheme();

        // Initialize sub-engines
        this.auth.init();
        this.circulation.init();
        this.catalog.init();
        this.patrons.init();
        this.fines.init();
        this.telemetry.init();
        this.firebaseModal.init();
        this.commandPalette.init();

        console.log('Sonam Institutional Library Management System initialized.');
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-view]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchTab(view);
            });
        });
    }

    switchTab(viewId) {
        sound.click();
        this.activeTab = viewId;

        // Update Nav items
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            if (item.dataset.view === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update Views
        document.querySelectorAll('.view-content').forEach(view => {
            if (view.id === `view-${viewId}`) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        // Update Topbar View Title
        const titleEl = document.getElementById('current-view-title');
        const subheadEl = document.getElementById('current-view-subhead');
        
        const titles = {
            circulation: { title: 'CIRCULATION DESK', sub: 'RAPID SCANNER & LOAN LEDGER' },
            catalog: { title: 'BIBLIOGRAPHIC CATALOG', sub: 'DEWEY DECIMAL & HOLDINGS' },
            patrons: { title: 'PATRON & SCHOLAR REGISTRY', sub: 'MEMBERSHIP & BORROWING TIERS' },
            fines: { title: 'FINANCIAL ASSESSMENTS', sub: 'FEE SETTLEMENT & WAIVER LEDGER' },
            telemetry: { title: 'INSTITUTIONAL TELEMETRY', sub: 'CIRCULATION METRICS & AUDIT LOGS' }
        };

        if (titles[viewId]) {
            if (titleEl) titleEl.textContent = titles[viewId].title;
            if (subheadEl) subheadEl.textContent = titles[viewId].sub;
        }

        // Trigger view refreshes if appropriate
        if (viewId === 'circulation') this.circulation.loadLoans();
        if (viewId === 'catalog') this.catalog.loadBooks();
        if (viewId === 'patrons') this.patrons.loadPatrons();
        if (viewId === 'fines') this.fines.loadFines();
        if (viewId === 'telemetry') this.telemetry.refresh();
    }

    setupClock() {
        const clockEl = document.getElementById('topbar-live-clock');
        const update = () => {
            if (!clockEl) return;
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            clockEl.textContent = `${dateStr} • ${timeStr} LOCAL`;
        };
        update();
        setInterval(update, 1000);
    }

    setupKeybindings() {
        window.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K or / (when not typing in an input) opens command palette
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.commandPalette.open();
                return;
            }

            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                this.commandPalette.open();
                return;
            }

            // F2: focus rapid patron scan
            if (e.key === 'F2') {
                e.preventDefault();
                this.switchTab('circulation');
                const patronInput = document.getElementById('scan-patron-input');
                if (patronInput) patronInput.focus();
                return;
            }

            // F3: focus rapid item barcode scan
            if (e.key === 'F3') {
                e.preventDefault();
                this.switchTab('circulation');
                const barcodeInput = document.getElementById('scan-barcode-input');
                if (barcodeInput) barcodeInput.focus();
                return;
            }

            // Esc: close all open modals
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.commandPalette.close();
            }
        });
    }

    setupModalDismissals() {
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                sound.click();
                this.closeAllModals();
            });
        });

        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.closeAllModals();
                }
            });
        });
    }

    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    }

    setupAudioToggle() {
        const btn = document.getElementById('topbar-audio-toggle');
        if (!btn) return;

        const updateBtn = () => {
            const isMuted = sound.isMuted;
            btn.style.color = isMuted ? 'var(--text-muted)' : 'var(--accent-gold)';
            btn.title = isMuted ? 'Acoustic cues muted' : 'Acoustic cues enabled';
        };

        updateBtn();

        btn.addEventListener('click', () => {
            sound.toggle();
            updateBtn();
            if (!sound.isMuted) sound.click();
        });
    }

    setupTheme() {
        const toggleBtn = document.getElementById('topbar-theme-toggle');
        const savedTheme = localStorage.getItem('athena_theme') || 'light';

        const applyTheme = (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('athena_theme', theme);
            if (toggleBtn) {
                if (theme === 'light') {
                    toggleBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                    `;
                    toggleBtn.title = 'Switch to Obsidian Dark Mode';
                } else {
                    toggleBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    `;
                    toggleBtn.title = 'Switch to Archival Light Mode';
                }
            }
        };

        applyTheme(savedTheme);

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                sound.click();
                const current = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                this.toast(`Interface theme: ${next === 'light' ? 'Archival Light (National Library)' : 'Midnight Obsidian'}`, 'info');
            });
        }
    }

    toast(message, type = 'info') {
        const container = document.getElementById('app-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSvg = type === 'success' ? 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>` :
            (type === 'error' ? 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` :
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`);

        toast.innerHTML = `
            ${iconSvg}
            <span>${this.escape(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            toast.style.transition = 'all 200ms var(--ease-out)';
            setTimeout(() => toast.remove(), 220);
        }, 4000);
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

// Instantiate and expose globally
window.addEventListener('DOMContentLoaded', () => {
    const app = new AthenaApplication();
    window.sonamApp = app;
    window.athenaApp = app;
    app.init();
});
