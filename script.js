document.getElementById('year').textContent = new Date().getFullYear();

// Some browsers restore the previous scroll position on reopen/back-forward
// navigation (session restore, bfcache) even with history.scrollRestoration
// set to 'manual' in the head — that only prevents restoration on reload.
// Force back to the top on any load that isn't targeting a specific anchor.
if (!location.hash) window.scrollTo(0, 0);
window.addEventListener('pageshow', () => {
  if (!location.hash) window.scrollTo(0, 0);
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

// ---- light / dark theme toggle ----
// The <head> inline script already set data-theme before first paint (no
// flash); this just wires up the button and persistence. Which of the two
// icons (sun/moon) is visible is handled declaratively by CSS off the
// data-theme attribute, so there's no icon state to manage here.
{
  const THEME_KEY = 'portfolio-theme';
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
      document.dispatchEvent(new CustomEvent('themechange'));
    });
  }
}

// ---- scroll-triggered reveal, staggered per group ----
// .photo-grid (static gallery) cards get reveal treatment; .marquee-track
// (sliding preview) cards don't, since they're already moving continuously.
const cards = document.querySelectorAll('.project-card, .timeline-item, .panel, .profile-card, .pillar-card, .photo-grid .photo-card');

if (!reduceMotion && cards.length) {
  cards.forEach(card => {
    card.classList.add('reveal-init');
    const idx = Array.prototype.indexOf.call(card.parentElement.children, card);
    card.style.setProperty('--reveal-delay', `${Math.min(idx * 70, 280)}ms`);
  });

  const revealed = new WeakSet();
  const reveal = (card) => {
    if (revealed.has(card)) return;
    revealed.add(card);
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
    // Drop the reveal transition once settled, so any later cursor-driven
    // transform (tilt) tracks the pointer at full speed instead of
    // inheriting this slower easing. Only ever removes the class — never
    // touches opacity/transform, since by the time this fires the tilt
    // effect may already own those values and clearing them here would
    // wipe out an in-progress tilt.
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

  // Safety net: IntersectionObserver callbacks can be coalesced or skipped
  // entirely when a smooth-scroll animation gets repeatedly interrupted and
  // retargeted (e.g. a user clicking through nav links faster than the
  // scroll animation settles) — 'scroll' events alone aren't reliable
  // enough to catch every case either. Once scroll activity starts, poll
  // every frame via rAF (doesn't depend on any particular event actually
  // delivering) until everything is revealed, then stop — so there's zero
  // ongoing cost while the page is idle, but nothing can stay stuck
  // invisible once the user starts interacting.
  let polling = false;
  const pollStragglers = () => {
    let allRevealed = true;
    cards.forEach(card => {
      if (revealed.has(card)) return;
      const rect = card.getBoundingClientRect();
      if (rect.bottom > -50 && rect.top < window.innerHeight + 50) {
        reveal(card);
      } else {
        allRevealed = false;
      }
    });
    if (!allRevealed) {
      requestAnimationFrame(pollStragglers);
    } else {
      polling = false;
    }
  };
  const kickPoll = () => {
    if (!polling) {
      polling = true;
      requestAnimationFrame(pollStragglers);
    }
  };
  // 'scroll' events can themselves be coalesced away by the browser during
  // a rapidly-retargeted smooth-scroll animation, so don't rely on that
  // alone — also kick the poll from the actual interactions that trigger
  // programmatic scrolling (nav clicks) and from wheel/touch input.
  window.addEventListener('scroll', kickPoll, { passive: true });
  window.addEventListener('resize', kickPoll);
  window.addEventListener('wheel', kickPoll, { passive: true });
  window.addEventListener('touchmove', kickPoll, { passive: true });
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', kickPoll));
  kickPoll();
}

// ---- scroll progress bar ----
{
  const progressBar = document.querySelector('.scroll-progress-bar');
  if (progressBar) {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 0;
      progressBar.style.setProperty('--progress', progress.toFixed(4));
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
  }
}

// ---- scroll-spy nav highlighting ----
{
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    const linkFor = (id) => document.querySelector(`.nav-links a[href="#${id}"]`);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const link = linkFor(entry.target.id);
        if (!link) return;
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(s => spy.observe(s));
  }
}

