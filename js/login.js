/**
 * login.js
 * Curved Double-Slider Animated Login & Sign Up (SaveEnergi SDG 12):
 *  - Animasi panel overlay melengkung meluncur kanan ↔ kiri saat pindah Masuk ↔ Daftar
 *  - Onboarding pengguna baru: Nama, Email, Sandi + Konfirmasi, & Profil Daya Listrik PLN awal
 *  - Hash SHA-256 kata sandi via Web Crypto API (fallback aman non-HTTPS)
 *  - Sinkronisasi otomatis ke backend /api/households & live stats /api/impact
 */

(function () {
    const ACCOUNTS_KEY = 'sdg12_accounts';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const stage = document.getElementById('login-stage');
    const authContainer = document.getElementById('auth-container');
    const paneSignIn = document.getElementById('pane-signin');
    const paneSignUp = document.getElementById('pane-signup');

    // Desktop curved overlay toggle buttons
    const btnSlideToRegister = document.getElementById('btn-slide-to-register');
    const btnSlideToLogin = document.getElementById('btn-slide-to-login');

    // Mobile tab controls
    const mobileTabLogin = document.getElementById('mobile-tab-login');
    const mobileTabRegister = document.getElementById('mobile-tab-register');
    const mobileTabGlider = document.getElementById('mobile-tab-glider');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const linkToRegister = document.getElementById('link-to-register');
    const linkToLogin = document.getElementById('link-to-login');

    const regName = document.getElementById('reg-name');
    const regEmail = document.getElementById('reg-email');
    const regPassword = document.getElementById('reg-password');
    const regPasswordConfirm = document.getElementById('reg-password-confirm');
    const registerError = document.getElementById('register-error');
    const btnRegisterSubmit = document.getElementById('btn-register-submit');
    const pwStrengthBar = document.getElementById('pw-strength-bar');
    const pwStrengthLabel = document.getElementById('pw-strength-label');
    const plnTierBtns = document.querySelectorAll('.pln-tier-btn');

    const btnGuest = document.getElementById('btn-guest-login');

    const successOverlay = document.getElementById('login-success-overlay');
    const successCheckPath = document.getElementById('success-check-path');
    const successGreeting = document.getElementById('success-greeting');
    const successSubtitle = document.getElementById('success-subtitle');

    let mode = 'login';
    let selectedInitialKwh = 300;
    let submitting = false;

    function generateUuid() {
        if (crypto.randomUUID) return crypto.randomUUID();
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    async function hashPassword(plain) {
        const salted = `sdg12:${plain}`;
        if (window.crypto && window.crypto.subtle) {
            const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
            return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
        }
        let hash = 2166136261;
        for (let i = 0; i < salted.length; i += 1) {
            hash ^= salted.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return `fnv:${(hash >>> 0).toString(16)}`;
    }

    function readAccounts() {
        try {
            const raw = localStorage.getItem(ACCOUNTS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function writeAccounts(map) {
        try {
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));
        } catch (_) {
            // Storage unavailable
        }
    }

    // ── Double-Slider Mode Switch: Login ↔ Sign Up ──────────────
    function setAuthMode(nextMode) {
        if (nextMode === mode) return;
        mode = nextMode;
        const isSignUp = nextMode === 'register';

        authContainer.classList.toggle('is-signup', isSignUp);
        paneSignIn.inert = isSignUp;
        paneSignUp.inert = !isSignUp;

        // Sinkronkan mobile tab switcher
        if (mobileTabLogin && mobileTabRegister && mobileTabGlider) {
            mobileTabLogin.setAttribute('aria-selected', String(!isSignUp));
            mobileTabRegister.setAttribute('aria-selected', String(isSignUp));
            mobileTabLogin.classList.toggle('text-slateDark', !isSignUp);
            mobileTabLogin.classList.toggle('text-slate-500', isSignUp);
            mobileTabRegister.classList.toggle('text-slateDark', isSignUp);
            mobileTabRegister.classList.toggle('text-slate-500', !isSignUp);
            mobileTabGlider.style.transform = isSignUp ? 'translateX(100%)' : 'translateX(0%)';
        }

        loginError.classList.add('hidden');
        registerError.classList.add('hidden');

        // Fokuskan input pertama setelah panel mulai meluncur
        setTimeout(() => {
            (isSignUp ? regName : loginEmail).focus();
        }, 280);
    }

    if (btnSlideToRegister) btnSlideToRegister.addEventListener('click', () => setAuthMode('register'));
    if (btnSlideToLogin) btnSlideToLogin.addEventListener('click', () => setAuthMode('login'));
    if (linkToRegister) linkToRegister.addEventListener('click', () => setAuthMode('register'));
    if (linkToLogin) linkToLogin.addEventListener('click', () => setAuthMode('login'));
    if (mobileTabLogin) mobileTabLogin.addEventListener('click', () => setAuthMode('login'));
    if (mobileTabRegister) mobileTabRegister.addEventListener('click', () => setAuthMode('register'));

    // ── Pilih Daya Listrik PLN Awal (Onboarding) ────────────────
    plnTierBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            selectedInitialKwh = parseInt(btn.dataset.kwh, 10) || 300;
            plnTierBtns.forEach((b) => {
                b.className = 'pln-tier-btn p-2 rounded-xl border border-stone-200 bg-white hover:border-forest/50 text-center transition-all cursor-pointer';
            });
            btn.className = 'pln-tier-btn p-2 rounded-xl border-2 border-forest bg-forest-50/80 text-center transition-all cursor-pointer';
        });
    });

    // ── Toggle Show / Hide Password ─────────────────────────────
    document.querySelectorAll('.pw-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.togglePw);
            if (!target) return;
            const showing = target.type === 'text';
            target.type = showing ? 'password' : 'text';
            btn.innerHTML = `<i data-lucide="${showing ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>`;
            lucide.createIcons();
        });
    });

    // ── Password Strength Meter (Register) ──────────────────────
    regPassword.addEventListener('input', () => {
        const val = regPassword.value;
        let score = 0;
        if (val.length >= 6) score += 1;
        if (val.length >= 10) score += 1;
        if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
        if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) score += 1;

        if (!val) {
            pwStrengthBar.style.width = '0%';
            pwStrengthLabel.textContent = 'Min. 6';
            pwStrengthLabel.className = 'text-[10px] font-semibold text-slate-400';
        } else if (score <= 1) {
            pwStrengthBar.style.width = '30%';
            pwStrengthBar.className = 'h-full bg-rose-500 rounded-full transition-all duration-300';
            pwStrengthLabel.textContent = 'Lemah';
            pwStrengthLabel.className = 'text-[10px] font-semibold text-rose-600';
        } else if (score <= 2) {
            pwStrengthBar.style.width = '65%';
            pwStrengthBar.className = 'h-full bg-sdg12 rounded-full transition-all duration-300';
            pwStrengthLabel.textContent = 'Sedang';
            pwStrengthLabel.className = 'text-[10px] font-semibold text-sdg12-dark';
        } else {
            pwStrengthBar.style.width = '100%';
            pwStrengthBar.className = 'h-full bg-forest rounded-full transition-all duration-300';
            pwStrengthLabel.textContent = 'Kuat';
            pwStrengthLabel.className = 'text-[10px] font-semibold text-forest-dark';
        }
    });

    function setButtonLoading(button, loading, idleHtml, loadingLabel) {
        button.disabled = loading;
        if (loading) {
            button.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>${loadingLabel}</span>`;
        } else {
            button.innerHTML = idleHtml;
        }
        lucide.createIcons();
    }

    function showError(el, msg) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function persistSession({ id, name, email, initialKwh }) {
        try {
            localStorage.setItem('sdg12_household_id', id);
            localStorage.setItem('sdg12_display_name', name);
            localStorage.setItem('sdg12_user_email', email || '');
            localStorage.setItem('sdg12_logged_in', '1');
            if (initialKwh) {
                localStorage.setItem('sdg12_initial_kwh', String(initialKwh));
            }
        } catch (_) {
            // Storage unavailable
        }
    }

    async function syncHousehold(id, displayName) {
        try {
            const res = await window.api('/api/households', {
                method: 'POST',
                body: JSON.stringify({ id, display_name: displayName }),
            });
            return { id: res.id, online: true };
        } catch (_) {
            return { id, online: false };
        }
    }

    function completeAndRedirect(displayName, subtitle) {
        successGreeting.textContent = `Selamat datang, ${displayName}!`;
        successSubtitle.textContent = subtitle || 'Mengarahkan ke dashboard SaveEnergi…';
        successOverlay.classList.remove('hidden');
        requestAnimationFrame(() => {
            successCheckPath.classList.add('is-drawn');
        });

        setTimeout(() => {
            stage.classList.add('page-exiting');
            setTimeout(() => {
                window.location.href = './index.html';
            }, 340);
        }, 720);
    }

    // ── Form 1: Login Email + Kata Sandi ────────────────────────
    const loginIdleHtml = btnLoginSubmit.innerHTML;
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting) return;
        loginError.classList.add('hidden');

        const email = loginEmail.value.trim().toLowerCase();
        const password = loginPassword.value;

        if (!EMAIL_RE.test(email)) {
            showError(loginError, 'Masukkan alamat email yang valid (contoh: nama@email.com).');
            loginEmail.focus();
            return;
        }
        if (password.length < 6) {
            showError(loginError, 'Kata sandi minimal 6 karakter.');
            loginPassword.focus();
            return;
        }

        submitting = true;
        setButtonLoading(btnLoginSubmit, true, loginIdleHtml, 'Memverifikasi akun…');
        try {
            const accounts = readAccounts();
            const account = accounts[email];
            if (!account) {
                showError(loginError, 'Email belum terdaftar. Klik "Daftar Sekarang" di panel samping untuk mendaftar.');
                setButtonLoading(btnLoginSubmit, false, loginIdleHtml);
                submitting = false;
                return;
            }

            const inputHash = await hashPassword(password);
            if (account.passwordHash !== inputHash) {
                showError(loginError, 'Kata sandi tidak sesuai. Silakan periksa kembali.');
                setButtonLoading(btnLoginSubmit, false, loginIdleHtml);
                submitting = false;
                loginPassword.focus();
                return;
            }

            const synced = await syncHousehold(account.householdId, account.name);
            persistSession({
                id: synced.id,
                name: account.name,
                email: account.email,
                initialKwh: account.initialKwh || 300,
            });
            completeAndRedirect(
                account.name,
                synced.online
                    ? 'Akun terverifikasi & tersinkron ke server. Membuka dashboard…'
                    : 'Akun terverifikasi. Membuka dashboard…'
            );
        } catch (error) {
            showError(loginError, error.message || 'Gagal memproses login.');
            setButtonLoading(btnLoginSubmit, false, loginIdleHtml);
            submitting = false;
        }
    });

    // ── Form 2: Daftar Akun Baru (Onboarding Pertama Kali) ─────
    const regIdleHtml = btnRegisterSubmit.innerHTML;
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting) return;
        registerError.classList.add('hidden');

        const name = regName.value.trim();
        const email = regEmail.value.trim().toLowerCase();
        const password = regPassword.value;
        const confirm = regPasswordConfirm.value;

        if (name.length < 2 || name.length > 60) {
            showError(registerError, 'Nama lengkap harus antara 2 sampai 60 karakter.');
            regName.focus();
            return;
        }
        if (!EMAIL_RE.test(email)) {
            showError(registerError, 'Format alamat email tidak valid.');
            regEmail.focus();
            return;
        }
        if (password.length < 6) {
            showError(registerError, 'Kata sandi minimal 6 karakter.');
            regPassword.focus();
            return;
        }
        if (password !== confirm) {
            showError(registerError, 'Konfirmasi kata sandi tidak cocok.');
            regPasswordConfirm.focus();
            return;
        }

        submitting = true;
        setButtonLoading(btnRegisterSubmit, true, regIdleHtml, 'Menyiapkan akun baru…');
        try {
            const accounts = readAccounts();
            if (accounts[email]) {
                showError(registerError, 'Email ini sudah terdaftar. Silakan klik "Masuk ke Akun".');
                setButtonLoading(btnRegisterSubmit, false, regIdleHtml);
                submitting = false;
                return;
            }

            const householdId = generateUuid();
            const passwordHash = await hashPassword(password);
            const synced = await syncHousehold(householdId, name);

            accounts[email] = {
                name,
                email,
                passwordHash,
                householdId: synced.id,
                initialKwh: selectedInitialKwh,
            };
            writeAccounts(accounts);
            persistSession({
                id: synced.id,
                name,
                email,
                initialKwh: selectedInitialKwh,
            });

            completeAndRedirect(
                name,
                synced.online
                    ? `Profil awal (${selectedInitialKwh} kWh/bln) tersinkron. Membuka dashboard…`
                    : `Profil awal (${selectedInitialKwh} kWh/bln) siap. Membuka dashboard…`
            );
        } catch (error) {
            showError(registerError, error.message || 'Gagal mendaftarkan akun.');
            setButtonLoading(btnRegisterSubmit, false, regIdleHtml);
            submitting = false;
        }
    });

    // ── Masuk Cepat sebagai Tamu ────────────────────────────────
    btnGuest.addEventListener('click', async () => {
        if (submitting) return;
        submitting = true;
        btnGuest.disabled = true;

        const id = generateUuid();
        const synced = await syncHousehold(id, 'Tamu Hemat Energi');
        persistSession({ id: synced.id, name: 'Tamu Hemat Energi', email: 'tamu@saveenergi.id', initialKwh: 300 });
        completeAndRedirect('Tamu', 'Masuk cepat berhasil. Membuka dashboard…');
    });

    // ── Live Community Preview dari /api/impact ─────────────────
    (async function loadPreviewImpact() {
        try {
            const impact = await window.api('/api/impact');
            const fmt = (n) => Math.round(n).toLocaleString('id-ID');
            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = fmt(val);
            };
            set('login-stat-kwh', impact.kwh_saved);
            set('login-stat-households', impact.households);
            set('overlay-left-kwh', impact.kwh_saved);
            set('overlay-left-co2', impact.co2_prevented);
        } catch (_) {
            // Keep seeded baseline numbers when offline
        }
    })();

    // Prefill email terakhir jika pernah masuk sebelumnya
    try {
        const lastEmail = localStorage.getItem('sdg12_user_email');
        if (lastEmail && lastEmail !== 'tamu@saveenergi.id') {
            loginEmail.value = lastEmail;
        }
    } catch (_) {
        // ignore
    }

    document.addEventListener('DOMContentLoaded', () => {
        lucide.createIcons();
    });
    lucide.createIcons();
})();
