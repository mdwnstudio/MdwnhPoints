/* +60: نقطة الماااسية — the show for a +60 award.

   Everything on screen is a pure function of t, the seconds since the sound
   (sounds/5 Fajr.mp3) started; the beats are the owner's own marks from
   sfx-lab/plan.json. The clock is the AudioContext's, so the picture cannot
   drift off the sound, and any frame can be drawn alone (seek).

   Space is بدر's (MaqrMdwnh, ختام خطة بدر): painted once, drawn every frame
   under three star depths, pushed a little further in contrast and colour.

   Layers, back to front: one canvas (the ground, space, stars, speed lines,
   crystals), the world (the count, the 60 sticker, the avatar and its crown:
   DOM moved only by transform and opacity), one canvas (dust, shards, sparks,
   flashes), the button.

   Motion rules (motion-design skill): every move has a cause on the sound;
   moves overlap (the next starts about halfway through the one before);
   arrivals settle, exits accelerate, gravity eases in; shakes only on impacts;
   nothing ever holds still. */
(function () {
'use strict';

let BASE = './';
const SRC = {
  sound: 'sounds/5 Fajr.mp3',
  s10: 'points-stickers/10.webp',
  s60: 'points-stickers/60.webp',
  crown: 'plus60/crown.webp',
  logo: 'plus60/logo.webp',
};
const href = k => BASE + SRC[k].split('/').map(encodeURIComponent).join('/');

// The beats, in seconds of the sound.
const T = {
  black: 0.110,                 // the screen goes black
  fall: 1.36, land: 1.839,      // falls onto the floor, contact on 1.839
  push0: 1.839, push1: 6.525,   // the slow push in on the avatar
  charge0: 4.315, charge1: 6.16, // a long wind-up…
  jump: 6.16, top: 6.467,       // …then one fast jump; hits the top of the screen
  space: 6.525,                 // cut to space
  hits: [6.981, 7.126, 7.291, 7.487, 7.803, 8.028, 8.374, 8.574],   // the +10 crystals
  st0: 8.798, st1: 11.646,      // the 60 sticker rises and settles
  ant: 11.646, slam: 12.514,    // winds up, hits the avatar
  num0: 13.920, num1: 15.159,   // the count appears, lands on the new total
  crown: 19.780, crownFall: 0.44,
  go: 21.6,                     // the button
};
const LAST_HIT = T.hits[T.hits.length - 1];
// plus60/crown.webp: the crown (w × h, in GoldCrown.png's pixels) with `pad` of glow on every side
const CROWN = { w: 966, h: 827, pad: 110, box: 966 + 2 * 110 };

// ---------- the motion toolkit (motion-design skill, code-recipes) ----------
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
function bez(x1, y1, x2, y2) {
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 26; i++) {
      u = (lo + hi) / 2;
      const bx = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
      if (bx < x) lo = u; else hi = u;
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
}
const E = {
  out: bez(0.16, 1, 0.3, 1),      // arrive and settle
  in: bez(0.7, 0, 0.84, 0),       // leave, or fall: exits at speed
  io: bez(0.72, 0, 0.28, 1),      // travel between two rests
  soft: bez(0.45, 0, 0.55, 1),    // gentle change in place
  back: bez(0.34, 1.56, 0.64, 1), // pop with a small overshoot
  ssh: bez(0.01, 0, 0, 1),        // Fares' sharp start hard: struck, then a long glide
  ssm: bez(0.32, 0, 0, 1),        // sharp start medium: a fast launch without the shock
};
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rnd(i) * 2 - 1, rnd(i + 1) * 2 - 1, u); };
const decay = (t, T0, k) => t >= T0 ? Math.exp(-(t - T0) * k) : 0;
const wob = (t, T0, f, k) => t >= T0 ? Math.sin((t - T0) * f) * Math.exp(-(t - T0) * k) : 0;
const TAU = Math.PI * 2;

// Impacts only: [time, strength, length]. Shake = trauma², on noise.
const SHAKES = [
  [T.land, 0.32, 0.3], [T.top, 0.55, 0.3], [T.space, 1, 0.95],
  ...T.hits.map(h => [h, 0.45, 0.32]),
  [T.slam, 1, 0.8], [T.num1, 0.3, 0.3], [T.crown, 0.75, 0.5],
];

// ---------- audio ----------
let AC = null, unlocked = false;
const cache = { buf: null, bufP: null, img: {} };

function ac() {
  if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); }
  return AC;
}
// Called straight from the press, before any await: Safari only lets a sound
// start from a gesture, and the show starts after the loading circle.
function unlock() {
  const c = ac();
  if (!c) return;
  try { c.resume(); } catch (_) {}
  if (unlocked) return;
  try {
    const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
    unlocked = true;
  } catch (_) {}
}
function loadSound() {
  if (cache.buf) return Promise.resolve(cache.buf);
  if (cache.bufP) return cache.bufP;
  const c = ac();
  if (!c) return Promise.resolve(null);
  cache.bufP = fetch(href('sound'))
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((res, rej) => {
      const p = c.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    }))
    .then(b => (cache.buf = b))
    .catch(e => { console.warn('[+60] sound', e); cache.bufP = null; return null; });
  return cache.bufP;
}
function loadImg(src, key) {
  if (key && cache.img[key]) return Promise.resolve(cache.img[key]);
  return new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    // decode() can wait for the tab to be visible, so it is never awaited
    im.onload = () => { if (key) cache.img[key] = im; if (im.decode) im.decode().catch(() => {}); res(im); };
    im.onerror = () => res(null);
    im.src = src;
  });
}

// Everything the show needs, while the button shows its loading circle.
function preload(opts = {}) {
  if (opts.base != null) BASE = opts.base;
  clearTimeout(cache.dropT);
  const jobs = [
    loadSound(),
    loadImg(href('s10'), 's10'), loadImg(href('s60'), 's60'), loadImg(href('crown'), 'crown'), loadImg(href('logo'), 'logo'),
    opts.avatar ? loadImg(opts.avatar) : Promise.resolve(null),
    document.fonts && document.fonts.load ? document.fonts.load('900 100px Norsal').catch(() => {}) : null,
  ];
  const all = Promise.all(jobs).then(r => ({ sound: !!r[0], avatar: r[5] }));
  // A weak link never blocks the award for long: after 9 s the show goes on
  // with whatever arrived (the picture keeps its own clock without the sound).
  return Promise.race([all, new Promise(res => setTimeout(() => res({ sound: !!cache.buf, avatar: null, slow: true }), 9000))]);
}

