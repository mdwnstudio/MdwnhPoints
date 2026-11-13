/* +45: the dawn. The show for a +45 award, one step under the +60.

   The +30 stays on the page, the +45 rises into the dawn sky, the +60 goes on
   to space. Like the +60, everything on screen is a pure function of t, the
   seconds since the sound (sounds/45 fajr.mp3) started, on the AudioContext's
   clock; the beats are the owner's marks in sfx-lab/plan-plus45.json.

   It starts like the +60 (a spotlit floor, a fall, a wind-up, one jump), tinted
   toward the dawn above it. Then the dawn: an orange horizon under a teal sky,
   a sea of clouds scrolling along the bottom. The avatar shoots up from under
   it and splits it in half; the scene drops into slow motion and the camera
   rises with him as he floats up on what is left of his momentum. The camera
   settles into thirds (avatar left, the rising sun right), the sun's glow
   swells and the +45 grows out of it, and it ends like the +60: the screenshot
   line, متابعة, the camera recentring.

   The dawn is painted once into sprites (sky, stars, moon, high streaks, far
   mountains, sun, clouds) and moved every frame by a camera with parallax: far
   things barely move, near clouds sweep past and keep the frame's edges full.
   Everything is flat like the +45 sticker: two tones, warm underneath from the
   low sun, no shading that reads as a sphere.

   It shares plus60.css for the avatar, the logo and the footing (class `p60`),
   with plus45.css for what is its own. */
(function () {
'use strict';

let BASE = './';
const SRC = {
  sound: 'sounds/45 fajr.mp3',
  s45: 'points-stickers/45.webp',
  logo: 'plus60/logo.webp',
};
const href = k => BASE + SRC[k].split('/').map(encodeURIComponent).join('/');

// The beats, in seconds of the sound.
const T = {
  black: 0.065,                  // black out, the spotlight comes up
  fall: 1.393, land: 1.859,      // falls onto the floor, contact on 1.859
  push0: 1.859, push1: 6.104,    // the slow push in
  charge0: 3.132, charge1: 5.828, // the wind-up, with bubbles
  jump: 5.828, cut: 6.104,       // one rush up, out of the top: cut to the dawn
  enter: 6.19, brk: 6.314,       // the sea of clouds alone, then the avatar splits it
  pops: [6.535, 6.570, 7.061, 7.392],   // what is left of the burst pops like bubbles
  pan0: 9.241, pan1: 10.551,     // the camera settles into thirds
  flare0: 9.5, flare: 10.12,     // the sun's glow swells…
  reveal: 10.551,                // …and the +45 grows out of it
  pulse: 12.062,
  go: 14.879,                    // the screenshot line and متابعة
};

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
  in: bez(0.7, 0, 0.84, 0),       // leave, or fall
  io: bez(0.72, 0, 0.28, 1),      // travel between two rests (camera moves)
  soft: bez(0.45, 0, 0.55, 1),    // gentle change in place
  back: bez(0.34, 1.56, 0.64, 1), // pop with a small overshoot
};
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rnd(i) * 2 - 1, rnd(i + 1) * 2 - 1, u); };
const decay = (t, T0, k) => t >= T0 ? Math.exp(-(t - T0) * k) : 0;
const wob = (t, T0, f, k) => t >= T0 ? Math.sin((t - T0) * f) * Math.exp(-(t - T0) * k) : 0;
const TAU = Math.PI * 2;

// The scene's own clock after the break: it drops to a quarter speed on the
// impact and eases back to full over SLOW seconds (slow motion, then real time).
const SLOW = 2.2, SLOW_MIN = 0.28;
function slowT(t) {
  if (t <= T.brk) return t;
  const u = t - T.brk;
  if (u >= SLOW) return T.brk + SLOW * (SLOW_MIN + (1 - SLOW_MIN) / 2) + (u - SLOW);
  const x = u / SLOW;
  return T.brk + SLOW_MIN * u + (1 - SLOW_MIN) * SLOW * (x * x * x - x * x * x * x / 2);
}

// Impacts only: [time, strength, length]. Shake = trauma², on noise.
const SHAKES = [
  [T.land, 0.3, 0.3], [T.jump, 0.22, 0.2], [T.brk, 0.9, 0.9],
  [T.pops[0], 0.18, 0.22], [T.pops[1], 0.14, 0.22],
];

// ---------- audio + assets ----------
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
    .then(ab => new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }))
    .then(b => (cache.buf = b))
    .catch(e => { console.warn('[+45] sound', e); cache.bufP = null; return null; });
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
    loadSound(), loadImg(href('s45'), 's45'), loadImg(href('logo'), 'logo'),
    opts.avatar ? loadImg(opts.avatar) : Promise.resolve(null),
    document.fonts && document.fonts.load ? document.fonts.load('900 100px Norsal').catch(() => {}) : null,
  ];
  const all = Promise.all(jobs).then(r => ({ sound: !!r[0], avatar: r[3] }));
  // A weak link never blocks the award for long: after 9 s the show goes on with what arrived.
  return Promise.race([all, new Promise(res => setTimeout(() => res({ sound: !!cache.buf, slow: true }), 9000))]);
}

