/**
 * nav.js
 * Navigasi mobile — toggle buka/tutup dropdown menu, ikon, & aksesibilitas.
 */

(function () {
    const header     = document.getElementById('site-header');
    const floatingBar = document.getElementById('floating-nav-bar');
    const menuBtn    = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconOpen   = document.getElementById('mobile-menu-icon-open');
    const iconClose  = document.getElementById('mobile-menu-icon-close');

    // Elevasi glassmorphism halus saat halaman di-scroll
    if (floatingBar) {
        const updateScrollGlass = () => {
            const scrolled = window.scrollY > 24;
            floatingBar.classList.toggle('bg-white/90', scrolled);
            floatingBar.classList.toggle('bg-white/75', !scrolled);
            floatingBar.classList.toggle('shadow-[0_12px_36px_rgba(15,23,42,0.12)]', scrolled);
            floatingBar.classList.toggle('shadow-[0_8px_30px_rgba(15,23,42,0.08)]', !scrolled);
        };
        window.addEventListener('scroll', updateScrollGlass, { passive: true });
        updateScrollGlass();
    }

    // Sinkronkan nama, inisial avatar, email & aksi keluar
    const profile = typeof window.getHouseholdProfile === 'function'
        ? window.getHouseholdProfile()
        : { id: null, displayName: 'Tamu Hemat Energi', email: '' };

    const navUserAvatar = document.getElementById('nav-user-avatar');
    const navUserName = document.getElementById('nav-user-name');
    const navUserEmail = document.getElementById('nav-user-email');
    const mobileUserName = document.getElementById('mobile-user-name');
    const mobileUserEmail = document.getElementById('mobile-user-email');

    const initial = (profile.displayName || 'T').trim().charAt(0).toUpperCase() || 'T';
    if (navUserAvatar) navUserAvatar.textContent = initial;
    if (navUserName) navUserName.textContent = profile.displayName;
    if (navUserEmail) navUserEmail.textContent = profile.email || 'Sesi aktif';
    if (mobileUserName) mobileUserName.textContent = profile.displayName;
    if (mobileUserEmail) mobileUserEmail.textContent = profile.email || 'Skor SDG 12 Saya';

    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const handleLogout = () => {
        if (typeof window.logoutHousehold === 'function') {
            window.logoutHousehold();
        } else {
            window.location.href = './login.html';
        }
    };
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

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
