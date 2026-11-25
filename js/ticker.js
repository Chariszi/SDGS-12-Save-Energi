/**
 * ticker.js
 * Live impact ticker — counter kWh, CO₂, dan jumlah rumah tangga
 * yang terus bertambah secara acak setiap beberapa detik.
 *
 * Nilai ticker diekspos via window.ticker agar modul lain bisa
 * membacanya atau menambahkan nilai ketika user ambil tantangan.
 */

window.ticker = {
    kwh:        3890,
    co2:        6412,
    households: 1248,
};

function updateTickerDOM() {
    document.getElementById('ticker-kwh').textContent        = window.ticker.kwh.toLocaleString('id-ID');
    document.getElementById('ticker-co2').textContent        = window.ticker.co2.toLocaleString('id-ID');
    document.getElementById('ticker-households').textContent = window.ticker.households.toLocaleString('id-ID');
}

function incrementTicker() {
    window.ticker.kwh += Math.floor(Math.random() * 5) + 1;
    window.ticker.co2 += Math.floor(Math.random() * 4) + 1;
    if (Math.random() > 0.6) window.ticker.households += 1;

    updateTickerDOM();

    // Jadwal increment berikutnya: acak antara 4–6 detik
    const nextDelay = 4000 + Math.floor(Math.random() * 2000);
    setTimeout(incrementTicker, nextDelay);
}

// Init
updateTickerDOM();
setTimeout(incrementTicker, 4000 + Math.floor(Math.random() * 2000));
