/**
 * checklist.js
 * Checklist Aksi Harian SDG 12 Energi (pledge system).
 *
 * Fitur:
 *  - Centang item → tambah poin & update progress bar
 *  - Level / rank berubah sesuai total poin (0 → 100)
 *  - Tombol reset mengosongkan semua centang
 */

(function () {
    // ── Elemen DOM ─────────────────────────────────────────────
    const checkboxes      = document.querySelectorAll('.pledge-chk');
    const pointsDisplay   = document.getElementById('pledge-points');
    const progressBar     = document.getElementById('pledge-progress-bar');
    const rankTitle       = document.getElementById('pledge-rank-title');
    const feedbackText    = document.getElementById('pledge-feedback');
    const badgeIconBox    = document.getElementById('badge-icon-box');
    const resetBtn        = document.getElementById('reset-pledges-btn');

    // ── Update tampilan progress & rank ───────────────────────
    function updateProgress() {
        let pts = 0;

        checkboxes.forEach(chk => {
            const card = chk.closest('.pledge-card');
            if (chk.checked) {
                pts += parseInt(chk.dataset.pts, 10);
                card.classList.add('border-sdg12', 'bg-sdg12-50/30');
                card.classList.remove('border-stone-200', 'bg-white');
            } else {
                card.classList.remove('border-sdg12', 'border-forest', 'bg-sdg12-50/30', 'bg-forest-50/30');
                card.classList.add('border-stone-200', 'bg-white');
            }
        });

        pointsDisplay.textContent      = pts;
        progressBar.style.width        = `${pts}%`;

        // ── Rank berdasarkan total poin ──────────────────────
        if (pts === 0) {
            rankTitle.textContent   = 'Pemula Sadar Energi 🌱';
            badgeIconBox.className  = 'w-14 h-14 rounded-2xl bg-sdg12-50 border border-sdg12/30 text-sdg12 flex items-center justify-center shrink-0';
            feedbackText.innerHTML  = 'Pilih aksi di bawah ini untuk mulai berkontribusi pada pengurangan beban puncak listrik nasional.';
        } else if (pts < 50) {
            rankTitle.textContent   = 'Penggerak Efisiensi ⚡';
            badgeIconBox.className  = 'w-14 h-14 rounded-2xl bg-forest-50 border border-forest/30 text-forest flex items-center justify-center shrink-0';
            feedbackText.textContent = 'Langkah awal yang bagus! Teruskan kebiasaan baik ini setiap hari.';
        } else if (pts < 100) {
            rankTitle.textContent   = 'Pejuang Transisi Energi 🌍';
            badgeIconBox.className  = 'w-14 h-14 rounded-2xl bg-sdg12 text-white flex items-center justify-center shrink-0 shadow-md';
            feedbackText.textContent = 'Hebat! Anda sudah menerapkan mayoritas prinsip konsumsi energi bertanggung jawab SDG 12.';
        } else {
            rankTitle.textContent   = 'Duta Utama SDG 12 Energi 🏆';
            badgeIconBox.className  = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-sdg12 to-forest text-white flex items-center justify-center shrink-0 shadow-lg';
            feedbackText.innerHTML  = '<strong>100/100 Poin Terkumpul!</strong> Anda adalah teladan konsumsi energi bersih dan berkelanjutan.';
        }

        lucide.createIcons();
    }

    // ── Event: centang / batal centang ────────────────────────
    checkboxes.forEach(chk => {
        chk.addEventListener('change', (e) => {
            const delta = parseInt(chk.dataset.pts, 10);

            if (e.target.checked) {
                window.userScore += delta;
                window.showToast(`Aksi selesai! +${delta} Poin SDG 12 dikreditkan.`, 'success');
            } else {
                window.userScore = Math.max(0, window.userScore - delta);
            }

            window.updateGlobalScore();
            updateProgress();
        });
    });

    // ── Event: tombol reset ───────────────────────────────────
    resetBtn.addEventListener('click', () => {
        checkboxes.forEach(chk => { chk.checked = false; });
        updateProgress();
    });

    // Tampilkan state awal
    updateProgress();
})();
