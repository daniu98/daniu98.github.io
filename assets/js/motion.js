/* NOT LOADED.

   This held the ambient scroll motion — word-by-word headings, odometer
   digits, marquee bands, the puck scroll indicator, page tint drift,
   parallax, stacking experience rows, the cursor ring, magnetic links and the
   pinned photo gallery. The page was deliberately quietened down and no longer
   includes this file; index.html does not reference it.

   Kept in the repo so individual effects can be lifted back out if wanted.
   Deleting it changes nothing. */

/* ===========================================================================
   Motion — the behaviour shared by every section.

   One rAF loop drives everything that tracks scroll, one IntersectionObserver
   drives everything that fires once. Both bail out under prefers-reduced-
   motion, and nothing here is load-bearing: remove the file and the page is
   the same page, just still.
   =========================================================================== */

(function () {
  'use strict';

  var RM   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(pointer: fine)').matches;
  var root = document.documentElement;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function once(el, cb, th) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { cb(); io.disconnect(); } });
    }, { threshold: th == null ? 0.25 : th });
    io.observe(el);
  }

  /* ---- 1. Headings rise word by word -------------------------------------
     The wrapper's generic fade is dropped so the words are the only motion. */
  function initHeadings() {
    $$('.h-sec').forEach(function (h) {
      var head = h.closest('.sec-head');
      if (head) { head.classList.remove('reveal'); head.classList.add('head-anim'); }

      (function split(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              var w = document.createElement('span'); w.className = 'wd';
              var i = document.createElement('i'); i.textContent = part;
              w.appendChild(i); frag.appendChild(w);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') split(n);
        });
      })(h);

      $$('.wd > i', h).forEach(function (i, k) { i.style.transitionDelay = (k * 0.062) + 's'; });

      if (RM) { h.classList.add('in'); if (head) head.classList.add('in'); return; }
      once(h, function () { h.classList.add('in'); if (head) head.classList.add('in'); }, 0.3);
    });
  }

  /* ---- 2. Odometer digits -------------------------------------------------
     Each digit is a 0-9 column that slides. Non-digits are left alone, so
     "10+" rolls the 1 and the 0 and keeps the plus still.                   */
  function odo(el, text, instant) {
    text = String(text);
    if (el._odoText === text) return;
    var chars = text.split('');
    var same = el._odo && el._odo.length === chars.length &&
               el._odo.every(function (s, i) { return (/\d/.test(chars[i])) === s._digit; });

    if (!same) {
      el.innerHTML = '';
      el.classList.add('odo');
      el._odo = chars.map(function (ch) {
        var s = document.createElement('span');
        if (/\d/.test(ch)) {
          s._digit = true; s.className = 'odo-d';
          var col = document.createElement('span');
          col.className = 'odo-s';
          col.innerHTML = '0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9';
          s.appendChild(col);
        } else { s._digit = false; s.className = 'odo-c'; s.textContent = ch; }
        el.appendChild(s);
        return s;
      });
      instant = true;
    }

    chars.forEach(function (ch, i) {
      var s = el._odo[i];
      if (!s._digit) { s.textContent = ch; return; }
      var col = s.firstChild;
      col.style.transition = (instant || RM) ? 'none' : '';
      col.style.transitionDelay = (i * 0.07) + 's';
      col.style.transform = 'translateY(' + (-(instant ? +ch : 10 + +ch) * 5) + '%)';
      if (instant) col.offsetHeight;   /* flush, so the next change animates */
    });
    el._odoText = text;
  }
  window.__odo = odo;

  function initCounters() {
    $$('[data-count]').forEach(function (el) {
      var target = el.getAttribute('data-count');
      if (RM) { el.textContent = target; return; }
      odo(el, target.replace(/\d/g, '0'), true);
      once(el, function () { setTimeout(function () { odo(el, target); }, 140); }, 0.6);
    });
  }

  /* ---- 3. Marquee bands ---------------------------------------------------
     Drift on their own; scroll velocity speeds them up and scroll direction
     flips them, so the page feels physically connected.                     */
  var bands = [], lastY = window.scrollY, vel = 0, sdir = 1, lastT = 0;

  function initBands() {
    bands = $$('.band').map(function (b) {
      var tr = $('.band-track', b);
      if (!tr) return null;
      var words = (tr.getAttribute('data-words') || '').split('|');
      var html = '';
      for (var r = 0; r < 4; r++) {
        words.forEach(function (w) { html += '<span>' + w + '<i></i></span>'; });
      }
      tr.innerHTML = html + html;
      return { b: b, tr: tr, dir: +b.getAttribute('data-dir') || 1, x: 0, w: 0, vis: true };
    }).filter(Boolean);

    if ('IntersectionObserver' in window) {
      bands.forEach(function (o) {
        new IntersectionObserver(function (es) { o.vis = es[0].isIntersecting; }, { threshold: 0 }).observe(o.b);
      });
    }
  }

  function bandsTick(now) {
    var dt = lastT ? Math.min(50, now - lastT) : 16;
    lastT = now;
    var y = window.scrollY, dy = y - lastY;
    lastY = y;
    if (Math.abs(dy) > 0.5) sdir = dy > 0 ? 1 : -1;
    vel += (Math.abs(dy) - vel) * 0.12;

    bands.forEach(function (o) {
      if (!o.vis || RM) return;
      if (!o.w) o.w = o.tr.scrollWidth / 2;
      if (!o.w) return;
      o.x -= (0.035 + vel * 0.011) * dt * o.dir * sdir;
      if (o.x < -o.w) o.x += o.w;
      if (o.x > 0) o.x -= o.w;
      o.tr.style.transform = 'translate3d(' + o.x.toFixed(1) + 'px,0,0)';
    });
  }

  /* ---- 4. The puck rides the scroll bar ----------------------------------- */
  var ind = $('#puck-ind'), indSvg = $('#puck-ind svg'), lastDir = 1, flip = 0;

  function puckTick() {
    if (!ind || !indSvg) return;
    var h = root.scrollHeight - window.innerHeight;
    var p = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
    var top = 104, bot = window.innerHeight - 62;
    ind.style.transform = 'translate3d(0,' + (top + (bot - top) * p - 8).toFixed(1) + 'px,0)';
    if (sdir !== lastDir) { lastDir = sdir; flip += 180; }
    indSvg.style.transform = 'rotate(' + flip + 'deg)';
  }

  /* ---- 5. Page tint drifts between sections ------------------------------- */
  var tints = [], curTint = '';

  function initTints() {
    tints = [
      ['#about',    '#f4f6f8'],
      ['#hockey',   '#0a1a2b'],
      ['#projects', '#f7f9fb'],
      ['#work',     '#e8edf2'],
      ['#beyond',   '#f4f6f8'],
      ['#contact',  '#0a1a2b']
    ].map(function (t) { return { el: $(t[0]), c: t[1] }; }).filter(function (t) { return t.el; });
  }

  function tintTick() {
    var mid = window.innerHeight * 0.55, c = '#f4f6f8';
    tints.forEach(function (t) { if (t.el.getBoundingClientRect().top < mid) c = t.c; });
    if (c !== curTint) { curTint = c; document.body.style.backgroundColor = c; }
  }

  /* ---- 6. Parallax -------------------------------------------------------- */
  var plx = [];
  function initParallax() { plx = $$('[data-plx]'); }
  function plxTick() {
    if (RM) return;
    plx.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      var amt = parseFloat(el.getAttribute('data-plx')) || 8;
      var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      var img = el.tagName === 'IMG' ? el : $('img', el);
      if (img) img.style.transform = 'translate3d(0,' + (-p * amt).toFixed(2) + '%,0) scale(1.1)';
    });
  }

  /* ---- 7. Experience rows stack ------------------------------------------- */
  var cvRows = [];
  function setupStack() {
    cvRows = $$('.cv-row');
    var ok = window.innerWidth >= 1000 && !RM;
    cvRows.forEach(function (c) {
      c.classList.remove('stackable');
      c.style.transform = ''; c.style.filter = ''; c.style.top = '';
    });
    if (!ok) { cvRows = []; return; }
    cvRows.forEach(function (c) {
      c.classList.add('stackable');
      c._top = Math.min(96, Math.max(72, window.innerHeight - c.offsetHeight - 28));
      c.style.top = c._top + 'px';
    });
  }
  function stackTick() {
    for (var i = 0; i < cvRows.length - 1; i++) {
      var next = cvRows[i + 1];
      var nt = next.getBoundingClientRect().top;
      var span = window.innerHeight - Math.max(72, next._top || 96);
      var q = clamp((window.innerHeight - nt) / span, 0, 1);
      cvRows[i].style.transform = q > 0
        ? 'scale(' + (1 - 0.05 * q).toFixed(4) + ') translateY(' + (-q * 14).toFixed(1) + 'px)' : '';
      cvRows[i].style.filter = q > 0 ? 'brightness(' + (1 - 0.07 * q).toFixed(3) + ')' : '';
    }
  }

  /* ---- 8. Cursor companion ------------------------------------------------
     Rides alongside the real cursor rather than replacing it, so nothing is
     lost if this script never runs.                                         */
  function initRing() {
    if (!FINE || RM) return;
    var ring = $('#ring');
    if (!ring) return;
    var mx = -100, my = -100, rx = -100, ry = -100, seen = false;

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; rx = mx; ry = my; ring.classList.add('on'); }
    }, { passive: true });

    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('a, button, .case-demo, .proj, [data-hover]');
      document.body.classList.toggle('hovering', !!t);
    });

    (function loop() {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---- 9. Magnetic contact links ------------------------------------------ */
  function initMagnets() {
    if (!FINE || RM) return;
    $$('[data-magnet]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px,' +
                                           ((e.clientY - r.top - r.height / 2) * 0.24).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ---- 10. Pinned photo gallery -------------------------------------------
     Desktop turns vertical scroll into a horizontal pan. Below 860px the CSS
     leaves it as an ordinary swipe rail and this does nothing.              */
  var pin = null;
  function setupPin() {
    var sec = $('.pinned');
    if (!sec) { pin = null; return; }
    var track = $('.pin-track', sec);
    var bar   = $('.pin-bar i', sec);
    var idx   = $('[data-pin-idx]', sec);
    var cards = $$('figure', track);
    var on = window.innerWidth > 860 && !RM;

    if (!on) {
      sec.style.height = '';
      if (track) track.style.transform = '';
      pin = null;
      return;
    }
    var over = track.scrollWidth - window.innerWidth;
    sec.style.height = (window.innerHeight + Math.max(0, over) + 90) + 'px';
    pin = { sec: sec, track: track, bar: bar, idx: idx, cards: cards, over: Math.max(0, over) };

    /* The prev/next buttons move the page, since the page is what pans the
       track. Bound once; `pin` is re-read on every click. */
    if (!sec._wired) {
      sec._wired = true;
      $$('[data-rail]', sec).forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!pin || !pin.over) return;         /* swipe mode: site.js handles it */
          var card = pin.cards[0];
          var stepPx = card ? card.getBoundingClientRect().width + 20 : 320;
          var total = pin.sec.offsetHeight - window.innerHeight;
          var dy = (stepPx / pin.over) * total * (btn.getAttribute('data-rail') === 'next' ? 1 : -1);
          window.scrollBy({ top: dy, behavior: RM ? 'auto' : 'smooth' });
        });
      });
    }
  }
  function pinTick() {
    if (!pin) return;
    var r = pin.sec.getBoundingClientRect();
    var total = pin.sec.offsetHeight - window.innerHeight;
    var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    pin.track.style.transform = 'translate3d(' + (-p * pin.over).toFixed(1) + 'px,0,0)';
    if (pin.bar) pin.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (pin.idx) odo(pin.idx, ('0' + Math.min(pin.cards.length, Math.floor(p * pin.cards.length) + 1)).slice(-2));
    pin.cards.forEach(function (c) {
      var cr = c.getBoundingClientRect();
      var mid = (cr.left + cr.width / 2) / window.innerWidth - 0.5;
      c.style.setProperty('--sk', (mid * -1.6).toFixed(2) + 'deg');
    });
  }

  /* ---- loop --------------------------------------------------------------- */
  function loop(now) {
    bandsTick(now);
    puckTick();
    tintTick();
    plxTick();
    stackTick();
    pinTick();
    requestAnimationFrame(loop);
  }

  function init() {
    initHeadings();
    initCounters();
    initBands();
    initTints();
    initParallax();
    initRing();
    initMagnets();
    setupStack();
    setupPin();

    window.addEventListener('resize', function () { setupStack(); setupPin(); }, { passive: true });

    /* One frame so the static state is right, then keep going unless the
       visitor asked for stillness. */
    if (RM) { puckTick(); tintTick(); return; }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
