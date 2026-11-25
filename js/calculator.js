/**
 * calculator.js
 * Kalkulator Jejak Karbon & Efisiensi Energi.
 *
 * Fitur:
 *  - Toggle mode input kWh / tagihan Rp
 *  - Slider konsumsi listrik & durasi AC
 *  - Selector transportasi (publik / motor / mobil)
 *  - Checkbox kebiasaan (LED, cabut standby)
 *  - Kalkulasi CO₂, biaya, grade (A–E), rekomendasi dinamis
 *
 * Konstanta lokal Indonesia:
 *  - Tarif PLN non-subsidi: Rp 1.445 / kWh
 *  - Faktor emisi grid Indonesia: 0,85 kg CO₂e / kWh
 */

(function () {
    // ── Konstanta ──────────────────────────────────────────────
    const TARIFF_PER_KWH  = 1445;   // Rp per kWh
    const EMISSION_FACTOR = 0.85;   // kg CO₂e per kWh

    // ── State ──────────────────────────────────────────────────
    let inputMode    = 'kwh';
    let currentKwh   = 300;
    let acHours      = 6;
    let transportCo2 = 25;          // default: transportasi umum

    // ── Elemen DOM ─────────────────────────────────────────────
    const btnModeKwh      = document.getElementById('btn-mode-kwh');
    const btnModeRp       = document.getElementById('btn-mode-rp');
    const inputKwhWrapper = document.getElementById('input-kwh-wrapper');
    const inputRpWrapper  = document.getElementById('input-rp-wrapper');

    const sliderKwh  = document.getElementById('slider-kwh');
    const valKwh     = document.getElementById('val-kwh');
    const sliderRp   = document.getElementById('slider-rp');
    const valRp      = document.getElementById('val-rp');

    const sliderAc   = document.getElementById('slider-ac');
    const valAc      = document.getElementById('val-ac');

    const transportBtns = document.querySelectorAll('.transport-btn');
    const chkLed        = document.getElementById('chk-led');
    const chkUnplug     = document.getElementById('chk-unplug');

    const outCo2          = document.getElementById('out-co2');
    const outTrees        = document.getElementById('out-trees');
    const outCost         = document.getElementById('out-cost');
    const outKwhSummary   = document.getElementById('out-kwh-summary');
    const gradeBadge      = document.getElementById('grade-badge');
    const gradeLetter     = document.getElementById('grade-letter');
    const gradeTitle      = document.getElementById('grade-title');
    const gradeDesc       = document.getElementById('grade-desc');
    const recommendationList = document.getElementById('recommendation-list');

    // ── Helper ─────────────────────────────────────────────────
    const fmtNum = (n) => Math.round(n).toLocaleString('id-ID');

    // ── Mode switch: kWh ↔ Rp ─────────────────────────────────
    btnModeKwh.addEventListener('click', () => {
        inputMode = 'kwh';
        btnModeKwh.className = 'px-3 py-1.5 rounded-lg bg-white text-slateDark shadow-sm transition-all';
        btnModeRp.className  = 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slateDark transition-all';
        inputKwhWrapper.classList.remove('hidden');
        inputRpWrapper.classList.add('hidden');
        calculate();
    });

    btnModeRp.addEventListener('click', () => {
        inputMode = 'rp';
        btnModeRp.className  = 'px-3 py-1.5 rounded-lg bg-white text-slateDark shadow-sm transition-all';
        btnModeKwh.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slateDark transition-all';
        inputRpWrapper.classList.remove('hidden');
        inputKwhWrapper.classList.add('hidden');
        calculate();
    });

    // ── Slider kWh ─────────────────────────────────────────────
    sliderKwh.addEventListener('input', (e) => {
        currentKwh = parseInt(e.target.value, 10);
        valKwh.textContent = fmtNum(currentKwh);

        // Sinkronisasi slider Rp
        sliderRp.value     = Math.round(currentKwh * TARIFF_PER_KWH);
        valRp.textContent  = fmtNum(sliderRp.value);
        calculate();
    });

    // ── Slider Rp ──────────────────────────────────────────────
    sliderRp.addEventListener('input', (e) => {
        const rp = parseInt(e.target.value, 10);
        valRp.textContent = fmtNum(rp);

        // Konversi ke kWh & sinkronisasi slider kWh
        currentKwh        = Math.round(rp / TARIFF_PER_KWH);
        sliderKwh.value   = Math.min(1500, Math.max(50, currentKwh));
        valKwh.textContent = fmtNum(currentKwh);
        calculate();
    });

    // ── Slider durasi AC ───────────────────────────────────────
    sliderAc.addEventListener('input', (e) => {
        acHours = parseInt(e.target.value, 10);
        valAc.textContent = acHours;
        calculate();
    });

    // ── Selector transportasi ──────────────────────────────────
    transportBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Reset semua tombol
            transportBtns.forEach(b => {
                b.classList.remove('border-forest', 'bg-forest-50/70');
                b.classList.add('border-stone-200', 'bg-white');
            });
            // Aktifkan tombol yang dipilih
            btn.classList.remove('border-stone-200', 'bg-white');
            btn.classList.add('border-forest', 'bg-forest-50/70');

            transportCo2 = parseInt(btn.dataset.co2, 10);
            calculate();
        });
    });

    // ── Checkbox kebiasaan ─────────────────────────────────────
    chkLed.addEventListener('change', calculate);
    chkUnplug.addEventListener('change', calculate);

    // ── Fungsi kalkulasi utama ─────────────────────────────────
    function calculate() {
        let efficiencyMultiplier = 1.0;
        if (chkLed.checked)    efficiencyMultiplier -= 0.08;
        if (chkUnplug.checked) efficiencyMultiplier -= 0.07;

        // Beban ekstra dari penggunaan AC > 8 jam/hari
        const acExtraKwh   = acHours > 8 ? (acHours - 8) * 18 : 0;
        const effectiveKwh = Math.round((currentKwh + acExtraKwh) * efficiencyMultiplier);

        const totalCost        = effectiveKwh * TARIFF_PER_KWH;
        const electricityCo2   = effectiveKwh * EMISSION_FACTOR;
        const totalCo2         = Math.round(electricityCo2 + transportCo2);
        const treesNeeded      = Math.max(1, Math.ceil(totalCo2 / 18));

        // Tampilkan output
        outCo2.textContent        = fmtNum(totalCo2);
        outTrees.textContent      = fmtNum(treesNeeded);
        outCost.textContent       = fmtNum(totalCost);
        outKwhSummary.textContent = fmtNum(effectiveKwh);

        // ── Grade A–E ────────────────────────────────────────
        let grade, title, desc, badgeColor, titleColor;

        if (totalCo2 <= 220) {
            grade = 'A'; title = 'Sangat Efisien (Teladan SDG 12)';
            desc  = 'Luar biasa! Pola konsumsi energi Anda sangat hemat dan ramah lingkungan.';
            badgeColor = 'bg-forest';    titleColor = 'text-forest-light';
        } else if (totalCo2 <= 360) {
            grade = 'B'; title = 'Efisien (Baik)';
            desc  = 'Konsumsi energi Anda terkendali, namun masih ada ruang untuk penghematan.';
            badgeColor = 'bg-teal-500';  titleColor = 'text-teal-400';
        } else if (totalCo2 <= 550) {
            grade = 'C'; title = 'Moderat (Rata-Rata)';
            desc  = 'Konsumsi energi cukup tinggi. Pertimbangkan mengurangi jam AC atau beralih transportasi.';
            badgeColor = 'bg-sdg12';     titleColor = 'text-sdg12-light';
        } else if (totalCo2 <= 800) {
            grade = 'D'; title = 'Boros Energi (Perlu Perbaikan)';
            desc  = 'Jejak karbon dan tagihan listrik Anda tergolong tinggi. Terapkan langkah efisiensi segera.';
            badgeColor = 'bg-orange-500'; titleColor = 'text-orange-400';
        } else {
            grade = 'E'; title = 'Sangat Boros (Kritis)';
            desc  = 'Konsumsi energi sangat tinggi! Audit peralatan rumah tangga dan pola perjalanan Anda.';
            badgeColor = 'bg-rose-600';  titleColor = 'text-rose-400';
        }

        gradeLetter.textContent = grade;
        gradeBadge.className    = `w-16 h-16 rounded-2xl ${badgeColor} text-white flex flex-col items-center justify-center shadow-lg transition-colors duration-300`;
        gradeTitle.textContent  = title;
        gradeTitle.className    = `font-semibold text-sm ${titleColor}`;
        gradeDesc.textContent   = desc;

        // ── Rekomendasi dinamis ──────────────────────────────
        const recs = [];

        if (acHours > 8) {
            recs.push(`Kurangi durasi AC dari ${acHours} jam menjadi 8 jam/hari &amp; gunakan fitur <em>timer</em> malam hari.`);
        }
        if (!chkLed.checked) {
            recs.push('Ganti seluruh lampu rumah ke LED untuk memangkas konsumsi daya penerangan hingga 85%.');
        }
        if (!chkUnplug.checked) {
            recs.push('Gunakan stopkontak bersaklar untuk memutus <em>standby power</em> TV, konsol, dan charger.');
        }
        if (transportCo2 >= 180) {
            recs.push('Ganti perjalanan mobil pribadi 2 hari/minggu dengan transportasi umum untuk hemat ~50 kg CO₂/bln.');
        }
        if (effectiveKwh > 450) {
            recs.push('Pertimbangkan pemasangan PLTS Atap (Solar Panel) atau periksa insulasi ruangan ber-AC.');
        }
        if (recs.length === 0) {
            recs.push('Pertahankan kebiasaan hebat Anda! Bagikan kalkulator ini untuk menginspirasi keluarga dan tetangga.');
        }

        recommendationList.innerHTML = recs.map(r => `
            <li class="flex items-start gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span class="text-forest-light font-bold mt-0.5 shrink-0">✓</span>
                <span>${r}</span>
            </li>
        `).join('');
    }

    // Hitung nilai awal saat halaman dimuat
    calculate();
})();
