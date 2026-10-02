/**
 * Athena Authentication & Account Manager
 * Password criteria verification & OTP via Gmail
 */

import { api } from './api.js';
import { sound } from './audio.js';

export class AuthEngine {
    constructor(app) {
        this.app = app;
        this.currentUser = null;
        this.pendingEmail = null;
        this.resendTimer = null;
        this.resendSeconds = 60;
    }

    init() {
        this.loadSession();
        this.bindEvents();
        this.updateHeaderUI();
    }

    loadSession() {
        try {
            const stored = localStorage.getItem('athena_user');
            if (stored) {
                this.currentUser = JSON.parse(stored);
            } else {
                // Default to Demo Admin for instant full control out-of-the-box
                this.currentUser = {
                    id: "user-admin-01",
                    email: "admin@sonam.edu",
                    full_name: "Eleanor Vance",
                    role: "admin",
                    membership_number: "SNM-ADMIN-01"
                };
                localStorage.setItem('athena_user', JSON.stringify(this.currentUser));
            }
        } catch (_) {
            this.currentUser = null;
        }
    }

    bindEvents() {
        // Auth Trigger in Header & Dropdown
        const trigger = document.getElementById('topbar-user-btn');
        const dropdown = document.getElementById('user-profile-dropdown');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                sound.click();
                if (this.currentUser) {
                    if (dropdown) dropdown.classList.toggle('open');
                } else {
                    this.openModal('login');
                }
            });
        }

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (dropdown && dropdown.classList.contains('open')) {
                if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
                    dropdown.classList.remove('open');
                }
            }
        });

        // Dropdown Menu Item Actions
        const dLoansBtn = document.getElementById('dropdown-btn-loans');
        if (dLoansBtn) {
            dLoansBtn.addEventListener('click', () => {
                sound.click();
                if (dropdown) dropdown.classList.remove('open');
                this.app.switchTab('circulation');
            });
        }

        const dSwitchBtn = document.getElementById('dropdown-btn-switch');
        if (dSwitchBtn) {
            dSwitchBtn.addEventListener('click', () => {
                sound.click();
                if (dropdown) dropdown.classList.remove('open');
                this.openModal('login');
            });
        }

        const dLogoutBtn = document.getElementById('dropdown-btn-logout');
        if (dLogoutBtn) {
            dLogoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Switch between tabs in Auth Modal (Login / Signup)
        const tabLogin = document.getElementById('auth-tab-login');
        const tabSignup = document.getElementById('auth-tab-signup');
        if (tabLogin && tabSignup) {
            tabLogin.addEventListener('click', () => this.switchAuthView('login'));
            tabSignup.addEventListener('click', () => this.switchAuthView('signup'));
        }

        const toSignupLink = document.getElementById('link-switch-to-signup');
        if (toSignupLink) {
            toSignupLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthView('signup');
            });
        }

        const toLoginLink = document.getElementById('link-switch-to-login');
        if (toLoginLink) {
            toLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthView('login');
            });
        }

        // Live Password Criteria Listener
        const signupPassInput = document.getElementById('signup-password');
        if (signupPassInput) {
            signupPassInput.addEventListener('input', (e) => {
                this.checkPasswordCriteria(e.target.value);
            });
        }

        // Signup Form Submission
        const signupForm = document.getElementById('form-auth-signup');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }

        // Login Form Submission
        const loginForm = document.getElementById('form-auth-login');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // OTP Verification Form
        const otpForm = document.getElementById('form-auth-otp');
        if (otpForm) {
            otpForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleVerifyOtp();
            });
        }

        // Resend OTP Button
        const resendBtn = document.getElementById('btn-resend-otp');
        if (resendBtn) {
            resendBtn.addEventListener('click', () => this.handleResendOtp());
        }

        // Demo Login Quick Buttons
        const demoAdminBtn = document.getElementById('btn-demo-admin-login');
        if (demoAdminBtn) {
            demoAdminBtn.addEventListener('click', () => this.quickLogin('admin@sonam.edu', 'Admin@1234'));
        }

        const demoPatronBtn = document.getElementById('btn-demo-patron-login');
        if (demoPatronBtn) {
            demoPatronBtn.addEventListener('click', () => this.quickLogin('patron@sonam.edu', 'Patron@1234'));
        }

        // Sign Out in Profile Menu
        const signOutBtn = document.getElementById('btn-auth-signout');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.logout());
        }
    }

    checkPasswordCriteria(password) {
        const rules = {
            len: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            num: /[0-9]/.test(password),
            sym: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
        };

        let passedCount = 0;
        for (const [key, passed] of Object.entries(rules)) {
            const el = document.getElementById(`pwd-rule-${key}`);
            if (el) {
                if (passed) {
                    el.classList.add('satisfied');
                    passedCount++;
                } else {
                    el.classList.remove('satisfied');
                }
            }
        }

        // Strength Bar
        const bar = document.getElementById('password-strength-fill');
        const text = document.getElementById('password-strength-text');
        if (bar && text) {
            if (passedCount <= 2) {
                bar.style.width = '25%';
                bar.style.backgroundColor = 'var(--status-danger-text)';
                text.textContent = 'Weak Password';
                text.style.color = 'var(--status-danger-text)';
            } else if (passedCount <= 4) {
                bar.style.width = '65%';
                bar.style.backgroundColor = 'var(--status-warning-text)';
                text.textContent = 'Moderate Password';
                text.style.color = 'var(--status-warning-text)';
            } else {
                bar.style.width = '100%';
                bar.style.backgroundColor = 'var(--status-success-text)';
                text.textContent = 'Strong Institutional Password';
                text.style.color = 'var(--status-success-text)';
            }
        }

        return passedCount === 5;
    }

    openModal(view = 'login') {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        this.switchAuthView(view);
        modal.classList.add('open');
    }

    switchAuthView(view) {
        const loginSection = document.getElementById('auth-section-login');
        const signupSection = document.getElementById('auth-section-signup');
        const otpSection = document.getElementById('auth-section-otp');
        const tabLogin = document.getElementById('auth-tab-login');
        const tabSignup = document.getElementById('auth-tab-signup');

        if (loginSection) loginSection.style.display = view === 'login' ? 'block' : 'none';
        if (signupSection) signupSection.style.display = view === 'signup' ? 'block' : 'none';
        if (otpSection) otpSection.style.display = view === 'otp' ? 'block' : 'none';

        if (tabLogin) tabLogin.classList.toggle('active', view === 'login');
        if (tabSignup) tabSignup.classList.toggle('active', view === 'signup');
    }

    async handleSignup() {
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const pass = document.getElementById('signup-password').value;
        const confirmPass = document.getElementById('signup-confirm-password').value;
        const role = document.getElementById('signup-role').value;
        const phone = document.getElementById('signup-phone').value.trim();

        if (!name || !email || !pass) {
            this.app.toast('Please fill all required fields', 'error');
            return;
        }

        if (pass !== confirmPass) {
            this.app.toast('Passwords do not match', 'error');
            return;
        }

        if (!this.checkPasswordCriteria(pass)) {
            this.app.toast('Please satisfy all password criteria (8+ chars, uppercase, lowercase, number, symbol)', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-signup');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Dispatching Verification Code...';

        try {
            const res = await api.signup(name, email, pass, role, phone);
            sound.success();
            this.pendingEmail = email;

            if (res.otp_required === false && res.user) {
                this.setSession(res.user, res.token);
                this.app.toast(res.message || 'Account created successfully!', 'success');
                document.getElementById('auth-modal').classList.remove('open');
                this.app.patrons.loadPatrons();
                this.app.telemetry.refresh();
                return;
            }

            // Transition to OTP screen
            document.getElementById('otp-target-email').textContent = email;
            
            // Show Dev OTP Preview banner if available
            const previewBox = document.getElementById('otp-dev-preview-box');
            if (previewBox) {
                if (res.dev_otp_preview) {
                    previewBox.style.display = 'block';
                    previewBox.innerHTML = `<strong>Verification Code (Dev Preview):</strong> <span style="letter-spacing: 0.15em; font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold-light); font-size: 15px;">${res.dev_otp_preview}</span><div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">(Configure Gmail SMTP in .env for direct email delivery)</div>`;
                } else {
                    previewBox.style.display = 'none';
                }
            }

            this.switchAuthView('otp');
            this.startResendTimer();
            this.app.toast(res.message || `Verification code dispatched to ${email}`, 'success');
            
            // Clear inputs and auto-fill if dev preview provided
            document.getElementById('form-auth-signup').reset();
            const otpInput = document.getElementById('auth-otp-input');
            if (otpInput) {
                otpInput.value = res.dev_otp_preview || '';
                otpInput.focus();
            }
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verify Email & Create Account';
        }
    }

    async handleVerifyOtp() {
        const otpInput = document.getElementById('auth-otp-input');
        const otp = otpInput ? otpInput.value.trim() : '';

        if (!otp || otp.length < 6) {
            this.app.toast('Please enter the 6-digit verification code', 'error');
            return;
        }

        try {
            sound.click();
            const res = await api.verifyOtp(this.pendingEmail, otp);
            sound.success();

            this.setSession(res.user, res.token);
            this.app.toast('Account verified and logged in successfully!', 'success');
            document.getElementById('auth-modal').classList.remove('open');
            this.app.patrons.loadPatrons();
            this.app.telemetry.refresh();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    async handleResendOtp() {
        if (!this.pendingEmail) return;
        try {
            sound.click();
            const res = await api.resendOtp(this.pendingEmail);
            sound.success();
            this.startResendTimer();
            
            const previewBox = document.getElementById('otp-dev-preview-box');
            if (previewBox && res.dev_otp_preview) {
                previewBox.style.display = 'block';
                previewBox.innerHTML = `<strong>New Code:</strong> <span style="letter-spacing: 0.15em; font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold-light);">${res.dev_otp_preview}</span>`;
            }

            this.app.toast('Fresh verification code sent', 'success');
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    startResendTimer() {
        clearInterval(this.resendTimer);
        this.resendSeconds = 60;
        const btn = document.getElementById('btn-resend-otp');
        const timerText = document.getElementById('resend-timer-text');
        if (btn) btn.disabled = true;

        this.resendTimer = setInterval(() => {
            this.resendSeconds--;
            if (timerText) timerText.textContent = `(${this.resendSeconds}s)`;
            if (this.resendSeconds <= 0) {
                clearInterval(this.resendTimer);
                if (btn) btn.disabled = false;
                if (timerText) timerText.textContent = '';
            }
        }, 1000);
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value;

        if (!email || !pass) {
            this.app.toast('Please enter email and password', 'error');
            return;
        }

        try {
            sound.click();
            const res = await api.login(email, pass);
            sound.success();
            this.setSession(res.user, res.token);
            this.app.toast(`Signed in as ${res.user.full_name} (${res.user.role.toUpperCase()})`, 'success');
            document.getElementById('auth-modal').classList.remove('open');
            document.getElementById('form-auth-login').reset();
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    async quickLogin(email, pass) {
        try {
            sound.click();
            const res = await api.login(email, pass);
            sound.success();
            this.setSession(res.user, res.token);
            this.app.toast(`Logged in as ${res.user.full_name} (${res.user.role.toUpperCase()})`, 'success');
            document.getElementById('auth-modal').classList.remove('open');
        } catch (e) {
            sound.error();
            this.app.toast(e.message, 'error');
        }
    }

    setSession(user, token) {
        this.currentUser = user;
        localStorage.setItem('athena_user', JSON.stringify(user));
        if (token) localStorage.setItem('athena_token', token);
        this.updateHeaderUI();
    }

    logout() {
        sound.click();
        this.currentUser = null;
        localStorage.removeItem('athena_user');
        localStorage.removeItem('athena_token');
        const dropdown = document.getElementById('user-profile-dropdown');
        if (dropdown) dropdown.classList.remove('open');
        this.updateHeaderUI();
        this.app.toast('Signed out successfully. Switched to guest mode.', 'info');
        document.getElementById('auth-modal').classList.remove('open');
    }

    updateHeaderUI() {
        const userBtn = document.getElementById('topbar-user-btn');
        if (!userBtn) return;

        const dropdown = document.getElementById('user-profile-dropdown');

        if (this.currentUser) {
            const roleBadgeClass = this.currentUser.role === 'admin' ? 'badge-available' : 'badge-tier';
            const initials = this.currentUser.full_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

            userBtn.innerHTML = `
                <div class="user-avatar-circle">${initials}</div>
                <div class="user-name-role">
                    <span class="user-display-name">${this.escape(this.currentUser.full_name)}</span>
                    <span class="badge ${roleBadgeClass}" style="font-size: 9px; padding: 1px 5px;">${this.currentUser.role.toUpperCase()}</span>
                </div>
            `;

            // Update dropdown header elements
            const dAvatar = document.getElementById('dropdown-user-avatar');
            const dName = document.getElementById('dropdown-user-name');
            const dEmail = document.getElementById('dropdown-user-email');
            const dCard = document.getElementById('dropdown-user-card');

            if (dAvatar) dAvatar.textContent = initials;
            if (dName) dName.textContent = this.currentUser.full_name;
            if (dEmail) dEmail.textContent = this.currentUser.email;
            if (dCard) dCard.textContent = this.currentUser.membership_number || 'ATH-8021';
        } else {
            userBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Sign In / Register</span>
            `;
            if (dropdown) dropdown.classList.remove('open');
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
