/**
 * challenges.js
 * Papan tantangan komunitas energi, backed by /api/challenges.
 *
 * Fitur:
 *  - Render kartu tantangan dari server
 *  - Filter per kategori (semua / listrik / transportasi / terbarukan)
 *  - Ambil tantangan → server mencatat join & poin
 *  - Modal "Bagikan Tantangan Baru" dengan form
 */

(function () {
    // ── State ──────────────────────────────────────────────────
    let currentFilter = 'all';
    let householdId = null;
    let challengeListings = [];
    let formPending = false;
    const pendingJoins = new Set();

    const grid = document.getElementById('challenge-feed-grid');

    // ── Style per kategori ─────────────────────────────────────
    function getCategoryStyle(category) {
        const map = {
            listrik: {
                badgeClass: 'bg-sdg12-50 text-sdg12-dark border-sdg12/25',
                iconName: 'zap',
                iconColor: 'text-sdg12',
                label: 'Hemat Listrik · SDG 12.8',
                borderHover: 'hover:border-sdg12',
                btnClass: 'bg-sdg12 hover:bg-sdg12-dark text-white',
            },
            transportasi: {
                badgeClass: 'bg-forest-50 text-forest-dark border-forest/25',
                iconName: 'bike',
                iconColor: 'text-forest',
                label: 'Transportasi Bersih · SDG 12.c',
                borderHover: 'hover:border-forest',
                btnClass: 'bg-forest hover:bg-forest-dark text-white',
            },
            terbarukan: {
                badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
                iconName: 'sun',
                iconColor: 'text-amber-500',
                label: 'Energi Terbarukan · SDG 12.2',
                borderHover: 'hover:border-amber-400',
                btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
            },
        };
        return map[category] || map.listrik;
    }

    // ── Render kartu tantangan ─────────────────────────────────
    function renderChallenges() {
        const setCount = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setCount('count-all-chal', challengeListings.length);
        setCount('count-listrik', challengeListings.filter((c) => c.category === 'listrik').length);
        setCount('count-transportasi', challengeListings.filter((c) => c.category === 'transportasi').length);
        setCount('count-terbarukan', challengeListings.filter((c) => c.category === 'terbarukan').length);
        setCount('nav-komunitas-badge', challengeListings.filter((c) => !c.joined).length);

        const filtered = currentFilter === 'all'
            ? challengeListings
            : challengeListings.filter((c) => c.category === currentFilter);

        if (filtered.length === 0) {
            grid.innerHTML = `
                <p class="col-span-full rounded-3xl bg-white border border-dashed border-stone-300 p-8 text-center text-sm text-slate-500">
                    Belum ada tantangan pada kategori ini. Bagikan tantangan pertama Anda.
                </p>`;
            return;
        }

        grid.innerHTML = filtered.map((item) => {
            const s = getCategoryStyle(item.category);
            const kwhLabel = item.kwh > 0 ? `${item.kwh} kWh dihemat` : `${item.co2} kg CO₂e dicegah`;
            const btnLabel = item.joined
                ? 'Sudah Diikuti ✓'
                : item.pending
                    ? 'Menyimpan…'
                    : 'Ambil Tantangan (+20 Poin)';
            const btnDisabled = item.joined || item.pending ? 'disabled' : '';
            const btnCls = item.joined ? 'bg-stone-200 text-slate-500 cursor-default' : s.btnClass;
            const co2Label = item.co2 > 0 ? item.co2 : (item.kwh * 0.85).toFixed(1);

            return `
                <article class="animate-card rounded-3xl bg-white border border-stone-200/90 p-6 flex flex-col justify-between
                                ${s.borderHover} transition-all hover:shadow-lg ${item.joined ? 'opacity-80' : ''}">
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-4">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.badgeClass}">
                                <i data-lucide="${s.iconName}" class="w-3.5 h-3.5 ${s.iconColor}"></i>
                                <span>${s.label}</span>
                            </span>
                            <span class="font-display font-extrabold text-xs px-2.5 py-1 rounded-lg bg-cream border border-stone-200 text-slateDark">
                                ${kwhLabel}
                            </span>
                        </div>

                        <h3 class="font-display font-bold text-lg text-slateDark leading-snug mb-2">${escapeHtml(item.title)}</h3>
                        <p class="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">${escapeHtml(item.description)}</p>
                    </div>

                    <div class="space-y-4 pt-3 border-t border-stone-100">
                        <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                            <div class="flex items-center gap-1.5">
                                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                                <span>${escapeHtml(item.location)}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                                <span>${escapeHtml(item.time)}</span>
                            </div>
                            <div class="flex items-center gap-1.5 text-slate-600 font-medium tabular-nums">
                                <i data-lucide="users" class="w-3.5 h-3.5 text-forest shrink-0"></i>
                                <span>${Number(item.join_count) || 0} peserta</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-3 pt-1">
                            <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg tabular-nums">
                                -${co2Label} kg CO₂e
                            </span>
                            <button type="button"
                                    onclick="joinChallenge(${Number(item.id)})"
                                    ${btnDisabled}
                                    class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-sm ${item.joined || item.pending ? '' : 'cursor-pointer'} ${btnCls}">
                                <i data-lucide="${item.joined ? 'check' : 'hand-heart'}" class="w-4 h-4"></i>
                                <span>${btnLabel}</span>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        lucide.createIcons();
    }

    // ── Aksi ambil tantangan (global agar bisa dipanggil dari onclick) ──
    window.joinChallenge = async function (id) {
        const item = challengeListings.find((c) => c.id === id);
        if (!item || item.joined || pendingJoins.has(id)) return;

        pendingJoins.add(id);
        item.pending = true;
        renderChallenges();

        try {
            householdId ||= await window.getHouseholdId();
            const result = await window.api(`/api/challenges/${id}/join`, {
                method: 'POST',
                body: JSON.stringify({ household_id: householdId }),
            });

            item.joined = true;
            if (result.awarded) {
                item.join_count = (Number(item.join_count) || 0) + 1;
            }
            renderChallenges();
            window.showToast(
                result.awarded
                    ? `Tantangan "${item.title}" diambil! +20 Poin SDG 12.`
                    : `Tantangan "${item.title}" sudah tercatat sebelumnya.`,
                'challenge'
            );
            await Promise.all([window.refreshScore(), window.refreshImpact()]);
        } catch (error) {
            window.showToast(`Gagal mengambil tantangan: ${error.message}`, 'error');
        } finally {
            pendingJoins.delete(id);
            item.pending = false;
            renderChallenges();
        }
    };

    // ── Filter buttons ─────────────────────────────────────────
    document.querySelectorAll('.chal-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;

            document.querySelectorAll('.chal-filter-btn').forEach((b) => {
                b.className = 'chal-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slateDark transition-all flex items-center gap-1.5';
            });
            btn.className = 'chal-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slateDark text-white shadow-sm transition-all flex items-center gap-1.5';

            renderChallenges();
        });
    });

    // ── Modal "Bagikan Tantangan" ───────────────────────────────
    const modal = document.getElementById('challenge-modal');
    const openBtn = document.getElementById('open-challenge-modal-btn');
    const closeBtn = document.getElementById('close-challenge-modal-btn');
    const cancelBtn = document.getElementById('cancel-challenge-btn');
    const backdrop = document.getElementById('challenge-modal-backdrop');
    const form = document.getElementById('post-challenge-form');

    const titleInput = document.getElementById('chal-title');
    let lastTriggerEl = null;

    const openModal = () => {
        lastTriggerEl = document.activeElement;
        modal.classList.remove('hidden');
        if (titleInput) {
            requestAnimationFrame(() => titleInput.focus());
        }
    };
    const closeModal = () => {
        modal.classList.add('hidden');
        if (lastTriggerEl && typeof lastTriggerEl.focus === 'function') {
            lastTriggerEl.focus();
        } else if (openBtn) {
            openBtn.focus();
        }
    };
    window.closeChallengeModal = closeModal;

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    // Submit tantangan baru
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (formPending) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const payload = {
            household_id: householdId,
            title: document.getElementById('chal-title').value.trim(),
            category: document.getElementById('chal-category').value,
            kwh: parseFloat(document.getElementById('chal-kwh').value) || 1.0,
            location: document.getElementById('chal-location').value.trim(),
            description: document.getElementById('chal-desc').value.trim(),
        };

        formPending = true;
        if (submitBtn) submitBtn.disabled = true;
        try {
            householdId ||= await window.getHouseholdId();
            const created = await window.api('/api/challenges', {
                method: 'POST',
                body: JSON.stringify({ ...payload, household_id: householdId }),
            });

            challengeListings.unshift(created);
            renderChallenges();
            closeModal();
            form.reset();
            window.showToast(`Tantangan "${created.title}" berhasil dipublikasikan! +30 Poin.`, 'success');
            await window.refreshScore();
        } catch (error) {
            window.showToast(`Gagal mempublikasikan tantangan: ${error.message}`, 'error');
        } finally {
            formPending = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // ── Initial load ───────────────────────────────────────────
    (async function load() {
        try {
            householdId = await window.getHouseholdId();
            challengeListings = await window.api(`/api/challenges?household_id=${householdId}`);
            renderChallenges();
        } catch (error) {
            grid.innerHTML = `
                <p class="col-span-full rounded-3xl bg-rose-50 border border-rose-200 p-8 text-center text-sm text-rose-700">
                    Tantangan tidak dapat dimuat (${escapeHtml(error.message)}). Pastikan server backend berjalan lalu muat ulang.
                </p>`;
        }
    })();
})();
