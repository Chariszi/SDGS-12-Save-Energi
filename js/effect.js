(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const style = document.createElement('style');
    style.textContent = `
        .spotlight { position: relative; overflow: hidden; }
        .spotlight::after {
            content: ''; position: absolute; inset: 0; border-radius: inherit;
            background: radial-gradient(260px circle at var(--x, 50%) var(--y, 50%),
                        rgba(5, 150, 105, .14), transparent 70%);
            opacity: 0; transition: opacity .25s; pointer-events: none;
        }
        .spotlight:hover::after { opacity: 1; }
        header nav a[aria-current="location"] { background: #1E293B; color: #fff; }
        a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
            outline: 3px solid #047857; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
            html { scroll-behavior: auto !important; }
            .animate-ping, .animate-pulse, .animate-card { animation: none !important; }
            .animate-card { opacity: 1; }
        }`;
    document.head.appendChild(style);

    const cards = document.querySelectorAll('#edukasi .grid > div, #inovasi .grid > div');

    // 1. SpotlightCard
    cards.forEach((card) => {
        card.classList.add('spotlight');
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--x', `${e.clientX - r.left}px`);
            card.style.setProperty('--y', `${e.clientY - r.top}px`);
        });
    });

    if (!('IntersectionObserver' in window)) return;

    // 2. AnimatedContent (muncul saat di-scroll)
    if (!reduce && Element.prototype.animate) {
        const pending = new Map();
        const reveal = new IntersectionObserver((entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (!isIntersecting) return;
                pending.get(target).play();
                reveal.unobserve(target);
            });
        }, { threshold: 0.15 });

        cards.forEach((card, i) => {
            const anim = card.animate(
                [{ opacity: 0, transform: 'translateY(20px)' },
                 { opacity: 1, transform: 'translateY(0)' }],
                { duration: 500, delay: (i % 5) * 80, easing: 'ease-out', fill: 'backwards' }
            );
            anim.pause();
            pending.set(card, anim);
            reveal.observe(card);
        });
    }

    // 3. PillNav (menu aktif mengikuti posisi scroll)
    const links = document.querySelectorAll('header nav a[href^="#"]');
    const spy = new IntersectionObserver((entries) => {
        entries.forEach(({ isIntersecting, target }) => {
            if (!isIntersecting) return;
            links.forEach((a) => {
                if (a.getAttribute('href') === `#${target.id}`) {
                    a.setAttribute('aria-current', 'location');
                } else {
                    a.removeAttribute('aria-current');
                }
            });
        });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('section[id]').forEach((s) => spy.observe(s));
})();