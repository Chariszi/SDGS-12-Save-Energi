/**
 * score.js
 * State & tampilan skor poin SDG 12 pengguna.
 *
 * Skor diekspos via window.userScore dan window.updateGlobalScore()
 * agar bisa diakses modul lain (calculator, challenges, checklist).
 */

window.userScore = 0;

window.updateGlobalScore = function () {
    const desktopDisplay = document.getElementById('user-score-display');
    const mobileDisplay  = document.getElementById('mobile-user-score');

    if (desktopDisplay) desktopDisplay.textContent = `${window.userScore} Poin`;
    if (mobileDisplay)  mobileDisplay.textContent  = `${window.userScore} Poin`;
};

// Tampilkan nilai awal (0 Poin) saat halaman dimuat
window.updateGlobalScore();
