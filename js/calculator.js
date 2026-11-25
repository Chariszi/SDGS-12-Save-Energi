/**
 * calculator.js
 * Kalkulator Jejak Karbon & Efisiensi Energi, dihitung oleh /api/assessments.
 *
 * Fitur:
 *  - Toggle mode input kWh / tagihan Rp
 *  - Slider konsumsi listrik & durasi AC
 *  - Selector transportasi (publik / motor / mobil)
 *  - Checkbox kebiasaan (LED, cabut standby)
 *  - CO₂, biaya, grade (A–E), dan rekomendasi berasal dari server
 *
 * Tarif PLN non-subsidi: Rp 1.445 / kWh (hanya untuk konversi slider Rp).
 */

(function () {
    const TARIFF_PER_KWH = 1445;

    // ── State ──────────────────────────────────────────────────
    let currentKwh = 300;
    let acHours = 6;
    let currentTransport = 'public';
    let debounceTimer = null;
    let requestSeq = 0;
    let errorToastShown = false;

    // ── Elemen DOM ─────────────────────────────────────────────
    const btnModeKwh = document.getElementById('btn-mode-kwh');
    const btnModeRp = document.getElementById('btn-mode-rp');
    const inputKwhWrapper = document.getElementById('input-kwh-wrapper');
    const inputRpWrapper = document.getElementById('input-rp-wrapper');

    const sliderKwh = document.getElementById('slider-kwh');
    const valKwh = document.getElementById('val-kwh');
    const sliderRp = document.getElementById('slider-rp');
    const valRp = document.getElementById('val-rp');

    const sliderAc = document.getElementById('slider-ac');
    const valAc = document.getElementById('val-ac');

    const transportBtns = document.querySelectorAll('.transport-btn');
    const chkLed = document.getElementById('chk-led');
    const chkUnplug = document.getElementById('chk-unplug');

    const outCo2 = document.getElementById('out-co2');
    const outTrees = document.getElementById('out-trees');
    const outCost = document.getElementById('out-cost');
    const outKwhSummary = document.getElementById('out-kwh-summary');
    const gradeBadge = document.getElementById('grade-badge');
    const gradeLetter = document.getElementById('grade-letter');
    const gradeTitle = document.getElementById('grade-title');
    const gradeDesc = document.getElementById('grade-desc');
    const recommendationList = document.getElementById('recommendation-list');

    const GRADE_STYLES = {
        A: ['bg-forest', 'text-forest-light'],
        B: ['bg-teal-500', 'text-teal-400'],
        C: ['bg-sdg12', 'text-sdg12-light'],
        D: ['bg-orange-500', 'text-orange-400'],
        E: ['bg-rose-600', 'text-rose-400'],
    };

    // ── Helper ─────────────────────────────────────────────────
    const fmtNum = (n) => Math.round(n).toLocaleString('id-ID');

    // ── Mode switch: kWh ↔ Rp ─────────────────────────────────
    btnModeKwh.addEventListener('click', () => {
        btnModeKwh.className = 'px-3 py-1.5 rounded-lg bg-white text-slateDark shadow-sm transition-all';
        btnModeRp.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slateDark transition-all';
        inputKwhWrapper.classList.remove('hidden');
        inputRpWrapper.classList.add('hidden');
        scheduleCalculate();
    });

    btnModeRp.addEventListener('click', () => {
        btnModeRp.className = 'px-3 py-1.5 rounded-lg bg-white text-slateDark shadow-sm transition-all';
        btnModeKwh.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slateDark transition-all';
        inputRpWrapper.classList.remove('hidden');
        inputKwhWrapper.classList.add('hidden');
        scheduleCalculate();
    });

    // ── Slider kWh ─────────────────────────────────────────────
    sliderKwh.addEventListener('input', (event) => {
        currentKwh = parseInt(event.target.value, 10);
        valKwh.textContent = fmtNum(currentKwh);

        sliderRp.value = Math.round(currentKwh * TARIFF_PER_KWH);
        valRp.textContent = fmtNum(sliderRp.value);
        scheduleCalculate();
    });

    // ── Slider Rp ──────────────────────────────────────────────
    sliderRp.addEventListener('input', (event) => {
        const rp = parseInt(event.target.value, 10);

        // Snap to the kWh slider's 10-kWh step, then write the rounded value
        // back to both controls so the Rp and kWh labels never disagree.
        const rawKwh = Math.min(1500, Math.max(50, Math.round(rp / TARIFF_PER_KWH)));
        currentKwh = Math.round(rawKwh / 10) * 10;
        sliderKwh.value = currentKwh;
        sliderRp.value = currentKwh * TARIFF_PER_KWH;

        valKwh.textContent = fmtNum(currentKwh);
        valRp.textContent = fmtNum(sliderRp.value);
        scheduleCalculate();
    });

    // ── Slider durasi AC ───────────────────────────────────────
    sliderAc.addEventListener('input', (event) => {
        acHours = parseInt(event.target.value, 10);
        valAc.textContent = acHours;
        scheduleCalculate();
    });

    // ── Selector transportasi ──────────────────────────────────
    transportBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            transportBtns.forEach((b) => {
                b.classList.remove('border-forest', 'bg-forest-50/70');
                b.classList.add('border-stone-200', 'bg-white');
            });
            btn.classList.remove('border-stone-200', 'bg-white');
            btn.classList.add('border-forest', 'bg-forest-50/70');

            currentTransport = btn.dataset.transport;
            scheduleCalculate();
        });
    });

    // ── Checkbox kebiasaan ─────────────────────────────────────
    chkLed.addEventListener('change', scheduleCalculate);
    chkUnplug.addEventListener('change', scheduleCalculate);

    // ── Render hasil dari server ───────────────────────────────
    function renderAssessment(result) {
        outCo2.textContent = fmtNum(result.total_co2_kg);
        outTrees.textContent = fmtNum(result.trees);
        outCost.textContent = fmtNum(result.cost_rp);
        outKwhSummary.textContent = fmtNum(result.effective_kwh);

        const [badgeColor, titleColor] = GRADE_STYLES[result.grade] || GRADE_STYLES.C;
        gradeLetter.textContent = result.grade;
        gradeBadge.className = `w-16 h-16 rounded-2xl ${badgeColor} text-white flex flex-col items-center justify-center shadow-lg transition-colors duration-300`;
        gradeTitle.textContent = result.title;
        gradeTitle.className = `font-semibold text-sm ${titleColor}`;
        gradeDesc.textContent = result.description;

        recommendationList.innerHTML = result.recommendations.map((text) => `
            <li class="flex items-start gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span class="text-forest-light font-bold mt-0.5 shrink-0">✓</span>
                <span>${escapeHtml(text)}</span>
            </li>
        `).join('');
    }

    // ── Debounced server calculation ───────────────────────────
    function scheduleCalculate() {
        clearTimeout(debounceTimer);
        const seq = ++requestSeq;
        debounceTimer = setTimeout(() => calculate(seq), 350);
    }

    async function calculate(seq) {
        try {
            const householdId = await window.getHouseholdId();
            const result = await window.api('/api/assessments', {
                method: 'POST',
                body: JSON.stringify({
                    household_id: householdId,
                    kwh_monthly: currentKwh,
                    ac_hours: acHours,
                    transport: currentTransport,
                    led: chkLed.checked,
                    unplug: chkUnplug.checked,
                }),
            });
            if (seq !== requestSeq) return;
            renderAssessment(result);
        } catch (error) {
            if (seq !== requestSeq) return;
            console.warn('Assessment failed:', error.message);
            if (!errorToastShown) {
                errorToastShown = true;
                window.showToast('Kalkulator tidak dapat terhubung ke server. Hasil terakhir dipertahankan.', 'error');
                setTimeout(() => { errorToastShown = false; }, 8000);
            }
        }
    }

    // Hitung nilai awal saat halaman dimuat
    scheduleCalculate();
})();