// ---------- the show ----------
function play(host, opts = {}) {
  const rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
  const S = { rm, low, raf: 0, dead: false, front: false, manual: opts.manual ? 0 : null };

  // DOM
  const root = el('div', 'p60');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `+60 نقطة الماااسية${opts.name ? ' لـ ' + opts.name : ''}`);
  const bg = el('canvas', 'p60-bg'), fx = el('canvas', 'p60-fx');
  const world = el('div', 'p60-world');
  const num = el('div', 'p60-num');
  const numGlow = el('span', 'p60-num__glow'), numTxt = el('span', 'p60-num__txt');
  num.append(numGlow, numTxt);
  // the new total echoed above and below it once it lands: [rows away, opacity]
  const ECHO = [[-3, 0.13], [-2, 0.24], [-1, 0.4], [1, 0.4], [2, 0.24]];
  const echoes = ECHO.map(([k, o]) => { const e = el('div', 'p60-num p60-echo'); e._k = k; e._o = o; return e; });
  const logo = el('img', 'p60-logo');
  logo.alt = '';
  logo.src = href('logo');
  const stk = el('canvas', 'p60-sticker');
  const av = el('div', 'p60-av');
  const disc = el('div', 'p60-av__disc');
  if (opts.avatar) {
    const img = el('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = opts.avatar;
    img.onerror = () => img.replaceWith(initial());
    disc.append(img);
  } else disc.append(initial());
  const rim = el('div', 'p60-av__rim'), flash = el('div', 'p60-av__flash');
  const crown = el('img', 'p60-crown');
  crown.alt = '';
  crown.src = href('crown');
  av.append(disc, rim, flash, crown);
  world.append(...echoes, logo, num, stk, av);   // the mark stays readable over the echoes
  const foot = el('div', 'p60-foot');
  const note = el('p', 'p60-note');
  note.textContent = 'قم بالتقاط الشاشة وارسلها في التوثيق 📸';
  const go = el('button', 'p60-go');
  go.type = 'button';
  go.textContent = 'متابعة';
  go.addEventListener('click', () => { if (opts.onContinue) opts.onContinue(); });
  foot.append(note, go);
  const scrim = el('div', 'p60-scrim');
  root.append(bg, world, fx, scrim, foot);
  host.append(root);
  const bgc = bg.getContext('2d'), fxc = fx.getContext('2d');

  function initial() {
    const d = el('div', 'p60-av__initial');
    d.textContent = (opts.name || '?').trim().charAt(0);
    return d;
  }

  // ---------- layout + baked art (rebuilt on resize) ----------
  let L, dpr, art;
  function measure() {
    const W = Math.max(1, root.clientWidth), H = Math.max(1, root.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
    if (W * H * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (W * H));
    const A = Math.round(Math.min(W * 0.42, H * 0.30));
    const to = opts.to != null ? opts.to : 60;
    const digits = String(Math.max(Math.abs(to), Math.abs(opts.from || 0))).length + (opts.from == null ? 1 : 0);
    const F = Math.round(Math.min(W * 0.88 / (Math.max(3, digits) * 0.7), H * 0.26));   // Norsal Black digits run ~0.7 em
    const Ny = H * 0.5 + (H > W ? 0.17 : 0.15) * H;              // the count's centre
    const Yend = Ny - F * 0.34 - A * 0.57 + A * 0.16;               // the avatar stands over the top of it
    L = {
      W, H, A, F, U: Math.min(W, H), cx: W / 2, cy: H / 2,
      gy: H * 0.66,                    // the floor
      Ymid: H * 0.64,                  // where the flight holds (room ahead, above)
      Yrest: H * 0.5 + A * 0.44,       // the rest pose, under the sticker
      Yend, Ny,
      S: Math.round(A * 1.12),         // the sticker
      Vmax: H * 2.3,                   // px a second of the camera's climb
    };
    for (const c of [bg, fx]) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
    }
    av.style.width = av.style.height = A + 'px';
    av.style.setProperty('--p60-a', A + 'px');
    crown.style.width = Math.round(A * 0.66 * CROWN.box / CROWN.w) + 'px';   // the crown is 0.66 A; the rest is room for its glow
    for (const n of [num, ...echoes]) {
      n.style.fontSize = F + 'px';
      n.style.setProperty('--p60-stroke', Math.max(1.6, F * 0.011).toFixed(1) + 'px');
    }
    num.style.setProperty('--p60-glow', Math.round(F * 0.05) + 'px');
    L.logoW = Math.round(clamp(W * 0.32, 116, 210));
    logo.style.width = L.logoW + 'px';
    // Where the closing slide takes the camera: the crown-to-count group centred between
    // the logo and the screenshot line (measured from the footing's own layout).
    const crownTop = Yend - A * 0.97, countFoot = Ny + F * 0.38;
    const logoFoot = Math.max(16, H * 0.045) + L.logoW * 207 / 640 + H * 0.02;
    const noteTop = foot.offsetTop + note.offsetTop - H * 0.02;
    L.slide = clamp((crownTop + countFoot) / 2 - (logoFoot + noteTop) / 2, -H * 0.06, H * 0.15);
    art = bake();
  }

  function bake() {
    const q = Math.min(dpr, 1.5);
    return {
      space: paintSpace(L.W, L.H, q, low),
      stars: makeStars(L.W, L.H, low),
      vignette: paintVignette(L.W, L.H),
      spot: paintSpot(),
      crystal: paintCrystal(L.A * 0.44, dpr),
      sticker: paintSticker(stk, L.S, dpr),
      lines: Array.from({ length: low ? 18 : 28 }, (_, i) => ({ x: rnd(i + 3), y: rnd(i + 40), l: 0.12 + 0.36 * rnd(i + 77), w: 1 + 1.6 * rnd(i + 9), a: 0.18 + 0.32 * rnd(i + 21), sp: 0.8 + 0.6 * rnd(i + 55) })),
      streaks: Array.from({ length: 6 }, (_, i) => ({ x: rnd(i + 900), y: rnd(i + 950), l: 0.5 + 0.5 * rnd(i + 990), w: 5 + 9 * rnd(i + 999) })),
    };
  }

  // ---------- the camera's climb in space (px travelled upward) ----------
  // Full speed through the crystals, then a long exponential glide to rest.
  const vAt = t => {
    if (t < T.space) return 0;
    if (t < LAST_HIT) return L.Vmax * (1 - 0.18 * Math.exp(-(t - T.space) / 0.18));
    return vAt(LAST_HIT - 1e-6) * Math.exp(-(t - LAST_HIT) / 0.75);
  };
  const D = t => {
    if (t <= T.space) return 0;
    const u = Math.min(t, LAST_HIT) - T.space;
    let d = L.Vmax * (u - 0.18 * 0.18 * (1 - Math.exp(-u / 0.18)));
    if (t > LAST_HIT) d += vAt(LAST_HIT - 1e-6) * 0.75 * (1 - Math.exp(-(t - LAST_HIT) / 0.75));
    return d;
  };

  // ---------- the avatar ----------
  const groundY = () => L.gy - L.A / 2;
  const zoomK = t => 1 + 0.3 * Math.pow(seg(t, T.push0, T.push1), 1.5);
  // The jump is one move: it leaves the floor already moving and only ever speeds up,
  // so it never hangs in the air on the way to the top.
  // The squash springs out into a stretch while the body speeds up; the two are
  // balanced so the top of the avatar never slows down on the way up.
  const jumpF = t => { const p = seg(t, T.jump, T.top); return 0.5 * p + 0.5 * Math.pow(p, 2.8); };
  function jumpSy(t) {
    const p = seg(t, T.jump, T.top);
    return 0.83 + 0.4 * (1 - Math.pow(1 - p, 1.6));
  }
  // How high the jump goes (world px) so its top meets the top of the screen on T.top.
  function jumpLen() {
    const y0 = groundY(), A = L.A, k = zoomK(T.top), sy = jumpSy(T.top);
    return A / 2 - A * sy + y0 / k;
  }

  // The flight path in space, before impacts: the base the crystals are placed on.
  function flightBase(t) {
    const { A, H } = L;
    const start = H + 0.75 * A;
    let y = start + (L.Ymid - start) * E.ssm(seg(t, T.space, T.space + 0.85))
      + (L.Yrest - L.Ymid) * E.soft(seg(t, T.space + 0.45, 10.4))
      + (L.Yend - L.Yrest) * E.soft(seg(t, T.slam + 0.3, T.slam + 1.8));
    const run = 1 - E.soft(seg(t, 8.3, 9.6));
    let x = L.cx + A * 0.22 * Math.sin((t - T.space) * 2.7 + 0.5) * run;
    const fl = E.soft(seg(t, 8.2, 10.5));
    x += fl * (A * 0.04 * Math.sin(0.47 * t + 2) + A * 0.014 * Math.sin(1.1 * t));
    y += fl * (A * 0.045 * Math.sin(0.71 * t) + A * 0.016 * Math.sin(1.37 * t + 1.1));
    return { x, y, fl };
  }

  // { x, y, r, sx, sy, s, flash, world } — world: drawn under the ground camera
  function avatarAt(t) {
    const A = L.A;
    if (t < T.space) {
      const y0 = groundY();
      // anchor 1: the feet stay on the floor while it squashes
      let x = L.cx, y, sx = 1, sy = 1, anchor = 1, vis = t >= T.fall;
      if (t < T.land) {
        const p = seg(t, T.fall, T.land);
        y = lerp(-A * 1.2, y0, p * p);                 // gravity: accelerates into the floor
        sy = 1 + 0.2 * p * p; sx = 1 - 0.1 * p * p;     // stretched along the fall
      } else {
        const u = t - T.land;
        const q = Math.cos(u * 26) * Math.exp(-u * 8);  // squash on contact, rings down
        sy = 1 - 0.24 * q; sx = 1 + 0.17 * q;
        y = y0;
        const bp = seg(u, 0.05, 0.3);                   // one short bump, heavy
        if (bp > 0 && bp < 1) y -= 0.07 * A * Math.sin(Math.PI * bp);
        const c = E.soft(seg(t, T.charge0, T.charge1 - 0.08));   // the wind-up
        sy *= 1 - 0.17 * c; sx *= 1 + 0.11 * c;
        if (!S.rm) x += noise(t * 38) * 0.03 * A * c * c;
        if (t >= T.jump) {
          sy = jumpSy(Math.min(t, T.top)); sx = 1 / Math.pow(sy, 0.7);
          y = y0 - jumpLen() * jumpF(t);
          x = L.cx;
          if (t >= T.top) {                               // flattened against the top of the screen
            const topW = y0 - y0 / zoomK(T.top);          // the screen's top edge, in world px
            sy = lerp(sy, 0.76, E.out(seg(t, T.top, T.top + 0.045)));
            sx = 1 / Math.pow(sy, 0.6);
            y = topW + (A / 2) * sy;                      // its top stays on the edge
            anchor = 0;
          }
        }
      }
      if (anchor === 1) y += (A / 2) * (1 - sy);
      return { x, y, r: 0, sx, sy, s: 1, flash: 0.6 * decay(t, T.land, 9), world: true, vis };
    }

    const b = flightBase(t);
    let { x, y } = b;
    const u = t - T.space;
    let sy = 1 + 0.16 * (1 - E.out(seg(t, T.space, T.space + 0.7))), sx = 1 / Math.pow(sy, 0.6);
    // What is left of the launch's spin, then a slow turn about itself: time frozen mid-flight.
    let r = S.rm ? 0 : -TAU * (1 - Math.exp(-u / 0.8));
    r += b.fl * (0.17 * Math.sin(0.42 * t + 0.5) + 0.05 * Math.sin(1.3 * t));
    let flashV = 0, sq = 0;
    T.hits.forEach((h, i) => {
      y += 0.11 * A * wob(t, h, 18, 9);                 // knocked back by each crystal
      r += (i % 2 ? 1 : -1) * 0.13 * wob(t, h, 20, 8);
      sq += decay(t, h, 14);
      flashV += 0.5 * decay(t, h, 10);
    });
    // The slam: pushed down, springs back, and stays a size bigger.
    y += 0.2 * A * wob(t, T.slam, 13, 6.5);
    sq += 1.6 * decay(t, T.slam, 9);
    flashV += decay(t, T.slam, 4.5);
    let s = 1 + 0.14 * E.back(seg(t, T.slam, T.slam + 0.5));
    // The crown lands.
    y += 0.06 * A * wob(t, T.crown, 20, 9);
    sq += 0.7 * decay(t, T.crown, 11);
    s *= 1 + 0.012 * Math.sin(2.1 * t) * b.fl;          // breathing
    sy *= 1 - 0.13 * sq; sx *= 1 + 0.09 * sq;
    return { x, y, r, sx, sy, s, flash: clamp(flashV), world: false, vis: true };
  }

  // ---------- the crystals ----------
  const crystals = T.hits.map((h, i) => {
    const b = { x: 0, y: 0 };
    return { T: h, i, b, R: 0.6 + 0.4 * rnd(i + 300), jit: rnd(i + 200) * 2 - 1, spin: (rnd(i + 400) - 0.5) * 2.4, r0: (rnd(i + 500) - 0.5) * 0.6 };
  });
  function placeCrystals() {
    for (const c of crystals) {
      const p = flightBase(c.T);
      const R = L.A * 0.44 * c.R;
      c.rad = R;
      c.x = p.x + c.jit * 0.14 * L.A;
      c.y = p.y - L.A * 0.47 - R * 0.55;              // meets the top of the avatar
    }
  }

  // ---------- the sticker ----------
  function stickerAt(t) {
    if (t < T.st0) return null;
    const A = L.A, Sz = L.S;
    const p = E.ssh(seg(t, T.st0, T.st1));
    const restY = L.Yrest - 0.98 * A;
    let x = lerp(L.cx + 0.4 * A, L.cx, p);
    let y = lerp(L.H + Sz * 1.1, restY, p);
    let r = lerp(-0.55, -0.1, p), s = lerp(1.6, 1, p), o = 1;
    y += 0.03 * A * Math.sin(0.9 * t + 1); r += 0.035 * Math.sin(0.7 * t);
    // Winds up: lifts and leans back, toward the camera…
    const up = E.out(seg(t, T.ant, T.ant + 0.55));
    y -= 0.44 * A * up; s *= 1 + 0.1 * up; r -= 0.18 * up;
    // …then strikes down onto the avatar, landing on the slam frame.
    const k = E.in(seg(t, T.ant + 0.38, T.slam));
    if (k > 0) {
      const a = avatarAt(T.slam - 1e-4);
      const target = a.y - (A / 2) * a.s * a.sy - Sz * 0.24;
      y = lerp(y, target, k); x = lerp(x, a.x, k); r = lerp(r, 0.06, k); s = lerp(s, 0.98, k);
    }
    let sx = 1, sy = 1;
    if (t >= T.slam) {                                 // squashes onto the head and is swallowed by the flash
      const v = seg(t, T.slam, T.slam + 0.12);
      if (v >= 1) return null;
      const a = avatarAt(T.slam);
      y = lerp(y, a.y - A * 0.1, E.in(v));
      sy = 1 - 0.45 * E.out(v); sx = 1 + 0.25 * E.out(v);
      s *= 1 - 0.55 * E.in(v); o = 1 - E.in(v);
    }
    return { x, y, r, s, o, sx, sy };
  }

  // ---------- drawing ----------
  let last = { st: '', av: '', num: '', crown: '', world: '' };
  function setT(elm, key, v) { if (last[key] !== v) { elm.style.transform = v; last[key] = v; } }

  function render(t) {
    if (t < 0) t = 0;
    const { W, H, A } = L;
    // shake
    let tr = 0;
    if (!S.rm) for (const [T0, a, d] of SHAKES) if (t >= T0 && t < T0 + d) tr = Math.max(tr, a * (1 - (t - T0) / d));
    const sh = tr * tr, amp = 0.042 * L.U;
    const shx = amp * sh * noise(t * 28), shy = amp * sh * noise(t * 28 + 100), shr = 0.03 * sh * noise(t * 28 + 200);

    const inSpace = t >= T.space;
    const k = inSpace ? 1 : zoomK(t), P = { x: L.cx, y: groundY() };

    // ---- back canvas ----
    bgc.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgc.clearRect(0, 0, W, H);
    bgc.save();
    bgc.translate(W / 2 + shx, H / 2 + shy); bgc.rotate(shr); bgc.translate(-W / 2, -H / 2);
    // The closing slide: the camera is already gliding down when the screenshot line
    // arrives (its fastest moment is the line's entrance), so the group settles centred
    // above it. One calm move, landed before the line is read.
    const cs = inSpace ? L.slide * E.io(seg(t, T.go - 0.9, T.go + 0.9)) : 0;   // slow in, fast middle, slow out
    if (!inSpace) drawGround(t, k, P);
    else drawSpace(t, cs);
    bgc.restore();

    // ---- the world (DOM) ----
    const wt = inSpace
      ? `translate3d(${shx.toFixed(2)}px,${(shy - cs).toFixed(2)}px,0) rotate(${shr.toFixed(4)}rad)`
      : `translate3d(${(shx + P.x).toFixed(2)}px,${(shy + P.y).toFixed(2)}px,0) rotate(${shr.toFixed(4)}rad) scale(${k.toFixed(4)}) translate(${(-P.x).toFixed(2)}px,${(-P.y).toFixed(2)}px)`;
    setT(world, 'world', wt);

    const a = avatarAt(t);
    av.style.opacity = a.vis ? '1' : '0';
    setT(av, 'av', `translate3d(${(a.x - A / 2).toFixed(2)}px,${(a.y - A / 2).toFixed(2)}px,0) rotate(${a.r.toFixed(4)}rad) scale(${(a.s * a.sx).toFixed(4)},${(a.s * a.sy).toFixed(4)})`);
    flash.style.opacity = a.flash.toFixed(3);

    // crown: falls under gravity onto the head, then rides on it
    if (t >= T.crown - T.crownFall) {
      const p = seg(t, T.crown - T.crownFall, T.crown);
      const cw = A * 0.66, ch = cw * CROWN.h / CROWN.w, pad = cw * CROWN.pad / CROWN.w;
      const restY = -ch * 0.62 - pad;                             // seated on the top of the head
      const drop = (a.y - (A / 2) * a.s + ch * 1.3 + pad * 2) / Math.max(0.5, a.s);   // from just above the top edge
      const y = restY - drop * (1 - p * p);
      const r = -0.12 + 0.7 * (1 - p) * (1 - p) + 0.14 * wob(t, T.crown, 18, 8);
      const sq = 0.2 * decay(t, T.crown, 12) * Math.cos((t - T.crown) * 30);
      crown.style.opacity = '1';
      setT(crown, 'crown', `translate3d(-50%,${y.toFixed(2)}px,0) rotate(${r.toFixed(4)}rad) scale(${(1 + sq * 0.7).toFixed(4)},${(1 - sq).toFixed(4)})`);
    } else if (last.crown !== 'off') { crown.style.opacity = '0'; last.crown = 'off'; }

    // the sticker
    const st = stickerAt(t);
    if (st) {
      if (!S.front && t > T.ant) {
        const bottom = st.y + (L.S / 2) * st.s * 0.8, top = a.y - (A / 2) * a.s * a.sy;
        if (bottom < top) { S.front = true; stk.classList.add('is-front'); }   // swapped while clear of each other: no snap
      }
      stk.style.opacity = st.o.toFixed(3);
      const bs = L.S * 1.5;
      setT(stk, 'st', `translate3d(${(st.x - bs / 2).toFixed(2)}px,${(st.y - bs / 2).toFixed(2)}px,0) rotate(${st.r.toFixed(4)}rad) scale(${(st.s * st.sx).toFixed(4)},${(st.s * st.sy).toFixed(4)})`);
    } else if (last.st !== 'off') { stk.style.opacity = '0'; last.st = 'off'; }
    if (t < T.ant && S.front) { S.front = false; stk.classList.remove('is-front'); }

    // the count
    drawCount(t);

    // ---- front canvas ----
    fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxc.clearRect(0, 0, W, H);
    fxc.save();
    fxc.translate(W / 2 + shx, H / 2 + shy); fxc.rotate(shr); fxc.translate(-W / 2, -H / 2);
    if (!inSpace) { fxc.save(); fxc.translate(P.x, P.y); fxc.scale(k, k); fxc.translate(-P.x, -P.y); drawGroundFx(t, a); fxc.restore(); }
    else drawSpaceFx(t, a, st);
    fxc.restore();

    drawLogo(t, inSpace, cs);
    drawFoot(t);
  }

  // The studio's mark rides at the top of space: it drops in just after the cut and stays.
  // It is on a far plane, so the closing slide moves it only a fifth as much.
  function drawLogo(t, inSpace, cs) {
    if (!inSpace) { if (last.logo !== 'off') { logo.style.opacity = '0'; last.logo = 'off'; } return; }
    const lh = L.logoW * 207 / 640, top = Math.max(16, L.H * 0.045);
    const p = E.out(seg(t, T.space + 0.12, T.space + 1.0));
    const y = lerp(-lh * 1.4, top, p) + 0.004 * L.H * Math.sin(0.8 * t) + cs * 0.8;
    logo.style.opacity = (0.92 * E.soft(seg(t, T.space + 0.12, T.space + 0.45))).toFixed(3);
    setT(logo, 'logo', `translate3d(${(L.cx - L.logoW / 2).toFixed(2)}px,${y.toFixed(2)}px,0)`);
  }

  // The screenshot line and متابعة: the line first, the button just behind it, on a dark
  // footing so the line reads over the echoed rows.
  function drawFoot(t) {
    const a = E.soft(seg(t, T.go - 0.3, T.go + 0.6));
    const n = E.out(seg(t, T.go, T.go + 0.7)), g = E.out(seg(t, T.go + 0.14, T.go + 0.84));
    const key = a.toFixed(3) + n.toFixed(3) + g.toFixed(3);
    if (last.foot === key) return;
    last.foot = key;
    scrim.style.opacity = a.toFixed(3);
    note.style.opacity = n.toFixed(3);
    note.style.transform = `translate3d(0,${(18 * (1 - n)).toFixed(2)}px,0)`;
    go.style.opacity = g.toFixed(3);
    go.style.transform = `translate3d(0,${(22 * (1 - g)).toFixed(2)}px,0)`;
    go.style.pointerEvents = g > 0.5 ? 'auto' : 'none';
  }

  // The black stage: a floor lit from above, the avatar's shadow, the charge.
  function drawGround(t, k, P) {
    const c = bgc, { W, H, A } = L;
    c.fillStyle = `rgba(3,3,9,${E.in(seg(t, 0, T.black)).toFixed(3)})`;
    c.fillRect(-W, -H, W * 3, H * 3);
    if (t < T.black) return;
    c.save();
    c.translate(P.x, P.y); c.scale(k, k); c.translate(-P.x, -P.y);
    const charge = E.in(seg(t, T.charge0, T.charge1));
    const leave = E.in(seg(t, T.jump, T.top));
    let lit = E.soft(seg(t, 0.35, 1.6)) * (0.75 + 0.55 * decay(t, T.land, 5) + 0.5 * charge) * (1 - 0.6 * leave);
    if (!S.rm) lit *= 1 + 0.04 * Math.sin(t * 9) * charge;
    // the cone and the pool
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp(lit * 0.55);
    // the beam fades out into the floor, and the floor's light dies away into the dark
    const coneW = A * 2.6;
    c.drawImage(art.spot.cone, L.cx - coneW / 2, -H * 0.4, coneW, L.gy + H * 0.4 + A * 0.18);
    c.globalAlpha = clamp(lit * 0.55);
    c.drawImage(art.spot.pool, L.cx - A * 2.6, L.gy - A * 0.55, A * 5.2, A * 1.1);
    c.globalAlpha = clamp(lit);
    c.drawImage(art.spot.pool, L.cx - A * 1.5, L.gy - A * 0.3, A * 3, A * 0.6);
    c.globalCompositeOperation = 'source-over';
    // the shadow: smaller and lighter the higher the avatar is
    const a = avatarAt(t);
    if (a.vis) {
      const hgt = Math.max(0, L.gy - (a.y + A / 2 * a.sy));
      const f = 1 / (1 + hgt / (A * 0.9));
      c.globalAlpha = 0.6 * f * (1 - leave);
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(a.x, L.gy, A * 0.46 * f * a.sx, A * 0.09 * f, 0, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // charge: sparks drawn in toward the avatar, faster and denser as it winds up
    if (t > T.charge0 && t < T.jump + 0.1) drawCharge(c, t);
    c.restore();
  }

  function drawCharge(c, t) {
    const A = L.A, N = S.low ? 56 : 92, cy = groundY() + A * 0.08;
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const born = T.charge0 + Math.pow(i / N, 0.75) * (T.charge1 - T.charge0 - 0.15);
      const life = 0.42 + 0.3 * rnd(i + 11) - 0.18 * (i / N);
      const p = seg(t, born, born + life);
      if (p <= 0 || p >= 1) continue;
      const ang = rnd(i + 17) * TAU, R0 = A * (0.95 + 0.75 * rnd(i + 29));
      const e = E.in(p), r = lerp(R0, A * 0.42, e), r2 = lerp(R0, A * 0.42, E.in(Math.max(0, p - 0.12)));
      const x = L.cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.8;
      const x2 = L.cx + Math.cos(ang) * r2, y2 = cy + Math.sin(ang) * r2 * 0.8;
      const col = i % 3 === 0 ? '69,196,185' : i % 3 === 1 ? '247,208,56' : '255,255,255';
      c.strokeStyle = `rgba(${col},${(0.9 * Math.sin(Math.PI * p)).toFixed(3)})`;
      c.lineWidth = A * (0.012 + 0.014 * rnd(i + 5));
      c.beginPath(); c.moveTo(x2, y2); c.lineTo(x, y); c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawGroundFx(t, a) {
    const c = fxc, A = L.A;
    puffs(c, t, T.land, 16, L.cx, L.gy, A, 0.9, 2);
    if (t >= T.jump) {
      puffs(c, t, T.jump, 14, L.cx, L.gy, A, 1.1, 7);
      ring(c, t, T.jump, L.cx, L.gy, A * 0.5, A * 1.8, 0.35, 0.25, 'rgba(255,255,255,', 0.28);
    }
    if (t >= T.top) {                                   // the bonk on the top edge
      const p = seg(t, T.top, T.top + 0.3);
      const topW = groundY() - groundY() / zoomK(T.top);
      c.strokeStyle = `rgba(255,255,255,${(1 - p).toFixed(3)})`;
      c.lineWidth = A * 0.025;
      for (let i = 0; i < 6; i++) {                      // out from both sides of the contact, clear of the face
        const ang = Math.PI * (i < 3 ? 0.04 + 0.11 * i : 0.96 - 0.11 * (i - 3));
        const r0 = A * (0.6 + 0.35 * E.out(p)), r1 = r0 + A * 0.28 * (1 - p);
        c.beginPath();
        c.moveTo(a.x + Math.cos(ang) * r0, topW + Math.sin(ang) * r0 * 0.5);
        c.lineTo(a.x + Math.cos(ang) * r1, topW + Math.sin(ang) * r1 * 0.5);
        c.stroke();
      }
    }
  }

  function puffs(c, t, T0, n, x0, y0, A, spread, seed) {
    const p0 = seg(t, T0, T0 + 0.75);
    if (p0 <= 0 || p0 >= 1) return;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, sp = 0.35 + 0.65 * rnd(i + seed * 31);
      const p = E.out(p0);
      const x = x0 + dir * A * (0.25 + spread * sp * p);
      const y = y0 - A * (0.05 + 0.22 * rnd(i + seed * 17) * p);
      const r = A * (0.05 + 0.08 * rnd(i + seed * 7)) * (0.7 + 1.1 * p);
      c.globalAlpha = 0.5 * (1 - p0) * (1 - p0);
      c.drawImage(art.spot.puff, x - r, y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
  }

  function ring(c, t, T0, x, y, r0, r1, len, w, rgba, a0) {
    const p = seg(t, T0, T0 + len);
    if (p <= 0 || p >= 1) return;
    const e = E.out(p);
    c.strokeStyle = rgba + (a0 * (1 - p)).toFixed(3) + ')';
    c.lineWidth = Math.max(1, L.A * w * 0.1 * (1 - p));
    c.beginPath(); c.ellipse(x, y, lerp(r0, r1, e), lerp(r0, r1, e) * (y === L.gy ? 0.22 : 1), 0, 0, TAU); c.stroke();
  }

  // Space: the painted sky (far, barely moves), three star depths, the speed lines.
  // cs: the closing slide (px the camera has glided down); the sky follows it in depth.
  function drawSpace(t, cs = 0) {
    const c = bgc, { W, H } = L;
    const d = D(t), v = vAt(t) / L.Vmax;
    // the slam reaches the sky too: it swells and settles
    const pulse = S.rm ? 0 : 0.05 * decay(t, T.slam, 3.2) * Math.cos((t - T.slam) * 9);
    const sc = 1.08 + pulse;
    c.save();
    c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2);
    const sp = art.space, tw = W, th = H;
    let ox = (-(t * 14) % tw + tw) % tw, oy = (((d - cs) * 0.1) % th + th) % th;
    for (let ix = -1; ix <= 0; ix++) for (let iy = -1; iy <= 0; iy++)
      c.drawImage(sp, ox + ix * tw, oy + iy * th, tw + 1, th + 1);
    c.restore();
    // two slow washes of light (full-screen fills: skipped on weaker phones)
    if (!S.low) {
      c.globalCompositeOperation = 'screen';
      wash(c, W * (0.28 + 0.07 * Math.sin(t * 0.21)), H * (0.3 + 0.06 * Math.cos(t * 0.17)), Math.max(W, H) * 0.6, '113,58,184', 0.16);
      wash(c, W * (0.74 + 0.06 * Math.cos(t * 0.19)), H * (0.72 + 0.05 * Math.sin(t * 0.23)), Math.max(W, H) * 0.55, '0,132,193', 0.12);
    }
    c.globalCompositeOperation = 'lighter';
    // stars
    const push = S.rm ? 0 : 0.1 * decay(t, T.slam, 3);
    for (const Lr of art.stars) {
      const stretch = S.rm ? 0 : v * (4 + 36 * Lr.f);
      for (const s of Lr.list) {
        let x = (s.x * (W + 20) - t * 14 * Lr.f) % (W + 20); if (x < 0) x += W + 20; x -= 10;
        let y = (s.y * (H + 20) + (d - cs) * Lr.f * 0.55) % (H + 20); if (y < 0) y += H + 20; y -= 10;
        if (push) { x += (x - W / 2) * push * Lr.f; y += (y - H / 2) * push * Lr.f; }
        const al = s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.p));
        c.fillStyle = `rgba(${s.c},${al.toFixed(2)})`;
        c.fillRect(x - s.s / 2, y - s.s / 2 - stretch, s.s, s.s + stretch);
        if (Lr.glint && stretch < 2) { c.fillRect(x - s.s * 2.2, y - 0.5, s.s * 4.4, 1); c.fillRect(x - 0.5, y - s.s * 2.2, 1, s.s * 4.4); }
      }
    }
    // anime speed lines, streaming down past the climb
    if (!S.rm && v > 0.02) {
      for (const ln of art.lines) {
        const len = ln.l * H, span = H + len;
        let y = (ln.y * span * 3 + d * 1.7 * ln.sp) % span - len;
        c.fillStyle = `rgba(235,232,255,${(ln.a * v).toFixed(3)})`;
        c.fillRect(ln.x * W, y, ln.w, len);
      }
    }
    c.globalCompositeOperation = 'source-over';
    // crystals still on their way down
    for (const cr of crystals) {
      if (t >= cr.T) continue;
      const y = cr.y + (d - D(cr.T));
      if (y < -cr.rad * 2) continue;
      const sz = cr.rad * 2.3;
      c.save();
      c.translate(cr.x + Math.sin(t * 2 + cr.i) * L.A * 0.02, y);
      c.rotate(cr.r0 + cr.spin * t);
      c.drawImage(art.crystal, -sz / 2, -sz / 2, sz, sz);
      c.restore();
    }
    c.drawImage(art.vignette, 0, 0, W, H);
  }

  function wash(c, x, y, r, rgb, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, L.W, L.H);
  }

  function drawSpaceFx(t, a, st) {
    const c = fxc, { W, H, A } = L;
    const d = D(t), v = vAt(t) / L.Vmax;
    // foreground streaks: the nearest plane, big and faint, fastest
    if (!S.rm && v > 0.05) {
      c.globalCompositeOperation = 'lighter';
      for (const s of art.streaks) {
        const len = s.l * H, span = H + len;
        const y = (s.y * span * 2 + d * 3.2) % span - len;
        c.fillStyle = `rgba(200,190,255,${(0.07 * v).toFixed(3)})`;
        c.fillRect(s.x * W, y, s.w, len);
      }
      c.globalCompositeOperation = 'source-over';
    }
    // crystals bursting
    for (const cr of crystals) {
      if (t < cr.T || t > cr.T + 1) continue;
      const dy = d - D(cr.T);
      burst(c, t, cr.T, cr.x, cr.y + dy, cr.rad, cr.i * 50, 11, ['69,196,185', '180,240,255', '255,255,255', '247,208,56'], 0.9, true);
      flashDot(c, t, cr.T, cr.x, cr.y + dy, cr.rad * 2.2, 0.16);
    }
    // the sticker's own sparkle while it rests
    if (st && t > T.st0 + 0.4 && t < T.slam) {
      const on = E.soft(seg(t, T.st0 + 0.4, T.st0 + 1.2));
      for (let i = 0; i < 7; i++) {
        const ang = rnd(i + 70) * TAU, rr = L.S * (0.5 + 0.18 * rnd(i + 80)) * st.s;
        const tw = Math.max(0, Math.sin(t * (2 + 2 * rnd(i + 90)) + i * 2.1));
        sparkle(c, st.x + Math.cos(ang) * rr, st.y + Math.sin(ang) * rr, A * 0.05 * tw * on, `rgba(255,248,220,${(0.95 * tw * on).toFixed(3)})`);
      }
    }
    // the slam
    if (t >= T.slam && t < T.slam + 1.2) {
      const hx = a.x, hy = a.y - A * 0.45;
      c.fillStyle = `rgba(255,255,255,${(0.42 * decay(t, T.slam, 9)).toFixed(3)})`;
      c.fillRect(-W, -H, W * 3, H * 3);
      ring(c, t, T.slam, hx, hy, A * 0.5, A * 3.6, 0.75, 0.6, 'rgba(247,208,56,', 0.9);
      ring(c, t, T.slam + 0.06, hx, hy, A * 0.4, A * 2.6, 0.7, 0.35, 'rgba(169,139,230,', 0.8);
      burst(c, t, T.slam, hx, hy, A * 0.9, 7000, S.low ? 30 : 46, ['247,208,56', '169,139,230', '255,255,255', '245,101,73', '113,58,184'], 1.1, false);
    }
    // the count lands
    if (t >= T.num1 && t < T.num1 + 1) burst(c, t, T.num1, L.cx, L.Ny, L.F * 0.9, 8000, 18, ['247,208,56', '255,255,255'], 0.9, false, true);
    // the crown lands
    if (t >= T.crown && t < T.crown + 1) {
      const hx = a.x + Math.sin(a.r) * A * 0.55 * a.s, hy = a.y - Math.cos(a.r) * A * 0.55 * a.s;
      burst(c, t, T.crown, hx, hy, A * 0.55, 9000, 18, ['247,208,56', '255,240,200', '255,255,255'], 0.8, false, true);
      ring(c, t, T.crown, hx, hy, A * 0.2, A * 1.4, 0.5, 0.3, 'rgba(255,230,140,', 0.8);
    }
  }

  function flashDot(c, t, T0, x, y, r, len) {
    const p = seg(t, T0, T0 + len);
    if (p <= 0 || p >= 1) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${(0.9 * (1 - p)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Shards (triangles) or sparks flying out from a point; stars = four-point sparkles.
  function burst(c, t, T0, x, y, R, seed, n, cols, life, shards, stars) {
    const p0 = seg(t, T0, T0 + life);
    if (p0 <= 0 || p0 >= 1) return;
    const e = E.out(p0), fade = 1 - p0 * p0;
    for (let i = 0; i < n; i++) {
      const ang = rnd(seed + i) * TAU, sp = 0.5 + rnd(seed + i + 100) * 1.4;
      const dist = R * (0.4 + 2.2 * sp * e);
      const px = x + Math.cos(ang) * dist, py = y + Math.sin(ang) * dist;
      const col = cols[i % cols.length], sz = L.A * (0.03 + 0.05 * rnd(seed + i + 200)) * (1 - 0.5 * p0);
      if (shards) {
        c.save(); c.translate(px, py); c.rotate(ang + p0 * (rnd(seed + i + 300) - 0.5) * 12);
        c.fillStyle = `rgba(${col},${(0.95 * fade).toFixed(3)})`;
        c.beginPath(); c.moveTo(sz * 1.4, 0); c.lineTo(-sz * 0.8, sz * 0.7); c.lineTo(-sz * 0.5, -sz * 0.8); c.closePath(); c.fill();
        c.restore();
      } else if (stars) {
        sparkle(c, px, py, sz * 1.3, `rgba(${col},${(0.95 * fade).toFixed(3)})`);
      } else {
        c.strokeStyle = `rgba(${col},${(0.95 * fade).toFixed(3)})`;
        c.lineWidth = Math.max(1, sz * 0.45);
        const tail = R * 0.35 * (1 - e) + sz;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px - Math.cos(ang) * tail, py - Math.sin(ang) * tail); c.stroke();
      }
    }
  }

  function sparkle(c, x, y, s, fill) {
    if (s < 0.4) return;
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
    c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
    c.fill();
  }

  // The count: your total before, rolling up to the new one, landing on the hit.
  function drawCount(t) {
    if (t < T.num0) {
      if (!last.numOff) { num.style.opacity = '0'; last.numOff = true; drawEchoes(t, ''); }
      return;
    }
    last.numOff = false;
    const F = L.F;
    const from = opts.from, to = opts.to != null ? opts.to : (from != null ? from + 60 : 60);
    const base = from != null ? from : 0;
    // A riser: it climbs faster and faster and is still moving at the end, so the
    // last point only arrives on the hit itself (one short of it until then).
    const p = seg(t, T.num0 + 0.15, T.num1), f = 0.35 * p + 0.65 * Math.pow(p, 2.2);
    const val = t >= T.num1 ? to : Math.min(to - 1, Math.floor(lerp(base, to, f)));
    const txt = (from == null ? '+' : '') + val;
    if (numTxt.textContent !== txt) { numTxt.textContent = txt; numGlow.textContent = txt; }
    drawEchoes(t, txt);
    const inP = E.out(seg(t, T.num0, T.num0 + 0.7));
    let s = 0.92 + 0.08 * inP, y = L.Ny + F * 0.16 * (1 - inP), x = L.cx;
    // lands: grows past, wobbles, keeps a little of the growth
    s += 0.06 * E.back(seg(t, T.num1, T.num1 + 0.4)) + 0.05 * wob(t, T.num1, 16, 6);
    if (!S.rm) { const q = decay(t, T.num1, 9); x += noise(t * 40) * F * 0.02 * q; y += noise(t * 40 + 50) * F * 0.02 * q; }
    s *= 1 + 0.008 * Math.sin(1.6 * t);                    // breathing
    num.style.opacity = E.soft(seg(t, T.num0, T.num0 + 0.3)).toFixed(3);
    numGlow.style.opacity = (t >= T.num1 ? 0.35 + 0.65 * decay(t, T.num1, 2.2) + 0.08 * Math.sin(t * 1.3) : 0).toFixed(3);
    setT(num, 'num', `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${s.toFixed(4)})`);
  }

  // The landed total, echoed in thinner, fainter rows that burst out of it and
  // glide to their places: fast out of the origin, slow into place. The nearer
  // rows lead and the farther ones follow, so they spread as one ripple.
  function drawEchoes(t, txt) {
    const F = L.F, gap = F * 0.92;
    for (const e of echoes) {
      if (t < T.num1) { if (e._on) { e.style.opacity = '0'; e._on = false; } continue; }
      if (e.textContent !== txt) e.textContent = txt;
      const d = Math.abs(e._k), t0 = T.num1 + 0.035 * (d - 1);
      const p = E.out(seg(t, t0, t0 + 1.2));
      const y = L.Ny + e._k * gap * p + 0.004 * F * Math.sin(1.6 * t + e._k);
      const s = (1 - 0.035 * d * p) * (1 + 0.008 * Math.sin(1.6 * t));
      e.style.opacity = (e._o * E.out(seg(t, t0, t0 + 0.3))).toFixed(3);
      e._on = true;
      e.style.transform = `translate3d(${L.cx.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${s.toFixed(4)})`;
    }
  }

  // ---------- clock + loop ----------
  let src = null, gain = null, t0 = 0, p0 = 0;
  function clock() {
    if (S.manual != null) return S.manual;
    if (src && AC) return AC.currentTime - t0;
    return (performance.now() - p0) / 1000;
  }
  function loop() {
    if (S.dead) return;
    S.raf = requestAnimationFrame(loop);
    render(clock());
  }

  let resizeT = 0;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { measure(); placeCrystals(); last = {}; render(clock()); }, 120); };
  window.addEventListener('resize', onResize);

  measure();
  placeCrystals();
  render(0);

  if (S.manual == null) {
    const c = ac();
    if (c && cache.buf) {
      try { c.resume(); } catch (_) {}
      gain = c.createGain();
      gain.gain.value = opts.volume != null ? opts.volume : 1;
      gain.connect(c.destination);
      src = c.createBufferSource();
      src.buffer = cache.buf;
      src.connect(gain);
      t0 = c.currentTime + 0.06;
      src.start(t0);
    } else p0 = performance.now();
    S.raf = requestAnimationFrame(loop);
  }

  return {
    seek(t) { S.manual = t; render(t); },
    get t() { return clock(); },
    // متابعة: the picture keeps moving while it fades away, and the sound takes a few
    // seconds to fade out after it.
    destroy() {
      if (S.leaving) return;
      S.leaving = true;
      window.removeEventListener('resize', onResize);
      if (src && gain && AC) {
        try {
          const now = AC.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.setTargetAtTime(0, now, 0.75);       // ~3 s to silence
          src.stop(now + 3.4);
        } catch (_) {}
      }
      root.style.pointerEvents = 'none';
      root.classList.add('is-leaving');
      setTimeout(() => { S.dead = true; cancelAnimationFrame(S.raf); root.remove(); }, 950);
      // ~14 MB of decoded sound: let it go (the file stays in the HTTP cache), unless
      // another +60 has started loading since
      clearTimeout(cache.dropT);
      cache.dropT = setTimeout(() => { cache.buf = null; cache.bufP = null; }, 3600);
    },
  };
}

