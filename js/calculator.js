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
    const calcModeGlider = document.getElementById('calc-mode-glider');
    const calcInputTrack = document.getElementById('calc-input-track');
    const inputKwhWrapper = document.getElementById('input-kwh-wrapper');
    const inputRpWrapper = document.getElementById('input-rp-wrapper');
    const presetBtns = document.querySelectorAll('.calc-preset-btn');

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
    const calcStatus = document.getElementById('calc-status');
    const gradePips = document.querySelectorAll('#grade-scale .grade-pip');

    const GRADE_STYLES = {
        A: ['bg-forest', 'text-forest-light'],
        B: ['bg-teal-500', 'text-teal-400'],
        C: ['bg-sdg12', 'text-sdg12-light'],
        D: ['bg-orange-500', 'text-orange-400'],
        E: ['bg-rose-600', 'text-rose-400'],
    };

    const GRADE_PIP_STYLES = {
        A: { active: 'bg-forest text-white ring-2 ring-white/80 opacity-100', inactive: 'bg-forest/30 text-forest-light opacity-50' },
        B: { active: 'bg-teal-500 text-white ring-2 ring-white/80 opacity-100', inactive: 'bg-teal-500/30 text-teal-300 opacity-50' },
        C: { active: 'bg-sdg12 text-white ring-2 ring-white/80 opacity-100', inactive: 'bg-sdg12/30 text-sdg12-light opacity-50' },
        D: { active: 'bg-orange-500 text-white ring-2 ring-white/80 opacity-100', inactive: 'bg-orange-500/30 text-orange-300 opacity-50' },
        E: { active: 'bg-rose-600 text-white ring-2 ring-white/80 opacity-100', inactive: 'bg-rose-600/30 text-rose-300 opacity-50' },
    };

    // ── Helper ─────────────────────────────────────────────────
    const fmtNum = (n) => Math.round(n).toLocaleString('id-ID');

    function syncSliderFill(slider) {
        if (!slider) return;
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const val = parseFloat(slider.value) || 0;
        const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
        slider.style.setProperty('--range-pct', `${Math.min(100, Math.max(0, pct))}%`);
    }

    function setCalcStatus(label, tone = 'idle') {
        if (!calcStatus) return;
        calcStatus.textContent = label;
        const tones = {
            idle: 'bg-slate-800 text-slate-300 border-slate-700',
            loading: 'bg-sdg12/20 text-sdg12-light border-sdg12/40',
            error: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
        calcStatus.className = `text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${tones[tone] || tones.idle}`;
    }

    // ── Mode switch: kWh ↔ Rp (Gliding Pill + Horizontal Slide) ─
    function setInputMode(mode) {
        const isKwh = mode === 'kwh';
        btnModeKwh.setAttribute('aria-selected', String(isKwh));
        btnModeRp.setAttribute('aria-selected', String(!isKwh));

        btnModeKwh.classList.toggle('text-slateDark', isKwh);
        btnModeKwh.classList.toggle('text-slate-500', !isKwh);
        btnModeRp.classList.toggle('text-slateDark', !isKwh);
        btnModeRp.classList.toggle('text-slate-500', isKwh);

        if (calcModeGlider) {
            calcModeGlider.style.transform = isKwh ? 'translateX(0%)' : 'translateX(100%)';
        }
        if (calcInputTrack) {
            calcInputTrack.style.transform = isKwh ? 'translateX(0%)' : 'translateX(-50%)';
        }
        if (inputKwhWrapper) inputKwhWrapper.inert = !isKwh;
        if (inputRpWrapper) inputRpWrapper.inert = isKwh;

        scheduleCalculate();
    }

    btnModeKwh.addEventListener('click', () => setInputMode('kwh'));
    btnModeRp.addEventListener('click', () => setInputMode('rp'));

    // ── Smooth glide animation untuk preset cepat ──────────────
    let presetFrame = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function glideToPreset(targetKwh, targetAc) {
        if (presetFrame) cancelAnimationFrame(presetFrame);

        const applyValues = (kwhVal, acVal) => {
            currentKwh = Math.round(kwhVal / 10) * 10;
            acHours = Math.round(acVal);

            sliderKwh.value = currentKwh;
            sliderRp.value = currentKwh * TARIFF_PER_KWH;
            sliderAc.value = acHours;

            valKwh.textContent = fmtNum(currentKwh);
            valRp.textContent = fmtNum(sliderRp.value);
            valAc.textContent = acHours;

            syncSliderFill(sliderKwh);
            syncSliderFill(sliderRp);
            syncSliderFill(sliderAc);
        };

        if (reduceMotion) {
            applyValues(targetKwh, targetAc);
            scheduleCalculate();
            return;
        }

        const startKwh = currentKwh;
        const startAc = acHours;
        const duration = 420;
        const startTime = performance.now();

        function step(now) {
            const t = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            applyValues(
                startKwh + (targetKwh - startKwh) * eased,
                startAc + (targetAc - startAc) * eased
            );
            if (t < 1) {
                presetFrame = requestAnimationFrame(step);
            } else {
                presetFrame = null;
                applyValues(targetKwh, targetAc);
                scheduleCalculate();
            }
        }
        presetFrame = requestAnimationFrame(step);
    }

    presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const kwh = parseInt(btn.dataset.presetKwh, 10);
            const ac = parseInt(btn.dataset.presetAc, 10);
            if (!Number.isNaN(kwh) && !Number.isNaN(ac)) {
                glideToPreset(kwh, ac);
            }
        });
    });

    // ── Slider kWh ─────────────────────────────────────────────
    sliderKwh.addEventListener('input', (event) => {
        currentKwh = parseInt(event.target.value, 10);
        valKwh.textContent = fmtNum(currentKwh);

        sliderRp.value = Math.round(currentKwh * TARIFF_PER_KWH);
        valRp.textContent = fmtNum(sliderRp.value);
        syncSliderFill(sliderKwh);
        syncSliderFill(sliderRp);
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
        syncSliderFill(sliderKwh);
        syncSliderFill(sliderRp);
        scheduleCalculate();
    });

    // ── Slider durasi AC ───────────────────────────────────────
    sliderAc.addEventListener('input', (event) => {
        acHours = parseInt(event.target.value, 10);
        valAc.textContent = acHours;
        syncSliderFill(sliderAc);
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

        gradePips.forEach((pip) => {
            const g = pip.dataset.grade;
            const style = GRADE_PIP_STYLES[g] || GRADE_PIP_STYLES.C;
            const isActive = g === result.grade;
            pip.className = `grade-pip py-1.5 rounded-lg text-center font-display font-bold text-xs transition-all ${isActive ? style.active : style.inactive}`;
            pip.setAttribute('aria-current', isActive ? 'true' : 'false');
        });

        recommendationList.innerHTML = result.recommendations.map((text) => `
            <li class="flex items-start gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span class="text-forest-light font-bold mt-0.5 shrink-0">✓</span>
                <span>${escapeHtml(text)}</span>
            </li>
        `).join('');
        setCalcStatus('Tersinkron', 'idle');
    }

    // ── Debounced server calculation ───────────────────────────
    function scheduleCalculate() {
        clearTimeout(debounceTimer);
        const seq = ++requestSeq;
        setCalcStatus('Menghitung…', 'loading');
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
            setCalcStatus('Offline', 'error');
            console.warn('Assessment failed:', error.message);
            if (!errorToastShown) {
                errorToastShown = true;
                window.showToast('Kalkulator tidak dapat terhubung ke server. Hasil terakhir dipertahankan.', 'error');
                setTimeout(() => { errorToastShown = false; }, 8000);
            }
        }
    }

    // Inisialisasi nilai awal dari profil daya PLN onboarding (bila ada)
    try {
        const savedKwh = parseInt(localStorage.getItem('sdg12_initial_kwh') || '', 10);
        if (!Number.isNaN(savedKwh) && savedKwh >= 50 && savedKwh <= 1500) {
            currentKwh = Math.round(savedKwh / 10) * 10;
            sliderKwh.value = currentKwh;
            sliderRp.value = currentKwh * TARIFF_PER_KWH;
            valKwh.textContent = fmtNum(currentKwh);
            valRp.textContent = fmtNum(sliderRp.value);
        }
    } catch (_) {
        // ignore storage errors
    }

    // Inisialisasi posisi track slider & hitung nilai awal saat halaman dimuat
    syncSliderFill(sliderKwh);
    syncSliderFill(sliderRp);
    syncSliderFill(sliderAc);
    scheduleCalculate();
})();
