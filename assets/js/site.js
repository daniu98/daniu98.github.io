/* ===========================================================================
   Daniel Xiao — site behaviour
   Progressive enhancement only: every link, section and photo works with this
   file removed. Needs assets/js/site-config.js loaded first.
   =========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- 1. Apply site-config.js -------------------------------------------
     The HTML carries real hrefs as a no-JS fallback; the config wins here so
     there is only one file to edit.                                        */
  function applyConfig() {
    var cfg = window.SITE;
    if (!cfg) return;

    document.querySelectorAll('[data-link]').forEach(function (el) {
      var key = el.getAttribute('data-link');
      var url = key === 'email' ? (cfg.email && 'mailto:' + cfg.email) : (cfg.links || {})[key];
      if (url) el.setAttribute('href', url);
    });

    document.querySelectorAll('[data-text]').forEach(function (el) {
      var val = cfg[el.getAttribute('data-text')];
      if (typeof val === 'string') el.textContent = val;
    });

    document.querySelectorAll('[data-img]').forEach(function (fig) {
      var img = fig.tagName === 'IMG' ? fig : fig.querySelector('img');
      var spec = (cfg.images || {})[fig.getAttribute('data-img')];
      if (!img || !spec) return;
      if (spec.small) img.setAttribute('src', spec.small);
      if (spec.small && spec.large) img.setAttribute('srcset', spec.small + ' 760w, ' + spec.large + ' 1500w');
      if (spec.alt) img.setAttribute('alt', spec.alt);
    });
  }

  /* --- 2. Footer year ---------------------------------------------------- */
  function setYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* --- 3. Mobile menu ---------------------------------------------------- */
  function initMenu() {
    var btn = document.querySelector('.nav-toggle');
    var panel = document.getElementById('nav-panel');
    if (!btn || !panel) return;

    function setOpen(open) {
      btn.setAttribute('aria-expanded', String(open));
      panel.setAttribute('data-open', String(open));
      // `inert` keeps the closed panel out of the tab order and out of hit
      // testing. Toggling visibility instead left the links unclickable after
      // a close/reopen cycle in Chrome.
      if (open) panel.removeAttribute('inert');
      else panel.setAttribute('inert', '');
      document.body.style.overflow = open ? 'hidden' : '';
    }

    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        btn.focus();
      }
    });

    // Reset when the panel stops being a panel.
    window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* --- 4. Scroll progress ------------------------------------------------ */
  function initProgress() {
    var bar = document.querySelector('.progress');
    if (!bar) return;
    var ticking = false;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      bar.style.transform = 'scaleX(' + ratio + ')';
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* --- 5. Scroll spy ----------------------------------------------------- */
  function initSpy() {
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('main section[id]')
    );
    var links = Array.prototype.slice.call(
      document.querySelectorAll('.nav-links a[href^="#"]')
    );
    if (!sections.length || !links.length || !('IntersectionObserver' in window)) return;

    var visible = new Map();

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      var bestId = null, bestRatio = 0;
      visible.forEach(function (ratio, id) {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      });

      links.forEach(function (a) {
        var match = bestId !== null && a.getAttribute('href') === '#' + bestId;
        if (match) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-62px 0px -45% 0px', threshold: [0, 0.15, 0.4, 0.75, 1] });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* --- 6. Reveal on scroll ----------------------------------------------- */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* --- 7. Photo rail ----------------------------------------------------- */
  function initRail() {
    var rail = document.getElementById('rail');
    var prev = document.querySelector('[data-rail="prev"]');
    var next = document.querySelector('[data-rail="next"]');
    if (!rail || !prev || !next) return;

    function step() {
      var first = rail.querySelector('figure');
      var gap = parseFloat(getComputedStyle(rail).columnGap) || 14;
      return first ? first.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
    }

    function scrollBy(dir) {
      rail.scrollBy({
        left: dir * step() * 2,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    prev.addEventListener('click', function () { scrollBy(-1); });
    next.addEventListener('click', function () { scrollBy(1); });

    // Arrow keys when the rail itself has focus.
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollBy(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollBy(-1); }
    });

    function syncButtons() {
      // When the gallery is pinned (desktop), the track does not scroll — the
      // page does, and motion.js owns the buttons. Leave them enabled.
      var maxScroll = rail.scrollWidth - rail.clientWidth - 1;
      if (maxScroll <= 0) { prev.disabled = next.disabled = false; return; }
      prev.disabled = rail.scrollLeft <= 0;
      next.disabled = rail.scrollLeft >= maxScroll;
    }

    rail.addEventListener('scroll', syncButtons, { passive: true });
    window.addEventListener('resize', syncButtons, { passive: true });
    syncButtons();
  }

  /* --- 8. Smooth scroll with a fixed-header offset ------------------------
     The offset itself lives in CSS (`scroll-margin-top`), so there is one
     source of truth. Focus moves first: calling focus() after kicking off a
     smooth scroll cancels it in Chrome.                                    */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;

      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      history.pushState(null, '', '#' + id);

      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });

      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }

  /* --- 9. Header is hidden during the opening ------------------------------
     `html.intro` fades the header out and turns off its pointer events, so its
     links must leave the tab order too — otherwise Tab lands focus on an
     invisible, unclickable nav item. */
  function initHeaderInert() {
    var head = document.querySelector('.site-head');
    if (!head) return;
    var root = document.documentElement;
    function sync() {
      if (root.classList.contains('intro')) head.setAttribute('inert', '');
      else head.removeAttribute('inert');
    }
    sync();
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  /* --- 10. Home / away sweater ---------------------------------------------
     His two real numbers. The plate under the hero photo is the control; the
     choice is remembered, and the inline script in <head> reads it back so
     there is no flash of the wrong kit on load. faceoff.js listens for
     `kitchange` and repaints the skater in the matching sweater. */
  function initKit() {
    var btn = document.getElementById('kit-toggle');
    var cfg = (window.SITE || {}).kit;
    if (!btn || !cfg) return;

    var numEl   = document.getElementById('kit-number');
    var sideEl  = document.getElementById('kit-side');
    var sheetEl = document.getElementById('kit-sheet');
    var sbNum   = document.getElementById('sb-num');
    var noteEl  = document.getElementById('kit-note');
    var root    = document.documentElement;

    function apply(side, announce) {
      var k = cfg[side] || cfg.home;
      root.dataset.kit = side;
      if (numEl)   numEl.textContent   = k.number;
      if (sideEl)  sideEl.textContent  = k.label;
      if (sheetEl) sheetEl.textContent = k.sheet;
      if (sbNum)   sbNum.textContent   = k.number;
      btn.setAttribute('aria-pressed', String(side === 'away'));
      btn.setAttribute('aria-label',
        'Jersey number ' + k.number + ', ' + k.label.toLowerCase() +
        ' sweater. Activate to switch to the ' +
        (side === 'away' ? cfg.home.label : cfg.away.label).toLowerCase() + ' sweater.');
      if (noteEl) {
        var note = (cfg.note || '').trim();
        noteEl.textContent = note;
        noteEl.hidden = !note;
      }
      if (announce) document.dispatchEvent(new CustomEvent('kitchange', { detail: side }));
    }

    apply(root.dataset.kit === 'away' ? 'away' : 'home', false);

    btn.addEventListener('click', function () {
      var next = root.dataset.kit === 'away' ? 'home' : 'away';
      try { localStorage.setItem('kit', next); } catch (e) {}
      apply(next, true);
    });
  }

  function init() {
    applyConfig();
    initHeaderInert();
    initKit();
    setYear();
    initMenu();
    initProgress();
    initSpy();
    initReveal();
    initRail();
    initAnchors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