// ---------- baked art ----------
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

// بدر's sky, with more contrast and the brand's colours in the clouds of light.
// Tileable both ways: everything near an edge is painted across it too.
function paintSpace(W, H, q, low) {
  const bw = Math.ceil(W * q), bh = Math.ceil(H * q);
  const cv = canvas(bw, bh), c = cv.getContext('2d');
  let seed = 20261031;
  const r = () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  c.fillStyle = '#050717';
  c.fillRect(0, 0, bw, bh);
  const glow1 = (x, y, rad, rgb, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  const glow = (x, y, rad, rgb, a) => {
    for (const ox of [0, -bw, bw]) for (const oy of [0, -bh, bh]) {
      const X = x + ox, Y = y + oy;
      if (X + rad < 0 || X - rad > bw || Y + rad < 0 || Y - rad > bh) continue;
      glow1(X, Y, rad, rgb, a);
    }
  };
  const M = Math.max(bw, bh);
  c.globalCompositeOperation = 'screen';
  glow(bw * 0.28, bh * 0.36, M * 0.5, '113,58,184', 0.55);   // plum
  glow(bw * 0.82, bh * 0.22, M * 0.42, '0,132,193', 0.42);   // sky
  glow(bw * 0.66, bh * 0.84, M * 0.4, '69,196,185', 0.22);   // mint
  glow(bw * 0.08, bh * 0.78, M * 0.3, '245,101,73', 0.16);   // ember
  glow(bw * 0.5, bh * 0.55, M * 0.26, '60,70,190', 0.22);
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9; i++) glow(r() * bw, r() * bh, M * (0.12 + 0.18 * r()), '2,3,12', 0.5 + 0.3 * r());   // dark pools: the contrast
  c.globalCompositeOperation = 'lighter';
  const NEB = ['113,58,184', '0,132,193', '69,196,185', '150,110,230', '247,208,56'];
  for (let i = 0; i < (low ? 26 : 44); i++) glow(r() * bw, r() * bh, M * (0.03 + 0.08 * r()), NEB[(r() * NEB.length) | 0], 0.03 + 0.04 * r());
  const STAR = ['255,255,255', '206,222,255', '226,214,255', '196,240,255', '255,240,214'];
  const n = Math.min(low ? 1800 : 3200, Math.round(bw * bh / 1100));
  const drifts = Array.from({ length: 7 }, () => [r() * bw, r() * bh, M * (0.06 + 0.12 * r())]);
  for (let i = 0; i < n; i++) {
    let x = r() * bw, y = r() * bh;
    if (r() < 0.45) { const d = drifts[(r() * drifts.length) | 0], a = r() * 6.283, rr = d[2] * Math.pow(r(), 0.7); x = ((d[0] + Math.cos(a) * rr) % bw + bw) % bw; y = ((d[1] + Math.sin(a) * rr * 0.7) % bh + bh) % bh; }
    const s = (0.45 + r() * 0.8) * q;
    c.fillStyle = `rgba(${STAR[(r() * STAR.length) | 0]},${(0.15 + 0.6 * r() * r()).toFixed(2)})`;
    c.fillRect(x, y, s, s);
  }
  // warm galaxies, out of focus
  const blurry = (gx, gy, R, rot, tilt, rgb, core) => {
    c.save(); c.translate(gx, gy); c.rotate(rot); c.scale(1, tilt);
    glow1(0, 0, R * 2.3, rgb, 0.22); glow1(0, 0, R * 1.2, rgb, 0.42); glow1(0, 0, R * 0.5, core, 0.9);
    c.restore();
  };
  blurry(bw * 0.2, bh * 0.22, M * 0.05, -0.5, 0.45, '247,208,56', '255,244,200');
  blurry(bw * 0.74, bh * 0.66, M * 0.065, 0.6, 0.38, '245,160,70', '255,236,190');
  // a cool one in focus
  c.save(); c.translate(bw * 0.46, bh * 0.14); c.rotate(-0.4); c.scale(1, 0.46);
  glow1(0, 0, M * 0.05, '150,180,255', 0.3); glow1(0, 0, M * 0.016, '240,240,255', 0.85);
  for (let i = 0; i < (low ? 220 : 420); i++) {
    const tt = r(), ang = (i % 2) * Math.PI + tt * 4.6 + (r() - 0.5) * 0.55, rad = M * 0.04 * (0.08 + tt * 0.95);
    c.fillStyle = `rgba(${r() < 0.5 ? '150,180,255' : '255,255,255'},${(0.1 + (1 - tt) * 0.6).toFixed(2)})`;
    c.fillRect(Math.cos(ang) * rad, Math.sin(ang) * rad, (0.6 + r()) * q, (0.6 + r()) * q);
  }
  c.restore();
  c.globalCompositeOperation = 'source-over';
  return cv;
}

