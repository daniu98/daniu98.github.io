document.getElementById('year').textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cards = document.querySelectorAll('.project-card, .timeline-item, .panel, .profile-card');

if (!reduceMotion && cards.length) {
  cards.forEach(card => card.classList.add('reveal-init'));

  const revealed = new WeakSet();
  const reveal = (card) => {
    if (revealed.has(card)) return;
    revealed.add(card);
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
    // Drop the 0.5s reveal transition once settled, so any later
    // cursor-driven transform (tilt) tracks the pointer at full speed
    // instead of inheriting this slow easing. Only ever removes the
    // class — never touches opacity/transform, since by the time this
    // fires the tilt effect may already own those values and clearing
    // them here would wipe out an in-progress tilt.
    const cleanup = (e) => {
      if (e.target !== card) return;
      card.removeEventListener('transitionend', cleanup);
      card.classList.remove('reveal-init');
    };
    card.addEventListener('transitionend', cleanup);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 100px 0px' });
    cards.forEach(card => observer.observe(card));
  } else {
    cards.forEach(reveal);
  }

  // Safety net: IntersectionObserver can miss a crossing during a fast or
  // programmatic scroll. Anything already on/near screen must never stay
  // stuck invisible, so double-check on every scroll/resize.
  const revealStragglers = () => {
    cards.forEach(card => {
      if (revealed.has(card)) return;
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight + 50) reveal(card);
    });
  };
  window.addEventListener('scroll', revealStragglers, { passive: true });
  window.addEventListener('resize', revealStragglers);
  revealStragglers();
}

const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

// cursor-reactive spotlight — only for devices with a real mouse
const glow = document.querySelector('.cursor-glow');
if (glow) {
  if (!reduceMotion && hasFinePointer) {
    window.addEventListener('pointermove', (e) => {
      glow.style.setProperty('--x', e.clientX + 'px');
      glow.style.setProperty('--y', e.clientY + 'px');
    }, { passive: true });
  } else {
    glow.remove();
  }
}

// cursor-reactive tilt + glare on cards
if (!reduceMotion && hasFinePointer) {
  const tiltCards = document.querySelectorAll('.project-card, .timeline-card, .panel, .profile-card');
  tiltCards.forEach(card => {
    card.classList.add('tilt-card');

    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      const rotateY = (px - 0.5) * 8;
      const rotateX = (0.5 - py) * 8;
      card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    });

    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}
