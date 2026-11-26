/**
 * checklist.js
 * Checklist Aksi Harian SDG 12 Energi (pledge system), backed by /api/pledges.
 *
 * Fitur:
 *  - Centang item → server mencatat completion & poin
 *  - Level / rank berubah sesuai total poin (0 → 100)
 *  - Tombol reset mengosongkan semua centang
 */

(function () {
    // ── Elemen DOM ─────────────────────────────────────────────
    const checkboxes = document.querySelectorAll('.pledge-chk');
    const pointsDisplay = document.getElementById('pledge-points');
    const progressBar = document.getElementById('pledge-progress-bar');
    const rankTitle = document.getElementById('pledge-rank-title');
    const feedbackText = document.getElementById('pledge-feedback');
    const badgeIconBox = document.getElementById('badge-icon-box');
    const resetBtn = document.getElementById('reset-pledges-btn');

    let householdId = null;
    let resetPending = false;
    let pendingSaves = 0;
    let stateVersion = 0;

    // Prevent a toggle from racing the initial GET and being clobbered by stale state.
    checkboxes.forEach((chk) => {
        chk.disabled = true;
    });
    resetBtn.disabled = true;

    // ── Update tampilan progress & rank ───────────────────────
    function updateProgress() {
        let pts = 0;

        checkboxes.forEach((chk) => {
            const card = chk.closest('.pledge-card');
            if (chk.checked) {
                pts += parseInt(chk.dataset.pts, 10) || 0;
                card.classList.add('border-sdg12', 'bg-sdg12-50/30');
                card.classList.remove('border-stone-200', 'bg-white');
            } else {
                card.classList.remove('border-sdg12', 'border-forest', 'bg-sdg12-50/30', 'bg-forest-50/30');
                card.classList.add('border-stone-200', 'bg-white');
            }
        });

        pointsDisplay.textContent = pts;
        progressBar.style.width = `${pts}%`;

        // ── Rank berdasarkan total poin (SVG Lucide dinamis, tanpa emoji) ──
        let iconName = 'sprout';
        if (pts === 0) {
            rankTitle.textContent = 'Pemula Sadar Energi';
            iconName = 'sprout';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-sdg12-50 border border-sdg12/30 text-sdg12 flex items-center justify-center shrink-0';
            feedbackText.textContent = 'Pilih aksi di bawah ini untuk mulai berkontribusi pada pengurangan beban puncak listrik nasional.';
        } else if (pts < 50) {
            rankTitle.textContent = 'Penggerak Efisiensi';
            iconName = 'zap';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-forest-50 border border-forest/30 text-forest flex items-center justify-center shrink-0';
            feedbackText.textContent = 'Langkah awal yang bagus! Teruskan kebiasaan baik ini setiap hari.';
        } else if (pts < 100) {
            rankTitle.textContent = 'Pejuang Transisi Energi';
            iconName = 'globe';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-sdg12 text-white flex items-center justify-center shrink-0 shadow-md';
            feedbackText.textContent = 'Hebat! Anda sudah menerapkan mayoritas prinsip konsumsi energi bertanggung jawab SDG 12.';
        } else {
            rankTitle.textContent = 'Duta Utama SDG 12 Energi';
            iconName = 'trophy';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-sdg12 to-forest text-white flex items-center justify-center shrink-0 shadow-lg';
            feedbackText.textContent = '100/100 Poin Terkumpul! Anda adalah teladan konsumsi energi bersih dan berkelanjutan.';
        }

        badgeIconBox.innerHTML = `<i data-lucide="${iconName}" class="w-7 h-7"></i>`;
        lucide.createIcons();
    }

    async function savePledge(code, completed) {
        householdId ||= await window.getHouseholdId();
        return window.api(`/api/pledges/${code}`, {
            method: 'PUT',
            body: JSON.stringify({ household_id: householdId, completed }),
        });
    }

    async function loadPledges() {
        householdId ||= await window.getHouseholdId();
        const pledges = await window.api(`/api/pledges?household_id=${householdId}`);
        const byCode = new Map(pledges.map((pledge) => [pledge.code, pledge]));

        checkboxes.forEach((chk) => {
            const pledge = byCode.get(chk.dataset.pledge);
            if (pledge) {
                chk.checked = pledge.completed;
                chk.dataset.pts = pledge.points;
            }
            chk.disabled = resetPending || pendingSaves > 0;
        });
        resetBtn.disabled = resetPending || pendingSaves > 0;
        updateProgress();
    }

    // ── Event: centang / batal centang ────────────────────────
    checkboxes.forEach((chk) => {
        chk.addEventListener('change', async () => {
            const delta = parseInt(chk.dataset.pts, 10) || 0;
            const version = stateVersion;
            pendingSaves += 1;
            chk.disabled = true;
            resetBtn.disabled = true;

            try {
                await savePledge(chk.dataset.pledge, chk.checked);
                updateProgress();
                window.showToast(
                    chk.checked
                        ? `Aksi selesai! +${delta} Poin SDG 12 dikreditkan.`
                        : 'Aksi dibatalkan. Poin aksi harian disesuaikan.',
                    chk.checked ? 'success' : 'energy'
                );
                window.refreshScore();
            } catch (error) {
                // A reset or newer toggle may have changed state while this
                // request was in flight; only revert the current generation.
                if (version === stateVersion) {
                    chk.checked = !chk.checked;
                    updateProgress();
                }
                window.showToast(`Gagal menyimpan aksi: ${error.message}`, 'error');
            } finally {
                pendingSaves -= 1;
                chk.disabled = resetPending || pendingSaves > 0;
                resetBtn.disabled = resetPending || pendingSaves > 0;
            }
        });
    });

    // ── Event: tombol reset ───────────────────────────────────
    resetBtn.addEventListener('click', async () => {
        if (resetPending || pendingSaves > 0) return;

        const completed = [...checkboxes].filter((chk) => chk.checked);
        if (completed.length === 0) return;

        resetPending = true;
        stateVersion += 1;
        resetBtn.disabled = true;
        checkboxes.forEach((chk) => {
            chk.disabled = true;
        });
        try {
            const results = await Promise.allSettled(
                completed.map((chk) => savePledge(chk.dataset.pledge, false))
            );
            // Re-read server state after all requests settle; a partial failure
            // must not leave the UI claiming points the server no longer has.
            await loadPledges();
            const failed = results.filter((result) => result.status === 'rejected');
            if (failed.length > 0) {
                window.showToast(`Gagal mereset ${failed.length} aksi. Checklist disinkronkan ulang.`, 'error');
            } else {
                window.showToast('Checklist direset. Poin aksi harian dikosongkan.', 'success');
            }
        } catch (error) {
            window.showToast(`Gagal mereset checklist: ${error.message}`, 'error');
        } finally {
            resetPending = false;
            checkboxes.forEach((chk) => {
                chk.disabled = pendingSaves > 0;
            });
            resetBtn.disabled = pendingSaves > 0;
            window.refreshScore();
        }
    });

    // ── Initial load: state dari server ───────────────────────
    (async function init() {
        try {
            await loadPledges();
        } catch (error) {
            feedbackText.textContent = 'Data aksi harian tidak dapat dimuat. Pastikan server backend berjalan lalu muat ulang.';
            console.warn('Pledge load failed:', error.message);
        }
    })();
})();
