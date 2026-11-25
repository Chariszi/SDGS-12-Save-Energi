/**
 * SDG 12 Energi — menu.js
 * All interactive JavaScript for the SDG 12 Indonesian energy website.
 * Sections:
 *  1. Lucide icon init
 *  2. Live impact ticker
 *  3. Mobile menu toggle
 *  4. User score state & updater
 *  5. Energy calculator (kWh/Rp mode, AC, transport, habits)
 *  6. Appliance simulation (Chart.js)
 *  7. Community challenges feed
 *  8. Post challenge modal
 *  9. Daily checklist pledges
 * 10. Toast notifications
 */

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. LUCIDE ICONS INIT
    // ============================================================
    lucide.createIcons();

    // ============================================================
    // 2. LIVE IMPACT TICKER
    // ============================================================
    let tickerKwh = 3890;
    let tickerCo2 = 6412;
    let tickerHouseholds = 1248;

    function updateTicker() {
        document.getElementById('ticker-kwh').textContent = tickerKwh.toLocaleString('id-ID');
        document.getElementById('ticker-co2').textContent = tickerCo2.toLocaleString('id-ID');
        document.getElementById('ticker-households').textContent = tickerHouseholds.toLocaleString('id-ID');
    }

    updateTicker();

    function incrementTicker() {
        tickerKwh += Math.floor(Math.random() * 5) + 1;
        tickerCo2 += Math.floor(Math.random() * 4) + 1;
        if (Math.random() > 0.6) tickerHouseholds += 1;
        updateTicker();
        // Schedule next increment with a random interval between 4s and 6s
        const nextDelay = 4000 + Math.floor(Math.random() * 2000);
        setTimeout(incrementTicker, nextDelay);
    }

    setTimeout(incrementTicker, 4000 + Math.floor(Math.random() * 2000));

    // ============================================================
    // 3. MOBILE MENU TOGGLE
    // ============================================================
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });

    // ============================================================
    // 4. USER SCORE STATE
    // ============================================================
    let userScore = 0;

    function updateGlobalScore() {
        const display = document.getElementById('user-score-display');
        const mobileDisplay = document.getElementById('mobile-user-score');
        if (display) display.textContent = `${userScore} Poin`;
        if (mobileDisplay) mobileDisplay.textContent = `${userScore} Poin`;
    }

    updateGlobalScore();

    // ============================================================
    // 5. ENERGY CALCULATOR
    // ============================================================
    const TARIFF_PER_KWH = 1445;   // Rp per kWh (rata-rata non-subsidi)
    const EMISSION_FACTOR = 0.85;   // kg CO₂e per kWh (grid Indonesia)

    let inputMode = 'kwh';
    let currentKwh = 300;
    let acHours = 6;
    let transportCo2 = 25; // default: public transport

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

    const fmtNum = (n) => Math.round(n).toLocaleString('id-ID');

    // Mode switch: kWh ↔ Rp
    btnModeKwh.addEventListener('click', () => {
        inputMode = 'kwh';
        btnModeKwh.className = 'px-3 py-1.5 rounded-lg bg-white text-slateDark shadow-sm transition-all';
        btnModeRp.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slateDark transition-all';
        inputKwhWrapper.classList.remove('hidden');
        inputRpWrapper.classList.add('hidden');
        calculateEnergy();
    });

    btnModeRp.addEventListener('click', () => {
        inputMode = 'rp';
        btnModeRp.className = 'px-3 py-1.5 rounded-lg bg-white text-slateDark shadow-sm transition-all';
        btnModeKwh.className = 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slateDark transition-all';
        inputRpWrapper.classList.remove('hidden');
        inputKwhWrapper.classList.add('hidden');
        calculateEnergy();
    });

    sliderKwh.addEventListener('input', (e) => {
        currentKwh = parseInt(e.target.value, 10);
        valKwh.textContent = fmtNum(currentKwh);
        sliderRp.value = Math.round(currentKwh * TARIFF_PER_KWH);
        valRp.textContent = fmtNum(sliderRp.value);
        calculateEnergy();
    });

    sliderRp.addEventListener('input', (e) => {
        const rp = parseInt(e.target.value, 10);
        valRp.textContent = fmtNum(rp);
        currentKwh = Math.round(rp / TARIFF_PER_KWH);
        sliderKwh.value = Math.min(1500, Math.max(50, currentKwh));
        valKwh.textContent = fmtNum(currentKwh);
        calculateEnergy();
    });

    sliderAc.addEventListener('input', (e) => {
        acHours = parseInt(e.target.value, 10);
        valAc.textContent = acHours;
        calculateEnergy();
    });

    transportBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            transportBtns.forEach(b => {
                b.classList.remove('border-forest', 'bg-forest-50/70');
                b.classList.add('border-stone-200', 'bg-white');
            });
            btn.classList.remove('border-stone-200', 'bg-white');
            btn.classList.add('border-forest', 'bg-forest-50/70');
            transportCo2 = parseInt(btn.dataset.co2, 10);
            calculateEnergy();
        });
    });

    chkLed.addEventListener('change', calculateEnergy);
    chkUnplug.addEventListener('change', calculateEnergy);

    function calculateEnergy() {
        let efficiencyMultiplier = 1.0;
        if (chkLed.checked) efficiencyMultiplier -= 0.08;
        if (chkUnplug.checked) efficiencyMultiplier -= 0.07;

        // Additional load from AC usage beyond 8 h/day
        const acExtraKwh = acHours > 8 ? (acHours - 8) * 18 : 0;
        const effectiveKwh = Math.round((currentKwh + acExtraKwh) * efficiencyMultiplier);

        const totalCost = effectiveKwh * TARIFF_PER_KWH;
        const electricityCo2 = effectiveKwh * EMISSION_FACTOR;
        const totalCo2 = Math.round(electricityCo2 + transportCo2);
        const treesNeeded = Math.max(1, Math.ceil(totalCo2 / 18));

        outCo2.textContent = fmtNum(totalCo2);
        outTrees.textContent = fmtNum(treesNeeded);
        outCost.textContent = fmtNum(totalCost);
        outKwhSummary.textContent = fmtNum(effectiveKwh);

        // Grade A–E based on total monthly CO₂ (kg)
        let grade, title, desc, badgeColor, titleColor;

        if (totalCo2 <= 220) {
            grade = 'A'; title = 'Sangat Efisien (Teladan SDG 12)';
            desc = 'Luar biasa! Pola konsumsi energi Anda sangat hemat dan ramah lingkungan.';
            badgeColor = 'bg-forest'; titleColor = 'text-forest-light';
        } else if (totalCo2 <= 360) {
            grade = 'B'; title = 'Efisien (Baik)';
            desc = 'Konsumsi energi Anda terkendali, namun masih ada ruang untuk penghematan.';
            badgeColor = 'bg-teal-500'; titleColor = 'text-teal-400';
        } else if (totalCo2 <= 550) {
            grade = 'C'; title = 'Moderat (Rata-Rata)';
            desc = 'Konsumsi energi cukup tinggi. Pertimbangkan mengurangi jam AC atau beralih transportasi.';
            badgeColor = 'bg-sdg12'; titleColor = 'text-sdg12-light';
        } else if (totalCo2 <= 800) {
            grade = 'D'; title = 'Boros Energi (Perlu Perbaikan)';
            desc = 'Jejak karbon dan tagihan listrik Anda tergolong tinggi. Terapkan langkah efisiensi segera.';
            badgeColor = 'bg-orange-500'; titleColor = 'text-orange-400';
        } else {
            grade = 'E'; title = 'Sangat Boros (Kritis)';
            desc = 'Konsumsi energi sangat tinggi! Audit peralatan rumah tangga dan pola perjalanan Anda.';
            badgeColor = 'bg-rose-600'; titleColor = 'text-rose-400';
        }

        gradeLetter.textContent = grade;
        gradeBadge.className = `w-16 h-16 rounded-2xl ${badgeColor} text-white flex flex-col items-center justify-center shadow-lg transition-colors duration-300`;
        gradeTitle.textContent = title;
        gradeTitle.className = `font-semibold text-sm ${titleColor}`;
        gradeDesc.textContent = desc;

        // Dynamic recommendations
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

    // Initial calculation
    calculateEnergy();

    // ============================================================
    // 6. APPLIANCE SIMULATION (Chart.js)
    // ============================================================
    const simData = {
        lamp: {
            chartTitle: 'Konsumsi Listrik Tahunan 10 Lampu (kWh/Tahun)',
            labels: ['Lampu Pijar (10 × 60W)', 'Lampu LED (10 × 9W)'],
            values: [1752, 263],
            colors: ['#94A3B8', '#059669'],
            savingBadge: 'Hemat hingga 85% Energi',
            heading: '10 Titik Lampu Rumah (Nyala 8 Jam/Hari)',
            description: 'Lampu pijar konvensional (60W) membuang sebagian besar energinya menjadi panas, bukan cahaya. Menggantinya dengan lampu LED (9W) memberikan pencahayaan setara dengan konsumsi listrik jauh lebih rendah dan umur pakai 10× lebih lama.',
            moneySaved: 'Rp 2.152.000',
            co2Saved: '1.266 kg CO₂'
        },
        ac: {
            chartTitle: 'Konsumsi Listrik Tahunan 1 Unit AC 1 PK (kWh/Tahun)',
            labels: ['AC Non-Inverter (850W)', 'AC Inverter Bintang 5 (480W rata-rata)'],
            values: [2482, 1401],
            colors: ['#94A3B8', '#BF8B2E'],
            savingBadge: 'Hemat hingga 43% Energi',
            heading: 'Penggunaan AC 1 PK Selama 8 Jam Setiap Hari',
            description: 'AC Non-Inverter menyalakan dan mematikan kompresor secara penuh berulang kali sehingga boros daya awal. Teknologi AC Inverter menyesuaikan kecepatan kompresor secara halus untuk menjaga suhu stabil dengan jauh lebih sedikit listrik.',
            moneySaved: 'Rp 1.562.000',
            co2Saved: '919 kg CO₂'
        },
        standby: {
            chartTitle: 'Beban Listrik Perangkat Elektronik Rumah (kWh/Tahun)',
            labels: ['Dibiarkan Standby 24 Jam', 'Dicabut / Matikan Saklar Stopkontak'],
            values: [525, 0],
            colors: ['#F43F5E', '#059669'],
            savingBadge: '100% Hilangkan Vampire Power',
            heading: 'Efek "Vampire Power" pada TV, Set-Top Box & Charger',
            description: 'Perangkat elektronik yang tetap tercolok dalam mode siaga tetap menyedot daya 50–70 Watt secara terus-menerus. Mematikan saklar stopkontak saat tidur menghentikan pemborosan energi tanpa biaya tambahan.',
            moneySaved: 'Rp 758.000',
            co2Saved: '446 kg CO₂'
        }
    };

    const ctx = document.getElementById('comparisonChart').getContext('2d');
    let comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: simData.lamp.labels,
            datasets: [{
                label: 'Konsumsi Listrik (kWh / Tahun)',
                data: simData.lamp.values,
                backgroundColor: simData.lamp.colors,
                borderRadius: 12,
                barThickness: 56
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toLocaleString('id-ID')} kWh / tahun`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#F1F5F9' },
                    ticks: {
                        font: { family: 'Inter', size: 12 },
                        callback: (val) => `${val} kWh`
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 } }
                }
            }
        }
    });

    const simTabs = document.querySelectorAll('.sim-tab-btn');
    simTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const key = tab.dataset.sim;
            const data = simData[key];

            simTabs.forEach(t => {
                t.className = 'sim-tab-btn px-5 py-3 rounded-xl font-semibold text-sm bg-stone-100 text-slate-600 hover:bg-stone-200 transition-all flex items-center gap-2';
            });
            tab.className = 'sim-tab-btn px-5 py-3 rounded-xl font-semibold text-sm bg-sdg12 text-white shadow-md transition-all flex items-center gap-2';

            document.getElementById('sim-chart-title').textContent = data.chartTitle;
            document.getElementById('sim-saving-badge').textContent = data.savingBadge;
            document.getElementById('sim-heading').textContent = data.heading;
            document.getElementById('sim-description').textContent = data.description;
            document.getElementById('sim-money-saved').textContent = data.moneySaved;
            document.getElementById('sim-co2-saved').textContent = data.co2Saved;

            comparisonChart.data.labels = data.labels;
            comparisonChart.data.datasets[0].data = data.values;
            comparisonChart.data.datasets[0].backgroundColor = data.colors;
            comparisonChart.update();
        });
    });

    // ============================================================
    // 7. COMMUNITY CHALLENGES FEED
    // ============================================================
    let currentChallengeFilter = 'all';

    let challengeListings = [
        {
            id: 1,
            category: 'listrik',
            title: 'Matikan AC Semalam',
            description: 'Coba tidur tanpa AC semalam dengan membuka jendela dan menggunakan kipas angin. Hemat energi mulai dari malam ini.',
            kwh: 1.2,
            co2: 1.0,
            location: 'Jabodetabek',
            time: 'Malam ini',
            joined: false
        },
        {
            id: 2,
            category: 'transportasi',
            title: 'Gunakan Sepeda/Angkutan Umum 3 Hari',
            description: 'Tantang diri Anda menggunakan sepeda atau angkutan umum selama 3 hari berturut-turut sebagai pengganti kendaraan pribadi berbahan bakar fosil.',
            kwh: 0,
            co2: 15.0,
            location: 'Nasional',
            time: 'Minggu ini',
            joined: false
        },
        {
            id: 3,
            category: 'listrik',
            title: 'Audit Lampu Rumah (Ganti ke LED)',
            description: 'Hitung berapa lampu non-LED yang masih ada di rumah Anda dan ganti dengan LED hemat energi. Satu langkah nyata menuju SDG 12.8.',
            kwh: 8.0,
            co2: 6.8,
            location: 'Semua Wilayah',
            time: 'Bulan ini',
            joined: false
        },
        {
            id: 4,
            category: 'terbarukan',
            title: 'Pasang Panel Surya Komunitas RT/RW',
            description: 'Inisiasi pengadaan panel surya bersama untuk dipasang di atap balai RT/RW atau fasilitas umum setempat.',
            kwh: 180.0,
            co2: 153.0,
            location: 'Bandung',
            time: 'Kuartal ini',
            joined: false
        },
        {
            id: 5,
            category: 'listrik',
            title: 'Cabut Semua Perangkat Standby Malam Ini',
            description: 'Sebelum tidur, cabut semua colokan TV, set-top box, charger, dan microwave untuk menghilangkan 100% beban vampire power.',
            kwh: 0.4,
            co2: 0.3,
            location: 'Nasional',
            time: 'Malam ini',
            joined: false
        },
        {
            id: 6,
            category: 'listrik',
            title: 'Cuci Pakaian Full Load + Jemur Alami',
            description: 'Kumpulkan cucian hingga penuh kapasitas mesin cuci lalu jemur di bawah sinar matahari — tidak menggunakan pengering listrik.',
            kwh: 0.9,
            co2: 0.8,
            location: 'Semua Wilayah',
            time: 'Hari ini',
            joined: false
        }
    ];

    function getCategoryStyle(category) {
        const styles = {
            listrik: {
                badgeClass: 'bg-sdg12-50 text-sdg12-dark border-sdg12/25',
                iconName: 'zap',
                iconColor: 'text-sdg12',
                label: 'Hemat Listrik · SDG 12.8',
                borderHover: 'hover:border-sdg12',
                btnClass: 'bg-sdg12 hover:bg-sdg12-dark text-white'
            },
            transportasi: {
                badgeClass: 'bg-forest-50 text-forest-dark border-forest/25',
                iconName: 'bike',
                iconColor: 'text-forest',
                label: 'Transportasi Bersih · SDG 12.c',
                borderHover: 'hover:border-forest',
                btnClass: 'bg-forest hover:bg-forest-dark text-white'
            },
            terbarukan: {
                badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
                iconName: 'sun',
                iconColor: 'text-amber-500',
                label: 'Energi Terbarukan · SDG 12.2',
                borderHover: 'hover:border-amber-400',
                btnClass: 'bg-amber-500 hover:bg-amber-600 text-white'
            }
        };
        return styles[category] || styles.listrik;
    }

    function renderChallenges() {
        const grid = document.getElementById('challenge-feed-grid');

        const totalAll = challengeListings.length;
        const totalListrik = challengeListings.filter(c => c.category === 'listrik').length;
        const totalTransportasi = challengeListings.filter(c => c.category === 'transportasi').length;
        const totalTerbarukan = challengeListings.filter(c => c.category === 'terbarukan').length;

        document.getElementById('count-all-chal').textContent = totalAll;
        document.getElementById('count-listrik').textContent = totalListrik;
        document.getElementById('count-transportasi').textContent = totalTransportasi;
        document.getElementById('count-terbarukan').textContent = totalTerbarukan;
        document.getElementById('nav-komunitas-badge').textContent = challengeListings.filter(c => !c.joined).length;

        const filtered = currentChallengeFilter === 'all'
            ? challengeListings
            : challengeListings.filter(c => c.category === currentChallengeFilter);

        grid.innerHTML = filtered.map(item => {
            const s = getCategoryStyle(item.category);
            const kwhLabel = item.kwh > 0 ? `${item.kwh} kWh dihemat` : `${item.co2} kg CO₂e dicegah`;
            const btnLabel = item.joined ? 'Sudah Diikuti ✓' : 'Ambil Tantangan (+20 Poin)';
            const btnDisabled = item.joined ? 'disabled' : '';
            const btnCls = item.joined ? 'bg-stone-200 text-slate-500 cursor-default' : s.btnClass;

            return `
                <article class="animate-card rounded-3xl bg-white border border-stone-200/90 p-6 flex flex-col justify-between ${s.borderHover} transition-all hover:shadow-lg ${item.joined ? 'opacity-80' : ''}">
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
                            <button type="button" onclick="joinChallenge(${item.id})" ${btnDisabled} class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-sm ${btnCls}">
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

    // Join challenge action (global scope for onclick)
    window.joinChallenge = function(id) {
        const item = challengeListings.find(c => c.id === id);
        if (!item || item.joined) return;

        item.joined = true;
        userScore += 20;
        tickerKwh = Math.round(tickerKwh + item.kwh);
        tickerCo2 = Math.round(tickerCo2 + (item.co2 > 0 ? item.co2 : item.kwh * 0.85));
        updateTicker();
        updateGlobalScore();
        renderChallenges();
        showToast(`Tantangan "${item.title}" diambil! +20 Poin SDG 12.`, 'challenge');
    };

    // Filter buttons
    document.querySelectorAll('.chal-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentChallengeFilter = btn.dataset.filter;
            document.querySelectorAll('.chal-filter-btn').forEach(b => {
                b.className = 'chal-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slateDark transition-all flex items-center gap-1.5';
            });
            btn.className = 'chal-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slateDark text-white shadow-sm transition-all flex items-center gap-1.5';
            renderChallenges();
        });
    });

    // Initial render
    renderChallenges();

    // ============================================================
    // 8. POST CHALLENGE MODAL
    // ============================================================
    const challengeModal = document.getElementById('challenge-modal');
    const openChallengeModalBtn = document.getElementById('open-challenge-modal-btn');
    const closeChallengeModalBtn = document.getElementById('close-challenge-modal-btn');
    const cancelChallengeBtn = document.getElementById('cancel-challenge-btn');
    const challengeModalBackdrop = document.getElementById('challenge-modal-backdrop');
    const postChallengeForm = document.getElementById('post-challenge-form');

    function openChallengeModal() {
        challengeModal.classList.remove('hidden');
    }

    function closeChallengeModal() {
        challengeModal.classList.add('hidden');
    }

    openChallengeModalBtn.addEventListener('click', openChallengeModal);
    closeChallengeModalBtn.addEventListener('click', closeChallengeModal);
    cancelChallengeBtn.addEventListener('click', closeChallengeModal);
    challengeModalBackdrop.addEventListener('click', closeChallengeModal);

    postChallengeForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('chal-title').value.trim();
        const category = document.getElementById('chal-category').value;
        const kwh = parseFloat(document.getElementById('chal-kwh').value) || 1.0;
        const location = document.getElementById('chal-location').value.trim();
        const desc = document.getElementById('chal-desc').value.trim();

        const co2Estimate = parseFloat((kwh * 0.85).toFixed(1));

        const newChallenge = {
            id: Date.now(),
            category,
            title,
            description: desc,
            kwh,
            co2: co2Estimate,
            location,
            time: 'Baru saja',
            joined: false
        };

        challengeListings.unshift(newChallenge);
        userScore += 30;
        tickerKwh = Math.round(tickerKwh + kwh);
        tickerCo2 = Math.round(tickerCo2 + co2Estimate);
        updateTicker();
        updateGlobalScore();
        renderChallenges();
        closeChallengeModal();
        postChallengeForm.reset();
        showToast(`Tantangan "${title}" berhasil dipublikasikan! +30 Poin.`, 'success');
    });

    // ============================================================
    // 9. DAILY CHECKLIST PLEDGES
    // ============================================================
    const pledgeCheckboxes = document.querySelectorAll('.pledge-chk');
    const pledgePointsEl = document.getElementById('pledge-points');
    const pledgeProgressBar = document.getElementById('pledge-progress-bar');
    const pledgeRankTitle = document.getElementById('pledge-rank-title');
    const pledgeFeedback = document.getElementById('pledge-feedback');
    const badgeIconBox = document.getElementById('badge-icon-box');
    const resetPledgesBtn = document.getElementById('reset-pledges-btn');

    function updatePledgeProgress() {
        let pts = 0;
        pledgeCheckboxes.forEach(chk => {
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

        pledgePointsEl.textContent = pts;
        pledgeProgressBar.style.width = `${pts}%`;

        if (pts === 0) {
            pledgeRankTitle.textContent = 'Pemula Sadar Energi 🌱';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-sdg12-50 border border-sdg12/30 text-sdg12 flex items-center justify-center shrink-0';
            pledgeFeedback.innerHTML = 'Pilih aksi di bawah ini untuk mulai berkontribusi pada pengurangan beban puncak listrik nasional.';
        } else if (pts < 50) {
            pledgeRankTitle.textContent = 'Penggerak Efisiensi ⚡';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-forest-50 border border-forest/30 text-forest flex items-center justify-center shrink-0';
            pledgeFeedback.textContent = 'Langkah awal yang bagus! Teruskan kebiasaan baik ini setiap hari.';
        } else if (pts < 100) {
            pledgeRankTitle.textContent = 'Pejuang Transisi Energi 🌍';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-sdg12 text-white flex items-center justify-center shrink-0 shadow-md';
            pledgeFeedback.textContent = 'Hebat! Anda sudah menerapkan mayoritas prinsip konsumsi energi bertanggung jawab SDG 12.';
        } else {
            pledgeRankTitle.textContent = 'Duta Utama SDG 12 Energi 🏆';
            badgeIconBox.className = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-sdg12 to-forest text-white flex items-center justify-center shrink-0 shadow-lg';
            pledgeFeedback.innerHTML = '<strong>100/100 Poin Terkumpul!</strong> Anda adalah teladan konsumsi energi bersih dan berkelanjutan.';
        }

        lucide.createIcons();
    }

    pledgeCheckboxes.forEach(chk => {
        chk.addEventListener('change', (e) => {
            const delta = parseInt(chk.dataset.pts, 10);
            if (e.target.checked) {
                userScore += delta;
                showToast(`Aksi selesai! +${delta} Poin SDG 12 dikreditkan.`, 'success');
            } else {
                userScore = Math.max(0, userScore - delta);
            }
            updateGlobalScore();
            updatePledgeProgress();
        });
    });

    resetPledgesBtn.addEventListener('click', () => {
        pledgeCheckboxes.forEach(chk => { chk.checked = false; });
        updatePledgeProgress();
    });

    // ============================================================
    // 10. TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        let bgClass;
        let iconName;
        if (type === 'challenge') {
            bgClass = 'bg-sdg12 text-white';
            iconName = 'zap';
        } else if (type === 'energy') {
            bgClass = 'bg-sdg12 text-white';
            iconName = 'zap';
        } else {
            bgClass = 'bg-forest text-white';
            iconName = 'check-circle-2';
        }

        toast.className = `${bgClass} px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 pointer-events-auto animate-card max-w-sm`;
        toast.innerHTML = `
            <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

});

// ============================================================
// COMPETITION ADDITIONS: Impact Dashboard + Animated KPIs
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // ---- Animated KPI counters on scroll ----
    const kpiTargets = {
        'kpi-kwh-saved':      { target: 3890,  suffix: '',  decimals: 0 },
        'kpi-co2-prevented':  { target: 6412,  suffix: '',  decimals: 0 },
        'kpi-households':     { target: 1248,  suffix: '',  decimals: 0 },
        'kpi-rp-saved':       { target: 562,   suffix: '',  decimals: 0 },
    };

    let kpiAnimated = false;

    function animateKPI(id, target, decimals) {
        const el = document.getElementById(id);
        if (!el) return;
        const duration = 1800;
        const start = performance.now();
        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * target;
            el.textContent = decimals > 0
                ? current.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                : Math.round(current).toLocaleString('id-ID');
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

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
            // Animate impact bars
            setTimeout(() => {
                const barListrik = document.getElementById('bar-listrik');
                const barTransportasi = document.getElementById('bar-transportasi');
                const barTerbarukan = document.getElementById('bar-terbarukan');
                if (barListrik) barListrik.style.width = '62%';
                if (barTransportasi) barTransportasi.style.width = '25%';
                if (barTerbarukan) barTerbarukan.style.width = '13%';
            }, 300);
        }
    }

    window.addEventListener('scroll', triggerKPIAnimation, { passive: true });
    triggerKPIAnimation(); // Run on load in case section is already visible

    // ---- Sync KPI counters with live ticker values ----
    // Every time the ticker increments (from the main DOMContentLoaded block),
    // also update the KPI dashboard cards to stay in sync
    function syncKPIWithTicker() {
        const tickerKwhEl = document.getElementById('ticker-kwh');
        const tickerCo2El = document.getElementById('ticker-co2');
        const tickerHouseholdsEl = document.getElementById('ticker-households');
        const kpiKwhEl = document.getElementById('kpi-kwh-saved');
        const kpiCo2El = document.getElementById('kpi-co2-prevented');
        const kpiHouseholdsEl = document.getElementById('kpi-households');
        const kpiRpEl = document.getElementById('kpi-rp-saved');

        if (!kpiAnimated) return; // Only sync after initial animation

        if (tickerKwhEl && kpiKwhEl) {
            kpiKwhEl.textContent = tickerKwhEl.textContent;
        }
        if (tickerCo2El && kpiCo2El) {
            kpiCo2El.textContent = tickerCo2El.textContent;
        }
        if (tickerHouseholdsEl && kpiHouseholdsEl) {
            kpiHouseholdsEl.textContent = tickerHouseholdsEl.textContent;
        }
        // Rp saved = kWh * 1445 / 1,000,000 Juta Rp
        if (tickerKwhEl && kpiRpEl) {
            const kwh = parseInt(tickerKwhEl.textContent.replace(/\./g, '').replace(/,/g, ''), 10) || 3890;
            const jutaRp = Math.round((kwh * 1445) / 1000000);
            kpiRpEl.textContent = jutaRp.toLocaleString('id-ID');
        }
    }

    // Poll every 5 seconds to stay in sync with the ticker
    setInterval(syncKPIWithTicker, 5000);

    // ---- Update impact bars dynamically when challenges are joined ----
    // Listen for DOM mutations in the challenge feed to recalculate bar widths
    const challengeFeedGrid = document.getElementById('challenge-feed-grid');
    if (challengeFeedGrid) {
        const observer = new MutationObserver(() => {
            if (!kpiAnimated) return;
            // Recalculate bar percentages based on joined challenges (approximate)
            const totalJoined = document.querySelectorAll('[onclick^="joinChallenge"]').length;
            const listrikBar = document.getElementById('bar-listrik');
            const transportasiBar = document.getElementById('bar-transportasi');
            const terbarukannBar = document.getElementById('bar-terbarukan');
            if (listrikBar) listrikBar.style.width = '62%';
            if (transportasiBar) transportasiBar.style.width = '25%';
            if (terbarukannBar) terbarukannBar.style.width = '13%';
        });
        observer.observe(challengeFeedGrid, { childList: true, subtree: false });
    }

    // ---- Keyboard accessibility: ESC closes challenge modal ----
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('challenge-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        }
    });

    // ---- Focus trap in challenge modal ----
    const challengeModal = document.getElementById('challenge-modal');
    if (challengeModal) {
        challengeModal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusable = challengeModal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
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

    // ---- Smooth entrance animations using IntersectionObserver ----
    const animateOnScrollEls = document.querySelectorAll('#urgensi .rounded-3xl, #inovasi .rounded-3xl, #dampak .rounded-3xl');
    const entranceObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entranceObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    animateOnScrollEls.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        entranceObserver.observe(el);
    });

});
