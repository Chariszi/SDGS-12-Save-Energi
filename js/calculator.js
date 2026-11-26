(() => {
    "use strict";

    // ── Configuration ─────────────────────────────────────────

    const TARIFF_PER_KWH = 1445;
    const MIN_KWH = 50;
    const MAX_KWH = 2000;
    const DEBOUNCE_MS = 450;

    const $ = (id) => document.getElementById(id);

    // ── DOM References ────────────────────────────────────────

    const elements = {
        btnModeKwh: $("btn-mode-kwh"),
        btnModeRp: $("btn-mode-rp"),

        inputKwhWrapper: $("input-kwh-wrapper"),
        inputRpWrapper: $("input-rp-wrapper"),

        sliderKwh: $("slider-kwh"),
        sliderRp: $("slider-rp"),
        sliderAc: $("slider-ac"),

        valKwh: $("val-kwh"),
        valRp: $("val-rp"),
        valAc: $("val-ac"),

        transportButtons: document.querySelectorAll(".transport-btn"),

        chkLed: $("chk-led"),
        chkUnplug: $("chk-unplug"),

        gradeNow: $("grade-now"),
        gradeAfter: $("grade-after"),
        gradeTitle: $("grade-title"),
        gradeDesc: $("grade-desc"),

        cmpKwhNow: $("cmp-kwh-now"),
        cmpKwhAfter: $("cmp-kwh-after"),
        cmpBarAfter: $("cmp-bar-after"),

        cmpCo2Now: $("cmp-co2-now"),
        cmpCo2After: $("cmp-co2-after"),

        cmpCostNow: $("cmp-cost-now"),
        cmpCostAfter: $("cmp-cost-after"),

        svKwh: $("sv-kwh"),
        svRp: $("sv-rp"),
        svRpYear: $("sv-rp-year"),
        svCo2: $("sv-co2"),
        svTrees: $("sv-trees"),
        svCapNote: $("sv-cap-note"),

        potLabel: $("pot-label"),
        potBar: $("pot-bar"),

        recommendationList: $("recommendation-list"),
    };

    if (!elements.sliderKwh || !elements.sliderAc) {
        console.error(
            "Calculator initialization failed: required sliders were not found."
        );
        return;
    }

    // ── Helpers ────────────────────────────────────────────────

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function readNumber(element, fallback) {
        const value = Number(element?.value);
        return Number.isFinite(value) ? value : fallback;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("id-ID", {
            maximumFractionDigits: 0,
        }).format(value);
    }

    function formatCurrency(value) {
        return `Rp ${formatNumber(value)}`;
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value);
        }
    }

    function setBarWidth(element, percentage) {
        if (!element) return;

        const safePercentage = clamp(percentage, 0, 100);
        element.style.width = `${safePercentage}%`;
    }

    function getInitialTransport() {
        for (const button of elements.transportButtons) {
            const selected =
                button.getAttribute("aria-pressed") === "true" ||
                button.classList.contains("active") ||
                button.classList.contains("selected");

            if (selected && button.dataset.transport) {
                return button.dataset.transport;
            }
        }

        return "public";
    }

    // ── State ─────────────────────────────────────────────────

    const state = {
        kwhMonthly: clamp(
            Math.round(readNumber(elements.sliderKwh, 300)),
            MIN_KWH,
            MAX_KWH
        ),

        acHours: clamp(
            Math.round(readNumber(elements.sliderAc, 6)),
            0,
            24
        ),

        transport: getInitialTransport(),

        led: Boolean(elements.chkLed?.checked),
        unplug: Boolean(elements.chkUnplug?.checked),
    };

    // ── Input Display ─────────────────────────────────────────

    function syncSliders() {
        elements.sliderKwh.value = String(state.kwhMonthly);

        if (elements.sliderRp) {
            elements.sliderRp.value = String(
                state.kwhMonthly * TARIFF_PER_KWH
            );
        }
    }

    function updateInputLabels() {
        setText(
            elements.valKwh,
            `${formatNumber(state.kwhMonthly)} kWh/bulan`
        );

        setText(
            elements.valRp,
            `${formatCurrency(state.kwhMonthly * TARIFF_PER_KWH)} / bulan`
        );

        setText(
            elements.valAc,
            `${state.acHours} jam/hari`
        );
    }

    // ── Input Mode ─────────────────────────────────────────────

    function setInputMode(mode) {
        const useKwh = mode === "kwh";

        elements.inputKwhWrapper?.classList.toggle("hidden", !useKwh);
        elements.inputRpWrapper?.classList.toggle("hidden", useKwh);

        elements.btnModeKwh?.setAttribute(
            "aria-pressed",
            String(useKwh)
        );

        elements.btnModeRp?.setAttribute(
            "aria-pressed",
            String(!useKwh)
        );

        elements.btnModeKwh?.classList.toggle("active", useKwh);
        elements.btnModeRp?.classList.toggle("active", !useKwh);
    }

    elements.btnModeKwh?.addEventListener("click", () => {
        setInputMode("kwh");
    });

    elements.btnModeRp?.addEventListener("click", () => {
        setInputMode("rp");
    });

    // ── Transport Selection ───────────────────────────────────

    function updateTransportButtons() {
        for (const button of elements.transportButtons) {
            const selected =
                button.dataset.transport === state.transport;

            button.classList.toggle("active", selected);
            button.classList.toggle("selected", selected);

            button.setAttribute(
                "aria-pressed",
                String(selected)
            );
        }
    }

    for (const button of elements.transportButtons) {
        button.addEventListener("click", () => {
            const transport = button.dataset.transport;

            if (!["public", "motor", "car"].includes(transport)) {
                return;
            }

            state.transport = transport;

            updateTransportButtons();
            scheduleAssessment();
        });
    }

    // ── Slider Handlers ───────────────────────────────────────

    elements.sliderKwh.addEventListener("input", () => {
        state.kwhMonthly = clamp(
            Math.round(readNumber(elements.sliderKwh, MIN_KWH)),
            MIN_KWH,
            MAX_KWH
        );

        syncSliders();
        scheduleAssessment();
    });

    elements.sliderRp?.addEventListener("input", () => {
        const rupiah = Math.max(
            0,
            readNumber(elements.sliderRp, 0)
        );

        // Convert the electricity bill to an approximate kWh value.
        const estimatedKwh = Math.round(
            rupiah / TARIFF_PER_KWH / 10
        ) * 10;

        state.kwhMonthly = clamp(
            estimatedKwh,
            MIN_KWH,
            MAX_KWH
        );

        syncSliders();
        scheduleAssessment();
    });

    elements.sliderAc.addEventListener("input", () => {
        state.acHours = clamp(
            Math.round(readNumber(elements.sliderAc, 0)),
            0,
            24
        );

        scheduleAssessment();
    });

    // ── Habit Checkboxes ──────────────────────────────────────

    elements.chkLed?.addEventListener("change", () => {
        state.led = elements.chkLed.checked;
        scheduleAssessment();
    });

    elements.chkUnplug?.addEventListener("change", () => {
        state.unplug = elements.chkUnplug.checked;
        scheduleAssessment();
    });

    // ── Rendering ─────────────────────────────────────────────

    function renderRecommendations(recommendations) {
        const list = elements.recommendationList;

        if (!list) return;

        list.replaceChildren();

        for (const recommendation of recommendations) {
            const item = document.createElement("li");
            item.textContent = recommendation;
            list.appendChild(item);
        }
    }

    function renderComparison(result) {
        if (!result?.before || !result?.after) {
            throw new Error("Invalid assessment response from server.");
        }

        const before = result.before;
        const after = result.after;

        // Grade comparison
        setText(elements.gradeNow, before.grade);
        setText(elements.gradeAfter, after.grade);

        // Keep the description and recommendations about the
        // user's actual/current situation.
        setText(elements.gradeTitle, before.title);
        setText(elements.gradeDesc, before.description);

        // Electricity comparison
        setText(
            elements.cmpKwhNow,
            formatNumber(before.effective_kwh)
        );

        setText(
            elements.cmpKwhAfter,
            formatNumber(after.effective_kwh)
        );

        const kwhRatio = before.effective_kwh > 0
            ? (after.effective_kwh / before.effective_kwh) * 100
            : 0;

        setBarWidth(elements.cmpBarAfter, kwhRatio);

        // CO2 comparison
        setText(
            elements.cmpCo2Now,
            formatNumber(before.total_co2_kg)
        );

        setText(
            elements.cmpCo2After,
            formatNumber(after.total_co2_kg)
        );

        // Electricity cost comparison
        setText(
            elements.cmpCostNow,
            formatCurrency(before.cost_rp)
        );

        setText(
            elements.cmpCostAfter,
            formatCurrency(after.cost_rp)
        );

        // Savings
        setText(
            elements.svKwh,
            formatNumber(result.saved_kwh)
        );

        setText(
            elements.svRp,
            formatCurrency(result.saved_cost_rp)
        );

        setText(
            elements.svRpYear,
            formatCurrency(result.saved_cost_yearly_rp)
        );

        setText(
            elements.svCo2,
            formatNumber(result.saved_co2_kg)
        );

        setText(
            elements.svTrees,
            formatNumber(result.saved_trees)
        );

        // Potential savings percentage
        const savedPercentage = before.effective_kwh > 0
            ? (result.saved_kwh / before.effective_kwh) * 100
            : 0;

        setText(
            elements.potLabel,
            `${savedPercentage.toFixed(1)}%`
        );

        setBarWidth(elements.potBar, savedPercentage);

        setText(
            elements.svCapNote,
            "Simulasi menerapkan LED, mencabut perangkat saat tidak digunakan, dan membatasi AC maksimal 8 jam/hari. Transportasi tetap."
        );

        // Recommendations based on the current situation
        renderRecommendations(before.recommendations);
    }

    // ── Backend Requests ──────────────────────────────────────

    let debounceTimer = null;
    let requestVersion = 0;

    // Requests are serialized so an older request cannot overwrite
    // a newer assessment in the database.
    let requestQueue = Promise.resolve();

    function scheduleAssessment() {
        updateInputLabels();

        const version = ++requestVersion;

        const snapshot = {
            kwhMonthly: state.kwhMonthly,
            acHours: state.acHours,
            transport: state.transport,
            led: state.led,
            unplug: state.unplug,
        };

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            requestQueue = requestQueue
                .catch(() => {})
                .then(() => sendAssessment(snapshot, version));
        }, DEBOUNCE_MS);
    }

    async function sendAssessment(snapshot, version) {
        // Discard outdated requests that have not started yet.
        if (version !== requestVersion) return;

        try {
            if (typeof window.api !== "function") {
                throw new Error("API client is not loaded.");
            }

            if (typeof window.loadSession === "function") {
                await window.loadSession();
            }

            // The inputs may have changed while the session was checked.
            if (version !== requestVersion) return;

            const result = await window.api("/api/assessments", {
                method: "POST",

                body: JSON.stringify({
                    kwh_monthly: snapshot.kwhMonthly,
                    ac_hours: snapshot.acHours,
                    transport: snapshot.transport,
                    led: snapshot.led,
                    unplug: snapshot.unplug,
                }),
            });

            // Never render an outdated response.
            if (version !== requestVersion) return;

            renderComparison(result);

        } catch (error) {
            if (version !== requestVersion) return;

            console.error("Calculator request failed:", error);

            if (typeof window.showToast === "function") {
                window.showToast(
                    error.message || "Gagal menghitung konsumsi energi.",
                    "error"
                );
            }
        }
    }

    // ── Initialization ────────────────────────────────────────

    syncSliders();
    updateInputLabels();
    updateTransportButtons();
    setInputMode("kwh");

    // Get the first assessment as soon as the page loads.
    scheduleAssessment();
})();