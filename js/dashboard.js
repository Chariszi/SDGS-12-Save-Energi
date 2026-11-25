/**
 * dashboard.js
 * Dashboard Dampak Komunitas SDG 12.
 *
 * Fitur:
 *  - KPI (kWh, CO₂, rumah tangga, Rp) dari /api/impact
 *  - Animasi counter saat section #dampak masuk viewport
 *  - Progress bar distribusi dampak per kategori
 *  - Observer untuk animasi entrance tiap section (#urgensi, #inovasi, #dampak)
 *  - Keyboard accessibility: ESC tutup modal tantangan
 *  - Focus trap di dalam modal tantangan
 */

(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const kpiConfig = {
        'kpi-kwh-saved': 'kwh_saved',
        'kpi-co2-prevented': 'co2_prevented',
        'kpi-households': 'households',
        'kpi-rp-saved': 'rp_saved_million',
    };
    const barConfig = {
        listrik: { bar: 'bar-listrik', label: 'bar-label-listrik' },
        transportasi: { bar: 'bar-transportasi', label: 'bar-label-transportasi' },
        terbarukan: { bar: 'bar-terbarukan', label: 'bar-label-terbarukan' },
    };

    let latestImpact = null;
    let kpiAnimated = false;
    const kpiFrames = {};

    // ── Animasi counter angka (ease-out cubic) ─────────────────
    function stopKPI(id) {
        if (kpiFrames[id]) {
            cancelAnimationFrame(kpiFrames[id]);
            delete kpiFrames[id];
        }
    }

    function animateKPI(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        stopKPI(id);

        const duration = 1800;
        const start = performance.now();

        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target).toLocaleString('id-ID');
            if (progress < 1) {
                kpiFrames[id] = requestAnimationFrame(step);
            } else {
                delete kpiFrames[id];
            }
        }
        kpiFrames[id] = requestAnimationFrame(step);
    }

    function setKPI(id, value) {
        stopKPI(id);
        const el = document.getElementById(id);
        if (el) el.textContent = Math.round(value).toLocaleString('id-ID');
    }

    function renderImpact(impact, animate) {
        Object.entries(kpiConfig).forEach(([id, key]) => {
            const value = impact[key] || 0;
            if (animate && !reduceMotion) {
                animateKPI(id, value);
            } else {
                setKPI(id, value);
            }
        });

        const applyBars = () => {
            Object.entries(barConfig).forEach(([key, ids]) => {
                const percent = impact.distribution?.[key] ?? 0;
                const bar = document.getElementById(ids.bar);
                const label = document.getElementById(ids.label);
                if (bar) bar.style.width = `${percent}%`;
                if (label) label.textContent = `${percent}%`;
            });
        };

        if (animate && !reduceMotion) {
            setTimeout(applyBars, 300);
        } else {
            applyBars();
        }
    }

    // ── Trigger animasi saat section #dampak masuk viewport ───
    function triggerKPIAnimation() {
        if (kpiAnimated || !latestImpact) return;

        const dampakSection = document.getElementById('dampak');
        if (!dampakSection) return;

        if (dampakSection.getBoundingClientRect().top < window.innerHeight * 0.85) {
            kpiAnimated = true;
            renderImpact(latestImpact, true);
        }
    }

    window.addEventListener('impact:update', (event) => {
        latestImpact = event.detail;
        if (kpiAnimated) {
            renderImpact(latestImpact, false);
        } else {
            triggerKPIAnimation();
        }
    });

    window.addEventListener('scroll', triggerKPIAnimation, { passive: true });
    triggerKPIAnimation();

    // ── Animasi entrance scroll untuk kartu di tiga section ───
    if (!reduceMotion) {
        const animateOnScrollEls = document.querySelectorAll(
            '#urgensi .rounded-3xl, #inovasi .rounded-3xl, #dampak .rounded-3xl'
        );

        const entranceObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    entranceObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        animateOnScrollEls.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            entranceObserver.observe(el);
        });
    }

    // ── Keyboard: ESC menutup modal tantangan ─────────────────
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const modal = document.getElementById('challenge-modal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });

    // ── Focus trap di dalam modal tantangan ───────────────────
    const challengeModal = document.getElementById('challenge-modal');
    if (challengeModal) {
        challengeModal.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;

            const focusable = challengeModal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey) {
                if (document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }
})();
