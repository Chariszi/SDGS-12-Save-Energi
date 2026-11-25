/**
 * dashboard.js
 * Dashboard Dampak Komunitas SDG 12.
 *
 * Fitur:
 *  - Animasi counter KPI (kWh, CO₂, rumah tangga, Rp) saat scroll masuk viewport
 *  - Sinkronisasi KPI dengan nilai ticker setiap 5 detik
 *  - Animasi progress bar distribusi dampak
 *  - Observer untuk animasi entrance tiap section (#urgensi, #inovasi, #dampak)
 *  - Keyboard accessibility: ESC tutup modal tantangan
 *  - Focus trap di dalam modal tantangan
 */

(function () {
    // ── Konfigurasi target KPI ─────────────────────────────────
    const kpiTargets = {
        'kpi-kwh-saved':     { target: 3890, decimals: 0 },
        'kpi-co2-prevented': { target: 6412, decimals: 0 },
        'kpi-households':    { target: 1248, decimals: 0 },
        'kpi-rp-saved':      { target: 562,  decimals: 0 },
    };

    let kpiAnimated = false;

    // ── Animasi counter angka (ease-out cubic) ─────────────────
    function animateKPI(id, target, decimals) {
        const el = document.getElementById(id);
        if (!el) return;

        const duration = 1800;
        const start    = performance.now();

        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased    = 1 - Math.pow(1 - progress, 3);
            const current  = eased * target;

            el.textContent = decimals > 0
                ? current.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                : Math.round(current).toLocaleString('id-ID');

            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // ── Trigger animasi saat section #dampak masuk viewport ───
    function triggerKPIAnimation() {
        if (kpiAnimated) return;

        const dampakSection = document.getElementById('dampak');
        if (!dampakSection) return;

        const rect = dampakSection.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.85) {
            kpiAnimated = true;

            Object.entries(kpiTargets).forEach(([id, cfg]) => {
                animateKPI(id, cfg.target, cfg.decimals);
            });

            // Animasi progress bar dampak setelah sedikit delay
            setTimeout(() => {
                const bars = {
                    'bar-listrik':      '62%',
                    'bar-transportasi': '25%',
                    'bar-terbarukan':   '13%',
                };
                Object.entries(bars).forEach(([id, width]) => {
                    const el = document.getElementById(id);
                    if (el) el.style.width = width;
                });
            }, 300);
        }
    }

    window.addEventListener('scroll', triggerKPIAnimation, { passive: true });
    triggerKPIAnimation(); // Jalankan sekali saat load, kalau section sudah terlihat

    // ── Sinkronisasi KPI dengan nilai ticker (setiap 5 detik) ─
    function syncKPIWithTicker() {
        if (!kpiAnimated) return; // Hanya sync setelah animasi awal selesai

        const tickerKwhEl       = document.getElementById('ticker-kwh');
        const tickerCo2El       = document.getElementById('ticker-co2');
        const tickerHouseholdsEl = document.getElementById('ticker-households');

        const kpiKwhEl       = document.getElementById('kpi-kwh-saved');
        const kpiCo2El       = document.getElementById('kpi-co2-prevented');
        const kpiHouseholdsEl = document.getElementById('kpi-households');
        const kpiRpEl        = document.getElementById('kpi-rp-saved');

        if (tickerKwhEl && kpiKwhEl)
            kpiKwhEl.textContent = tickerKwhEl.textContent;

        if (tickerCo2El && kpiCo2El)
            kpiCo2El.textContent = tickerCo2El.textContent;

        if (tickerHouseholdsEl && kpiHouseholdsEl)
            kpiHouseholdsEl.textContent = tickerHouseholdsEl.textContent;

        // Konversi kWh → Juta Rp (asumsi Rp 1.445/kWh)
        if (tickerKwhEl && kpiRpEl) {
            const kwh    = parseInt(tickerKwhEl.textContent.replace(/\./g, '').replace(/,/g, ''), 10) || 3890;
            const jutaRp = Math.round((kwh * 1445) / 1_000_000);
            kpiRpEl.textContent = jutaRp.toLocaleString('id-ID');
        }
    }

    setInterval(syncKPIWithTicker, 5000);

    // ── Animasi entrance scroll untuk kartu di tiga section ───
    const animateOnScrollEls = document.querySelectorAll(
        '#urgensi .rounded-3xl, #inovasi .rounded-3xl, #dampak .rounded-3xl'
    );

    const entranceObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity   = '1';
                entry.target.style.transform = 'translateY(0)';
                entranceObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    animateOnScrollEls.forEach(el => {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        entranceObserver.observe(el);
    });

    // ── Keyboard: ESC menutup modal tantangan ─────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const modal = document.getElementById('challenge-modal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });

    // ── Focus trap di dalam modal tantangan ───────────────────
    const challengeModal = document.getElementById('challenge-modal');
    if (challengeModal) {
        challengeModal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            const focusable = challengeModal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last  = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }
})();
