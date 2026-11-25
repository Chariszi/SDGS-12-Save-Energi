/**
 * ticker.js
 * Live impact ticker sourced from /api/impact and refreshed every 15 s.
 * Exposes window.ticker values and window.refreshImpact() for other modules.
 */

window.ticker = {
    kwh: 3890,
    co2: 6412,
    households: 1248,
};

function renderTicker() {
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.round(value).toLocaleString('id-ID');
    };
    set('ticker-kwh', window.ticker.kwh);
    set('ticker-co2', window.ticker.co2);
    set('ticker-households', window.ticker.households);
}

let impactRequest = 0;

window.refreshImpact = async function () {
    const seq = ++impactRequest;
    try {
        const impact = await window.api('/api/impact');
        if (seq !== impactRequest) return null;
        window.ticker = {
            kwh: impact.kwh_saved,
            co2: impact.co2_prevented,
            households: impact.households,
        };
        renderTicker();
        window.dispatchEvent(new CustomEvent('impact:update', { detail: impact }));
        return impact;
    } catch (error) {
        console.warn('Impact refresh failed:', error.message);
        return null;
    }
};

renderTicker();
window.refreshImpact();
setInterval(() => {
    if (!document.hidden) window.refreshImpact();
}, 15000);
