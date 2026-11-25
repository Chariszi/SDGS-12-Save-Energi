/**
 * nav.js
 * Navigasi mobile — toggle buka/tutup dropdown menu.
 */

(function () {
    const menuBtn  = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (!menuBtn || !mobileMenu) return;

    // Toggle buka/tutup saat tombol hamburger diklik
    menuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // Tutup otomatis saat salah satu link di menu diklik
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });
})();
