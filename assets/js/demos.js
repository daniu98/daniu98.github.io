/* ===========================================================================
   Project demonstrations.

   Each <canvas data-demo="..."> in the Projects section is driven by one
   function below. They draw the actual idea behind the project — a real
   depth-first search, real convolution kernels — rather than a looping GIF.

   Rules they all follow:
     · nothing animates until it is on screen, and it stops when it leaves
     · prefers-reduced-motion gets the finished state, drawn once
     · every canvas carries alt text, so the page still says something with
       scripting off
   =========================================================================== */

(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var C = {
    navy:  '#0a1a2b',
    steel: '#3e5468',
    muted: '#8094a6',
    line:  '#d5dde5',
    soft:  '#eaf0f5',
    paper: '#ffffff',
    red:   '#c8102e',
    blue:  '#1c4e9e',
    mint:  '#1b8f6a'
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Size a canvas to its CSS box at device resolution and hand back a context
     already scaled to CSS pixels. */
  function surface(cv) {
    var r = cv.getBoundingClientRect();
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== w * d || cv.height !== h * d) { cv.width = w * d; cv.height = h * d; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function label(ctx, x, y, text, size, color, align) {
    ctx.font = '500 ' + (size || 10) + 'px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = color || C.muted;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setRead(bar, text) {
    var el = bar && bar.querySelector('[data-demo-read]');
    if (el && el.textContent !== text) el.textContent = text;
  }

  /* =======================================================================
     01 — TreeReq: the scraping pipeline, and the graph it produces
     ======================================================================= */
  function treereq(cv, bar) {
    var STAGES = ['CATALOGUE', 'PLAYWRIGHT', 'CLAUDE', 'JSON', 'MONGO'];

    /* A slice of the UCLA CS sequence — the shape of graph the API serves. */
    var NODES = [
      { id: 'CS 31',   col: 0, row: 0.9 },
      { id: 'MATH 61', col: 0, row: 2.8 },
      { id: 'CS 32',   col: 1, row: 0.9 },
      { id: 'CS 33',   col: 2, row: 0 },
      { id: 'CS 35L',  col: 2, row: 1.7 },
      { id: 'CS 180',  col: 2, row: 3.1 },
      { id: 'CS 111',  col: 3, row: 0.85 },
      { id: 'CS 181',  col: 3, row: 3.1 },
      { id: 'CS 118',  col: 4, row: 0.85 }
    ];
    var EDGES = [
      ['CS 31', 'CS 32'], ['CS 32', 'CS 33'], ['CS 32', 'CS 35L'],
      ['CS 33', 'CS 111'], ['CS 35L', 'CS 111'], ['CS 111', 'CS 118'],
      ['CS 32', 'CS 180'], ['MATH 61', 'CS 180'], ['CS 180', 'CS 181']
    ];
    var byId = {};
    NODES.forEach(function (n) { byId[n.id] = n; });

    var run = 1, running = false, hover = null, chain = {}, t0 = 0;

    /* every course this one depends on, transitively */
    function ancestors(id, out) {
      out = out || {};
      EDGES.forEach(function (e) {
        if (e[1] === id && !out[e[0]]) { out[e[0]] = true; ancestors(e[0], out); }
      });
      return out;
    }

    var MAXROW = 3.1;
    function layout(w, h) {
      var padX = Math.max(14, w * 0.05), padY = h * 0.34;
      var nw = Math.min(84, (w - padX * 2) / 5.5);
      var nh = Math.min(24, h * 0.058);
      var gw = (w - padX * 2 - nw) / 4;
      var gh = (h - padY - nh - 14) / MAXROW;   /* last row clears the bottom */
      NODES.forEach(function (n) { n.x = padX + n.col * gw; n.y = padY + n.row * gh; });
      return { nw: nw, nh: nh };
    }

    function draw(now) {
      var s = surface(cv), ctx = s.ctx, w = s.w, h = s.h;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      var L = layout(w, h);
      var p = running ? clamp((now - t0) / 3800, 0, 1) : run;
      if (running && p >= 1) { running = false; run = 1; }

      /* ---- the pipeline across the top ---- */
      var sy = h * 0.14, sx0 = w * 0.1, sx1 = w * 0.9;
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx0, sy); ctx.lineTo(sx1, sy); ctx.stroke();

      STAGES.forEach(function (st, i) {
        var x = sx0 + (sx1 - sx0) * (i / (STAGES.length - 1));
        var reached = p >= i / (STAGES.length - 1) - 0.001;
        ctx.beginPath(); ctx.arc(x, sy, reached ? 6.5 : 4.5, 0, 7);
        ctx.fillStyle = reached ? C.navy : C.paper; ctx.fill();
        ctx.strokeStyle = reached ? C.navy : C.line;
        ctx.lineWidth = 1.4; ctx.stroke();
        label(ctx, x, sy - 18, st, 8.5, reached ? C.navy : C.muted, 'center');
      });

      /* the document being carried along it */
      if (running && p > 0 && p < 1) {
        var px = sx0 + (sx1 - sx0) * p;
        ctx.save();
        ctx.translate(px, sy + 16);
        ctx.fillStyle = C.red;
        roundRect(ctx, -5.5, -7.5, 11, 15, 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-2.5, -3.5); ctx.lineTo(2.5, -3.5);
        ctx.moveTo(-2.5, -0.5); ctx.lineTo(2.5, -0.5);
        ctx.moveTo(-2.5, 2.5);  ctx.lineTo(1, 2.5);
        ctx.stroke();
        ctx.restore();
      }

      label(ctx, sx0, h * 0.25,
            running ? 'PARSING PREREQUISITE TEXT…' : 'PREREQUISITES PARSED · 141 MAJORS',
            9, running ? C.muted : C.mint);

      /* ---- the graph ---- */
      var reveal = running ? clamp((p - 0.3) / 0.6, 0, 1) : 1;
      var shown = Math.ceil(reveal * NODES.length);

      EDGES.forEach(function (e) {
        var a = byId[e[0]], b = byId[e[1]];
        if (NODES.indexOf(a) >= shown || NODES.indexOf(b) >= shown) return;
        var lit = hover && (chain[e[0]] || e[0] === hover) && (chain[e[1]] || e[1] === hover);
        var ax = a.x + L.nw, ay = a.y + L.nh / 2, bx = b.x, by = b.y + L.nh / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(ax + (bx - ax) * 0.5, ay, ax + (bx - ax) * 0.5, by, bx - 5, by);
        ctx.strokeStyle = lit ? C.red : C.line;
        ctx.lineWidth = lit ? 1.8 : 1.1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx - 5.5, by - 3.2); ctx.lineTo(bx - 5.5, by + 3.2);
        ctx.closePath();
        ctx.fillStyle = lit ? C.red : C.line; ctx.fill();
      });

      NODES.forEach(function (n, i) {
        if (i >= shown) return;
        var isHover = n.id === hover;
        var lit = hover && (isHover || chain[n.id]);
        ctx.globalAlpha = (hover && !lit) ? 0.4 : 1;
        roundRect(ctx, n.x, n.y, L.nw, L.nh, 3);
        ctx.fillStyle = isHover ? C.navy : lit ? '#fdeaee' : C.paper;
        ctx.fill();
        ctx.strokeStyle = lit ? C.red : C.line;
        ctx.lineWidth = lit ? 1.5 : 1;
        ctx.stroke();
        label(ctx, n.x + L.nw / 2, n.y + L.nh / 2, n.id, 9.5,
              isHover ? '#fff' : lit ? C.red : C.steel, 'center');
        ctx.globalAlpha = 1;
      });

      return running;
    }

    function hitTest(ev) {
      var r = cv.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      var L = layout(r.width, r.height), found = null;
      NODES.forEach(function (nd) {
        if (x >= nd.x && x <= nd.x + L.nw && y >= nd.y && y <= nd.y + L.nh) found = nd.id;
      });
      if (found === hover) return;
      hover = found;
      chain = found ? ancestors(found) : {};
      var k = Object.keys(chain).length;
      setRead(bar, found
        ? found + ' — ' + k + ' prerequisite' + (k === 1 ? '' : 's') + ' upstream'
        : IDLE);
      draw(performance.now());
    }

    /* "Hover" is meaningless on a touch screen, so say — and do — the right
       thing for the pointer actually in use. */
    var HOVERS = window.matchMedia('(hover: hover)').matches;
    var IDLE = HOVERS ? 'Hover a course to trace its chain'
                      : 'Tap a course to trace its chain';
    if (!RM) {
      setRead(bar, IDLE);
      if (HOVERS) {
        cv.addEventListener('pointermove', hitTest);
        cv.addEventListener('pointerleave', function () {
          hover = null; chain = {};
          setRead(bar, IDLE);
          draw(performance.now());
        });
      } else {
        cv.addEventListener('pointerdown', function (e) {
          var before = hover;
          hitTest(e);
          if (hover === before && hover) {        /* tap the same node to clear */
            hover = null; chain = {};
            setRead(bar, IDLE);
            draw(performance.now());
          }
        });
      }
    }

    return {
      draw: draw,
      act: function (what) {
        if (what === 'scrape' && !RM) { running = true; t0 = performance.now(); return true; }
      }
    };
  }

  /* =======================================================================
     02 — Maze robot: a real depth-first search, backtracking and all
     ======================================================================= */
  function maze(cv, bar) {
    var CW = 15, CH = 10;
    var cells, stack, visited, done, stepT, robot, head, built = false, count = 0;

    function idx(x, y) { return y * CW + x; }

    /* recursive backtracker — a perfect maze, so the search always terminates */
    function build() {
      cells = [];
      for (var i = 0; i < CW * CH; i++) cells.push({ n: 1, e: 1, s: 1, w: 1, v: 0 });
      var st = [{ x: 0, y: 0 }];
      cells[0].v = 1;
      var seen = 1;
      while (seen < CW * CH && st.length) {
        var c = st[st.length - 1], opts = [];
        if (c.y > 0      && !cells[idx(c.x, c.y - 1)].v) opts.push('n');
        if (c.x < CW - 1 && !cells[idx(c.x + 1, c.y)].v) opts.push('e');
        if (c.y < CH - 1 && !cells[idx(c.x, c.y + 1)].v) opts.push('s');
        if (c.x > 0      && !cells[idx(c.x - 1, c.y)].v) opts.push('w');
        if (!opts.length) { st.pop(); continue; }
        var d = opts[(Math.random() * opts.length) | 0];
        var nx = c.x + (d === 'e' ? 1 : d === 'w' ? -1 : 0);
        var ny = c.y + (d === 's' ? 1 : d === 'n' ? -1 : 0);
        cells[idx(c.x, c.y)][d] = 0;
        cells[idx(nx, ny)][{ n: 's', s: 'n', e: 'w', w: 'e' }[d]] = 0;
        cells[idx(nx, ny)].v = 1;
        seen++;
        st.push({ x: nx, y: ny });
      }
      built = true;
      reset();
    }

    function reset() {
      visited = { '0,0': 1 };
      count = 1;
      stack = [{ x: 0, y: 0 }];
      robot = { x: 0, y: 0 };
      head = 1;
      done = false;
      stepT = 0;
    }

    /* one DFS step: take an unvisited neighbour, else unwind the stack */
    function step() {
      if (done || !stack.length) { done = true; return; }
      var c = stack[stack.length - 1];
      if (c.x === CW - 1 && c.y === CH - 1) { done = true; return; }
      var w = cells[idx(c.x, c.y)], opts = [];
      if (!w.n && !visited[c.x + ',' + (c.y - 1)]) opts.push({ x: c.x, y: c.y - 1, d: 0 });
      if (!w.e && !visited[(c.x + 1) + ',' + c.y]) opts.push({ x: c.x + 1, y: c.y, d: 1 });
      if (!w.s && !visited[c.x + ',' + (c.y + 1)]) opts.push({ x: c.x, y: c.y + 1, d: 2 });
      if (!w.w && !visited[(c.x - 1) + ',' + c.y]) opts.push({ x: c.x - 1, y: c.y, d: 3 });

      if (opts.length) {
        var n2 = opts[0];
        visited[n2.x + ',' + n2.y] = 1;
        count++;
        stack.push({ x: n2.x, y: n2.y });
        head = n2.d;
      } else {
        stack.pop();
        var b = stack[stack.length - 1];
        if (b) head = b.x > c.x ? 1 : b.x < c.x ? 3 : b.y > c.y ? 2 : 0;
      }
      var tip = stack[stack.length - 1];
      if (tip) robot = { x: tip.x, y: tip.y };
    }

    function draw(now) {
      if (!built) build();
      var s = surface(cv), ctx = s.ctx, w = s.w, h = s.h;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      var cs = Math.min((w - 40) / CW, (h - 52) / CH);
      var ox = (w - cs * CW) / 2, oy = (h - cs * CH) / 2;

      Object.keys(visited).forEach(function (k) {
        var q = k.split(',');
        ctx.fillStyle = C.soft;
        ctx.fillRect(ox + q[0] * cs, oy + q[1] * cs, cs, cs);
      });

      ctx.fillStyle = 'rgba(27,143,106,.18)';
      ctx.fillRect(ox, oy, cs, cs);
      ctx.fillStyle = 'rgba(200,16,46,.14)';
      ctx.fillRect(ox + (CW - 1) * cs, oy + (CH - 1) * cs, cs, cs);
      label(ctx, ox + cs / 2, oy + cs / 2, 'IN', 8, C.mint, 'center');
      label(ctx, ox + (CW - 0.5) * cs, oy + (CH - 0.5) * cs, 'OUT', 8, C.red, 'center');

      /* the live stack: the route the robot would have to retrace */
      if (stack.length > 1) {
        ctx.beginPath();
        stack.forEach(function (c, i) {
          var x = ox + c.x * cs + cs / 2, y = oy + c.y * cs + cs / 2;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = C.red;
        ctx.lineWidth = Math.max(1.6, cs * 0.11);
        ctx.lineJoin = ctx.lineCap = 'round';
        ctx.globalAlpha = 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'square';
      ctx.beginPath();
      for (var y2 = 0; y2 < CH; y2++) {
        for (var x2 = 0; x2 < CW; x2++) {
          var c2 = cells[idx(x2, y2)], X = ox + x2 * cs, Y = oy + y2 * cs;
          if (c2.n) { ctx.moveTo(X, Y); ctx.lineTo(X + cs, Y); }
          if (c2.w) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cs); }
          if (y2 === CH - 1 && c2.s) { ctx.moveTo(X, Y + cs); ctx.lineTo(X + cs, Y + cs); }
          if (x2 === CW - 1 && c2.e) { ctx.moveTo(X + cs, Y); ctx.lineTo(X + cs, Y + cs); }
        }
      }
      ctx.stroke();

      /* the robot, with the two IR cones it actually sees with */
      var rx = ox + robot.x * cs + cs / 2, ry = oy + robot.y * cs + cs / 2;
      var ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][head];
      [-0.46, 0.46].forEach(function (off) {
        var a = ang + off;
        var g = ctx.createRadialGradient(rx, ry, 0, rx, ry, cs * 2);
        g.addColorStop(0, 'rgba(28,78,158,.3)');
        g.addColorStop(1, 'rgba(28,78,158,0)');
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.arc(rx, ry, cs * 2, a - 0.2, a + 0.2);
        ctx.closePath();
        ctx.fillStyle = g; ctx.fill();
      });

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang);
      ctx.fillStyle = C.navy;
      roundRect(ctx, -cs * 0.25, -cs * 0.19, cs * 0.5, cs * 0.38, 2);
      ctx.fill();
      ctx.fillStyle = C.red;
      ctx.fillRect(cs * 0.17, -cs * 0.065, cs * 0.11, cs * 0.13);
      ctx.restore();

      setRead(bar, done
        ? 'Exit found · ' + count + ' cells visited'
        : 'Stack depth ' + stack.length + ' · visited ' + count);

      if (RM) return false;
      if (!done && now - stepT > 60) { stepT = now; step(); }
      return !done;
    }

    return {
      draw: draw,
      act: function (what) {
        if (RM) return false;
        if (what === 'new') { build(); return true; }
        if (what === 'run') { reset(); return true; }
      },
      onEnter: function () { if (!RM && done) reset(); }
    };
  }

  /* =======================================================================
     03 — Rover: a sweeping range sensor feeding a steering loop
     ======================================================================= */
  function rover(cv, bar) {
    var obs = [], r, sweep = 0, dir = 1, trail = [], reads = [0.45, 0.45, 0.45];
    var goal = { x: 0.91, y: 0.5 };

    var stuck = 0, best = 1;
    function seed() {
      obs = [];
      var tries = 0;
      while (obs.length < 5 && tries++ < 200) {
        var o = {
          x: 0.26 + Math.random() * 0.48,
          y: 0.14 + Math.random() * 0.72,
          r: 0.03 + Math.random() * 0.04
        };
        /* keep the start and the goal clear, and keep them apart */
        if (Math.hypot(o.x - 0.07, o.y - 0.5) < o.r + 0.14) continue;
        if (Math.hypot(o.x - goal.x, o.y - goal.y) < o.r + 0.12) continue;
        if (obs.some(function (q) { return Math.hypot(q.x - o.x, q.y - o.y) < q.r + o.r + 0.04; })) continue;
        obs.push(o);
      }
      r = { x: 0.07, y: 0.5, a: 0 };
      trail = [];
      stuck = 0; best = 1;
    }

    /* distance to the first thing along a heading */
    function cast(a) {
      var step = 0.012, d = 0, x = r.x, y = r.y;
      while (d < 0.45) {
        x += Math.cos(a) * step; y += Math.sin(a) * step; d += step;
        if (x < 0.02 || x > 0.98 || y < 0.03 || y > 0.97) return d;
        for (var i = 0; i < obs.length; i++) {
          var o = obs[i];
          if ((x - o.x) * (x - o.x) + (y - o.y) * (y - o.y) < o.r * o.r) return d;
        }
      }
      return 0.45;
    }

    function tick() {
      sweep += dir * 0.085;
      if (sweep > 1) { sweep = 1; dir = -1; }
      if (sweep < -1) { sweep = -1; dir = 1; }

      reads = [cast(r.a - 0.5), cast(r.a), cast(r.a + 0.5)];
      var want = Math.atan2(goal.y - r.y, goal.x - r.x);
      var err = Math.atan2(Math.sin(want - r.a), Math.cos(want - r.a));

      /* Steer toward whichever side has more room, then let a blocked front
         override the goal entirely. */
      var closest = Math.min(reads[0], reads[1], reads[2]);
      var near = clamp((0.34 - closest) / 0.22, 0, 1);
      var avoid = (reads[2] - reads[0]) * 2;
      if (reads[1] < 0.22) avoid += (reads[2] >= reads[0] ? 1 : -1) * (0.22 - reads[1]) * 9;
      r.a += clamp(err * 0.08 + avoid * near * 0.55, -0.085, 0.085);

      var speed = 0.0045 * (reads[1] < 0.14 ? 0.4 : 1);
      r.x = clamp(r.x + Math.cos(r.a) * speed, 0.03, 0.97);
      r.y = clamp(r.y + Math.sin(r.a) * speed, 0.04, 0.96);

      trail.push({ x: r.x, y: r.y });
      if (trail.length > 200) trail.shift();

      /* If it stops closing on the goal it is circling: lay out a new field
         rather than spin forever. */
      var dist = Math.hypot(goal.x - r.x, goal.y - r.y);
      if (dist < best - 0.004) { best = dist; stuck = 0; } else { stuck++; }
      if (dist < 0.055 || stuck > 460) seed();
    }

    function draw() {
      if (!obs.length) seed();
      var s = surface(cv), ctx = s.ctx, w = s.w, h = s.h;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      var pad = 20;
      var sx = w - pad * 2, sy = h - pad * 2;
      function X(v) { return pad + v * sx; }
      function Y(v) { return pad + v * sy; }

      ctx.strokeStyle = C.soft; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var g = 0; g <= 10; g++) {
        ctx.moveTo(X(g / 10), Y(0)); ctx.lineTo(X(g / 10), Y(1));
        ctx.moveTo(X(0), Y(g / 10)); ctx.lineTo(X(1), Y(g / 10));
      }
      ctx.stroke();

      if (!RM) tick();

      ctx.beginPath(); ctx.arc(X(goal.x), Y(goal.y), 10, 0, 7);
      ctx.strokeStyle = C.mint; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(X(goal.x), Y(goal.y), 3, 0, 7);
      ctx.fillStyle = C.mint; ctx.fill();

      obs.forEach(function (o) {
        ctx.beginPath();
        ctx.arc(X(o.x), Y(o.y), o.r * sx, 0, 7);
        ctx.fillStyle = C.soft; ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
      });

      if (trail.length > 1) {
        ctx.beginPath();
        trail.forEach(function (p, i) { i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)); });
        ctx.strokeStyle = 'rgba(200,16,46,.3)';
        ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
      }

      var rx = X(r.x), ry = Y(r.y), reach = 0.45 * sx;
      var sa = r.a + sweep * 0.85;
      var gg = ctx.createRadialGradient(rx, ry, 0, rx, ry, reach);
      gg.addColorStop(0, 'rgba(28,78,158,.26)');
      gg.addColorStop(1, 'rgba(28,78,158,0)');
      ctx.beginPath(); ctx.moveTo(rx, ry);
      ctx.arc(rx, ry, reach, sa - 0.1, sa + 0.1); ctx.closePath();
      ctx.fillStyle = gg; ctx.fill();

      [-0.5, 0, 0.5].forEach(function (off, i) {
        var a = r.a + off, d = reads[i] * sx;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(a) * d, ry + Math.sin(a) * d);
        ctx.strokeStyle = reads[i] < 0.2 ? 'rgba(200,16,46,.65)' : 'rgba(62,84,104,.32)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      });

      ctx.save();
      ctx.translate(rx, ry); ctx.rotate(r.a);
      ctx.fillStyle = '#2c4154';
      ctx.fillRect(-9, -11, 7, 3); ctx.fillRect(-9, 8, 7, 3);
      ctx.fillRect(3, -11, 7, 3);  ctx.fillRect(3, 8, 7, 3);
      ctx.fillStyle = C.navy;
      roundRect(ctx, -11, -8, 22, 16, 3); ctx.fill();
      ctx.fillStyle = C.red; ctx.fillRect(7, -3, 5, 6);
      ctx.restore();

      var deg = ((r.a * 180 / Math.PI) % 360 + 360) % 360;
      setRead(bar, 'Heading ' + deg.toFixed(0) + '° · front ' + (reads[1] / 0.45 * 120).toFixed(0) + ' cm');
      return !RM;
    }

    return { draw: draw, act: function (w) { if (w === 'obst') { seed(); return !RM; } } };
  }

  /* =======================================================================
     04 — MNIST: three real convolution kernels, run on what you draw
     ======================================================================= */
  function mnist(cv, bar) {
    var N = 28;
    var grid = new Float32Array(N * N);
    var drawing = false;

    var KERNELS = [
      { name: 'VERTICAL', k: [-1, 0, 1, -2, 0, 2, -1, 0, 1] },
      { name: 'HORIZONTAL', k: [-1, -2, -1, 0, 0, 0, 1, 2, 1] },
      { name: 'OUTLINE', k: [0, -1, 0, -1, 4, -1, 0, -1, 0] }
    ];

    function stamp(cx, cy, rad) {
      for (var y = Math.floor(cy - rad); y <= cy + rad; y++) {
        for (var x = Math.floor(cx - rad); x <= cx + rad; x++) {
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          var d = Math.hypot(x - cx, y - cy);
          if (d > rad) continue;
          var i = y * N + x;
          grid[i] = Math.min(1, grid[i] + (1 - d / rad) * 0.85);
        }
      }
    }

    /* a 3, so the panel is never blank on arrival */
    function seed() {
      grid = new Float32Array(N * N);
      var pts = [[10, 7], [12, 6], [14, 6.5], [15.5, 8], [15, 10], [13, 11.5], [11.5, 12],
                 [13.5, 12.5], [15.5, 13.5], [16.5, 15.5], [15.5, 18], [13.5, 19.5],
                 [11.5, 19.5], [9.8, 18.5]];
      for (var i = 0; i < pts.length - 1; i++) {
        for (var t = 0; t <= 1; t += 0.14) {
          stamp(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t), 1.35);
        }
      }
    }

    /* an actual 3×3 convolution — nothing here is pre-rendered */
    function conv(k) {
      var out = new Float32Array(N * N), max = 0;
      for (var y = 1; y < N - 1; y++) {
        for (var x = 1; x < N - 1; x++) {
          var sum = 0, m = 0;
          for (var j = -1; j <= 1; j++) {
            for (var i = -1; i <= 1; i++) sum += grid[(y + j) * N + (x + i)] * k[m++];
          }
          var v = Math.abs(sum);
          out[y * N + x] = v;
          if (v > max) max = v;
        }
      }
      if (max > 0) for (var p = 0; p < out.length; p++) out[p] /= max;
      return out;
    }

    /* Four equal panels in a 2 x 2 grid: the drawing, then the three
       responses. Equal sizing makes them directly comparable. */
    function boxes(w, h) {
      var pad = Math.max(14, w * 0.035), gap = 14, cap = 15;
      var top = 26, bot = h - 30;
      var side = Math.min((w - pad * 2 - gap) / 2, (bot - top - gap - cap * 2) / 2);
      var left = (w - (side * 2 + gap)) / 2;          /* centre the grid */
      return {
        pad: pad, gap: gap, cap: cap, top: top, side: side, cell: side / N,
        inX: left, inY: top,
        cellAt: function (i) {
          return { x: left + (i % 2) * (side + gap),
                   y: top + Math.floor(i / 2) * (side + gap + cap) };
        }
      };
    }

    function draw() {
      var s = surface(cv), ctx = s.ctx, w = s.w, h = s.h;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      var B = boxes(w, h);

      label(ctx, B.inX, 15, 'INPUT · DRAW HERE', 9, C.muted);
      ctx.fillStyle = C.navy;
      ctx.fillRect(B.inX, B.inY, B.side, B.side);
      for (var y = 0; y < N; y++) {
        for (var x = 0; x < N; x++) {
          var v = grid[y * N + x];
          if (v <= 0.02) continue;
          ctx.fillStyle = 'rgba(244,246,248,' + v.toFixed(3) + ')';
          ctx.fillRect(B.inX + x * B.cell, B.inY + y * B.cell, B.cell + 0.5, B.cell + 0.5);
        }
      }
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.strokeRect(B.inX + 0.5, B.inY + 0.5, B.side - 1, B.side - 1);
      label(ctx, B.inX + B.side / 2, B.inY + B.side + 10, '28 × 28', 7.5, C.muted, 'center');

      var mc = B.side / N;
      KERNELS.forEach(function (K, i) {
        var out = conv(K.k);
        var pos = B.cellAt(i + 1), X = pos.x, Y = pos.y;
        if (i === 0) label(ctx, X, 15, 'FIRST-LAYER RESPONSES', 9, C.muted);
        ctx.fillStyle = '#07121d';
        ctx.fillRect(X, Y, B.side, B.side);
        for (var yy = 1; yy < N - 1; yy++) {
          for (var xx = 1; xx < N - 1; xx++) {
            var v2 = out[yy * N + xx];
            if (v2 <= 0.05) continue;
            ctx.fillStyle = 'rgba(' + (70 + 150 * v2).toFixed(0) + ',' +
                                      (160 + 80 * v2).toFixed(0) + ',' +
                                      (225 + 25 * v2).toFixed(0) + ',' + v2.toFixed(3) + ')';
            ctx.fillRect(X + xx * mc, Y + yy * mc, mc + 0.5, mc + 0.5);
          }
        }
        ctx.strokeStyle = C.line; ctx.lineWidth = 1;
        ctx.strokeRect(X + 0.5, Y + 0.5, B.side - 1, B.side - 1);
        label(ctx, X + B.side / 2, Y + B.side + 10, K.name, 7.5, C.muted, 'center');
      });

      /* the shape of the network the notebook trains */
      var ay = h - 13;
      var arch = ['28×28', 'CONV', 'POOL', 'CONV', 'POOL', 'FC', '10'];
      var archW = Math.min(w - B.pad * 2, B.side * 2 + B.gap);
      var aw = archW / arch.length, ax0 = (w - archW) / 2;
      arch.forEach(function (a, i) {
        var X = ax0 + i * aw;
        label(ctx, X + aw / 2, ay, a, 8.5, i === arch.length - 1 ? C.red : C.steel, 'center');
        if (i < arch.length - 1) {
          ctx.strokeStyle = C.line; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X + aw * 0.8, ay); ctx.lineTo(X + aw * 0.96, ay); ctx.stroke();
        }
      });
      return false;      /* static until something changes */
    }

    function at(ev) {
      var r = cv.getBoundingClientRect();
      var B = boxes(r.width, r.height);
      var x = (ev.clientX - r.left - B.inX) / B.cell;
      var y = (ev.clientY - r.top - B.inY) / B.cell;
      if (x < -1.5 || y < -1.5 || x > N + 1.5 || y > N + 1.5) return null;
      return { x: x, y: y };
    }

    if (!RM) {
      cv.style.touchAction = 'none';
      cv.style.cursor = 'crosshair';
      cv.addEventListener('pointerdown', function (e) {
        var p = at(e); if (!p) return;
        drawing = true;
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        stamp(p.x, p.y, 1.3); draw();
        setRead(bar, 'Kernels running on your drawing');
        e.preventDefault();
      });
      cv.addEventListener('pointermove', function (e) {
        if (!drawing) return;
        var p = at(e); if (!p) return;
        stamp(p.x, p.y, 1.3); draw();
      });
      ['pointerup', 'pointercancel'].forEach(function (t) {
        cv.addEventListener(t, function () { drawing = false; });
      });
    }

    seed();
    return {
      draw: draw,
      act: function (w) {
        if (w === 'clear') {
          grid = new Float32Array(N * N);
          setRead(bar, 'Draw in the box — the kernels run on what you draw');
          draw();
        }
        return false;
      }
    };
  }

  /* =======================================================================
     wiring
     ======================================================================= */
  var MAKE = { treereq: treereq, maze: maze, rover: rover, mnist: mnist };

  function mount(cv) {
    var kind = cv.getAttribute('data-demo');
    if (!MAKE[kind]) return;
    var panel = cv.closest('.case-demo');
    var bar = panel && panel.querySelector('.demo-bar');
    var demo = MAKE[kind](cv, bar);
    var raf = null, live = false;

    function loop(now) {
      var again = demo.draw(now);
      raf = (live && again && !RM) ? requestAnimationFrame(loop) : null;
    }
    function kick() {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    }

    if (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-demo-act]');
        if (!btn) return;
        var keep = demo.act && demo.act(btn.getAttribute('data-demo-act'));
        if (keep) kick();
      });
    }

    var rz;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () { demo.draw(performance.now()); }, 120);
    }, { passive: true });

    if (!('IntersectionObserver' in window) || RM) { demo.draw(performance.now()); return; }

    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        live = e.isIntersecting;
        if (!live) { cancelAnimationFrame(raf); raf = null; return; }
        if (demo.onEnter) demo.onEnter();
        kick();
      });
    }, { threshold: 0.15 }).observe(cv);
  }

  function init() {
    Array.prototype.slice.call(document.querySelectorAll('canvas[data-demo]')).forEach(mount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