function makeStars(W, H, low) {
  const area = clamp(W * H / (900 * 600), 0.6, 1.8) * (low ? 0.6 : 1);
  const STAR = ['255,255,255', '206,222,255', '226,214,255', '196,240,255', '255,240,214'];
  let i = 0;
  return [[150, 0.25, 0.7, 1.3, 0.6], [70, 0.55, 1.1, 2.0, 0.85], [26, 1, 1.8, 3.0, 1]].map(([cnt, f, s0, s1, a0]) => ({
    f, glint: f > 0.9,
    list: Array.from({ length: Math.round(cnt * area) }, () => {
      i++;
      return { x: rnd(i * 3.1), y: rnd(i * 5.7), s: s0 + rnd(i * 7.3) * (s1 - s0), a: a0 * (0.45 + 0.55 * rnd(i * 2.2)), p: rnd(i * 9.9) * 6.283, tw: 0.7 + rnd(i * 4.4) * 2.4, c: STAR[(rnd(i * 6.6) * STAR.length) | 0] };
    }),
  }));
}

function paintVignette(W, H) {
  const cv = canvas(Math.min(512, W), Math.min(512, H)), c = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(3,3,12,0)'); g.addColorStop(1, 'rgba(3,3,12,0.62)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  return cv;
}

function paintSpot() {
  // The beam: stacked trapezoids, narrower and brighter towards the middle, so its edges are soft.
  const cone = canvas(256, 512), c = cone.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(255,240,214,0)'); g.addColorStop(0.35, 'rgba(255,240,214,0.022)');
  g.addColorStop(0.8, 'rgba(255,240,214,0.055)'); g.addColorStop(1, 'rgba(255,240,214,0)');   // no hard foot
  c.fillStyle = g;
  for (let i = 0; i < 14; i++) {
    const w0 = 10 + i, w1 = 128 - i * 7.5;
    c.beginPath(); c.moveTo(128 - w0, 0); c.lineTo(128 + w0, 0); c.lineTo(128 + w1, 512); c.lineTo(128 - w1, 512); c.closePath(); c.fill();
  }
  const pool = canvas(512, 128), p = pool.getContext('2d');
  const rg = p.createRadialGradient(256, 64, 0, 256, 64, 256);
  rg.addColorStop(0, 'rgba(255,240,214,0.5)'); rg.addColorStop(0.3, 'rgba(255,240,214,0.22)'); rg.addColorStop(0.65, 'rgba(255,240,214,0.06)'); rg.addColorStop(1, 'rgba(255,240,214,0)');
  p.save(); p.scale(1, 0.25); p.translate(0, 192); p.fillStyle = rg; p.fillRect(0, -192, 512, 512); p.restore();
  // a soft puff of dust
  const puff = canvas(64, 64), f = puff.getContext('2d');
  const pg = f.createRadialGradient(32, 32, 0, 32, 32, 32);
  pg.addColorStop(0, 'rgba(214,208,232,0.9)'); pg.addColorStop(0.45, 'rgba(214,208,232,0.45)'); pg.addColorStop(1, 'rgba(214,208,232,0)');
  f.fillStyle = pg; f.fillRect(0, 0, 64, 64);
  return { cone, pool, puff };
}

