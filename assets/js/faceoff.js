/* ===========================================================================
   Faceoff — the opening sequence.

   Scroll-driven, not timed. `#faceoff` is a tall section with a sticky stage;
   where you are inside it drives one timeline, so the visitor is always in
   control and nothing is a mandatory wait. Scroll fast and you blow through it
   in a second; stop and it stops with you.

   Timeline (fractions of the scroll through #faceoff):
     0.00 → 0.16   rink markings paint themselves on
     0.20 → 0.56   the rush: the puck moves up ice through three passes
     0.56 → 0.74   the shot: puck at the camera, rink blurs, white-out
     0.74 → 1.00   the hero resolves out of the ice spray

   Everything here is decorative. Remove this file and the hero is a normal
   static hero with every link intact.
   =========================================================================== */

(function () {
  'use strict';

  var RM   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  var sec  = document.getElementById("rink");
  var ice  = document.getElementById('ice');
  var fx   = document.getElementById('shotfx');
  var hero = document.getElementById('hero');
  if (!sec || !ice || !fx || !hero) return;

  var ictx    = ice.getContext('2d');
  var fctx    = fx.getContext('2d');
  var sprayCv = document.getElementById('spray');
  var spctx   = sprayCv ? sprayCv.getContext('2d') : null;

  var hint    = document.getElementById('faceoff-hint');
  var board   = document.getElementById('scoreboard');
  var clockEl = document.getElementById('sb-clock');
  var passEl  = document.getElementById('sb-pass');
  var callEl  = document.getElementById('shot-call');
  var radarEl = document.getElementById('shot-radar');
  var skipBtn = document.getElementById('faceoff-skip');
  var heroIn  = hero.querySelector('.hero-grid');

  /* ---- timeline ---------------------------------------------------------- */
  var P_PAINT = 0.16, P_RUSH = 0.20, P_SHOT = 0.56, P_HERO = 0.74, P_END = 0.96;

  /* ---- rink, in metres (NHL sheet: 61 × 26) ------------------------------ */
  var HW = 13, LEN = 61;
  var GOAL_N = 4, BLUE_N = 19.4, MID = 30.5, BLUE_F = 41.6, GOAL_F = 57;
  var BOARD_H = 1.07, GLASS_H = 2.9;

  /* The puck's route up ice. Each waypoint is a pass received. */
  var LEGS = [
    { x: -8.6, z: 47.0 },
    { x:  7.4, z: 34.5 },
    { x: -6.2, z: 23.0 },
    { x:  4.3, z: 13.5 }
  ];

  var ICE_HI = '#f2f7fb', ICE_LO = '#aec1d2';
  var RED = '#c8102e', BLUE = '#1c4e9e';

  /* ---- maths ------------------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---- camera ------------------------------------------------------------ */
  var W, H, D, CX, f, hz, camZ, camH, port;

  function fit(c) {
    var r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    c.width  = Math.max(1, Math.round(r.width * d));
    c.height = Math.max(1, Math.round(r.height * d));
    return { w: r.width, h: r.height, d: d };
  }

  function size() {
    var a = fit(ice); W = a.w; H = a.h; D = a.d;
    fit(fx);
    port = W / H < 0.95;
    CX = W / 2;
    /* A broadcast gantry: far enough back and high enough that the sheet
       reads as a rink instead of a corridor. Close in and the far end
       collapses to a point. */
    /* `fill` is how much of the viewport the sheet spans at the near boards
       (>1 crops the side boards out, which is what a phone wants); `base` is
       where the near goal-line end of the ice sits down the screen. */
    var fill, base;
    if (port) { camZ = -26; camH = 20; fill = 1.9;  base = 0.93; }
    else      { camZ = -46; camH = 17; fill = 0.94; base = 0.97; }
    var dn = -camZ;
    f  = fill * W * dn / (2 * HW);
    hz = base * H - f * camH / dn;
  }

  /* Pinhole projection. Straight lines in the world stay straight on screen,
     so a quad only ever needs its corners. */
  function P(x, y, z) {
    var d = Math.max(0.4, z - camZ);
    return { x: CX + f * x / d, y: hz + f * (camH - y) / d, s: f / d };
  }

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var q = P(pts[i][0], pts[i][1] || 0, pts[i][2]);
      i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }

  /* A line painted across the sheet, revealed from the centre out. */
  function lineAcross(z, w, col, k) {
    if (k <= 0) return;
    var x = HW * k;
    poly(ictx, [[-x, 0, z - w], [x, 0, z - w], [x, 0, z + w], [-x, 0, z + w]], col);
  }

  /* A circle on the ice, drawn as a world-space polygon so perspective is
     free. `k` sweeps it on like a paint line. */
  function circle(cx, cz, r, col, lw, k) {
    if (k <= 0) return;
    var n = 64, i, a, q, started = false;
    ictx.beginPath();
    for (i = 0; i <= n * k; i++) {
      a = (i / n) * Math.PI * 2 - Math.PI / 2;
      q = P(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
      started ? ictx.lineTo(q.x, q.y) : (ictx.moveTo(q.x, q.y), started = true);
    }
    ictx.strokeStyle = col;
    ictx.lineWidth = Math.max(1, P(0, 0, cz).s * lw);
    ictx.stroke();
  }

  function dot(cx, cz, r, col) {
    var q = P(cx, 0, cz), rr = Math.max(1.2, q.s * r);
    ictx.beginPath();
    ictx.ellipse(q.x, q.y, rr, rr * 0.34, 0, 0, 7);
    ictx.fillStyle = col; ictx.fill();
  }

  /* ---- the arena beyond the sheet ---------------------------------------- */
  var LED = 'SOFTWARE ENGINEERING  ·  APPLIED ML  ·  AUTONOMOUS SYSTEMS  ·  UCLA COMPUTER SCIENCE  ·  ';

  function arena(now, paint) {
    var wallTop = P(0, 16, LEN).y;

    var g = ictx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04080e');
    g.addColorStop(0.42, '#0b1826');
    g.addColorStop(1, '#070e18');
    ictx.fillStyle = g;
    ictx.fillRect(-W, -H, W * 3, H * 3);

    /* rink lighting rigs */
    [0.2, 0.5, 0.8].forEach(function (lx) {
      var rg = ictx.createRadialGradient(W * lx, -H * 0.1, 0, W * lx, -H * 0.1, H * 0.6);
      rg.addColorStop(0, 'rgba(206,228,246,.14)');
      rg.addColorStop(1, 'rgba(206,228,246,0)');
      ictx.fillStyle = rg;
      ictx.fillRect(0, -H, W, H + wallTop);
    });

    /* the end wall, wider than the sheet */
    var wl = P(-HW * 3.4, 0, LEN), wr = P(HW * 3.4, 0, LEN), wy = P(0, GLASS_H, LEN).y;
    ictx.fillStyle = '#0a1726';
    ictx.fillRect(wl.x, wallTop, wr.x - wl.x, wy - wallTop);
    ictx.fillStyle = 'rgba(255,255,255,.03)';
    ictx.fillRect(wl.x, wallTop, wr.x - wl.x, (wy - wallTop) * 0.5);

    /* name painted across the back wall — measured, so the two words sit
       side by side at any viewport */
    var ns = P(0, 0, LEN).s, fs = ns * 4.6;
    if (fs > 9) {
      ictx.save();
      ictx.textAlign = 'left';
      ictx.textBaseline = 'middle';
      ictx.font = '500 ' + fs.toFixed(1) + 'px Oswald, "Arial Narrow", sans-serif';
      var gap = fs * 0.26;
      var w1 = ictx.measureText('DANIEL').width, w2 = ictx.measureText('XIAO').width;
      var x0 = CX - (w1 + gap + w2) / 2, ny = lerp(wallTop, wy, 0.46);
      var al = 0.18 + 0.4 * paint;
      ictx.fillStyle = 'rgba(233,239,244,' + al * 0.62 + ')';
      ictx.fillText('DANIEL', x0, ny);
      ictx.lineWidth = Math.max(0.8, fs * 0.035);
      ictx.strokeStyle = 'rgba(233,239,244,' + al * 0.78 + ')';
      ictx.strokeText('XIAO', x0 + w1 + gap, ny);
      ictx.restore();
    }

    /* LED ribbon board */
    var r0 = P(-HW * 3.4, GLASS_H, LEN), r1 = P(HW * 3.4, GLASS_H + 1.15, LEN);
    var bh = Math.abs(r1.y - r0.y);
    if (bh > 5) {
      ictx.save();
      ictx.beginPath();
      ictx.rect(r0.x, r1.y, r1.x - r0.x, bh);
      ictx.clip();
      ictx.fillStyle = '#060d16';
      ictx.fillRect(r0.x, r1.y, r1.x - r0.x, bh);
      ictx.font = '500 ' + (bh * 0.42).toFixed(1) + 'px "JetBrains Mono", ui-monospace, monospace';
      ictx.textBaseline = 'middle';
      ictx.fillStyle = 'rgba(141,197,247,.72)';
      var tw = ictx.measureText(LED).width;
      var off = -((now * 0.058) % tw);
      for (var i = 0; off + i * tw < r1.x - r0.x + tw; i++) {
        ictx.fillText(LED, r0.x + off + i * tw, r1.y + bh * 0.54);
      }
      ictx.restore();
    }
  }

  /* ---- the sheet --------------------------------------------------------- */
  function sheet(paint) {
    /* ice surface, cooler as it runs away from the camera */
    var yFar = P(0, 0, LEN).y, yNear = P(0, 0, 0).y;
    var g = ictx.createLinearGradient(0, yFar, 0, yNear);
    g.addColorStop(0, ICE_LO);
    g.addColorStop(0.45, '#d8e4ee');
    g.addColorStop(1, ICE_HI);
    poly(ictx, [[-HW, 0, 0], [HW, 0, 0], [HW, 0, LEN], [-HW, 0, LEN]], g);

    /* a wash of reflected light down the middle */
    var rg = ictx.createLinearGradient(0, yFar, 0, yNear);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(1, 'rgba(255,255,255,.5)');
    ictx.save();
    poly(ictx, [[-HW, 0, 0], [HW, 0, 0], [HW, 0, LEN], [-HW, 0, LEN]]);
    ictx.clip();
    ictx.fillStyle = rg;
    ictx.fillRect(0, yFar, W, yNear - yFar);
    ictx.restore();

    /* markings, painted on in order: goal lines, blue lines, centre, circles */
    var k1 = sstep(0.01, 0.06, paint);
    var k2 = sstep(0.04, 0.10, paint);
    var k3 = sstep(0.07, 0.13, paint);
    var k4 = sstep(0.10, 0.17, paint);

    lineAcross(GOAL_N, 0.05, RED, k1);
    lineAcross(GOAL_F, 0.05, RED, k1);
    lineAcross(BLUE_N, 0.3, BLUE, k2);
    lineAcross(BLUE_F, 0.3, BLUE, k2);
    lineAcross(MID, 0.3, RED, k3);

    /* creases */
    [GOAL_N, GOAL_F].forEach(function (gz, i) {
      var dir = i ? -1 : 1, n = 28, a, q, started = false;
      if (k1 <= 0) return;
      ictx.beginPath();
      for (var j = 0; j <= n; j++) {
        a = (j / n) * Math.PI;
        q = P(Math.cos(a) * 1.8, 0, gz + dir * Math.sin(a) * 1.8);
        started ? ictx.lineTo(q.x, q.y) : (ictx.moveTo(q.x, q.y), started = true);
      }
      ictx.closePath();
      ictx.fillStyle = 'rgba(126,181,232,.42)'; ictx.fill();
      ictx.strokeStyle = RED; ictx.lineWidth = Math.max(1, P(0, 0, gz).s * 0.05); ictx.stroke();
    });

    /* end-zone circles (red) and the centre circle (blue) */
    [[-6.7, 10], [6.7, 10], [-6.7, 51], [6.7, 51]].forEach(function (c) {
      circle(c[0], c[1], 4.5, RED, 0.05, k4);
      dot(c[0], c[1], 0.3, RED);
    });
    circle(0, MID, 4.5, BLUE, 0.05, k4);
    dot(0, MID, 0.3, BLUE);
    [[-6.7, 25], [6.7, 25], [-6.7, 36], [6.7, 36]].forEach(function (c) {
      if (k4 > 0.5) dot(c[0], c[1], 0.3, RED);
    });

    /* nets: 6 ft wide, 4 ft tall, mesh bellying out behind the goal line */
    [GOAL_N, GOAL_F].forEach(function (gz, i) {
      if (k1 < 0.6) return;
      var dir = i ? 1 : -1, x = 0.92, dz = 1.12, hgt = 1.22;
      var lw = Math.max(1.2, P(0, 0, gz).s * 0.055);

      /* the mesh, seen through */
      poly(ictx, [[-x, 0, gz], [x, 0, gz], [x, 0, gz + dir * dz], [-x, 0, gz + dir * dz]], 'rgba(188,208,226,.3)');
      poly(ictx, [[-x, 0, gz + dir * dz], [x, 0, gz + dir * dz], [x, hgt * 0.6, gz + dir * dz], [-x, hgt * 0.6, gz + dir * dz]], 'rgba(214,228,240,.52)');
      poly(ictx, [[-x, 0, gz], [-x, 0, gz + dir * dz], [-x, hgt * 0.78, gz + dir * dz], [-x, hgt, gz]], 'rgba(220,232,243,.42)');
      poly(ictx, [[x, 0, gz], [x, 0, gz + dir * dz], [x, hgt * 0.78, gz + dir * dz], [x, hgt, gz]], 'rgba(220,232,243,.42)');

      /* frame */
      ictx.strokeStyle = RED;
      ictx.lineWidth = lw;
      [[-x, gz], [x, gz]].forEach(function (pst) {
        var a = P(pst[0], 0, pst[1]), b = P(pst[0], hgt, pst[1]);
        ictx.beginPath(); ictx.moveTo(a.x, a.y); ictx.lineTo(b.x, b.y); ictx.stroke();
      });
      var cl = P(-x, hgt, gz), cr = P(x, hgt, gz);
      ictx.beginPath(); ictx.moveTo(cl.x, cl.y); ictx.lineTo(cr.x, cr.y); ictx.stroke();
    });
  }

  function boards() {
    /* the boards nearest the camera, closing off the bottom of the frame */
    poly(ictx, [[-HW * 2.4, 0, 0], [HW * 2.4, 0, 0], [HW * 2.4, BOARD_H, 0], [-HW * 2.4, BOARD_H, 0]], '#e7eef5');
    var na = P(-HW * 2.4, BOARD_H, 0), nc = P(HW * 2.4, BOARD_H, 0);
    ictx.beginPath(); ictx.moveTo(na.x, na.y); ictx.lineTo(nc.x, nc.y);
    ictx.strokeStyle = RED; ictx.lineWidth = 2.5; ictx.stroke();

    [-1, 1].forEach(function (s) {
      var x = HW * s;
      poly(ictx, [[x, 0, 0], [x, 0, LEN], [x, BOARD_H, LEN], [x, BOARD_H, 0]], '#eef3f7');
      poly(ictx, [[x, BOARD_H, 0], [x, BOARD_H, LEN], [x, GLASS_H, LEN], [x, GLASS_H, 0]], 'rgba(150,186,214,.2)');
      var a = P(x, BOARD_H, 0), b = P(x, BOARD_H, LEN);
      ictx.beginPath(); ictx.moveTo(a.x, a.y); ictx.lineTo(b.x, b.y);
      ictx.strokeStyle = RED; ictx.lineWidth = 2; ictx.stroke();
    });
  }

  /* ---- the puck ---------------------------------------------------------- */
  function puckAt(u) {
    var n = LEGS.length - 1;
    var s = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(s)), k = s - i;
    var e = k * k * (3 - 2 * k);
    return { x: lerp(LEGS[i].x, LEGS[i + 1].x, e), z: lerp(LEGS[i].z, LEGS[i + 1].z, e), leg: i, k: k };
  }

  /* Physically a puck is 7.6 cm across, which is under a pixel at centre ice.
     Floor it at something you can actually see. */
  function puckR(s) { return Math.max(port ? 6 : 7.5, s * 0.1); }

  /* A puck is a disc on edge: an ellipse for the top, a band for the side. */
  function drawPuck(ctx, x, y, r, tilt) {
    var h = r * (tilt == null ? 0.5 : tilt);
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.5, r, r * 0.33, 0, 0, 7);
    ctx.fillStyle = '#080b0f'; ctx.fill();
    ctx.beginPath();
    ctx.rect(x - r, y, r * 2, h * 0.5);
    ctx.fillStyle = '#0d1116'; ctx.fill();

    var g = ctx.createLinearGradient(x - r, y - r * 0.33, x + r, y + r * 0.33);
    g.addColorStop(0, '#272e37');
    g.addColorStop(0.45, '#161c23');
    g.addColorStop(1, '#0c1016');
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.33, 0, 0, 7);
    ctx.fillStyle = g; ctx.fill();
    if (r > 14) {
      ctx.lineWidth = Math.max(0.6, r * 0.035);
      ctx.strokeStyle = 'rgba(196,216,234,.34)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.82, r * 0.27, 0, 0, 7);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(0.5, r * 0.05);
    ctx.strokeStyle = 'rgba(190,212,232,.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.33, 0, 0, 7);
    ctx.stroke();
  }

  /* Ice kicked up where a skate stopped or a pass was received. */
  function sprayMark(cx, cz, dir, grow, seed) {
    if (grow <= 0) return;
    var R = rng(seed), q = P(cx, 0, cz), s = q.s, g = Math.min(1, grow);
    ictx.save();
    ictx.globalAlpha = 0.9 * (1 - Math.pow(g, 2.2));
    for (var i = 0; i < 44; i++) {
      var a = dir + (R() - 0.5) * 1.5;
      var d = (0.3 + R() * 2.4) * g;
      var p2 = P(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d * 0.6);
      var rr = Math.max(0.7, s * (0.03 + R() * 0.07));
      ictx.beginPath();
      ictx.ellipse(p2.x, p2.y, rr, rr * 0.5, 0, 0, 7);
      ictx.fillStyle = 'rgba(255,255,255,' + (0.45 + R() * 0.5) + ')';
      ictx.fill();
    }
    ictx.restore();
  }


  /* ---- the skater --------------------------------------------------------- */
  /* Built joint by joint in metres off the ice and run through the same
     pinhole projection as everything else, so he foreshortens correctly as he
     closes on the camera instead of just scaling up. One stride phase drives
     the legs and arms; `cut` is how hard he is leaning into a turn. */

  /* His two sweaters, so the figure on the ice matches the number on the
     scoreboard instead of contradicting it. */
  var KITS = {
    home: { body: '#eef3f7', sleeve: '#cfdbe6', trim: '#2a6ebb', pants: '#16233a', socks: '#2a6ebb' },
    away: { body: '#e0ae45', sleeve: '#b9842c', trim: '#2a6ebb', pants: '#16233a', socks: '#2a6ebb' }
  };
  var KIT = KITS[root.dataset.kit === 'away' ? 'away' : 'home'];
  document.addEventListener('kitchange', function (e) {
    KIT = KITS[e.detail === 'away' ? 'away' : 'home'];
  });

  function limb(ctx, pts, w, col, cap) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineWidth = Math.max(1, w);
    ctx.strokeStyle = col;
    ctx.lineCap = cap || 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function skater(ctx, x, z, headX, phase, cut, puck) {
    var q0 = P(x, 0, z), s = q0.s;
    if (s <= 0 || q0.y < -H || q0.y > H * 2) return;

    /* Metres -> a point, at this skater's depth. */
    function J(dx, y, dz) { return P(x + dx, y, z + dz); }

    var sw = Math.sin(phase), cw = Math.cos(phase);
    var side = headX >= 0 ? 1 : -1;

    /* He is skating toward the camera, so "forward" is -z: the shoulders and
       head lead the skates down the sheet, and he leans further the harder he
       is cutting. Metres, not degrees — it all goes through P() anyway. */
    var lean   = 0.46 + Math.abs(cut) * 0.26;
    var hipDz  = -lean * 0.30, hipY  = 0.86;
    var shDz   = -lean * 0.95, shY   = 1.38;
    var headDz = -lean * 1.26, headY = 1.66;
    var tilt   = cut * 0.42;                       /* roll into the turn */

    /* --- legs: one drives out and back, the other recovers underneath ----- */
    var pushL = Math.max(0,  sw), pushR = Math.max(0, -sw);
    var liftL = pushR * 0.17,     liftR = pushL * 0.17;

    var hipL = J(-0.15 + tilt * 0.3, hipY, hipDz), hipR = J(0.15 + tilt * 0.3, hipY, hipDz);
    var ftL  = J(-0.19 - pushL * 0.72 + tilt * 0.3 + liftL * 0.7, liftL,
                 hipDz + pushL * 0.54 - liftL * 0.5);
    var ftR  = J( 0.19 + pushR * 0.72 + tilt * 0.3 - liftR * 0.7, liftR,
                 hipDz + pushR * 0.54 - liftR * 0.5);
    /* knee rides inboard of the line hip->foot, which is what sells a stride */
    var kneeL = J(-0.19 - pushL * 0.3 + tilt * 0.3, 0.46 + liftL * 0.55, hipDz + pushL * 0.2);
    var kneeR = J( 0.19 + pushR * 0.3 + tilt * 0.3, 0.46 + liftR * 0.55, hipDz + pushR * 0.2);
    var lift = liftL, lift2 = liftR;

    var wLeg = s * 0.17, wArm = s * 0.12;

    limb(ctx, [hipL, kneeL, ftL], wLeg, KIT.pants);
    limb(ctx, [hipR, kneeR, ftR], wLeg, KIT.pants);

    /* socks: a band of colour above each skate */
    limb(ctx, [kneeL, ftL], wLeg * 0.86, KIT.socks);
    limb(ctx, [kneeR, ftR], wLeg * 0.86, KIT.socks);

    /* skates + their blades */
    [[ftL, lift], [ftR, lift2]].forEach(function (p) {
      var ft = p[0], up = p[1];
      ctx.beginPath();
      ctx.ellipse(ft.x, ft.y, s * 0.17, s * 0.075, 0, 0, 7);
      ctx.fillStyle = '#0b0f14'; ctx.fill();
      if (up < 0.02) {                                  /* blade bites the ice */
        ctx.beginPath();
        ctx.ellipse(ft.x, ft.y + s * 0.05, s * 0.2, s * 0.03, 0, 0, 7);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
      }
    });

    /* --- torso: wide pads, narrow waist ---------------------------------- */
    var twist = sw * 0.1;                          /* shoulders counter the legs */
    var shL = J(-0.33 + tilt, shY, shDz + twist), shR = J(0.33 + tilt, shY, shDz - twist);
    ctx.beginPath();
    ctx.moveTo(hipL.x, hipL.y); ctx.lineTo(shL.x, shL.y);
    ctx.lineTo(shR.x, shR.y);   ctx.lineTo(hipR.x, hipR.y);
    ctx.closePath();
    ctx.fillStyle = KIT.body; ctx.fill();

    /* a blue yoke across the shoulders reads as the jersey at any size */
    var ykL = J(-0.31 + tilt, shY - 0.2, shDz + twist), ykR = J(0.31 + tilt, shY - 0.2, shDz - twist);
    ctx.beginPath();
    ctx.moveTo(shL.x, shL.y); ctx.lineTo(shR.x, shR.y);
    ctx.lineTo(ykR.x, ykR.y); ctx.lineTo(ykL.x, ykL.y);
    ctx.closePath();
    ctx.fillStyle = KIT.trim; ctx.fill();

    /* --- arms: the far one on the stick, the near one driving ------------ */
    var topHand = J(side * 0.12 + tilt + cw * 0.14, 1.08, shDz - 0.3);
    var lowHand = J(side * 0.5  + tilt + cw * 0.22, 0.84, shDz - 0.62);
    limb(ctx, [shL, J(-0.3 + tilt + cw * 0.16, 1.14, shDz - 0.14), topHand], wArm, KIT.sleeve);
    limb(ctx, [shR, J( 0.34 + tilt - cw * 0.16, 1.12, shDz - 0.2),  lowHand], wArm, KIT.sleeve);
    /* gloves */
    [topHand, lowHand].forEach(function (p2) {
      ctx.beginPath(); ctx.ellipse(p2.x, p2.y, wArm * 0.78, wArm * 0.78, 0, 0, 7);
      ctx.fillStyle = KIT.trim; ctx.fill();
    });

    /* --- stick: blade stays on the puck ---------------------------------- */
    var blade = puck ? P(puck.x, 0.02, puck.z) : J(side * 0.9 + tilt, 0.02, shDz - 1.5);
    limb(ctx, [topHand, lowHand, blade], Math.max(1, s * 0.045), '#2b3440', 'round');
    limb(ctx, [blade, P((puck ? puck.x : x + side * 0.9) + side * 0.26, 0.02,
                        (puck ? puck.z : z) - 0.08)], Math.max(1, s * 0.07), '#161c24', 'round');

    /* --- helmet ----------------------------------------------------------- */
    var hd = J(tilt + 0.02, headY, headDz), hr = s * 0.15;
    ctx.beginPath(); ctx.ellipse(hd.x, hd.y, hr, hr * 1.04, 0, 0, 7);
    ctx.fillStyle = KIT.trim; ctx.fill();
    /* cage */
    ctx.beginPath();
    ctx.ellipse(hd.x, hd.y + hr * 0.5, hr * 0.74, hr * 0.56, 0, 0, Math.PI);
    ctx.fillStyle = 'rgba(16,22,32,.82)'; ctx.fill();
  }


  /* ---- the warm-up lap ---------------------------------------------------- */
  /* He is on the ice before the puck is: one slow curl around the far end
     while the lines are still painting themselves on, finishing exactly where
     the rush collects him — so the rush reads as him picking the puck up
     rather than a puck appearing out of nothing. */

  var LAP_C = { x: 0.5, z: 50.5 }, LAP_R = 10.57, LAP_A0 = 0.79, LAP_A1 = 3.39;

  function lapAt(w) {
    var e = w < 0.5 ? 2 * w * w : 1 - Math.pow(2 - 2 * w, 2) / 2;   /* ease in-out */
    var a = lerp(LAP_A0, LAP_A1, e);
    return { x: LAP_C.x + Math.cos(a) * LAP_R, z: LAP_C.z + Math.sin(a) * LAP_R, a: a };
  }

  /* Two hairlines a blade-width apart, left on the sheet behind him. */
  function bladeCuts(w) {
    if (w <= 0.01) return;
    var N = 60, steps = Math.max(1, Math.ceil(w * N));
    ictx.save();
    ictx.lineWidth = 1;
    ictx.strokeStyle = 'rgba(10,26,43,.06)';
    for (var e2 = -1; e2 <= 1; e2 += 2) {
      ictx.beginPath();
      for (var i = 0; i <= steps; i++) {
        var q = lapAt(i / N);
        var s2 = P(q.x + Math.cos(q.a) * 0.17 * e2, 0, q.z + Math.sin(q.a) * 0.17 * e2);
        i ? ictx.lineTo(s2.x, s2.y) : ictx.moveTo(s2.x, s2.y);
      }
      ictx.stroke();
    }
    ictx.restore();
  }

  function rush(p, now) {
    var u = clamp((p - P_RUSH) / (P_SHOT - P_RUSH), 0, 1);
    var b = puckAt(u);

    /* marks left at each waypoint already passed */
    for (var i = 1; i < LEGS.length; i++) {
      var wp = P_RUSH + (i / (LEGS.length - 1)) * (P_SHOT - P_RUSH);
      if (p < wp) continue;
      var next = LEGS[Math.min(LEGS.length - 1, i)];
      var prev = LEGS[i - 1];
      sprayMark(next.x, next.z, Math.atan2(prev.z - next.z, prev.x - next.x),
                clamp((p - wp) / 0.1, 0, 1), 20 + i * 7);
    }

    if (u <= 0 || u >= 1) {
      if (u <= 0) {
        var w = clamp(p / P_RUSH, 0, 1);
        var lp = lapAt(w);
        var tx = -Math.sin(lp.a);                     /* tangent to the arc */
        var reach = Math.hypot(lp.x - LEGS[0].x, lp.z - LEGS[0].z) < 3.2;
        var q0 = P(LEGS[0].x, 0, LEGS[0].z);
        bladeCuts(w);
        skater(ictx, lp.x, lp.z, tx, w * 34, clamp(tx, -1, 1) * 0.45, reach ? LEGS[0] : null);
        drawPuck(ictx, q0.x, q0.y, puckR(q0.s));
      }
      return b;
    }

    /* trail along the ice */
    for (var j = 1; j <= 9; j++) {
      var t2 = puckAt(u - j * 0.012);
      var qt = P(t2.x, 0, t2.z);
      var rt = puckR(qt.s) * (1 - j / 11);
      ictx.beginPath();
      ictx.ellipse(qt.x, qt.y, rt * 1.4, rt * 0.5, 0, 0, 7);
      ictx.fillStyle = 'rgba(255,255,255,' + (0.3 - j * 0.03) + ')';
      ictx.fill();
    }

    /* The carrier: a stick-length behind the puck, facing the way he is
       going. Drawn before the puck so the blade tucks under it. */
    var ah = puckAt(u + 0.012), bh = puckAt(u - 0.012);
    var vx = ah.x - bh.x, vz = ah.z - bh.z;
    var vl = Math.hypot(vx, vz) || 1;
    var sx = b.x - (vx / vl) * 1.45, sz = b.z - (vz / vl) * 1.45;
    skater(ictx, sx, sz, vx, u * 46, clamp(vx / vl, -1, 1), b);

    /* snow off the blades once he is really moving */
    if (u > 0.04) sprayMark(sx, sz + 0.2, Math.atan2(vz, vx) + Math.PI,
                            0.35 + 0.3 * Math.abs(vx / vl), 91);

    var q = P(b.x, 0, b.z);
    drawPuck(ictx, q.x, q.y, puckR(q.s));
    return b;
  }

  /* ---- the shot ---------------------------------------------------------- */
  function shot(t, now) {
    var from = LEGS[LEGS.length - 1];
    var st = P(from.x, 0.1, from.z);
    var ex = CX, ey = H * 0.46;
    var e = t * t;
    var x = lerp(st.x, ex, e), y = lerp(st.y, ey, e);
    var r0 = puckR(st.s), rEnd = Math.hypot(W, H) * 0.62;
    var r = r0 * Math.pow(rEnd / r0, Math.pow(t, 2.4));

    /* speed lines */
    if (t > 0.18) {
      var sa = (t - 0.18) / 0.82, Rm = Math.hypot(W, H) / 2;
      fctx.lineCap = 'round';
      for (var i = 0; i < 50; i++) {
        var an = i * 2.39996;
        var ph = (i * 0.618 + now * 0.0012 * (1 + (i % 3) * 0.4)) % 1;
        var rr = Rm * (0.22 + ph * 0.92), len = Rm * (0.07 + 0.24 * sa) * (0.5 + (i % 5) / 5);
        fctx.strokeStyle = 'rgba(255,255,255,' + (0.42 * sa * (1 - ph * 0.6)) + ')';
        fctx.lineWidth = 1 + (i % 3) * 0.7;
        fctx.beginPath();
        fctx.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
        fctx.lineTo(x + Math.cos(an) * (rr + len), y + Math.sin(an) * (rr + len));
        fctx.stroke();
      }
    }

    drawPuck(fctx, x, y, r, 0.46);

    /* white-out into the hero */
    if (t > 0.86) {
      fctx.fillStyle = 'rgba(244,246,248,' + sstep(0.86, 1, t) + ')';
      fctx.fillRect(0, 0, W, H);
    }
  }

  /* ---- ice spray behind the resolved hero -------------------------------- */
  function sprayBurst(g) {
    if (!spctx || !sprayCv) return;
    var a = fit(sprayCv), w = a.w, h = a.h, d = a.d;
    spctx.setTransform(d, 0, 0, d, 0, 0);
    spctx.clearRect(0, 0, w, h);
    if (g <= 0) return;

    var R = rng(4181), m = Math.min(w, h);
    var cx = w * 0.5, cy = h * (port ? 0.3 : 0.46);
    var e = 1 - Math.pow(1 - Math.min(1, g), 3);
    var fade = clamp(1 - (g - 1) * 3.2, 0, 1);

    /* the mist hanging where the puck hit */
    var mist = spctx.createRadialGradient(cx, cy, 0, cx, cy, m * 0.62 * e);
    mist.addColorStop(0, 'rgba(203,220,235,' + (0.5 * fade * (1 - e * 0.55)) + ')');
    mist.addColorStop(1, 'rgba(203,220,235,0)');
    spctx.fillStyle = mist;
    spctx.fillRect(0, 0, w, h);

    /* shavings. Cool grey-blue, not white — on an off-white page white is
       invisible, and real shavings carry the ice's own colour. */
    for (var i = 0; i < 230; i++) {
      var an   = R() * Math.PI * 2;
      var bias = 0.42 + Math.pow(R(), 2.1) * 0.75;          /* dense near the hit */
      var dist = bias * m * 0.92 * e;
      var px = cx + Math.cos(an) * dist * 1.5;
      var py = cy + Math.sin(an) * dist * 0.82;
      if (px < -40 || px > w + 40 || py < -40 || py > h + 40) continue;
      var rr = m * (0.0025 + Math.pow(R(), 1.6) * 0.016) * (1 - bias * 0.45);
      if (rr <= 0.25) continue;
      spctx.save();
      spctx.translate(px, py);
      spctx.rotate(an * 1.7 + R() * 2);
      spctx.globalAlpha = clamp((0.3 + R() * 0.62) * (1 - bias * 0.42) * fade, 0, 1);
      var t = R();
      spctx.fillStyle = t > 0.72 ? '#ffffff' : t > 0.3 ? '#d2e0ec' : '#b2c6d8';
      spctx.beginPath();
      spctx.ellipse(0, 0, rr * (1.3 + R() * 1.6), rr * 0.46, 0, 0, 7);
      spctx.fill();
      spctx.restore();
    }

    /* the puck, come to rest where it landed */
    var k = clamp((g - 0.26) / 0.34, 0, 1);
    if (k > 0) {
      var pr = m * (port ? 0.032 : 0.026);
      var drop = (1 - k) * (1 - k) * 90;
      spctx.save();
      spctx.globalAlpha = k * fade;
      spctx.beginPath();
      spctx.ellipse(cx, cy + pr * 0.85, pr * 1.6 * k, pr * 0.44 * k, 0, 0, 7);
      spctx.fillStyle = 'rgba(86,108,128,.26)';
      spctx.fill();
      drawPuck(spctx, cx, cy - drop, pr);
      spctx.restore();
    }
  }

  /* The page lands on the hero. The opening is something a visitor can choose
     to watch, not a corridor they have to walk down first — so by default the
     stage is folded away and nothing here runs at all. */
  function fold(on) {
    root.classList.toggle('folded', on);
    if (on) root.classList.remove('intro');
    hero.classList.toggle('on', on);
    hero.classList.toggle('settled', on);
    if (board) board.classList.toggle('off', on);
    [hint, skipBtn, ice, fx].forEach(function (el) {
      if (el) el.style.display = on ? 'none' : '';
    });
  }

  /* Reduced motion never gets the sequence at all. */
  if (RM) {
    root.classList.add('rm');
    fold(true);
    return;
  }

  var armed = root.classList.contains('intro');
  if (!armed) fold(true);

  /* ---- drive it ---------------------------------------------------------- */
  var sp = 0, raf = null, running = false, lastFilter = '', fxDirty = false, paintT = 0;
  var heroOn = false, impactT = 0, heroRaf = null, radarIv = null;

  function setHero(on) {
    if (on === heroOn) return;
    heroOn = on;
    hero.classList.toggle('on', on);
    cancelAnimationFrame(heroRaf);
    clearInterval(radarIv);
    if (on) {
      impactT = performance.now();
      (function step(t) {
        var g = (t - impactT) / 1150;
        sprayBurst(g);
        heroRaf = g < 1.25 ? requestAnimationFrame(step) : null;
      })(impactT);
    } else if (spctx) {
      spctx.setTransform(1, 0, 0, 1, 0, 0);
      spctx.clearRect(0, 0, sprayCv.width, sprayCv.height);
    }
  }

  function progress() {
    var r = sec.getBoundingClientRect();
    var tot = sec.offsetHeight - window.innerHeight;
    return tot > 0 ? clamp(-r.top / tot, 0, 1) : 0;
  }

  function frame(now) {
    var target = progress();
    /* Smoothing: the canvas chases the scroll instead of snapping to it. */
    sp += (target - sp) * 0.13;
    if (Math.abs(target - sp) < 0.0004) sp = target;
    var p = sp;

    root.classList.toggle('intro', target < P_END);
    setHero(p >= P_HERO);

    if (hint) hint.style.opacity = p < 0.02 ? '1' : '0';
    if (board) board.classList.toggle('off', p > P_SHOT + 0.02);
    if (skipBtn) skipBtn.style.opacity = p < P_SHOT ? '1' : '0';

    /* scoreboard: clock runs with the rush, passes tick at each waypoint */
    if (clockEl && passEl) {
      var u = clamp((p - P_RUSH) / (P_SHOT - P_RUSH), 0, 1);
      var left = Math.round((1 - u) * 26 + 974);
      clockEl.textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
      var n = p < P_RUSH ? 0 : Math.min(LEGS.length - 1, Math.floor(u * (LEGS.length - 1) + 0.0001));
      passEl.textContent = ('0' + n).slice(-2);
    }

    /* hero drifts up as you scroll out of the stage */
    if (p >= P_HERO && heroIn) {
      var hp = clamp((p - P_HERO) / (1 - P_HERO), 0, 1);
      heroIn.style.transform = 'translate3d(0,' + (-hp * 3.5) + 'vh,0)';
      if (sprayCv) sprayCv.style.transform = 'translate3d(0,' + (-hp * 7) + 'vh,0)';
      hero.classList.toggle('settled', hp > 0.12);
    }

    if (p < P_HERO) {
      ictx.setTransform(D, 0, 0, D, 0, 0);
      ictx.clearRect(0, 0, W, H);

      /* the shot pushes the camera in and shakes it loose */
      var t = p > P_SHOT ? (p - P_SHOT) / (P_HERO - P_SHOT) : 0;
      var k = 1 + 0.26 * t * t, sx = 0, sy = 0;
      if (t > 0.8) {
        var amp = (t - 0.8) / 0.2;
        sx = (Math.random() - 0.5) * 11 * amp;
        sy = (Math.random() - 0.5) * 11 * amp;
      }
      ictx.setTransform(D * k, 0, 0, D * k, D * (CX * (1 - k) + sx), D * (H * 0.46 * (1 - k) + sy));

      var paint = clamp((now - paintT) / 1250, 0, 1);
      arena(now, paint);
      sheet(paint);
      rush(p, now);
      boards();

      var flt = t > 0
        ? 'blur(' + (8 * sstep(0.22, 0.8, t)).toFixed(1) + 'px) brightness(' + (1 - 0.42 * sstep(0.05, 0.5, t)).toFixed(2) + ')'
        : '';
      if (flt !== lastFilter) { ice.style.filter = flt; lastFilter = flt; }

      fctx.setTransform(D, 0, 0, D, 0, 0);
      fctx.clearRect(0, 0, W, H);
      fxDirty = true;

      if (p >= P_SHOT) {
        shot(t, now);
        if (callEl) {
          callEl.classList.add('on');
          callEl.style.setProperty('--k', String(sstep(0, 0.35, t)));
          callEl.style.setProperty('--out', String(1 - sstep(0.72, 0.92, t)));
        }
        if (radarEl) radarEl.textContent = String(Math.round(148 * sstep(0, 0.6, t)));
      } else if (callEl) {
        callEl.classList.remove('on');
      }
    } else if (fxDirty) {
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, fx.width, fx.height);
      fxDirty = false;
      if (lastFilter) { ice.style.filter = ''; lastFilter = ''; }
      if (callEl) callEl.classList.remove('on');
    }

    raf = running ? requestAnimationFrame(frame) : null;
  }

  size();
  window.addEventListener('resize', function () {
    size();
    if (heroOn) sprayBurst(9);
  });

  /* Only burn frames while the stage is actually on screen. Landing deeper in
     the page (a #projects deep link) must still clear the intro state. */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!armed) { running = false; return; }
      running = e.isIntersecting;
      if (running && !paintT) paintT = performance.now();
      if (running && !raf) raf = requestAnimationFrame(frame);
      if (!running) {
        root.classList.remove('intro');
        if (!heroOn) { setHero(true); sprayBurst(9); }
      }
    });
  }, { threshold: 0 });
  io.observe(sec);

  /* Skip puts the page back the way it opened. */
  function stop() {
    armed = false;
    running = false;
    cancelAnimationFrame(raf); raf = null;
    cancelAnimationFrame(heroRaf); clearInterval(radarIv);
    sp = 0; paintT = 0; heroOn = false;
    if (lastFilter) { ice.style.filter = ''; lastFilter = ''; }
    fold(true);
    if (heroIn) heroIn.style.transform = '';
    if (sprayCv) sprayCv.style.transform = '';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  if (skipBtn) skipBtn.addEventListener('click', stop);

  /* The one way in: the "watch the opening" link in the hero. */
  window.playOpening = function () {
    if (armed) return;
    armed = true;
    fold(false);
    root.classList.add('intro');
    sp = 0; paintT = 0; heroOn = false;
    size();
    window.scrollTo({ top: sec.offsetTop, behavior: 'auto' });
    running = true;
    if (!raf) raf = requestAnimationFrame(frame);
  };
})();
