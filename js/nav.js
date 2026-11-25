/**
 * nav.js
 * Navigasi mobile — toggle buka/tutup dropdown menu, ikon, & aksesibilitas.
 */

(function () {
    const header     = document.getElementById('site-header');
    const menuBtn    = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconOpen   = document.getElementById('mobile-menu-icon-open');
    const iconClose  = document.getElementById('mobile-menu-icon-close');

    if (!menuBtn || !mobileMenu) return;

    function setMenuState(isOpen) {
        mobileMenu.classList.toggle('hidden', !isOpen);
        menuBtn.setAttribute('aria-expanded', String(isOpen));
        menuBtn.setAttribute('aria-label', isOpen ? 'Tutup Menu' : 'Buka Menu');

        if (iconOpen && iconClose) {
            iconOpen.classList.toggle('hidden', isOpen);
            iconClose.classList.toggle('hidden', !isOpen);
        }
    }

    // Toggle buka/tutup saat tombol hamburger diklik
    menuBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = mobileMenu.classList.contains('hidden');
        setMenuState(isOpen);
    });

    // Tutup otomatis saat salah satu link di menu diklik
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setMenuState(false));
    });

    // Tutup saat klik di luar header/menu
    document.addEventListener('click', (event) => {
        if (mobileMenu.classList.contains('hidden')) return;
        if (header && !header.contains(event.target)) {
            setMenuState(false);
        }
    });

    // Tutup saat tombol Escape ditekan
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
            setMenuState(false);
            menuBtn.focus();
        }
    });
})();