// A +10 coin sealed in a crystal: a six-sided gem, glassy, catching the light.
function paintCrystal(R, dpr) {
  const sz = Math.ceil(R * 2.3 * Math.min(dpr, 2)), cv = canvas(sz, sz), c = cv.getContext('2d');
  const k = sz / 2.3, cx = sz / 2, cy = sz / 2;
  const pts = [[0, -1], [0.66, -0.42], [0.66, 0.42], [0, 1], [-0.66, 0.42], [-0.66, -0.42]].map(([x, y]) => [cx + x * k, cy + y * k]);
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
  c.save(); c.shadowColor = 'rgba(69,196,185,0.75)'; c.shadowBlur = k * 0.3; path();
  const g = c.createLinearGradient(cx - k, cy - k, cx + k, cy + k);
  g.addColorStop(0, 'rgba(160,250,240,0.55)'); g.addColorStop(0.55, 'rgba(69,150,200,0.35)'); g.addColorStop(1, 'rgba(113,58,184,0.5)');
  c.fillStyle = g; c.fill(); c.restore();
  const coin = cache.img.s10;
  if (coin) { c.save(); path(); c.clip(); const cs = k * 1.12; c.globalAlpha = 0.95; c.drawImage(coin, cx - cs / 2, cy - cs / 2, cs, cs); c.restore(); }
  // facets
  c.save(); path(); c.clip();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[5][0], pts[5][1]); c.lineTo(cx, cy - k * 0.1); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.lineTo(cx, cy - k * 0.1); c.closePath(); c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = 'rgba(30,20,80,0.22)';
  c.beginPath(); c.moveTo(pts[3][0], pts[3][1]); c.lineTo(pts[2][0], pts[2][1]); c.lineTo(cx, cy + k * 0.15); c.lineTo(pts[4][0], pts[4][1]); c.closePath(); c.fill();
  // a glint across the glass
  c.globalCompositeOperation = 'lighter';
  const gl = c.createLinearGradient(cx - k * 0.6, cy - k * 0.8, cx + k * 0.2, cy + k * 0.2);
  gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gl.addColorStop(0.62, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.fillRect(0, 0, sz, sz);
  c.restore();
  path(); c.lineWidth = Math.max(1, k * 0.045); c.strokeStyle = 'rgba(220,255,250,0.85)'; c.stroke();
  return cv;
}

