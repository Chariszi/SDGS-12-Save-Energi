/**
 * toast.js
 * Modul notifikasi toast popup.
 * Dipakai oleh modul lain via window.showToast().
 */

window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    let bgClass, iconName;

    if (type === 'challenge') {
        bgClass   = 'bg-sdg12 text-white';
        iconName  = 'zap';
    } else if (type === 'energy') {
        bgClass   = 'bg-sdg12 text-white';
        iconName  = 'zap';
    } else {
        bgClass   = 'bg-forest text-white';
        iconName  = 'check-circle-2';
    }

    toast.className = [
        bgClass,
        'px-4 py-3 rounded-2xl shadow-xl',
        'text-xs sm:text-sm font-semibold',
        'flex items-center gap-2.5',
        'pointer-events-auto animate-card max-w-sm',
    ].join(' ');

    toast.innerHTML = `
        <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Auto-dismiss setelah 3,5 detik
    setTimeout(() => {
        toast.style.opacity    = '0';
        toast.style.transform  = 'translateY(8px)';
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};
