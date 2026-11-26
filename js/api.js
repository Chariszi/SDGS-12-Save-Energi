/**
 * api.js
 * Same-origin API client + cookie session (HttpOnly; the page never sees the token).
 * Loaded first: every other module depends on window.api/loadSession.
 */

(function () {
    const STORAGE_KEY = 'sdg12_household_id';
    let sessionPromise = null;
    let redirecting = false;

    // Only one navigation wins when several requests answer 401 at once.
    function goToLogin() {
        if (redirecting) return;
        redirecting = true;
        window.location.replace('./login.html');
    }

    window.api = async function (path, options = {}) {
        const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
            ? AbortSignal.timeout(10000)
            : undefined;
        const response = await fetch(path, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            signal: options.signal || timeout,
        });

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (_) {
            // Non-JSON error body (proxy, body limit); fall through to status message.
        }

        if (!response.ok) {
            const error = new Error((data && data.error) || `Permintaan gagal (${response.status})`);
            error.status = response.status;
            // A dead/absent session anywhere except the login page means the
            // cached localStorage flag is stale: send the user to sign in.
            const onLoginPage = /\/login(\.html)?$/.test(window.location.pathname);
            if (response.status === 401 && !onLoginPage) {
                goToLogin();
            }
            throw error;
        }
        return data;
    };

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function readStoredId() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored && UUID_RE.test(stored) ? stored : null;
        } catch (_) {
            return null;
        }
    }

    function storeId(id) {
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch (_) {
            // Storage disabled: identity lives for this page load only.
        }
    }

    function readStoredName() {
        try {
            const name = localStorage.getItem('sdg12_display_name');
            return name && name.trim() ? name.trim().slice(0, 60) : null;
        } catch (_) {
            return null;
        }
    }

    function clearSession() {
        try {
            localStorage.removeItem('sdg12_logged_in');
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('sdg12_display_name');
            localStorage.removeItem('sdg12_user_email');
        } catch (_) {
            // Storage disabled: nothing cached to clear.
        }
    }

    window.loadSession = function () {
        if (!sessionPromise) {
            sessionPromise = fetchSession().catch((error) => {
                sessionPromise = null;
                throw error;
            });
        }
        return sessionPromise;
    };

    // The server is the only source of truth: the HttpOnly cookie is what
    // authenticates, so every page load asks /auth/me who we are.
    async function fetchSession() {
        try {
            const user = await window.api('/api/auth/me');
            storeId(user.household_id);
            try {
                localStorage.setItem('sdg12_logged_in', '1');
                localStorage.setItem('sdg12_display_name', user.display_name || 'Pengguna SaveEnergi');
                localStorage.setItem('sdg12_user_email', user.email || '');
            } catch (_) {
                // ignore storage errors
            }
            window.sdg12User = user;
            return user;
        } catch (error) {
            clearSession();
            throw error;
        }
    }

    window.getHouseholdProfile = function () {
        let email = '';
        try {
            email = localStorage.getItem('sdg12_user_email') || '';
        } catch (_) {
            // ignore
        }
        return {
            id: readStoredId(),
            displayName: readStoredName() || 'Pengguna SaveEnergi',
            email,
        };
    };

    window.logoutHousehold = async function () {
        try {
            // Revoke the server-side session, then drop the cookie via Set-Cookie.
            await window.api('/api/auth/logout', { method: 'POST' });
        } catch (_) {
            // Already signed out or offline: clearing local state still wins.
        }
        clearSession();
        goToLogin();
    };

    const HTML_ESCAPES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };

    window.escapeHtml = function (value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
    };
})();