// The 60 sticker composited into the scene: a shadow under it, a warm rim on
// the lit edge, a cool tint from the sky, a purple glow around it.
function paintSticker(cv, Sz, dpr) {
  const q = Math.min(dpr, 2), box = Sz * 1.5;
  cv.width = Math.ceil(box * q); cv.height = Math.ceil(box * q);
  cv.style.width = box + 'px'; cv.style.height = box + 'px';
  const c = cv.getContext('2d');
  c.setTransform(q, 0, 0, q, 0, 0);
  c.clearRect(0, 0, box, box);
  const im = cache.img.s60;
  if (!im) return cv;
  const o = (box - Sz) / 2;
  // glow + shadow (shadowBlur works on Safari's canvas; ctx.filter does not)
  c.save(); c.shadowColor = 'rgba(138,110,240,0.75)'; c.shadowBlur = Sz * 0.16; c.drawImage(im, o, o, Sz, Sz); c.restore();
  c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = Sz * 0.1; c.shadowOffsetY = Sz * 0.07; c.drawImage(im, o, o, Sz, Sz); c.restore();
  // the rim: the silhouette minus itself pushed away from the light
  const rimC = canvas(box * q, box * q), r = rimC.getContext('2d');
  r.setTransform(q, 0, 0, q, 0, 0);
  r.drawImage(im, o, o, Sz, Sz);
  r.globalCompositeOperation = 'source-in';
  r.fillStyle = 'rgb(255,236,190)'; r.fillRect(0, 0, box, box);
  r.globalCompositeOperation = 'destination-out';
  r.drawImage(im, o + Sz * 0.03, o + Sz * 0.035, Sz, Sz);
  // the tint, cool at the foot
  const tint = canvas(box * q, box * q), tc = tint.getContext('2d');
  tc.setTransform(q, 0, 0, q, 0, 0);
  tc.drawImage(im, o, o, Sz, Sz);
  tc.globalCompositeOperation = 'source-atop';
  const g = tc.createLinearGradient(0, o, 0, o + Sz);
  g.addColorStop(0, 'rgba(255,220,160,0.1)'); g.addColorStop(1, 'rgba(30,60,180,0.28)');
  tc.fillStyle = g; tc.fillRect(0, 0, box, box);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(tint, 0, 0);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.9;
  c.drawImage(rimC, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  return cv;
}

window.Plus60 = {
  unlock, preload, play, T,
  config(o) { if (o && o.base != null) BASE = o.base; },
};
})();