// ---------- the show ----------
function play(host, opts = {}) {
  const rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
  const S = { rm, low, raf: 0, dead: false, leaving: false, manual: opts.manual ? 0 : null };

  // DOM (shared look from plus60.css)
  const root = el('div', 'p60 p45');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `+45 نقطة${opts.name ? ' لـ ' + opts.name : ''}`);
  const bg = el('canvas', 'p60-bg'), fx = el('canvas', 'p60-fx');
  const world = el('div', 'p60-world');
  const logo = el('img', 'p60-logo');
  logo.alt = '';
  logo.src = href('logo');
  const stk = el('canvas', 'p45-sticker');
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
  const rim = el('div', 'p60-av__rim'), grade = el('div', 'p45-grade'), flash = el('div', 'p60-av__flash');
  av.append(disc, grade, rim, flash);
  world.append(logo, stk, av);
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
    dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.6);
    if (W * H * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (W * H));
    const tall = H > W * 1.1;
    // Two subjects share the frame in thirds: on a phone they sit on a diagonal
    // (sun high right, avatar lower left), so both can be bigger.
    const A = Math.round(tall ? Math.min(W * 0.36, H * 0.21) : Math.min(W * 0.2, H * 0.26));
    const R = Math.round(A * 0.62);                                 // the sun's disc
    const floatY = H * (tall ? 0.5 : 0.52), sunY = H * (tall ? 0.29 : 0.33);
    L = {
      W, H, A, R, tall, cx: W / 2, cy: H / 2,
      gy: H * 0.66,                      // the floor (the ground part)
      floatY, sunY,
      horizon: H * (tall ? 0.68 : 0.7),  // the top of the sea of clouds, where it splits
      pan: W / 6,                        // the camera's move into thirds
      rise: H * 0.24,                    // the camera rises with him after the break
      sunX: W * 2 / 3 + 0.15 * W / 6,    // so the far sun lands on the right third
      SB: Math.round(R * 3.08),          // the sticker's box: its yellow disc covers the sun's
      gap: Math.max(A * 1.6, W * 0.34),  // how far the two halves of the sea part
    };
    for (const c of [bg, fx]) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
    }
    av.style.width = av.style.height = A + 'px';
    av.style.setProperty('--p60-a', A + 'px');
    L.logoW = Math.round(clamp(W * 0.3, 112, 200));
    logo.style.width = L.logoW + 'px';
    // The closing slide: the sun-and-avatar group centred between the logo and the screenshot line.
    const groupTop = Math.min(sunY - R * 1.25, floatY - A * 0.6), groupFoot = Math.max(sunY + R * 1.15, floatY + A * 0.6);
    const logoFoot = Math.max(16, H * 0.045) + L.logoW * 207 / 640 + H * 0.02;
    const noteTop = foot.offsetTop + note.offsetTop - H * 0.02;
    L.slide = clamp((groupTop + groupFoot) / 2 - (logoFoot + noteTop) / 2, -H * 0.06, H * 0.15);
    art = bake(W, H, A, dpr, low);
    paintSticker(stk, L.SB, dpr, cache.img.s45);
  }

  // ---------- the camera ----------
  // x: the move into thirds. y: up with him from the break, on the slow clock (negative = up).
  // A layer at depth f moves f times as far as the avatar's plane.
  const camX = t => L.pan * E.io(seg(t, T.pan0, T.pan1));
  const camY = t => t <= T.brk ? 0 : -L.rise * (1 - Math.exp(-(slowT(t) - T.brk) / 0.55));
  const slide = t => L.slide * E.io(seg(t, T.go - 0.9, T.go + 0.9));

  // ---------- the ground part (like the +60's, tinted toward the dawn above) ----------
  const groundY = () => L.gy - L.A / 2;
  const zoomK = t => 1 + 0.26 * Math.pow(seg(t, T.push0, T.push1), 1.5);
  const jumpP = t => seg(t, T.jump, T.cut);
  const jumpF = t => { const p = jumpP(t); return 0.4 * p + 0.6 * Math.pow(p, 2.4); };   // only ever speeds up
  const jumpSy = t => 0.84 + 0.42 * (1 - Math.pow(1 - jumpP(t), 1.6));
  const jumpLen = () => L.A / 2 + groundY() / zoomK(T.cut) + L.A * 0.1;               // until it is out of the top

  // { x, y, r, sx, sy, s, flash, vis } — on the ground under the ground camera's zoom;
  // in the dawn in its world (the caller takes the camera off)
  function avatarAt(t) {
    const A = L.A;
    if (t < T.cut) {
      const y0 = groundY();
      let x = L.cx, y, sx = 1, sy = 1, vis = t >= T.fall;
      if (t < T.land) {
        const p = seg(t, T.fall, T.land);
        y = lerp(-A * 1.2, y0, p * p);                    // gravity
        sy = 1 + 0.2 * p * p; sx = 1 - 0.1 * p * p;
      } else {
        const u = t - T.land, q = Math.cos(u * 26) * Math.exp(-u * 8);
        sy = 1 - 0.24 * q; sx = 1 + 0.17 * q;
        y = y0;
        const bp = seg(u, 0.05, 0.3);
        if (bp > 0 && bp < 1) y -= 0.07 * A * Math.sin(Math.PI * bp);
        const c = E.soft(seg(t, T.charge0, T.charge1 - 0.08));
        sy *= 1 - 0.16 * c; sx *= 1 + 0.1 * c;
        if (!S.rm) x += noise(t * 36) * 0.026 * A * c * c;
        if (t >= T.jump) { sy = jumpSy(t); sx = 1 / Math.pow(sy, 0.7); y = y0 - jumpLen() * jumpF(t); x = L.cx; }
      }
      y += (A / 2) * (1 - sy);                             // the feet stay on the floor
      return { x, y, r: 0, sx, sy, s: 1, flash: 0.5 * decay(t, T.land, 9), vis };
    }
    if (t < T.enter) return { x: L.cx, y: L.H * 2, r: 0, sx: 1, sy: 1, s: 1, flash: 0, vis: false };
    const start = L.H + A * 0.8, brkY = L.horizon;
    let y, sy, sx, r = 0;
    if (t < T.brk) {
      // up from under the sea of clouds (it hides him until he breaks its top)
      y = lerp(start, brkY, Math.pow(seg(t, T.enter, T.brk), 1.25));
      sy = 1.32; sx = 0.82;
    } else {
      // Through it on his momentum: a short hard brake, then slow motion, the rest of the
      // climb on the slow clock (the camera takes most of it, so the world falls away).
      const u = t - T.brk, us = slowT(t) - T.brk;
      const v0 = (start - brkY) / (T.brk - T.enter) * 1.25;
      const total = brkY - (L.floatY - L.rise);
      const ramp = Math.min(v0 * 0.045, total * 0.4), tr = ramp / v0;
      y = brkY - ramp * (1 - Math.exp(-u / tr)) - (total - ramp) * (1 - Math.exp(-us / 0.45));
      sy = 1 + 0.32 * Math.exp(-u / 0.09) - 0.1 * Math.sin(us * 14) * Math.exp(-us * 3);
      sx = 1 / Math.pow(Math.max(0.5, sy), 0.6);
      r = S.rm ? 0 : 0.42 * Math.sin(us * 4.5) * Math.exp(-us * 1.7);   // a slow tumble
    }
    const fl = E.soft(seg(t, T.brk + 1.2, T.brk + 3.4));
    const x = L.cx + fl * (A * 0.03 * Math.sin(0.55 * t + 2) + A * 0.012 * Math.sin(1.2 * t));
    y += fl * (A * 0.045 * Math.sin(0.8 * t) + A * 0.016 * Math.sin(1.7 * t + 1));
    r += fl * (0.11 * Math.sin(0.5 * t + 0.4) + 0.04 * Math.sin(1.3 * t));
    const s = 1 + 0.012 * Math.sin(2.1 * t) * fl;         // breathing
    return { x, y, r, sx, sy, s, flash: 0.7 * decay(t, T.brk, 4), vis: true };
  }

  // The sun: rises slowly from behind the sea of clouds, far away (moves 0.15 as much).
  function sunAt(t) {
    const p = E.soft(seg(t, T.cut, T.reveal + 0.4));
    const wy = lerp(L.horizon + L.R * 0.5, L.sunY - L.rise * 0.15, p);
    return { x: L.sunX - camX(t) * 0.15, y: wy - camY(t) * 0.15 };
  }

  // The split: the two halves of the sea part fast, then drift on the slow clock.
  const gapAt = t => t <= T.brk ? 0 : L.gap * E.out(seg(slowT(t), T.brk, T.brk + 1.2)) + L.W * 0.012 * (slowT(t) - T.brk);

  // ---------- drawing ----------
  let last = {};
  function setT(elm, key, v) { if (last[key] !== v) { elm.style.transform = v; last[key] = v; } }
  function setO(elm, key, v) { const s = v.toFixed(3); if (last[key] !== s) { elm.style.opacity = s; last[key] = s; } }

  function render(t) {
    if (t < 0) t = 0;
    const { W, H, A } = L;
    let tr = 0;
    if (!S.rm) for (const [T0, a, d] of SHAKES) if (t >= T0 && t < T0 + d) tr = Math.max(tr, a * (1 - (t - T0) / d));
    const sh = tr * tr, amp = 0.04 * Math.min(W, H);
    const shx = amp * sh * noise(t * 28), shy = amp * sh * noise(t * 28 + 100), shr = 0.025 * sh * noise(t * 28 + 200);
    const dawn = t >= T.cut;
    const k = dawn ? 1 : zoomK(t), P = { x: L.cx, y: groundY() };
    const cx = dawn ? camX(t) : 0, cy = dawn ? camY(t) : 0, cs = dawn ? slide(t) : 0;
    const sun = dawn ? sunAt(t) : null;
    if (sun) sun.y -= cs;

    // back canvas
    bgc.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgc.clearRect(0, 0, W, H);
    bgc.save();
    bgc.translate(W / 2 + shx, H / 2 + shy); bgc.rotate(shr); bgc.translate(-W / 2, -H / 2);
    if (!dawn) drawGround(t, k, P);
    else drawDawnBack(t, cx, cy, cs, sun);
    bgc.restore();

    // the world (DOM)
    const wt = dawn
      ? `translate3d(${shx.toFixed(2)}px,${(shy - cs).toFixed(2)}px,0) rotate(${shr.toFixed(4)}rad)`
      : `translate3d(${(shx + P.x).toFixed(2)}px,${(shy + P.y).toFixed(2)}px,0) rotate(${shr.toFixed(4)}rad) scale(${k.toFixed(4)}) translate(${(-P.x).toFixed(2)}px,${(-P.y).toFixed(2)}px)`;
    setT(world, 'world', wt);
    const a = avatarAt(t);
    if (dawn) { a.x -= cx; a.y -= cy; }
    setO(av, 'avO', a.vis ? 1 : 0);
    setT(av, 'av', `translate3d(${(a.x - A / 2).toFixed(2)}px,${(a.y - A / 2).toFixed(2)}px,0) rotate(${a.r.toFixed(4)}rad) scale(${(a.s * a.sx).toFixed(4)},${(a.s * a.sy).toFixed(4)})`);
    setO(flash, 'fl', a.flash);
    drawSticker(t, sun);
    drawLogo(t, dawn, cs);

    // front canvas
    fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxc.clearRect(0, 0, W, H);
    fxc.save();
    fxc.translate(W / 2 + shx, H / 2 + shy); fxc.rotate(shr); fxc.translate(-W / 2, -H / 2);
    if (!dawn) { fxc.save(); fxc.translate(P.x, P.y); fxc.scale(k, k); fxc.translate(-P.x, -P.y); drawGroundFx(t); fxc.restore(); }
    else drawDawnFront(t, cx, cy, cs, sun);
    fxc.restore();
    drawFoot(t);
  }

  // ---- the ground: a dark teal stage, a warm light from above ----
  function drawGround(t, k, P) {
    const c = bgc, { W, H, A } = L;
    c.globalAlpha = E.in(seg(t, 0, T.black));
    c.drawImage(art.night, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
    c.globalAlpha = 1;
    if (t < T.black) return;
    c.save();
    c.translate(P.x, P.y); c.scale(k, k); c.translate(-P.x, -P.y);
    const charge = E.in(seg(t, T.charge0, T.charge1));
    const leave = E.in(seg(t, T.jump, T.cut));
    let lit = E.soft(seg(t, 0.3, 1.5)) * (0.75 + 0.5 * decay(t, T.land, 5) + 0.45 * charge) * (1 - 0.5 * leave);
    if (!S.rm) lit *= 1 + 0.04 * Math.sin(t * 8) * charge;
    c.globalCompositeOperation = 'lighter';
    // the beam warms from pale gold to the dawn's orange as it charges
    const coneW = A * 2.7;
    c.globalAlpha = clamp(lit * 0.6 * (1 - charge * 0.6));
    c.drawImage(art.cone, L.cx - coneW / 2, -H * 0.4, coneW, L.gy + H * 0.4 + A * 0.18);
    c.globalAlpha = clamp(lit * 0.7 * charge);
    c.drawImage(art.coneWarm, L.cx - coneW / 2, -H * 0.4, coneW, L.gy + H * 0.4 + A * 0.18);
    c.globalAlpha = clamp(lit * 0.55);
    c.drawImage(art.pool, L.cx - A * 2.6, L.gy - A * 0.55, A * 5.2, A * 1.1);
    c.globalAlpha = clamp(lit);
    c.drawImage(art.pool, L.cx - A * 1.5, L.gy - A * 0.3, A * 3, A * 0.6);
    c.globalCompositeOperation = 'source-over';
    const a = avatarAt(t);
    if (a.vis) {
      const hgt = Math.max(0, L.gy - (a.y + A / 2 * a.sy)), f = 1 / (1 + hgt / (A * 0.9));
      c.globalAlpha = 0.55 * f * (1 - leave);
      c.fillStyle = '#021014';
      c.beginPath(); c.ellipse(a.x, L.gy, A * 0.46 * f * a.sx, A * 0.09 * f, 0, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    if (t > T.charge0 && t < T.jump + 0.2) drawBubblesIn(c, t);
    c.restore();
  }

  // The wind-up: bubbles of dawn light lift off the floor and are drawn in to the avatar.
  function drawBubblesIn(c, t) {
    const A = L.A, N = S.low ? 34 : 56, cy = groundY() + A * 0.05;
    for (let i = 0; i < N; i++) {
      const born = T.charge0 + Math.pow(i / N, 0.8) * (T.charge1 - T.charge0 - 0.2);
      const life = 0.9 + 0.5 * rnd(i + 11) - 0.35 * (i / N);
      const p = seg(t, born, born + life);
      if (p <= 0 || p >= 1) continue;
      const side = rnd(i + 3) < 0.5 ? -1 : 1, x0 = L.cx + side * A * (0.7 + 0.9 * rnd(i + 17)), y0 = L.gy - A * 0.05 * rnd(i + 5);
      const e = E.in(p);
      const x = lerp(x0, L.cx + side * A * 0.1, e), y = lerp(y0, cy, e) - Math.sin(Math.PI * p) * A * (0.25 + 0.35 * rnd(i + 23));
      bubble(c, x, y, A * (0.025 + 0.035 * rnd(i + 31)) * (1 - 0.5 * e), BUB[i % BUB.length], Math.sin(Math.PI * p) * 0.95);
    }
  }

  function drawGroundFx(t) {
    const A = L.A;
    puffs(fxc, t, T.land, 14, L.cx, L.gy, A, 0.9, 2);
    if (t >= T.jump) { puffs(fxc, t, T.jump, 12, L.cx, L.gy, A, 1.1, 7); ring(fxc, t, T.jump, L.cx, L.gy, A * 0.5, A * 1.8, 0.35, 'rgba(255,226,170,', 0.3, 0.22); }
  }

  // ---- the dawn, behind the avatar ----
  function drawDawnBack(t, cx, cy, cs, sun) {
    const c = bgc, { W, H, A } = L;
    const off = f => ({ x: -cx * f, y: -cy * f - cs * f });
    let o = off(0.05);
    c.drawImage(art.sky, -W * 0.08, -H * 0.2 + o.y, W * 1.16, H * 1.45);
    const day = E.soft(seg(t, T.pan0, T.reveal));             // the day coming up
    // the last stars, up where the sky is still dark, and the setting moon
    drawStars(c, t, o, 1 - 0.45 * day);
    const ms = A * 0.3;
    c.globalAlpha = 0.72 - 0.27 * day;
    c.drawImage(art.moon, W * 0.2 + o.x - ms / 2, H * (L.tall ? 0.15 : 0.13) + o.y - ms / 2, ms, ms);
    c.globalAlpha = 1;
    // long thin streaks of high cloud, cool up high and lit warm lower down
    const drift = S.rm ? 0 : t * 6;
    o = off(0.1);
    tile(c, art.streaks, o.x - drift * 0.3, -H * 0.04 + o.y, W * 1.6, H * 0.62);
    drawSun(c, t, sun, day);
    // far mountains, their feet in the cloud bank (the sun rises from behind them)
    o = off(0.22);
    tile(c, art.peaks.cv, o.x, L.horizon - art.peaks.z * 0.9 + o.y, art.peaks.w, art.peaks.h);
    // far: wisps high in the sky and a bank of clouds on the horizon (slow, a little soft)
    o = off(0.18);
    tile(c, art.wisps, o.x - drift * 0.5, -H * 0.12 + o.y, W * 1.5, H * 0.5);
    o = off(0.3);
    tile(c, art.bank, o.x - drift, L.horizon - H * 0.2 + o.y, W * 1.5, H * 0.3);
    drawBirds(c, t, off(0.25));
    // mid and middle-ground clouds; everything shakes a little with the break
    const jolt = S.rm ? 0 : wob(slowT(t), T.brk + 0.02, 22, 4);
    for (const m of art.mids) cloudAt(c, m, t, off(m.f), drift * m.f * 1.6, jolt * m.f);
  }

  // The sun, flat like the sticker: a cream disc in a few flat rings of light, one
  // slow sunburst behind it, and a broad warm glow on the sky round it.
  function drawSun(c, t, sun, day) {
    const R = L.R, g = glowAt(t), hl = 0.55 + 0.45 * day;   // more highlighted as the camera settles on it
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp(0.55 * hl + 0.2 * g);
    const gs = R * (7 + 1.2 * g);
    c.drawImage(art.glow, sun.x - gs / 2, sun.y - gs / 2, gs, gs);
    const rs = R * (6.5 + 1.5 * hl);
    c.save(); c.translate(sun.x, sun.y); c.rotate(S.rm ? 0 : t * 0.05);
    c.globalAlpha = clamp(0.3 * hl + 0.12 * g);
    c.drawImage(art.rays, -rs / 2, -rs / 2, rs, rs);
    c.restore();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const hs = R * 3.6 * (1 + 0.14 * g);
    c.drawImage(art.halo, sun.x - hs / 2, sun.y - hs / 2, hs, hs);
    const ds = R * 1.9;
    c.drawImage(art.disc, sun.x - ds / 2, sun.y - ds / 2, ds, ds);
  }

  function drawStars(c, t, o, k) {
    const { W, H } = L;
    for (const st of art.stars) {
      const x = st.x * W + o.x, y = st.y * H + o.y;
      if (y < -8 || y > H * 0.44) continue;
      const tw = S.rm ? 0.8 : 0.6 + 0.4 * Math.sin(t * st.sp + st.p);
      const a = k * st.a * tw * (1 - clamp(y / (H * 0.42)));
      if (a < 0.02) continue;
      if (st.big) sparkle(c, x, y, st.r * 3, `rgba(255,250,232,${a.toFixed(3)})`);
      else { c.globalAlpha = a; c.drawImage(art.star, x - st.r, y - st.r, st.r * 2, st.r * 2); c.globalAlpha = 1; }
    }
  }

  // A few birds crossing the high left of the sky, far off, from just after the break.
  const FLOCK = [[0, 0], [-0.32, 0.12], [-0.58, -0.04], [-0.86, 0.17], [-1.12, 0.05]];
  function drawBirds(c, t, o) {
    if (t < T.brk) return;
    const { W, H, A } = L, u = t - T.brk;
    const x0 = -W * 0.04 + W * 0.045 * u + o.x, y0 = H * (L.tall ? 0.3 : 0.27) + o.y;
    c.strokeStyle = 'rgba(24,58,68,0.5)'; c.lineWidth = Math.max(1.1, A * 0.011);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    FLOCK.forEach(([dx, dy], i) => {
      const s = A * (0.05 + 0.012 * (i % 2)), bx = x0 + dx * A, by = y0 + dy * A + Math.sin(t * 1.3 + i) * A * 0.03;
      if (bx < -s || bx > W + s) return;
      const wy = s * (0.15 + 0.45 * (S.rm ? 0.5 : Math.sin(t * 8 + i * 1.7)));
      c.moveTo(bx - s, by - wy); c.quadraticCurveTo(bx - s * 0.4, by - s * 0.25, bx, by);
      c.quadraticCurveTo(bx + s * 0.4, by - s * 0.25, bx + s, by - wy);
    });
    c.stroke();
  }

  function cloudAt(c, m, t, o, drift, jolt) {
    const { W, H } = L;
    let x = m.x * W + o.x - drift, y = m.y * H + o.y + Math.sin(t * 0.6 + m.p) * H * 0.006;
    const span = W * 1.9;                                  // drifting clouds wrap round
    x = ((x + W * 0.45) % span + span) % span - W * 0.45;
    c.drawImage(m.cv, x - m.w / 2 + jolt * W * 0.012 * m.j, y - m.h / 2 + jolt * H * 0.008, m.w, m.h);
  }

  // The sun's glow: it swells as the camera settles on it, and eases back as the +45 comes out of it.
  const glowAt = t => E.soft(seg(t, T.flare0, T.flare)) * (1 - 0.7 * E.soft(seg(t, T.flare, T.reveal + 0.8)));

  // ---- in front of the avatar: the sea of clouds and what is nearest ----
  function drawDawnFront(t, cx, cy, cs, sun) {
    const c = fxc, { W, H, A } = L;
    const o = { x: -cx, y: -cy - cs };
    drawSea(c, t, o);
    if (t >= T.brk) burst(c, t, o);
    // the glow the +45 comes out of: warm and soft, never a white-out
    const gk = glowAt(t);
    if (gk > 0.01) {
      c.globalCompositeOperation = 'lighter';
      const fr = L.R * (2 + 0.5 * gk);
      const g = c.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, fr);
      g.addColorStop(0, `rgba(255,236,190,${(0.4 * gk).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(255,214,140,${(0.22 * gk).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,180,90,0)');
      c.fillStyle = g; c.fillRect(sun.x - fr, sun.y - fr, fr * 2, fr * 2);
      c.globalCompositeOperation = 'source-over';
    }
    if (t >= T.reveal - 0.2 && t < T.reveal + 1.8) sparks(c, t, T.reveal - 0.2, sun.x, sun.y, L.R * 1.1, 4500, 6, 2);
    // the nearest clouds: big, soft, fast; they sweep down past as the camera rises
    const drift = S.rm ? 0 : t * 9;
    c.imageSmoothingQuality = 'high';
    for (const f of art.fg) {
      const x = f.x * W + o.x * 1.8 - drift * f.sp, y = f.y * H + o.y * 1.8 + Math.sin(t * 0.5 + f.p) * H * 0.01;
      if (y - f.h / 2 > H * 1.05 || y + f.h / 2 < -H * 0.05) continue;
      c.globalAlpha = f.a;
      c.drawImage(f.cv, x - f.w / 2, y - f.h / 2, f.w, f.h);
    }
    c.globalAlpha = 1;
    const fl = 0.3 * decay(t, T.brk, 6);                  // the warm flash of the break
    if (fl > 0.01) { c.fillStyle = `rgba(255,240,214,${fl.toFixed(3)})`; c.fillRect(-W, -H, W * 3, H * 3); }
  }

  // The sea of clouds: one scrolling layer until he comes through; then two halves
  // that part (tilting away), each with a bubbly torn edge, on the slow clock.
  function drawSea(c, t, o) {
    const { W, H, A } = L;
    const top = L.horizon + o.y, sx = L.cx + o.x;          // the sea's top, and where it splits
    const scroll = S.rm ? 0 : -t * 22;
    const y0 = top - H * 0.06;                             // the painted sea's lobes sit 6% down its tile
    const sw = W * 1.6, sh = H * 0.62;
    if (t < T.brk) {
      tile(c, art.sea, scroll + o.x, y0, sw, sh);
      // it bulges where he is about to come through
      const b = E.in(seg(t, T.enter - 0.05, T.brk));
      if (b > 0) { const d = A * (0.4 + 0.5 * b); c.drawImage(art.puff[0], sx - d / 2, top - d * (0.25 + 0.35 * b), d, d); }
      return;
    }
    const g = gapAt(t), q = E.out(seg(slowT(t), T.brk, T.brk + 1.2));
    const tilt = 0.06 * q, drop = H * 0.035 * q;
    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * g / 2, drop);
      c.translate(sx, top + H * 0.3); c.rotate(side * tilt); c.translate(-sx, -(top + H * 0.3));
      c.save();
      c.beginPath();
      if (side < 0) c.rect(-W, top - H, sx + W, H * 3); else c.rect(sx, top - H, W * 2, H * 3);
      c.clip();
      tile(c, art.sea, scroll + o.x, y0, sw, sh);
      c.restore();
      // the torn edge: a column of round lobes along the cut, so it never looks sliced
      const e = art.edge, ex = side < 0 ? sx - e.w * 0.35 : sx - e.w * 0.65;
      c.globalAlpha = clamp(g / (e.w * 1.2));             // the edges show only as the halves part
      c.drawImage(e.cv, ex, top - e.w * 0.25, e.w, e.h);
      c.globalAlpha = 1;
      c.restore();
    }
  }

  // The burst: puffs fly out of the split (on the slow clock), swell and pop; four
  // linger by him and pop on their own beats. A soft ring goes out from the break.
  function puffState(t, p, o) {
    const us = slowT(t) - T.brk;
    const out = E.out(seg(us, 0, p.life * 0.9));
    const x = L.cx + o.x + p.ox + p.vx * out, y = L.horizon + o.y + p.oy + p.vy * out + p.g * us * us;
    const popAt = p.pop != null ? p.pop : T.brk + 0.2 + p.life * 2.6;   // real time
    if (t > popAt) return null;
    const pp = seg(t, popAt - 0.12, popAt);
    return { x, y, s: p.r * (1 + 0.5 * E.out(seg(us, 0, 0.3))) * (1 + 0.25 * pp), alpha: 1 - 0.3 * pp, popAt };
  }
  function burst(c, t, o) {
    for (const p of art.puffs) {
      const st = puffState(t, p, o);
      if (st) {
        const d = st.s * 2.3;
        c.globalAlpha = st.alpha;
        c.drawImage(art.puff[p.tone], st.x - d / 2, st.y - d / 2, d, d);
        c.globalAlpha = 1;
        continue;
      }
      const popAt = p.pop != null ? p.pop : T.brk + 0.2 + p.life * 2.6;
      if (t > popAt + 0.6) continue;
      const at = puffState(popAt - 1e-4, p, o);
      if (!at) continue;
      const q = seg(t, popAt, popAt + 0.5);
      c.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - q)).toFixed(3)})`;
      c.lineWidth = Math.max(1, at.s * 0.12 * (1 - q));
      c.beginPath(); c.arc(at.x, at.y, at.s * (1 + 0.8 * E.out(q)), 0, TAU); c.stroke();
      if (p.pop != null) droplets(c, t, popAt, at.x, at.y, at.s, p.seed);
    }
    // the shockwave, on the slow clock
    const rq = seg(slowT(t), T.brk, T.brk + 0.6);
    if (rq > 0 && rq < 1) {
      const r = lerp(L.A * 0.4, L.A * 3.4, E.out(rq));
      c.strokeStyle = `rgba(255,236,200,${(0.8 * (1 - rq)).toFixed(3)})`;
      c.lineWidth = Math.max(1, L.A * 0.05 * (1 - rq));
      c.beginPath(); c.ellipse(L.cx + o.x, L.horizon + o.y, r, r * 0.55, 0, 0, TAU); c.stroke();
    }
  }

  // ---- the +45: the sun's face ----
  // It grows out of the sun's glow, from about the size of the disc, and settles:
  // it starts overexposed, gold-white, and finds its colours as the glow eases.
  function drawSticker(t, sun) {
    const p = seg(t, T.flare - 0.3, T.reveal + 0.55);
    if (!sun || p <= 0) { setO(stk, 'stO', 0); return; }
    const e = E.out(p);
    const s = lerp(0.6, 1, e) * (1 + 0.025 * wob(t, T.pulse, 12, 5) + 0.01 * Math.sin(1.4 * t));
    const r = lerp(-0.08, 0, e) + 0.025 * Math.sin(0.6 * t);
    const B = L.SB, sy = sun.y + slide(t);               // the world layer already carries the slide
    setO(stk, 'stO', E.soft(clamp(p * 1.7)));
    const b = 1 + 0.65 * (1 - E.soft(clamp(p * 1.25)));
    const f = b > 1.002 ? `brightness(${b.toFixed(3)})` : 'none';
    if (last.stF !== f) { stk.style.filter = f; last.stF = f; }
    setT(stk, 'st', `translate3d(${(sun.x - B / 2).toFixed(2)}px,${(sy - B / 2).toFixed(2)}px,0) rotate(${r.toFixed(4)}rad) scale(${s.toFixed(4)})`);
  }

  // The studio's mark drops in just after the break and stays (a far plane: a fifth of the slide).
  function drawLogo(t, dawn, cs) {
    if (!dawn) { setO(logo, 'lgO', 0); return; }
    const lh = L.logoW * 207 / 640, top = Math.max(16, L.H * 0.045);
    const p = E.out(seg(t, T.brk + 0.6, T.brk + 1.6));
    const y = lerp(-lh * 1.4, top, p) + 0.004 * L.H * Math.sin(0.8 * t) + cs * 0.8;
    setO(logo, 'lgO', 0.95 * E.soft(seg(t, T.brk + 0.6, T.brk + 0.95)));
    setT(logo, 'logo', `translate3d(${(L.cx - L.logoW / 2).toFixed(2)}px,${y.toFixed(2)}px,0)`);
  }

  // The +60's ending: the line, then the button just behind it, on a light footing.
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

  // ---- small helpers that draw ----
  function tile(c, cv, x, y, w, h) {
    let ox = x % w; if (ox > -L.W * 0.08) ox -= w;      // one tile more on the left: the shake never shows an edge
    for (let xx = ox; xx < L.W * 1.08; xx += w) c.drawImage(cv, xx, y, w + 1, h);
  }
  function puffs(c, t, T0, n, x0, y0, A, spread, seed) {
    const p0 = seg(t, T0, T0 + 0.75);
    if (p0 <= 0 || p0 >= 1) return;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, sp = 0.35 + 0.65 * rnd(i + seed * 31), p = E.out(p0);
      const x = x0 + dir * A * (0.25 + spread * sp * p), y = y0 - A * (0.05 + 0.22 * rnd(i + seed * 17) * p);
      const r = A * (0.05 + 0.08 * rnd(i + seed * 7)) * (0.7 + 1.1 * p);
      c.globalAlpha = 0.5 * (1 - p0) * (1 - p0);
      c.drawImage(art.puff[0], x - r, y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
  }
  function ring(c, t, T0, x, y, r0, r1, len, rgba, a0, w) {
    const p = seg(t, T0, T0 + len);
    if (p <= 0 || p >= 1) return;
    const r = lerp(r0, r1, E.out(p));
    c.strokeStyle = rgba + (a0 * (1 - p)).toFixed(3) + ')';
    c.lineWidth = Math.max(1, L.A * w * 0.1 * (1 - p));
    c.beginPath(); c.ellipse(x, y, r, r * 0.22, 0, 0, TAU); c.stroke();
  }
  function droplets(c, t, T0, x, y, R, seed) {
    const p0 = seg(t, T0, T0 + 0.55);
    if (p0 <= 0 || p0 >= 1) return;
    const e = E.out(p0), fade = 1 - p0 * p0;
    for (let i = 0; i < 9; i++) {
      const ang = rnd(seed + i) * TAU, dist = R * (0.5 + 1.6 * (0.5 + rnd(seed + i + 100)) * e);
      bubble(c, x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, L.A * (0.02 + 0.03 * rnd(seed + i + 200)), BUB[i % BUB.length], fade);
    }
  }
  function sparks(c, t, T0, x, y, R, seed, n, life) {
    const p0 = seg(t, T0, T0 + life);
    if (p0 <= 0 || p0 >= 1) return;
    const e = E.out(p0), fade = 1 - p0 * p0;
    for (let i = 0; i < n; i++) {
      const ang = rnd(seed + i) * TAU, dist = R * (0.4 + 1.9 * (0.5 + rnd(seed + i + 100) * 1.4) * e);
      sparkle(c, x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, L.A * (0.03 + 0.05 * rnd(seed + i + 200)) * (1 - 0.5 * p0), `rgba(${SPARK[i % SPARK.length]},${(0.95 * fade).toFixed(3)})`);
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
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { measure(); last = {}; render(clock()); }, 120); };
  window.addEventListener('resize', onResize);

  measure();
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
    // متابعة: the picture keeps moving while it fades away; the sound takes a few seconds after it.
    destroy() {
      if (S.leaving) return;
      S.leaving = true;
      window.removeEventListener('resize', onResize);
      if (src && gain && AC) {
        try {
          const now = AC.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.setTargetAtTime(0, now, 0.75);
          src.stop(now + 3.4);
        } catch (_) {}
      }
      root.style.pointerEvents = 'none';
      root.classList.add('is-leaving');
      setTimeout(() => { S.dead = true; cancelAnimationFrame(S.raf); root.remove(); }, 950);
      clearTimeout(cache.dropT);
      cache.dropT = setTimeout(() => { cache.buf = null; cache.bufP = null; }, 3600);
    },
  };
}

// ---------- the palette ----------
const BUB = ['255,226,150', '140,222,212', '255,255,255', '242,154,46', '200,240,232'];
const SPARK = ['255,246,220', '247,208,56', '255,255,255', '242,154,46'];

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

function bubble(c, x, y, r, col, a) {
  if (r < 0.5 || a <= 0.01) return;
  c.fillStyle = `rgba(${col},${(0.28 * a).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = `rgba(${col},${(0.9 * a).toFixed(3)})`;
  c.lineWidth = Math.max(1, r * 0.18);
  c.stroke();
  c.fillStyle = `rgba(255,255,255,${(0.85 * a).toFixed(3)})`;
  c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU); c.fill();
}
function sparkle(c, x, y, s, fill) {
  if (s < 0.4) return;
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
  c.fill();
}

// ---------- baked art ----------
// Cloud tones, after the +45 sticker: flat white with a pale cool shade, warm
// underneath from the low orange sun, and a faint warm glow round the edge.
const TONES = {
  near: { hi: '#ffffff', mid: '#f9fcfc', shade: '#e2eeef', glow: 'rgba(255,200,120,0.5)', under: 'rgba(246,166,72,0.3)' },
  mid: { hi: '#ffffff', mid: '#f8fbfa', shade: '#e1ecea', glow: 'rgba(255,210,140,0.4)', under: 'rgba(246,170,80,0.27)' },
  far: { hi: '#fdfefb', mid: '#f6faf7', shade: '#e3ede8', glow: 'rgba(255,214,150,0.3)', under: 'rgba(246,176,96,0.24)' },
  fg: { hi: '#fdfefe', mid: '#f1f7f7', shade: '#d8e8e9', glow: 'rgba(255,196,110,0.35)', under: 'rgba(242,154,46,0.3)' },
};

// Flat and two toned, like the sticker's clouds: the whole silhouette once in the
// shade colour, then the lit part over it (each lobe a little smaller and higher),
// feathered so the line between the two is soft. No lobe draws a rim of its own,
// so nothing inside the cloud reads as a stack of circles.
function flatCloud(c, blobs, tone, glow, feather, extra, extraLit) {
  c.save(); c.shadowColor = tone.glow; c.shadowBlur = glow; c.fillStyle = tone.shade;
  c.beginPath();
  for (const [x, y, r] of blobs) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  if (extra) extra(c);
  c.fill(); c.restore();
  let top = Infinity, bot = -Infinity;
  for (const [, y, r] of blobs) { top = Math.min(top, y - r); bot = Math.max(bot, y + r); }
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, tone.hi); g.addColorStop(1, tone.mid);
  c.save(); c.globalCompositeOperation = 'source-atop';
  c.shadowColor = tone.hi; c.shadowBlur = feather; c.fillStyle = g;
  c.beginPath();
  for (const [x, y, r] of blobs) { const rr = r * 0.88, yy = y - r * 0.1; c.moveTo(x + rr, yy); c.arc(x, yy, rr, 0, TAU); }
  if (extraLit) extraLit(c);
  c.fill(); c.restore();
}

// A bubbly cloud: round lobes on a flat base, a soft warm glow round it and a warm belly.
function paintCloud(w, h, scale, seed, tone) {
  const cv = canvas(w * scale, h * scale), c = cv.getContext('2d');
  c.scale(scale, scale);
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const n = 6 + Math.floor(r() * 4), base = h * 0.8, blobs = [];
  for (let i = 0; i < n; i++) {
    const fx = (i + 0.5) / n, rad = Math.min(h * (0.15 + 0.19 * Math.sin(Math.PI * fx) + 0.06 * r()), w * 0.16);
    blobs.push([w * (0.24 + 0.52 * fx) + (r() - 0.5) * w * 0.03, base - rad * (0.55 + 0.35 * r()), rad]);
  }
  const bx = w * 0.18, by = base - h * 0.16, bw = w * 0.64, bh = h * 0.18;
  // the flat base, a pill drawn clockwise like the lobes so the union has no holes
  const pill = k => {
    k.moveTo(bx + bh / 2, by); k.lineTo(bx + bw - bh / 2, by);
    k.arc(bx + bw - bh / 2, by + bh / 2, bh / 2, -Math.PI / 2, Math.PI / 2);
    k.lineTo(bx + bh / 2, by + bh);
    k.arc(bx + bh / 2, by + bh / 2, bh / 2, Math.PI / 2, Math.PI * 1.5);
    k.closePath();
  };
  flatCloud(c, blobs, tone, h * 0.09 * scale, h * 0.06 * scale, pill);
  // the warm belly, from the low sun
  c.globalCompositeOperation = 'source-atop';
  const ug = c.createLinearGradient(0, base - h * 0.4, 0, base + h * 0.04);
  ug.addColorStop(0, 'rgba(246,166,72,0)'); ug.addColorStop(1, tone.under);
  c.fillStyle = ug; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  return cv;
}

function bake(W, H, A, dpr, low) {
  const q = Math.min(dpr, 1.5);
  // the sky: teal overhead down to the +45 button's orange at the horizon,
  // through a pale cream so the two never meet as mud
  const sky = canvas(4, 512), sc = sky.getContext('2d');
  const g = sc.createLinearGradient(0, 0, 0, 512);
  // (drawn from -0.2 H to 1.25 H: the orange lands on the horizon, about 0.6 down)
  g.addColorStop(0, '#0a4e57'); g.addColorStop(0.14, '#16818a'); g.addColorStop(0.27, '#4fb2ae');
  g.addColorStop(0.37, '#a8dccb'); g.addColorStop(0.44, '#f2ecc4'); g.addColorStop(0.5, '#f8cd8a');
  g.addColorStop(0.55, '#f5ac55'); g.addColorStop(0.6, '#f29a2e'); g.addColorStop(1, '#ec8418');
  sc.fillStyle = g; sc.fillRect(0, 0, 4, 512);

  // the dark stage of the ground part, already tinted with the teal above
  const night = canvas(128, 128), nc = night.getContext('2d');
  const ng = nc.createRadialGradient(64, 40, 4, 64, 64, 96);
  ng.addColorStop(0, '#0c3a40'); ng.addColorStop(0.6, '#05222a'); ng.addColorStop(1, '#010c10');
  nc.fillStyle = ng; nc.fillRect(0, 0, 128, 128);

  const cone = paintCone('255,236,190'), coneWarm = paintCone('255,180,90');
  const pool = canvas(512, 128), p = pool.getContext('2d');
  const rg = p.createRadialGradient(256, 64, 0, 256, 64, 256);
  rg.addColorStop(0, 'rgba(255,224,160,0.55)'); rg.addColorStop(0.3, 'rgba(255,196,120,0.24)'); rg.addColorStop(0.65, 'rgba(120,210,200,0.07)'); rg.addColorStop(1, 'rgba(120,210,200,0)');
  p.save(); p.scale(1, 0.25); p.translate(0, 192); p.fillStyle = rg; p.fillRect(0, -192, 512, 512); p.restore();

  // soft puffs (cloud bits): white, cool, warm
  const puff = [['#ffffff', '#eef8f6'], ['#ffffff', '#d6ece9'], ['#fffaf0', '#fde2b8']].map(([a, b]) => {
    const cv = canvas(96, 96), c = cv.getContext('2d');
    const gg = c.createRadialGradient(56, 38, 4, 48, 48, 48);
    gg.addColorStop(0, a); gg.addColorStop(0.6, b); gg.addColorStop(0.82, b + 'cc'); gg.addColorStop(1, b + '00');
    c.fillStyle = gg; c.fillRect(0, 0, 96, 96);
    return cv;
  });

  // the sun
  const glow = canvas(256, 256), gc = glow.getContext('2d');
  const gg = gc.createRadialGradient(128, 128, 0, 128, 128, 128);
  gg.addColorStop(0, 'rgba(255,246,220,1)'); gg.addColorStop(0.12, 'rgba(255,214,140,0.7)'); gg.addColorStop(0.35, 'rgba(250,160,70,0.28)'); gg.addColorStop(0.7, 'rgba(242,140,50,0.08)'); gg.addColorStop(1, 'rgba(242,140,50,0)');
  gc.fillStyle = gg; gc.fillRect(0, 0, 256, 256);
  // flat: a cream disc with a thin yellow rim, in three flat rings of light
  const disc = canvas(256, 256), dc = disc.getContext('2d');
  dc.fillStyle = '#ffe28c'; dc.beginPath(); dc.arc(128, 128, 127, 0, TAU); dc.fill();
  dc.fillStyle = '#fff1c2'; dc.beginPath(); dc.arc(128, 128, 116, 0, TAU); dc.fill();
  dc.fillStyle = '#fff9e4'; dc.beginPath(); dc.arc(128, 128, 86, 0, TAU); dc.fill();
  const halo = canvas(256, 256), hc = halo.getContext('2d');
  for (const [r, f] of [[127, 'rgba(255,226,150,0.12)'], [100, 'rgba(255,232,170,0.16)'], [77, 'rgba(255,242,200,0.24)']]) {
    hc.fillStyle = f; hc.beginPath(); hc.arc(128, 128, r, 0, TAU); hc.fill();
  }
  const rays = paintRays(512, 16, 0.09, 'rgba(255,232,180,');

  // the last stars (a few of them four pointed) and the setting moon, lit from the sun's side
  const star = canvas(16, 16), sx2 = star.getContext('2d');
  const sgr = sx2.createRadialGradient(8, 8, 0, 8, 8, 8);
  sgr.addColorStop(0, 'rgba(255,252,240,1)'); sgr.addColorStop(0.45, 'rgba(255,248,226,0.7)'); sgr.addColorStop(1, 'rgba(255,248,226,0)');
  sx2.fillStyle = sgr; sx2.fillRect(0, 0, 16, 16);
  const stars = [];
  for (let i = 0; i < (low ? 26 : 40); i++) {
    stars.push({ x: rnd(i + 1200) * 1.1 - 0.05, y: rnd(i + 1201) * 0.42 - 0.04, r: A * (0.008 + 0.012 * rnd(i + 1202)),
      a: 0.45 + 0.55 * rnd(i + 1203), sp: 1.2 + 2.2 * rnd(i + 1204), p: rnd(i + 1205) * TAU, big: i % 9 === 0 });
  }
  const moon = canvas(96, 96), mc = moon.getContext('2d');
  mc.shadowColor = 'rgba(255,248,228,0.7)'; mc.shadowBlur = 10;
  mc.fillStyle = '#fffaf0'; mc.beginPath(); mc.arc(48, 48, 36, 0, TAU); mc.fill();
  mc.shadowBlur = 0; mc.globalCompositeOperation = 'destination-out';
  mc.beginPath(); mc.arc(35, 40, 33, 0, TAU); mc.fill();

  // high streaks: long thin lines in pairs, cool up high and warm lower down. They tile sideways.
  const stw = W * 1.6, sth = H * 0.62, sts = Math.min(q, 1) * 0.75;
  const streaks = canvas(stw * sts, sth * sts), sk = streaks.getContext('2d');
  sk.scale(sts, sts); sk.lineCap = 'round';
  const NS = low ? 9 : 14;
  for (let i = 0; i < NS; i++) {
    const y = sth * (0.04 + 0.9 * (i + rnd(i + 1300) * 0.8) / NS), len = W * (0.12 + 0.28 * rnd(i + 1301));
    const x = stw * rnd(i + 1302), th = H * (0.004 + 0.006 * rnd(i + 1303));
    sk.strokeStyle = y > sth * 0.55 ? 'rgba(255,246,228,0.55)' : 'rgba(196,238,228,0.32)';
    for (const [dx, dy, k] of [[0, 0, 1], [len * 0.18, th * 2.6, 0.55]]) {
      sk.lineWidth = th * (k < 1 ? 0.8 : 1);
      for (const ox of [0, -stw, stw]) { sk.beginPath(); sk.moveTo(x + dx + ox, y + dy); sk.lineTo(x + dx + len * k + ox, y + dy); sk.stroke(); }
    }
  }

  // far mountains, flat and two toned (lit on the sun's side), a hazy range behind a
  // nearer one with snow on its tops. They tile sideways. The peaks stand in the top
  // `pz` of the tile; below that the slopes run on, widening, past the bottom of the
  // frame, so wherever the clouds part there is mountain under them and never a base.
  // (smaller on a phone, where the frame is narrow and they would crowd him)
  const pTall = H > W * 1.1, pw = W * (pTall ? 2 : 1.5), pz = H * (pTall ? 0.19 : 0.3), ph = pz + H * 0.8;
  const pss = Math.min(q, 1) * 0.8;
  const peaks = canvas(pw * pss, ph * pss), pk = peaks.getContext('2d');
  pk.scale(pss, pss);
  const range = (n, seed, h0, h1, shade, lit, cap) => {
    for (let i = 0; i < n; i++) {
      const hgt = pz * (h0 + (h1 - h0) * rnd(seed + i + 50)), half = hgt * (0.9 + 0.5 * rnd(seed + i + 100)), top = pz - hgt;
      const cx0 = pw * (i + 0.3 + 0.4 * rnd(seed + i)) / n, rdg = half * (0.15 + 0.2 * rnd(seed + i + 150));
      // below pz each side carries on along its own slope, and the ridge along its line
      const run = (ph - pz) * (0.55 * half) / (0.6 * hgt), rdgB = rdg * (ph - top) / hgt;
      for (const ox of [0, -pw, pw]) {
        const x = cx0 + ox;
        pk.fillStyle = shade; pk.beginPath(); pk.moveTo(x - half - run, ph); pk.lineTo(x - half, pz);
        pk.quadraticCurveTo(x - half * 0.45, top + hgt * 0.4, x, top); pk.lineTo(x + rdgB, ph); pk.closePath(); pk.fill();
        pk.fillStyle = lit; pk.beginPath(); pk.moveTo(x, top); pk.quadraticCurveTo(x + half * 0.45, top + hgt * 0.4, x + half, pz);
        pk.lineTo(x + half + run, ph); pk.lineTo(x + rdgB, ph); pk.closePath(); pk.fill();
        if (cap) {
          const d = hgt * 0.17;
          pk.fillStyle = cap; pk.beginPath(); pk.moveTo(x, top);
          pk.lineTo(x + d * 0.62, top + d); pk.lineTo(x + d * 0.3, top + d * 0.82); pk.lineTo(x + d * 0.05, top + d * 1.05);
          pk.lineTo(x - d * 0.25, top + d * 0.8); pk.lineTo(x - d * 0.55, top + d); pk.closePath(); pk.fill();
        }
      }
    }
  };
  range(low ? 5 : 6, 1400, 0.4, 0.72, '#e7ab90', '#f5c7a4');
  range(4, 1500, 0.5, 0.92, '#c08583', '#e6a98e', '#fff0d8');
  // the lower slopes sink into a warm haze (they stay solid: no edge anywhere)
  pk.globalCompositeOperation = 'source-atop';
  const mh = pk.createLinearGradient(0, pz * 0.45, 0, ph);
  mh.addColorStop(0, 'rgba(244,164,86,0)'); mh.addColorStop(0.45, 'rgba(242,156,74,0.5)'); mh.addColorStop(1, 'rgba(240,146,60,0.72)');
  pk.fillStyle = mh; pk.fillRect(-pw, 0, pw * 3, ph);
  pk.globalCompositeOperation = 'source-over';

  // Clouds. Sharp ones are painted at screen resolution; only the far and the very
  // near ones are painted smaller, where the softness is the depth.
  const tallK = W < H ? 1.5 : 1;
  const bankW = W * 1.5, bankH = H * 0.3, bs = Math.min(q, 1) * 0.6;
  const bank = canvas(bankW * bs, bankH * bs), bk = bank.getContext('2d');
  for (let i = 0; i < (low ? 9 : 13); i++) {
    const cw = W * (0.2 + 0.18 * rnd(i + 40)) * tallK, ch = cw * 0.42;
    const cl = paintCloud(cw, ch, bs, 900 + i * 37, TONES.far);
    const x = (bankW / (low ? 9 : 13)) * i - cw * 0.2, y = bankH - ch - rnd(i + 42) * bankH * 0.35;
    for (const ox of [0, -bankW]) bk.drawImage(cl, (x + ox) * bs, y * bs);       // wraps
  }
  const wispW = W * 1.5, wispH = H * 0.5, ws = Math.min(q, 1) * 0.5;
  const wisps = canvas(wispW * ws, wispH * ws), wk = wisps.getContext('2d');
  wk.globalAlpha = 0.6;
  for (let i = 0; i < (low ? 6 : 9); i++) {
    const cw = W * (0.1 + 0.1 * rnd(i + 60)) * tallK, ch = cw * 0.38;
    const cl = paintCloud(cw, ch, ws, 300 + i * 53, TONES.far);
    const x = (wispW / 9) * (i + rnd(i + 62) * 0.6), y = wispH * rnd(i + 63) * 0.75;
    for (const ox of [0, -wispW]) wk.drawImage(cl, (x + ox) * ws, y * ws);
  }
  // mid and middle-ground clouds, at several depths and heights (some above the
  // frame: they come into view as the camera rises)
  const MIDS = [
    [0.1, 0.18, 0.26, 0.5], [0.82, 0.1, 0.22, 0.5], [0.45, -0.12, 0.2, 0.55], [1.15, 0.3, 0.24, 0.6],
    [0.3, 0.46, 0.24, 0.65], [-0.15, 0.38, 0.22, 0.6], [0.95, -0.2, 0.26, 0.7], [0.62, 0.4, 0.2, 0.7],
    [0.05, 0.6, 0.32, 1], [0.96, 0.6, 0.34, 1], [0.2, -0.3, 0.28, 1], [0.78, -0.08, 0.26, 1],
  ].slice(0, low ? 9 : 12);
  const mids = MIDS.map(([x, y, sz, f], i) => {
    const w = W * sz * tallK, h = w * 0.44, sc2 = f >= 1 ? Math.min(q, 1.25) : Math.min(q, 1) * 0.85;
    return { x, y, f, w, h, p: rnd(i + 70) * 6, j: rnd(i + 71) < 0.5 ? -1 : 1, cv: paintCloud(w, h, sc2, 120 + i * 29, f >= 1 ? TONES.near : TONES.mid) };
  });
  // the sea of clouds and its torn edge
  const sea = paintSea(W * 1.6, H * 0.62, Math.min(q, 1) * 0.8);
  const ew = Math.max(A * 0.55, W * 0.12), edge = { w: ew, h: H * 0.62, cv: paintEdge(ew, H * 0.62, Math.min(q, 1) * 0.8) };
  // the nearest clouds: along the bottom and the sides, and some high, to sweep down
  // past as the camera rises; the top middle is the logo's and the sun's
  const fg = [[-0.08, 0.98, 0.55, 0.95, 0.6], [1.0, 1.0, 0.6, 0.95, 0.5], [1.42, 1.02, 0.55, 0.9, 0.7], [-0.16, 0.42, 0.34, 0.8, 0.45],
    [1.32, 0.66, 0.36, 0.85, 0.4], [-0.1, -0.35, 0.42, 0.85, 0.5], [1.12, -0.5, 0.4, 0.85, 0.55], [0.4, -0.75, 0.38, 0.8, 0.45]]
    .slice(0, low ? 6 : 8).map(([x, y, sz, a, sp], i) => {
      const w = W * sz * tallK, h = w * 0.48;
      return { x, y, w, h, a, sp, p: rnd(i + 90) * 6, cv: paintCloud(w, h, Math.min(q, 1) * 0.3, 40 + i * 61, TONES.fg) };
    });
  // the burst: puffs out of the split, mostly up and to the sides; four linger
  const NP = low ? 16 : 24, puffs = [], pr = Math.min(A, W * 0.3);
  for (let i = 0; i < NP; i++) {
    const ang = -Math.PI / 2 + (rnd(i + 5) - 0.5) * Math.PI * 1.25, speed = A * (0.9 + 1.7 * rnd(i + 7));
    puffs.push({ ox: (rnd(i + 6) - 0.5) * A * 0.5, oy: rnd(i + 4) * A * 0.2, vx: Math.cos(ang) * speed * 1.2, vy: Math.sin(ang) * speed,
      g: A * 0.15, r: pr * (0.1 + 0.13 * rnd(i + 8)), life: 0.35 + 0.45 * rnd(i + 9), tone: i % 4 === 3 ? 2 : i % 2, seed: 3000 + i * 13 });
  }
  [[-0.55, -0.4], [0.62, -0.55], [-0.35, -0.9], [0.42, -0.2]].forEach(([dx, dy], i) => {
    puffs.push({ ox: dx * A * 0.4, oy: 0, vx: dx * A * 1.2, vy: dy * A * 1.2, g: 0, r: pr * (0.17 + 0.04 * i), life: 2, pop: T.pops[i], tone: i % 3, seed: 6000 + i * 17 });
  });
  return { sky, night, cone, coneWarm, pool, puff, glow, disc, halo, rays, star, stars, moon, streaks, peaks: { cv: peaks, w: pw, h: ph, z: pz }, bank, wisps, mids, sea, edge, fg, puffs };
}

function paintCone(rgb) {
  // stacked trapezoids, narrower and brighter towards the middle, so the edges are soft
  const cone = canvas(256, 512), c = cone.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.35, `rgba(${rgb},0.022)`); g.addColorStop(0.8, `rgba(${rgb},0.055)`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  for (let i = 0; i < 14; i++) {
    const w0 = 10 + i, w1 = 128 - i * 7.5;
    c.beginPath(); c.moveTo(128 - w0, 0); c.lineTo(128 + w0, 0); c.lineTo(128 + w1, 512); c.lineTo(128 - w1, 512); c.closePath(); c.fill();
  }
  return cone;
}

// Sunburst: soft wedges that fade out from the centre.
function paintRays(size, n, width, rgba) {
  const cv = canvas(size, size), c = cv.getContext('2d'), m = size / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, w = width * (i % 2 ? 0.6 : 1);
    c.fillStyle = rgba + (i % 2 ? '0.55)' : '0.9)');
    c.beginPath(); c.moveTo(m, m); c.arc(m, m, m, a - w, a + w); c.closePath(); c.fill();
  }
  c.globalCompositeOperation = 'destination-in';
  const g = c.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.18, 'rgba(0,0,0,0.9)'); g.addColorStop(0.6, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  return cv;
}

// The sea of clouds: a scalloped top of round lobes, backlit by the sun with a warm
// glow, over a flat body that sinks into a cool haze. It tiles sideways.
function paintSea(w, h, scale) {
  const cv = canvas(w * scale, h * scale), c = cv.getContext('2d');
  c.scale(scale, scale);
  const blobs = [];
  let x = 0, i = 0;
  while (x < w) {
    const r = h * (0.045 + 0.05 * rnd(i + 700));
    for (const ox of [0, -w, w]) blobs.push([x + ox, h * 0.1 + r * 0.3 + rnd(i + 701) * h * 0.05, r]);
    x += r * (1.05 + 0.35 * rnd(i + 702)); i++;
  }
  flatCloud(c, blobs, { ...TONES.near, glow: 'rgba(255,196,110,0.65)' }, h * 0.04 * scale, h * 0.02 * scale,
    k => k.rect(-w, h * 0.12, w * 3, h), k => k.rect(-w, h * 0.115, w * 3, h));
  c.globalCompositeOperation = 'source-atop';
  const haze = c.createLinearGradient(0, h * 0.3, 0, h);
  haze.addColorStop(0, 'rgba(200,226,226,0)'); haze.addColorStop(0.6, 'rgba(200,226,226,0.4)'); haze.addColorStop(1, 'rgba(180,214,216,0.75)');
  c.fillStyle = haze; c.fillRect(0, h * 0.3, w, h);
  c.globalCompositeOperation = 'source-over';
  return cv;
}

// The torn edge of a half of the sea: a column of lobes along the cut.
function paintEdge(w, h, scale) {
  const cv = canvas(w * scale, h * scale), c = cv.getContext('2d');
  c.scale(scale, scale);
  const r = w * 0.36, blobs = [];
  for (let y = r, i = 0; y < h; y += r * (0.7 + 0.25 * rnd(i + 802)), i++) blobs.push([w / 2 + (rnd(i + 800) - 0.5) * w * 0.3, y, r * (0.8 + 0.35 * rnd(i + 801))]);
  flatCloud(c, blobs, TONES.near, 0, w * 0.14 * scale);
  return cv;
}

// The +45 sticker is a sun itself: its yellow disc is drawn centred in the box, the
// size of the scene's sun so it covers it, with a soft warm glow round it and a
// light warm wash from the sun behind (light enough that the white 45 stays white).
// Where the disc sits in the 512 px artwork:
const S45 = { cx: 258.5 / 512, cy: 247.5 / 512, r: 178.5 / 512 };
function paintSticker(cv, box, dpr, img) {
  const q = Math.min(dpr, 2);
  cv.width = Math.ceil(box * q); cv.height = Math.ceil(box * q);
  cv.style.width = box + 'px'; cv.style.height = box + 'px';
  const c = cv.getContext('2d');
  c.setTransform(q, 0, 0, q, 0, 0);
  c.clearRect(0, 0, box, box);
  const sz = box * 0.9, m = box / 2;
  const x = m - S45.cx * sz, y = m - S45.cy * sz;      // the disc's centre on the box's centre
  c.save(); c.shadowColor = 'rgba(255,196,60,0.7)'; c.shadowBlur = sz * 0.07 * q;
  if (img) c.drawImage(img, x, y, sz, sz);
  else { c.fillStyle = '#f7b928'; c.beginPath(); c.arc(m, m, S45.r * sz, 0, TAU); c.fill(); }
  c.restore();
  if (img) {
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, y, 0, y + sz);
    g.addColorStop(0, 'rgba(255,214,90,0.14)'); g.addColorStop(0.55, 'rgba(255,200,70,0.07)'); g.addColorStop(1, 'rgba(242,154,46,0.05)');
    c.fillStyle = g; c.fillRect(0, 0, box, box);
    c.globalCompositeOperation = 'source-over';
  }
  return cv;
}

window.Plus45 = {
  unlock, preload, play, T,
  config(o) { if (o && o.base != null) BASE = o.base; },
};
})();
