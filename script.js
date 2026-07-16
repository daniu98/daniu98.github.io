document.getElementById('year').textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cards = document.querySelectorAll('.project-card, .timeline-item, .stat-card, .panel, .profile-card');

if (!reduceMotion && cards.length) {
  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });

  const revealed = new WeakSet();
  const reveal = (card) => {
    if (revealed.has(card)) return;
    revealed.add(card);
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
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

// cursor-reactive spotlight — only for devices with a real mouse
const glow = document.querySelector('.cursor-glow');
if (glow) {
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      glow.style.setProperty('--x', e.clientX + 'px');
      glow.style.setProperty('--y', e.clientY + 'px');
    }, { passive: true });
  } else {
    glow.remove();
  }
}