// ---- cursor-reactive spotlight — only for devices with a real mouse ----
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

// ---- cursor-reactive tilt + glare on cards ----
if (!reduceMotion && hasFinePointer) {
  const tiltCards = document.querySelectorAll('.project-card, .timeline-card, .panel, .profile-card, .pillar-card, .photo-grid .photo-card');
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

// ---- magnetic buttons ----
if (!reduceMotion && hasFinePointer) {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });
}

// ---- photo marquees: auto-scroll right-to-left, pause on hover ----
// Driven by rAF with a plain pixel offset rather than a CSS keyframe
// percentage, so the wrap point is never a snap to a fixed value — it's
// always "subtract exactly one copy-width from wherever we currently are,"
// which stays frame-accurate regardless of how the browser rounds layout,
// and can never present as a visible jump.
{
  const SPEED = 40; // px per second
  document.querySelectorAll('.marquee').forEach(marquee => {
    const track = marquee.querySelector('.marquee-track');
    if (!track || !track.children.length) return;

    if (reduceMotion) {
      // Accessible fallback: no motion, just a manually scrollable strip.
      marquee.classList.add('marquee-static');
      return;
    }

    const originalWidth = track.scrollWidth;
    track.insertAdjacentHTML('beforeend', track.innerHTML); // duplicate for a seamless loop

    let offset = 0;
    let paused = false;
    let lastTime = null;

    marquee.addEventListener('mouseenter', () => { paused = true; });
    marquee.addEventListener('mouseleave', () => { paused = false; });

    const frame = (now) => {
      if (lastTime === null) lastTime = now;
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (!paused) {
        offset -= SPEED * dt;
        if (offset <= -originalWidth) offset += originalWidth;
        track.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// ---- photo lightbox: click a gallery/marquee photo to view it full-size ----
{
  const photoImgs = document.querySelectorAll('.photo-img');
  if (photoImgs.length) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous photo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <button class="lightbox-nav lightbox-next" type="button" aria-label="Next photo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <img class="lightbox-img" src="" alt="">
    `;
    document.body.appendChild(lightbox);

    const imgEl = lightbox.querySelector('.lightbox-img');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    let group = [];
    let index = 0;
    let trigger = null;

    const show = () => {
      imgEl.src = group[index].src;
      imgEl.alt = group[index].alt || '';
      const multi = group.length > 1;
      prevBtn.style.display = multi ? '' : 'none';
      nextBtn.style.display = multi ? '' : 'none';
    };

    const open = (clickedImg) => {
      // Group by the enclosing gallery/marquee so prev/next stays within it.
      // Marquees duplicate their track for a seamless loop, so the same photo
      // appears twice in the DOM — dedupe by src, keeping first-seen order.
      const container = clickedImg.closest('.photo-grid, .marquee-track') || document;
      const all = Array.from(container.querySelectorAll('.photo-img'));
      const seen = new Set();
      group = [];
      all.forEach(img => {
        if (!seen.has(img.src)) { seen.add(img.src); group.push(img); }
      });
      index = group.indexOf(clickedImg);
      if (index === -1) { group = [clickedImg]; index = 0; }

      trigger = clickedImg;
      show();
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    };

    const close = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (trigger) trigger.focus({ preventScroll: true });
    };

    const step = (delta) => {
      if (!group.length) return;
      index = (index + delta + group.length) % group.length;
      show();
    };

    document.addEventListener('click', (e) => {
      const img = e.target.closest('.photo-img');
      if (!img) return;
      open(img);
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }
}

// ---- Minecraft-style "Achievement Unlocked" toasts ----
// Each achievement fires once ever (persisted in localStorage), mirroring how
// Minecraft achievements can only be earned once per world.
{
  const ACHIEVEMENTS_KEY = 'portfolio-achievements';
  let unlocked;
  try { unlocked = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY)) || {}; } catch (e) { unlocked = {}; }

  const container = document.createElement('div');
  container.className = 'achievement-toast-container';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);

  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  const unlock = (id, text) => {
    if (unlocked[id]) return;
    unlocked[id] = true;
    try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked)); } catch (e) {}

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <span class="achievement-toast-icon">${checkIcon}</span>
      <span>
        <p class="achievement-toast-title">Achievement Unlocked</p>
        <p class="achievement-toast-text">${text}</p>
      </span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 500);
    }, 3800);
  };

  document.addEventListener('themechange', () => {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') unlock('dark-mode', 'Embrace the Night');
    else unlock('light-mode', 'Rise and Shine');
  });

  const lightboxEl = document.querySelector('.lightbox');
  if (lightboxEl && 'MutationObserver' in window) {
    const lbObserver = new MutationObserver(() => {
      if (lightboxEl.classList.contains('is-open')) unlock('lightbox', 'Photo Enthusiast');
    });
    lbObserver.observe(lightboxEl, { attributes: true, attributeFilter: ['class'] });
  }

  const footer = document.querySelector('.site-footer');
  if (footer && 'IntersectionObserver' in window) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          unlock('full-tour', 'The Full Tour');
          footerObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });
    footerObserver.observe(footer);
  }

  // Hidden: click the hero pill 5 times in quick succession.
  const heroPill = document.querySelector('.hero-pill');
  if (heroPill) {
    let clicks = 0;
    let resetTimer = null;
    heroPill.addEventListener('click', () => {
      clicks++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { clicks = 0; }, 1200);
      if (clicks >= 5) {
        clicks = 0;
        unlock('easter-egg', 'Diamonds! You Found the Secret');
      }
    });
  }
}

// ---- hero name letter-in animation ----
{
  const heroName = document.querySelector('.hero h1');
  if (heroName && !reduceMotion) {
    const text = heroName.textContent.trim();
    heroName.setAttribute('aria-label', text);
    heroName.innerHTML = '';
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch;
      if (ch.trim()) {
        span.className = 'letter';
        span.style.setProperty('--d', `${i * 35}ms`);
      } else {
        span.style.display = 'inline-block';
        span.style.width = '0.3em';
      }
      wrap.appendChild(span);
    });
    heroName.appendChild(wrap);
  }
}

// ---- animated particle network in the hero ----
if (!reduceMotion) {
  const canvas = document.querySelector('.particle-canvas');
  const hero = canvas ? canvas.closest('.hero') : null;

  if (canvas && hero && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let particles = [];
    const mouse = { x: null, y: null };
    const LINK_DIST = 130;
    const MOUSE_DIST = 160;

    let dotRGB = '222, 229, 255';
    let lineRGB = '150, 170, 255';
    let mouseRGB = '178, 107, 255';
    const readThemeColors = () => {
      const cs = getComputedStyle(document.documentElement);
      dotRGB = cs.getPropertyValue('--particle-dot').trim() || dotRGB;
      lineRGB = cs.getPropertyValue('--particle-line').trim() || lineRGB;
      mouseRGB = cs.getPropertyValue('--particle-mouse').trim() || mouseRGB;
    };
    readThemeColors();
    document.addEventListener('themechange', readThemeColors);

    const resize = () => {
      const rect = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.max(24, Math.round((w * h) / 16000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.8,
      }));
    };

    const step = () => {
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= w) { p.vx *= -1; p.x = Math.min(Math.max(p.x, 0), w); }
        if (p.y <= 0 || p.y >= h) { p.vy *= -1; p.y = Math.min(Math.max(p.y, 0), h); }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DIST) {
            ctx.strokeStyle = `rgba(${lineRGB}, ${(1 - dist / LINK_DIST) * 0.25})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (mouse.x !== null) {
          const p = particles[i];
          const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
          if (dist < MOUSE_DIST) {
            ctx.strokeStyle = `rgba(${mouseRGB}, ${(1 - dist / MOUSE_DIST) * 0.4})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = `rgba(${dotRGB}, 0.75)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };

    let raf = null;
    const start = () => { if (raf === null) raf = requestAnimationFrame(step); };
    const stop = () => { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };

    resize();
    start();
    window.addEventListener('resize', resize);

    if (hasFinePointer) {
      hero.addEventListener('pointermove', (e) => {
        const rect = hero.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      });
      hero.addEventListener('pointerleave', () => {
        mouse.x = null;
        mouse.y = null;
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });
  }
}
