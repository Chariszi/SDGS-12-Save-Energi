/**
 * challenges.js
 * Papan tantangan komunitas energi.
 *
 * Fitur:
 *  - Render kartu tantangan secara dinamis
 *  - Filter per kategori (semua / listrik / transportasi / terbarukan)
 *  - Ambil tantangan → tambah poin & update ticker
 *  - Modal "Bagikan Tantangan Baru" dengan form
 */

(function () {
    // ── State ──────────────────────────────────────────────────
    let currentFilter = 'all';

    let challengeListings = [
        {
            id:          1,
            category:    'listrik',
            title:       'Matikan AC Semalam',
            description: 'Coba tidur tanpa AC semalam dengan membuka jendela dan menggunakan kipas angin. Hemat energi mulai dari malam ini.',
            kwh:         1.2,
            co2:         1.0,
            location:    'Jabodetabek',
            time:        'Malam ini',
            joined:      false,
        },
        {
            id:          2,
            category:    'transportasi',
            title:       'Gunakan Sepeda/Angkutan Umum 3 Hari',
            description: 'Tantang diri Anda menggunakan sepeda atau angkutan umum selama 3 hari berturut-turut sebagai pengganti kendaraan pribadi berbahan bakar fosil.',
            kwh:         0,
            co2:         15.0,
            location:    'Nasional',
            time:        'Minggu ini',
            joined:      false,
        },
        {
            id:          3,
            category:    'listrik',
            title:       'Audit Lampu Rumah (Ganti ke LED)',
            description: 'Hitung berapa lampu non-LED yang masih ada di rumah Anda dan ganti dengan LED hemat energi. Satu langkah nyata menuju SDG 12.8.',
            kwh:         8.0,
            co2:         6.8,
            location:    'Semua Wilayah',
            time:        'Bulan ini',
            joined:      false,
        },
        {
            id:          4,
            category:    'terbarukan',
            title:       'Pasang Panel Surya Komunitas RT/RW',
            description: 'Inisiasi pengadaan panel surya bersama untuk dipasang di atap balai RT/RW atau fasilitas umum setempat.',
            kwh:         180.0,
            co2:         153.0,
            location:    'Bandung',
            time:        'Kuartal ini',
            joined:      false,
        },
        {
            id:          5,
            category:    'listrik',
            title:       'Cabut Semua Perangkat Standby Malam Ini',
            description: 'Sebelum tidur, cabut semua colokan TV, set-top box, charger, dan microwave untuk menghilangkan 100% beban vampire power.',
            kwh:         0.4,
            co2:         0.3,
            location:    'Nasional',
            time:        'Malam ini',
            joined:      false,
        },
        {
            id:          6,
            category:    'listrik',
            title:       'Cuci Pakaian Full Load + Jemur Alami',
            description: 'Kumpulkan cucian hingga penuh kapasitas mesin cuci lalu jemur di bawah sinar matahari — tidak menggunakan pengering listrik.',
            kwh:         0.9,
            co2:         0.8,
            location:    'Semua Wilayah',
            time:        'Hari ini',
            joined:      false,
        },
    ];

    // ── Style per kategori ─────────────────────────────────────
    function getCategoryStyle(category) {
        const map = {
            listrik: {
                badgeClass:   'bg-sdg12-50 text-sdg12-dark border-sdg12/25',
                iconName:     'zap',
                iconColor:    'text-sdg12',
                label:        'Hemat Listrik · SDG 12.8',
                borderHover:  'hover:border-sdg12',
                btnClass:     'bg-sdg12 hover:bg-sdg12-dark text-white',
            },
            transportasi: {
                badgeClass:   'bg-forest-50 text-forest-dark border-forest/25',
                iconName:     'bike',
                iconColor:    'text-forest',
                label:        'Transportasi Bersih · SDG 12.c',
                borderHover:  'hover:border-forest',
                btnClass:     'bg-forest hover:bg-forest-dark text-white',
            },
            terbarukan: {
                badgeClass:   'bg-amber-50 text-amber-700 border-amber-200',
                iconName:     'sun',
                iconColor:    'text-amber-500',
                label:        'Energi Terbarukan · SDG 12.2',
                borderHover:  'hover:border-amber-400',
                btnClass:     'bg-amber-500 hover:bg-amber-600 text-white',
            },
        };
        return map[category] || map.listrik;
    }

    // ── Render kartu tantangan ─────────────────────────────────
    function renderChallenges() {
        const grid = document.getElementById('challenge-feed-grid');

        // Update badge count di navigasi & filter buttons
        document.getElementById('count-all-chal').textContent    = challengeListings.length;
        document.getElementById('count-listrik').textContent     = challengeListings.filter(c => c.category === 'listrik').length;
        document.getElementById('count-transportasi').textContent = challengeListings.filter(c => c.category === 'transportasi').length;
        document.getElementById('count-terbarukan').textContent  = challengeListings.filter(c => c.category === 'terbarukan').length;
        document.getElementById('nav-komunitas-badge').textContent = challengeListings.filter(c => !c.joined).length;

        const filtered = currentFilter === 'all'
            ? challengeListings
            : challengeListings.filter(c => c.category === currentFilter);

        grid.innerHTML = filtered.map(item => {
            const s        = getCategoryStyle(item.category);
            const kwhLabel = item.kwh > 0 ? `${item.kwh} kWh dihemat` : `${item.co2} kg CO₂e dicegah`;
            const btnLabel = item.joined ? 'Sudah Diikuti ✓' : 'Ambil Tantangan (+20 Poin)';
            const btnDisabled = item.joined ? 'disabled' : '';
            const btnCls   = item.joined ? 'bg-stone-200 text-slate-500 cursor-default' : s.btnClass;

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

                        <h3 class="font-display font-bold text-lg text-slateDark leading-snug mb-2">${item.title}</h3>
                        <p class="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">${item.description}</p>
                    </div>

                    <div class="space-y-4 pt-3 border-t border-stone-100">
                        <div class="space-y-1.5 text-xs text-slate-500">
                            <div class="flex items-center gap-2">
                                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                                <span>${item.location}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                                <span>${item.time}</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-3 pt-1">
                            <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                -${item.co2 > 0 ? item.co2 : (item.kwh * 0.85).toFixed(1)} kg CO₂e
                            </span>
                            <button type="button"
                                    onclick="joinChallenge(${item.id})"
                                    ${btnDisabled}
                                    class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-sm ${btnCls}">
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
    window.joinChallenge = function (id) {
        const item = challengeListings.find(c => c.id === id);
        if (!item || item.joined) return;

        item.joined = true;

        // Tambah poin & update ticker
        window.userScore += 20;
        window.ticker.kwh  = Math.round(window.ticker.kwh + item.kwh);
        window.ticker.co2  = Math.round(window.ticker.co2 + (item.co2 > 0 ? item.co2 : item.kwh * 0.85));

        // Update semua tampilan
        document.getElementById('ticker-kwh').textContent = window.ticker.kwh.toLocaleString('id-ID');
        document.getElementById('ticker-co2').textContent = window.ticker.co2.toLocaleString('id-ID');
        window.updateGlobalScore();
        renderChallenges();
        window.showToast(`Tantangan "${item.title}" diambil! +20 Poin SDG 12.`, 'challenge');
    };

    // ── Filter buttons ─────────────────────────────────────────
    document.querySelectorAll('.chal-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;

            // Reset semua tombol
            document.querySelectorAll('.chal-filter-btn').forEach(b => {
                b.className = 'chal-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slateDark transition-all flex items-center gap-1.5';
            });
            // Aktifkan tombol yang dipilih
            btn.className = 'chal-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slateDark text-white shadow-sm transition-all flex items-center gap-1.5';

            renderChallenges();
        });
    });

    // ── Modal "Bagikan Tantangan" ───────────────────────────────
    const modal               = document.getElementById('challenge-modal');
    const openBtn             = document.getElementById('open-challenge-modal-btn');
    const closeBtn            = document.getElementById('close-challenge-modal-btn');
    const cancelBtn           = document.getElementById('cancel-challenge-btn');
    const backdrop            = document.getElementById('challenge-modal-backdrop');
    const form                = document.getElementById('post-challenge-form');

    const openModal  = () => modal.classList.remove('hidden');
    const closeModal = () => modal.classList.add('hidden');

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    // Submit tantangan baru
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const title    = document.getElementById('chal-title').value.trim();
        const category = document.getElementById('chal-category').value;
        const kwh      = parseFloat(document.getElementById('chal-kwh').value) || 1.0;
        const location = document.getElementById('chal-location').value.trim();
        const desc     = document.getElementById('chal-desc').value.trim();
        const co2Est   = parseFloat((kwh * 0.85).toFixed(1));

        challengeListings.unshift({
            id:          Date.now(),
            category,
            title,
            description: desc,
            kwh,
            co2:         co2Est,
            location,
            time:        'Baru saja',
            joined:      false,
        });

        window.userScore += 30;
        window.ticker.kwh  = Math.round(window.ticker.kwh + kwh);
        window.ticker.co2  = Math.round(window.ticker.co2 + co2Est);

        document.getElementById('ticker-kwh').textContent = window.ticker.kwh.toLocaleString('id-ID');
        document.getElementById('ticker-co2').textContent = window.ticker.co2.toLocaleString('id-ID');
        window.updateGlobalScore();
        renderChallenges();
        closeModal();
        form.reset();
        window.showToast(`Tantangan "${title}" berhasil dipublikasikan! +30 Poin.`, 'success');
    });

    // Render awal
    renderChallenges();
})();
