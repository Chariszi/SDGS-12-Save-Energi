/**
 * api.js
 * Same-origin API client + anonymous household identity.
 * Loaded first: every other module depends on window.api/getHouseholdId.
 */

(function () {
    const STORAGE_KEY = 'sdg12_household_id';
    let householdPromise = null;

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
            throw new Error((data && data.error) || `Permintaan gagal (${response.status})`);
        }
        return data;
    };

    function newUuid() {
        if (crypto.randomUUID) return crypto.randomUUID();
        // crypto.randomUUID needs a secure context; getRandomValues does not.
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

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

    async function registerOnce() {
        let id = readStoredId();
        if (!id) {
            id = newUuid();
            storeId(id);
        }
        const displayName = readStoredName();
        const payload = displayName ? { id, display_name: displayName } : { id };
        const household = await window.api('/api/households', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        storeId(household.id);
        return household.id;
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
            displayName: readStoredName() || 'Tamu Hemat Energi',
            email,
        };
    };

    window.logoutHousehold = function () {
        try {
            localStorage.removeItem('sdg12_logged_in');
        } catch (_) {
            // ignore
        }
        window.location.href = './login.html';
    };

    async function register() {
        // Two fresh tabs would otherwise mint two households and orphan one.
        if (navigator.locks && navigator.locks.request) {
            return navigator.locks.request('sdg12_household_register', registerOnce);
        }
        return registerOnce();
    }

    window.getHouseholdId = function () {
        if (!householdPromise) {
            householdPromise = register().catch((error) => {
                householdPromise = null;
                throw error;
            });
        }
        return householdPromise;
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
