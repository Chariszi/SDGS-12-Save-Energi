 /**
 * main.js
 * Entry point — inisialisasi semua modul setelah DOM siap.
 *
 * Urutan loading (via <script> tag di index.html):
 *   1. toast.js      — harus pertama (dipakai modul lain)
 *   2. ticker.js     — live impact counter
 *   3. nav.js        — mobile menu toggle + profil sesi
 *   4. score.js      — user score state
 *   5. simulation.js — simulasi perbandingan peralatan (Chart.js)
 *   6. challenges.js — papan tantangan komunitas
 *   7. dashboard.js  — KPI dashboard & animasi
 *   8. main.js       — init Lucide icons (file ini)
 *
 * calculator.js & checklist.js sudah pindah ke calculator.html.
 *
 * Catatan: Semua modul sudah membungkus kode dalam IIFE atau
 * meregistrasi handler sendiri saat di-load. Main.js hanya
 * bertanggung jawab menginisialisasi library pihak ketiga
 * yang belum di-init di modul masing-masing.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi semua ikon Lucide yang ada di halaman
    lucide.createIcons();
});
