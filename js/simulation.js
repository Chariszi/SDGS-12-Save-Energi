/**
 * simulation.js
 * Simulasi perbandingan peralatan rumah tangga menggunakan Chart.js.
 *
 * Skenario yang tersedia:
 *  - lamp    : Lampu Pijar vs LED
 *  - ac      : AC Non-Inverter vs Inverter
 *  - standby : Standby Power vs Cabut Daya
 */

(function () {
    // ── Data per skenario ──────────────────────────────────────
    const simData = {
        lamp: {
            chartTitle:   'Konsumsi Listrik Tahunan 10 Lampu (kWh/Tahun)',
            labels:       ['Lampu Pijar (10 × 60W)', 'Lampu LED (10 × 9W)'],
            values:       [1752, 263],
            colors:       ['#94A3B8', '#059669'],
            savingBadge:  'Hemat hingga 85% Energi',
            heading:      '10 Titik Lampu Rumah (Nyala 8 Jam/Hari)',
            description:  'Lampu pijar konvensional (60W) membuang sebagian besar energinya menjadi panas, bukan cahaya. '
                        + 'Menggantinya dengan lampu LED (9W) memberikan pencahayaan setara dengan konsumsi listrik jauh '
                        + 'lebih rendah dan umur pakai 10× lebih lama.',
            moneySaved:   'Rp 2.152.000',
            co2Saved:     '1.266 kg CO₂',
        },
        ac: {
            chartTitle:   'Konsumsi Listrik Tahunan 1 Unit AC 1 PK (kWh/Tahun)',
            labels:       ['AC Non-Inverter (850W)', 'AC Inverter Bintang 5 (480W rata-rata)'],
            values:       [2482, 1401],
            colors:       ['#94A3B8', '#BF8B2E'],
            savingBadge:  'Hemat hingga 43% Energi',
            heading:      'Penggunaan AC 1 PK Selama 8 Jam Setiap Hari',
            description:  'AC Non-Inverter menyalakan dan mematikan kompresor secara penuh berulang kali sehingga boros '
                        + 'daya awal. Teknologi AC Inverter menyesuaikan kecepatan kompresor secara halus untuk menjaga '
                        + 'suhu stabil dengan jauh lebih sedikit listrik.',
            moneySaved:   'Rp 1.562.000',
            co2Saved:     '919 kg CO₂',
        },
        standby: {
            chartTitle:   'Beban Listrik Perangkat Elektronik Rumah (kWh/Tahun)',
            labels:       ['Dibiarkan Standby 24 Jam', 'Dicabut / Matikan Saklar Stopkontak'],
            values:       [525, 0],
            colors:       ['#F43F5E', '#059669'],
            savingBadge:  '100% Hilangkan Vampire Power',
            heading:      'Efek "Vampire Power" pada TV, Set-Top Box & Charger',
            description:  'Perangkat elektronik yang tetap tercolok dalam mode siaga tetap menyedot daya 50–70 Watt '
                        + 'secara terus-menerus. Mematikan saklar stopkontak saat tidur menghentikan pemborosan energi '
                        + 'tanpa biaya tambahan.',
            moneySaved:   'Rp 758.000',
            co2Saved:     '446 kg CO₂',
        },
    };

    // ── Inisialisasi Chart.js ──────────────────────────────────
    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const initialData = simData.lamp;

    const comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: initialData.labels,
            datasets: [{
                label:           'Konsumsi Listrik (kWh / Tahun)',
                data:            initialData.values,
                backgroundColor: initialData.colors,
                borderRadius:    12,
                barThickness:    56,
            }],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    padding:         12,
                    cornerRadius:    10,
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toLocaleString('id-ID')} kWh / tahun`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid:  { color: '#F1F5F9' },
                    ticks: {
                        font:     { family: 'Inter', size: 12 },
                        callback: (val) => `${val} kWh`,
                    },
                },
                x: {
                    grid:  { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 } },
                },
            },
        },
    });

    // ── Tab skenario ───────────────────────────────────────────
    document.querySelectorAll('.sim-tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const key  = tab.dataset.sim;
            const data = simData[key];

            // Reset semua tab ke gaya non-aktif
            document.querySelectorAll('.sim-tab-btn').forEach(t => {
                t.className = 'sim-tab-btn px-5 py-3 rounded-xl font-semibold text-sm bg-stone-100 text-slate-600 hover:bg-stone-200 transition-all flex items-center gap-2';
            });
            // Aktifkan tab yang dipilih
            tab.className = 'sim-tab-btn px-5 py-3 rounded-xl font-semibold text-sm bg-sdg12 text-white shadow-md transition-all flex items-center gap-2';

            // Update teks deskripsi
            document.getElementById('sim-chart-title').textContent  = data.chartTitle;
            document.getElementById('sim-saving-badge').textContent = data.savingBadge;
            document.getElementById('sim-heading').textContent      = data.heading;
            document.getElementById('sim-description').textContent  = data.description;
            document.getElementById('sim-money-saved').textContent  = data.moneySaved;
            document.getElementById('sim-co2-saved').textContent    = data.co2Saved;

            // Update chart
            comparisonChart.data.labels                          = data.labels;
            comparisonChart.data.datasets[0].data               = data.values;
            comparisonChart.data.datasets[0].backgroundColor    = data.colors;
            comparisonChart.update();
        });
    });
})();
