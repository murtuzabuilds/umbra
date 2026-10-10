/* Umbra at the centre: shared with the portfolio. Plain script, sets window.umbraSystem (globalThis.umbraSystem in Node, for tests).

   A black hole at the centre is Umbra. Every dot on orbit is an AI tool (or agent) Kestrel Mutual staff use.
   The six rings, inner to outer, are controls: approvals, tool calling, API limits, rules, data boundaries, audit trail.
   Each ring around a tool is a control that applies to it, so placement is honest:
     approved tools    orbit inside all six rings (every control applies)
     unapproved tools  orbit between API limits and rules (rules, data boundaries and the audit trail still apply)
     high-risk tools   orbit between rules and data boundaries
     unowned agents    sit in the high-risk band, drawn in red with a dashed ring: nobody has set their limits
   Colours: approved aurora #3BE8B0, unapproved flare #FFB347, high risk ember #FF5470, unowned ember with a dashed ring.
   Nothing on this map ever turns approved by itself. Only a person approves.

   window.umbraSystem(canvas, options) -> handle
   options (all optional except geom):
     names            'all' (default) | 'events' (only the planet an event is happening to, or hovered) | 'auto' (events only when narrow)
     geom(W,H) -> {X, Y, Rh, narrow}   centre and hole radius in px. The outermost orbit is umbraSystem.EXTENT hole radii.
     host       element that receives pointer events (default: the canvas parent)
     planets    [{n, g, o, s, paused}]  default: umbraSystem.DEFAULT_PLANETS (15 sample services and Agent 7f3)
                  n  name
                  g  status: 'approved' | 'unapproved' | 'high' (or 'high risk') | 'unowned'.
                     Legacy numbers still work: 2 approved, 1 unapproved, 0 high risk.
                  o  orbit position in ring units (optional; default umbraSystem.place(g) spread by name).
                     Integer k sits on ring k (0 approvals ... 5 audit trail); -1 is the inner edge, 6 the outermost orbit.
                     Bands: approved (-1,0), unapproved (2,3), high risk (4,5), unowned (5,6]. Use umbraSystem.place(g, t).
                  s  size multiplier (default 1). paused: drawn faded with the word "paused".
     story      'site' (default when omitted) loops only real event kinds:
                  a pulse "sensitive data masked" from the core to an unapproved tool,
                  a beam "blocked by rule P-07" to a high-risk tool or Agent 7f3,
                  and roughly every 27 s "a person approves Agent 7f3": it moves inward and turns green, holds, then resets.
                false: no scripted events (the Umbra console: events come from the time machine, drills and real approvals).
     firstStory seconds before the first scripted event (default 3)
     labels     'always' shows ring names; 'hover' shows them when the pointer is near the core
     full       accepted for compatibility (all services are always shown)
     active()   return false to pause drawing
     statusNames {approved, unapproved, high, unowned} words under a planet (defaults below)
     lens       default true: background stars bend around the core and the cursor
   The handle is optional to use; callers that ignore it behave as before:
     setPlanets(list)            replace the planet set; same names tween, new ones fade in, missing ones fade out
     pulse(name, {strength, label})  a pulse from the core to that planet (something was masked, blocked or held)
     beam(name, {label})         a short beam from the core with a label (for example "blocked by rule P-07")
     govern(name, {g, o, label}) move a planet to a new status and orbit, and keep it there (a person's decision)
     drill(name, {held, label})  the planet tries to break orbit; held: a tether pulls it back; not held: it gets out (red)
     sound(on), soundOn          Web Audio hum and chimes, off until called with true; returns false if unsupported
     wake(), destroy()
   Pure helpers on umbraSystem: RINGS, STATUS, EXTENT, DEFAULT_PLANETS, statusOf(g), place(g, t), bandOf(o), ringsAround(o), radiusOf(o). */
(function (root) {
const RINGS = ['approvals', 'tool calling', 'API limits', 'rules', 'data boundaries', 'audit trail'];
const STATUS = {
  approved:   { word: 'approved',   hex: '#3BE8B0', rgb: [59, 232, 176], band: [-1, 0] },
  unapproved: { word: 'unapproved', hex: '#FFB347', rgb: [255, 179, 71], band: [2, 3] },
  high:       { word: 'high risk',  hex: '#FF5470', rgb: [255, 84, 112], band: [3, 4] },
  unowned:    { word: 'unowned',    hex: '#FF5470', rgb: [255, 84, 112], band: [3, 4], dashed: true },
};
/* radius, in hole radii, of each orbit position: index o+1 for o = -1 (inner edge) ... 5 (audit trail), 6 (outermost orbit) */
const RADII = [2.62, 3.2, 3.45, 3.7, 4.2, 4.45, 4.95, 5.3];
const EXTENT = RADII[RADII.length - 1];
const statusOf = g => {
  if (typeof g === 'string') { const k = g.toLowerCase().replace(/\s+risk$/, ''); return STATUS[k] ? k : 'unapproved'; }
  const n = Number(g); return n >= 1.5 ? 'approved' : n >= 0.5 ? 'unapproved' : 'high';
};
/** Orbit position for a status, t in [0,1] across its band (kept off the rings themselves). */
const place = (g, t = 0.5) => { const [a, b] = STATUS[statusOf(g)].band; const u = Math.max(0, Math.min(1, t)); return +(a + (b - a) * (0.2 + 0.6 * u)).toFixed(3); };
const radiusOf = o => { const v = Math.max(-1, Math.min(6, o)) + 1, i = Math.min(RADII.length - 2, Math.floor(v)); return RADII[i] + (RADII[i + 1] - RADII[i]) * (v - i); };
/** The rings that sit around an orbit position, inner to outer. */
const ringsAround = o => RINGS.filter((_, i) => i > o);
/** Which status band an orbit position falls in, or null if it is between bands. */
const bandOf = o => Object.keys(STATUS).find(k => k !== 'unowned' && o > STATUS[k].band[0] && o < STATUS[k].band[1]) || null; /* unowned agents share the high-risk band; they are told apart by the dashed ring */
const hashT = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 1000) / 999; };
/* the sample month's services with their status and size by interactions (same data as the Umbra console) */
const DEFAULT_PLANETS = [
  ['Aster Enterprise', 'approved', 1.55], ['Orion Code', 'approved', 1.03], ['Vega Model API', 'approved', 0.85], ['Relay Agents', 'approved', 0.75],
  ['Quill Write', 'unapproved', 1.13], ['Murmur Notes', 'unapproved', 0.9], ['Sonar Search', 'unapproved', 0.79],
  ['Chatly', 'high', 1.24], ['Aster Free', 'high', 1.05], ['HexPilot', 'high', 0.98], ['ParsePDF AI', 'high', 0.92], ['Deepwell API', 'high', 0.88],
  ['Loopwork', 'high', 0.74], ['inference.gpu-rent.xyz', 'high', 0.71], ['Lumen Draw', 'high', 0.71],
  ['Agent 7f3', 'unowned', 0.8],
].map(([n, g, s], i, all) => { const same = all.filter(q => q[1] === g), k = same.findIndex(q => q[0] === n); return { n, g, o: place(g, same.length > 1 ? k / (same.length - 1) : 0.5), s }; });

function umbraSystem(cv, o) { o = o || {}; const x = cv.getContext('2d'); const D = Math.min(2, devicePixelRatio || 1); let W, H, seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const S = Array.from({ length: 240 }, () => [r(), r(), r()]);
const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * D; cv.height = H * D; x.setTransform(D, 0, 0, D, 0, 0); if (P) for (const p of P) p.h = []; /* the centre moved: old trails would draw a jump */ if (still && P) draw1(); };
const sec = o.host || cv.parentElement; let mx = -1e4, my = -1e4, heat = 0; const pm = e => { const c = cv.getBoundingClientRect(); mx = e.clientX - c.left; my = e.clientY - c.top; }, pl0 = () => { mx = my = -1e4; }; sec.addEventListener('pointermove', pm); sec.addEventListener('pointerleave', pl0);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches; let on = false, running = false, dead = false; const go = () => { if (!dead && !running && on && !still && (!o.active || o.active())) { running = true; last = performance.now(); requestAnimationFrame(f); } };
let P = null; size(); addEventListener('resize', size);
const io = new IntersectionObserver(e => { on = e[0].isIntersecting; go(); }); io.observe(cv); cv.umbraWake = go;
const MONO = (getComputedStyle(document.body).getPropertyValue('--mono') || '').trim() || 'monospace';
const SN = Object.assign({ approved: 'approved', unapproved: 'unapproved', high: 'high risk', unowned: 'unowned' }, o.statusNames && !Array.isArray(o.statusNames) ? o.statusNames : {});
/* accretion disk: particles on circular orbits seen at a low angle */
const KY = .2, DISK = Array.from({ length: innerWidth < 700 ? 1400 : 2600 }, () => { const u = r(); return { f: Math.pow(u, 1.7), a: r() * 6.283, s: .6 + r() * .9, j: r() }; });
const HEATC = ['#FFFBF0', '#FFF1D2', '#FFE2AE', '#FFD08A', '#FFBC6A', '#FFA552', '#F68A45', '#E06F3E', '#C2573D', '#9E4542', '#7A3B55', '#5B3566'];
/* every ring and orbit shares one tilt and flatness, so "inside a ring" reads at a glance */
const TILT = -.1, FLAT = .6, CREAM = [245, 230, 200];
const VX = -.3, VY = -.95; /* direction of travel: up, so the trails fall away below */
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mk = (q, a) => { const st = statusOf(q.g); return { n: q.n, st, c: STATUS[st].rgb, o: q.o == null ? place(st, hashT(q.n)) : q.o, a, ph: r() * 6.283, beam: 0, h: [], al: 1, sz: q.s == null ? 1 : q.s, dash: STATUS[st].dashed ? 1 : 0, paused: !!q.paused, pv: q.paused ? 1 : 0, tags: [] }; };
P = (o.planets || DEFAULT_PLANETS).map((q, i) => mk(q, i * 2.399));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerpC = (a, b, k) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * k));
const PULSES = [];
/* where each ring's name sits, as an angle along the ring; candidates avoid the steep sides */
const CAND = []; for (let v = .16; v <= .841; v += .06) CAND.push(Math.PI * (1 + v), Math.PI * v);
const LB = RINGS.map((_, i) => ({ a: Math.PI * (1.2 + i * .12), al: 1, tgt: null }));
/* sound: synthesised only, never on until asked */
let AU = null, sndOn = false, lastChime = 0;
const audio = v => { sndOn = !!v; if (sndOn && !AU) { const C = window.AudioContext || window.webkitAudioContext; if (!C) { sndOn = false; return false; } const ac = new C(), hum = ac.createGain(), lp = ac.createBiquadFilter(), o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
    hum.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 180; o1.frequency.value = 55; o2.type = 'triangle'; o2.frequency.value = 82.4; g2.gain.value = .3; o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(hum); hum.connect(ac.destination); o1.start(); o2.start(); AU = { ac, hum, lp }; }
  if (AU) { if (sndOn) AU.ac.resume && AU.ac.resume(); AU.hum.gain.setTargetAtTime(sndOn ? .014 : 0, AU.ac.currentTime, .25); } return true; };
const chime = (fq, v) => { if (!AU || !sndOn) return; const ac = AU.ac, t = ac.currentTime; if (t - lastChime < .22) return; lastChime = t; [[fq, 1], [fq * 1.5, .35], [fq * 2.01, .15]].forEach(([fr, k]) => { const os = ac.createOscillator(), g = ac.createGain(); os.frequency.value = fr; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((v || .05) * k, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4); os.connect(g); g.connect(ac.destination); os.start(t); os.stop(t + 1.5); }); };
const find = n => P.find(p => p.n === n && !p.out);
/* a short label that floats above a planet for a few seconds */
const tag = (p, text, col, secs) => { p.tags = [{ text, col: col || CREAM, t: 0, life: secs || 3 }]; };
/* status change, animated: orbit glides, colour blends, the dashed ring fades */
const moveTo = (p, st, o1, secs) => { p.mv = { t: 0, dur: secs || 2.6, o0: p.o, o1, c0: p.c, c1: STATUS[st].rgb, d0: p.dash, d1: STATUS[st].dashed ? 1 : 0 }; p.st = st; };
/* ---- the site story: only real event kinds ---- */
const storyOn = o.story !== false; const AG = 'Agent 7f3';
let tPulse = o.firstStory || 3, tBeam = (o.firstStory || 3) + 3.2, tApprove = (o.firstStory || 3) + 9, ap = null;
const pickOf = list => list.length ? list[Math.floor(r() * list.length)] : null;
function story(dt) {
  if (!storyOn) return;
  tPulse -= dt; tBeam -= dt; tApprove -= dt;
  const live = P.filter(p => p.al > .99 && !p.mv && !p.brk && !p.out);
  if (tPulse <= 0) { tPulse = 4.2; const p = pickOf(live.filter(q => q.st === 'unapproved')); if (p) pulseP(p, 1, 'sensitive data masked'); }
  if (tBeam <= 0) { tBeam = 7.5; const ag = live.find(q => q.n === AG && q.st === 'unowned'); const p = ag && r() < .4 ? ag : pickOf(live.filter(q => q.st === 'high')); if (p) beamP(p, 'blocked by rule P-07'); }
  /* a person approves Agent 7f3: inward and green, hold, then reset to unowned (fade out, back on the outer orbit) */
  const a = find(AG);
  if (!ap && tApprove <= 0 && a && a.st === 'unowned' && !a.mv && !a.brk) { ap = { p: a, t: 0, home: a.o }; moveTo(a, 'approved', place('approved', .5), 3.4); tag(a, 'a person approves Agent 7f3', STATUS.approved.rgb, 9.5); chime(880, .04); tApprove = 27; }
  if (ap) { ap.t += dt; const p = ap.p;
    if (ap.t > 10 && !ap.gone) { p.al = Math.max(0, p.al - dt * 1.4); if (p.al <= 0) { ap.gone = 1; p.mv = null; p.st = 'unowned'; p.c = STATUS.unowned.rgb; p.dash = 1; p.o = ap.home; p.h = []; p.tags = []; p.a = r() * 6.283; } }
    if (ap.gone) { p.al = Math.min(1, p.al + dt * .7); if (p.al >= 1) ap = null; } }
}
function pulseP(p, k, label) { if (still) return; if (PULSES.length < 48) PULSES.push({ p, t: 0, k: Math.max(.35, Math.min(1, k || 1)), label: label || '' }); chime(1318.5, .025); }
function beamP(p, label) { p.beam = 1; p.bl = 1; if (label) tag(p, label, CREAM, 3.2); chime(660, .03); }
let last = performance.now(), T = 0;
function f(now) { const dt = still ? 0 : Math.min(.05, (now - last) / 1000); last = now; if (dead) return; x.clearRect(0, 0, W, H);
 const { X, Y, Rh, narrow } = o.geom(W, H);
 /* stars, bent by the core and, faintly, by the cursor: a point lens pushes each image outward */
 const RE = Rh * 1.35, RC2 = 14, lens = o.lens !== false, cur = mx > -1e3;
 for (const [a, b, c] of S) { const sp = (3 + c * 11) * T; let sx = ((a * W - VX * sp) % W + W) % W, sy = ((b * H - VY * sp) % H + H) % H;
   if (lens) { let dx = sx - X, dy = sy - Y, d = Math.hypot(dx, dy) || 1; const nd = (d + Math.sqrt(d * d + 4 * RE * RE)) / 2; sx = X + dx / d * nd; sy = Y + dy / d * nd;
     if (cur) { dx = sx - mx; dy = sy - my; d = Math.hypot(dx, dy) || 1; if (d < 160) { const n2 = (d + Math.sqrt(d * d + 4 * RC2 * RC2)) / 2; sx = mx + dx / d * n2; sy = my + dy / d * n2; } } }
   x.globalAlpha = (.05 + c * .35) * (.55 + .45 * Math.sin(T * (.6 + c * 1.8) + c * 40)); x.fillStyle = '#F5E6C8'; x.fillRect(sx, sy, c > .85 ? 1.5 : 1, c > .85 ? 1.5 : 1); } x.globalAlpha = 1;
 const near = Math.hypot(mx - X, my - Y) < Rh * 6; heat += ((near ? 1 : 0) - heat) * (still ? 1 : .04); T += dt * (1 + heat * .5);
 if (AU && sndOn) { const t = AU.ac.currentTime; AU.hum.gain.setTargetAtTime(.012 + .05 * heat, t, .4); AU.lp.frequency.setTargetAtTime(160 + 300 * heat, t, .4); }
 const rin = Rh * 1.45, rout = Rh * 2.45;
 let g = x.createRadialGradient(X, Y, Rh * .8, X, Y, Rh * 5); g.addColorStop(0, `rgba(255,190,110,${.16 + heat * .08})`); g.addColorStop(.35, 'rgba(139,124,255,.07)'); g.addColorStop(1, 'rgba(5,6,10,0)'); x.fillStyle = g; x.fillRect(X - Rh * 5, Y - Rh * 5, Rh * 10, Rh * 10);
 story(dt);
 for (let i = P.length - 1; i >= 0; i--) { const p = P[i];
   if (p.mv) { const m = p.mv; m.t += dt / m.dur; const e = ease(Math.min(1, m.t)); p.o = m.o0 + (m.o1 - m.o0) * e; p.c = lerpC(m.c0, m.c1, e); p.dash = m.d0 + (m.d1 - m.d0) * e; if (m.t >= 1) { p.mv = null; p.to = m.o1; chime(1046.5, .05); } }
   else if (p.to != null) { const k = Math.min(1, dt * 2.5); p.o += (p.to - p.o) * k; if (p.ct) { p.c = lerpC(p.c, p.ct, k); p.dash += ((STATUS[p.st].dashed ? 1 : 0) - p.dash) * k; } }
   if (p.szt != null) p.sz += (p.szt - p.sz) * Math.min(1, dt * 4);
   p.pv += ((p.paused ? 1 : 0) - p.pv) * Math.min(1, still ? 1 : dt * 3);
   if (p.out) { p.al -= dt * 1.5; if (p.al <= 0) { P.splice(i, 1); continue; } }
   else if (p.fade) { p.al = Math.min(1, p.al + dt * .6); if (p.al >= 1) p.fade = 0; }
   for (let j = p.tags.length - 1; j >= 0; j--) { p.tags[j].t += dt; if (p.tags[j].t > p.tags[j].life) p.tags.splice(j, 1); }
   /* the drill: try to break orbit */
   if (p.brk && !p.brk.frozen) { const b = p.brk; b.t += dt; let m = 1;
     if (b.held) { m = b.t < 1 ? 1 + .4 * ease(b.t) : b.t < 2.6 ? 1.4 - .4 * ease((b.t - 1) / 1.6) : 1; b.beam = b.t > .75 && b.t < 2.8 ? 1 : 0; if (b.t > .75 && !b.ch) { b.ch = 1; chime(784, .05); } }
     else { m = b.t < 1.3 ? 1 + .45 * ease(b.t / 1.3) : b.t < 3.6 ? 1.45 + .04 * Math.sin(b.t * 9) : b.t < 5.6 ? 1.49 - .49 * ease((b.t - 3.6) / 2) : 1; b.beam = 0; }
     b.m = m; if (b.t > (b.held ? 4.2 : 6.6)) p.brk = null; } }
 /* planets: positions and depth */
 const ct = Math.cos(TILT), sn = Math.sin(TILT);
 const pl = P.map(p => { const k0 = radiusOf(p.o), k = k0 * (p.brk ? p.brk.m : 1), w = .065 * Math.pow(3.1 / k0, 1.5) * (1 - heat * .35) * (p.paused ? .35 : 1); p.a += dt * w;
   const ex = Math.cos(p.a) * Rh * k, ey = Math.sin(p.a) * Rh * k * FLAT;
   let px = X + ex * ct - ey * sn, py = Y + ex * sn + ey * ct; if (p.brk) { px = Math.max(36, Math.min(W - 36, px)); py = Math.max(34, Math.min(H - 34, py)); } const drift = dt * (5.5 + heat * 4); for (const h of p.h) { h[0] -= VX * drift; h[1] -= VY * drift; } if (!still || !p.h.length) p.h.push([px, py, p.c]); if (p.h.length > 1500) p.h.shift();
   return { p, px, py, z: Math.sin(p.a), c: p.c }; });
 /* the path each planet has travelled: the system moves forward, so orbits become spirals behind it */
 x.lineWidth = 1.1; for (const q of pl) { const h = q.p.h, fa = q.p.al * (1 - q.p.pv * .6); for (let i = 1; i < h.length; i += 1) { x.globalAlpha = Math.pow(i / h.length, 1.8) * .34 * fa; x.strokeStyle = rgba(h[i][2], 1); x.beginPath(); x.moveTo(h[i - 1][0], h[i - 1][1]); x.lineTo(h[i][0], h[i][1]); x.stroke(); } } x.globalAlpha = 1;
 /* the core's own wake */
 { const L = Rh * 5; for (let i = 10; i >= 1; i--) { const k = i / 10, cx = X - VX * L * k, cy = Y - VY * L * k, rr = Rh * (1.4 - k * .6); const wg = x.createRadialGradient(cx, cy, 0, cx, cy, rr * 1.6); wg.addColorStop(0, `rgba(${k < .5 ? '255,205,150' : '150,135,255'},${(.09 + heat * .04) * (1 - k * .8)})`); wg.addColorStop(1, 'rgba(139,124,255,0)'); x.fillStyle = wg; x.beginPath(); x.arc(cx, cy, rr * 1.6, 0, 6.283); x.fill(); } }
 /* rings of control, drawn in two halves so they pass behind the hole and in front of it */
 const ring = front => { RINGS.forEach((_, i) => { const k = RADII[i + 1]; x.save(); x.translate(X, Y); x.rotate(TILT); x.beginPath(); x.ellipse(0, 0, Rh * k, Rh * k * FLAT, 0, front ? 0 : Math.PI, front ? Math.PI : 6.283); x.lineWidth = front ? 1.1 : .9; x.strokeStyle = rgba(CREAM, (front ? .22 : .1) + heat * .06); if (i > 2) x.setLineDash([2, 5]); x.stroke(); x.setLineDash([]); x.restore(); }); };
 /* ring names: small, set along the far side of each ring, staggered so they never stack, and faded when a planet is near */
 /* ring names: small, set along each ring where no planet or planet name is; when a planet comes close the name fades out and moves along its ring */
 const ringNames = () => { const lab = o.labels === 'always' ? .78 : heat; if (lab < .03) return; x.font = `${narrow ? 8 : 9}px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
   const placed = [];
   const at = (i, a) => { const k = RADII[i + 1], lx = Math.cos(a) * Rh * k, ly = Math.sin(a) * Rh * k * FLAT; return [X + lx * ct - ly * sn, Y + lx * sn + ly * ct]; };
   const clear = (i, a) => { const [gx, gy] = at(i, a), hw = RINGS[i].length * (narrow ? 2.5 : 2.8) + 4, hh = 7; let fd = 1;
     if (gx - hw < 4 || gx + hw > W - 4 || gy < 8 || gy > H - 8) return 0;
     for (const q of pl) { const d = Math.hypot(q.px - gx, q.py - gy); if (d < hw + 14) fd = Math.min(fd, Math.max(0, (d - hw * .6) / (hw * .4 + 14))); }
     for (const bx of boxes) if (gx - hw < bx[2] + 3 && gx + hw > bx[0] - 3 && gy - hh < bx[3] + 2 && gy + hh > bx[1] - 2) fd = 0;
     for (const r2 of placed) if (gx - hw < r2[2] && gx + hw > r2[0] && gy - hh < r2[3] && gy + hh > r2[1]) fd = 0;
     return fd; };
   RINGS.forEach((name, i) => { const L = LB[i];
     let f0 = clear(i, L.a);
     if (!L.tgt && f0 < .6) { let best = null, bf = f0 + .25; for (const c of CAND) { const fc = clear(i, c) - Math.abs(c - L.a) * .02; if (fc > bf) { bf = fc; best = c; } } if (best != null) { if (still) { L.a = best; f0 = clear(i, best); } else L.tgt = best; } }
     if (L.tgt != null) { L.al -= dt * 3; if (L.al <= 0) { L.al = 0; L.a = L.tgt; L.tgt = null; f0 = clear(i, L.a); } } else L.al = still ? 1 : Math.min(1, L.al + dt * 2);
     const a = L.a, [gx, gy] = at(i, a), k = RADII[i + 1], hw = name.length * (narrow ? 2.5 : 2.8) + 4;
     placed.push([gx - hw, gy - 7, gx + hw, gy + 7]);
     const tx = -Math.sin(a) * Rh * k, ty = Math.cos(a) * Rh * k * FLAT, ang = Math.atan2(tx * sn + ty * ct, tx * ct - ty * sn), rot = ang > Math.PI / 2 ? ang - Math.PI : ang < -Math.PI / 2 ? ang + Math.PI : ang;
     x.save(); x.translate(gx, gy); x.rotate(rot); x.globalAlpha = lab * L.al * (.15 + .85 * f0); x.lineWidth = 3; x.strokeStyle = 'rgba(5,6,10,.92)'; x.strokeText(name, 0, 0); x.fillStyle = 'rgba(245,230,200,.8)'; x.fillText(name, 0, 0); x.restore(); }); x.globalAlpha = 1; };
 ring(false);
 let hov = null, hd = 1e9; pl.forEach(q => { const d = Math.hypot(mx - q.px, my - q.py); if (d < 28 && d < hd) { hd = d; hov = q; } });
 const busy = p => !!p.mv || !!p.brk || p.tags.length > 0;
 /* planet names: the hovered and busy planets first, then the biggest (busiest) tools. Each name tries below its dot, then above, keeping last frame's side when it still fits, and is hidden only when both would overlap */
 const cw = narrow ? 6.1 : 6.7, boxes = [], dots = pl.map(q => { const r = (narrow ? 4.2 : 5.4) * (1 + .22 * q.z) * q.p.sz + 2; return [q.px - r, q.py - r, q.px + r, q.py + r]; });
 const hit = (b, list) => list.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
 [...pl].sort((a, b) => (b === hov) - (a === hov) || busy(b.p) - busy(a.p) || b.p.sz - a.p.sz || b.z - a.z).forEach((q, qi) => { const s0 = (narrow ? 4.2 : 5.4) * (1 + .22 * q.z) * q.p.sz, w = q.p.n.length * cw + 6, bx = q.px - w / 2, tall = q.p.beam > .35 || busy(q.p) || q.p.pv > .5 ? 30 : 16;
   const below = [bx, q.py + s0 + 2, bx + w, q.py + s0 + 2 + tall], above = [bx, q.py - s0 - 2 - tall, bx + w, q.py - s0 - 2], own = dots[pl.indexOf(q)], others = dots.filter(d => d !== own);
   const fits = b => !hit(b, boxes) && !hit(b, others), must = q === hov || busy(q.p), allowed = o.names !== 'events' && !(o.names === 'auto' && narrow);
   const order = busy(q.p) ? ['below'] : q.p.ls === 'above' ? ['above', 'below'] : ['below', 'above'];
   const side = order.find(k => fits(k === 'below' ? below : above));
   q.show = must || (allowed && !!side); q.ls = q.p.ls = must && !side ? 'below' : side || q.p.ls || 'below';
   if (q.show) boxes.push(q.ls === 'below' ? below : above); });
 const drawPlanet = q => { const { p, px, py, z, c } = q, s = (narrow ? 4.2 : 5.4) * (1 + .22 * z) * p.sz, lit = hov === q, A = p.al * (1 - p.pv * .55);
   p.beam = Math.max(0, p.beam - dt * .55);
   if (p.beam > 0 || lit) { const b = (lit ? 1 : p.beam) * A; const lg = x.createLinearGradient(X, Y, px, py); lg.addColorStop(0, 'rgba(255,230,190,0)'); lg.addColorStop(.25, `rgba(255,230,190,${.5 * b})`); lg.addColorStop(1, rgba(lit ? c : CREAM, 1)); x.globalAlpha = b * .9; x.strokeStyle = lg; x.lineWidth = p.bl && !lit ? 1.8 : 1.2; x.beginPath(); x.moveTo(X + (px - X) * .18, Y + (py - Y) * .18); x.lineTo(px, py); x.stroke();
     x.globalAlpha = b * .6; x.strokeStyle = rgba(lit ? c : CREAM, 1); x.lineWidth = 1.1; x.beginPath(); x.arc(px, py, s + 4 + (1 - b) * 12, 0, 6.283); x.stroke(); x.globalAlpha = 1; }
   if (p.beam <= 0) p.bl = 0;
   /* drill: a tether from the core pulls it back, or a red ring marks that it got out */
   if (p.brk) { const b = p.brk;
     if (b.beam) { const lg = x.createLinearGradient(X, Y, px, py); lg.addColorStop(0, 'rgba(245,230,200,0)'); lg.addColorStop(.2, 'rgba(245,230,200,.55)'); lg.addColorStop(1, 'rgba(255,250,240,.95)'); x.globalAlpha = A * (.75 + .25 * Math.sin(T * 22)); x.strokeStyle = lg; x.lineWidth = 3; x.beginPath(); x.moveTo(X + (px - X) * .15, Y + (py - Y) * .15); x.lineTo(px, py); x.stroke();
       x.setLineDash([3, 6]); x.lineDashOffset = -T * 60; x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.moveTo(X + (px - X) * .15, Y + (py - Y) * .15); x.lineTo(px, py); x.stroke(); x.setLineDash([]); x.lineDashOffset = 0;
       x.globalAlpha = A * .8; x.strokeStyle = rgba(CREAM, 1); x.lineWidth = 1.4; x.beginPath(); x.arc(px, py, s + 6 + 2 * Math.sin(T * 10), 0, 6.283); x.stroke(); }
     else if (!b.held && b.t > .6) { x.globalAlpha = A * (.6 + .3 * Math.sin(T * 8)); x.strokeStyle = rgba(STATUS.high.rgb, 1); x.lineWidth = 1.3; x.setLineDash([3, 3]); x.beginPath(); x.arc(px, py, s + 8, 0, 6.283); x.stroke(); x.setLineDash([]); }
     if (b.label) { x.globalAlpha = A; x.font = `500 ${narrow ? 9.5 : 10.5}px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillStyle = b.held ? rgba(CREAM, 1) : rgba(STATUS.high.rgb, 1); x.fillText(b.label, px, py - s - 10); }
     x.globalAlpha = 1; }
   const risky = p.st === 'high' || p.st === 'unowned', flick = risky ? .7 + .3 * Math.sin(T * 3.1 + p.ph * 7) : 1;
   const hg = x.createRadialGradient(px, py, 0, px, py, s * 4); hg.addColorStop(0, rgba(c, .33)); hg.addColorStop(1, rgba(c, 0)); x.globalAlpha = A * flick * (.45 + .55 * (z + 1) / 2); x.fillStyle = hg; x.beginPath(); x.arc(px, py, s * 4, 0, 6.283); x.fill();
   const dd = Math.hypot(X - px, Y - py) || 1, lx = px + (X - px) / dd * s * .55, ly = py + (Y - py) / dd * s * .55;
   const sg = x.createRadialGradient(lx, ly, s * .1, px, py, s); sg.addColorStop(0, '#FFFFFF'); sg.addColorStop(.35, rgba(c, 1)); sg.addColorStop(1, '#0A0C13'); x.globalAlpha = A * flick * (.55 + .45 * (z + 1) / 2); x.fillStyle = sg; x.beginPath(); x.arc(px, py, s, 0, 6.283); x.fill();
   /* unowned: a dashed ring around the dot */
   if (p.dash > .02) { x.globalAlpha = A * p.dash * .9; x.strokeStyle = rgba(STATUS.unowned.rgb, 1); x.lineWidth = 1.2; x.setLineDash([2.5, 2.5]); x.lineDashOffset = -T * 6; x.beginPath(); x.arc(px, py, s + 4, 0, 6.283); x.stroke(); x.setLineDash([]); x.lineDashOffset = 0; }
   if (q.show) { x.globalAlpha = p.al * (lit || busy(p) ? 1 : (.3 + .6 * (z + 1) / 2) * (1 - p.pv * .35)) * (risky && !lit ? flick : 1); x.font = `500 ${narrow ? 10 : 11}px ${MONO}`; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = lit ? '#FFFFFF' : '#D6D9E4'; const tw = x.measureText(p.n).width / 2, nx = Math.max(tw + 3, Math.min(W - tw - 3, px)), up = q.ls === 'above'; x.fillText(p.n, nx, up ? py - s - 9 : py + s + 9);
     if (lit || p.beam > .35 || busy(p) || p.pv > .5) { x.globalAlpha = p.al * (lit || busy(p) || p.pv > .5 ? 1 : p.beam); x.fillStyle = p.pv > .5 ? 'rgba(214,217,228,.75)' : rgba(c, 1); x.font = `${narrow ? 9 : 10}px ${MONO}`; x.fillText(p.pv > .5 ? 'paused' : p.mv ? (p.st === 'approved' ? 'approving' : 'moving') : SN[p.st], px, up ? py - s - 21 : py + s + 21); } }
   /* event label above the planet */
   const tg = p.tags[0]; if (tg && !p.brk) { const fa = Math.min(1, tg.t * 4, (tg.life - tg.t) * 1.5); x.globalAlpha = p.al * fa; x.font = `500 ${narrow ? 9.5 : 10.5}px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.lineWidth = 3; x.strokeStyle = 'rgba(5,6,10,.9)'; const ty = py - s - 9; x.strokeText(tg.text, px, ty); x.fillStyle = rgba(tg.col, 1); x.fillText(tg.text, px, ty); }
   x.globalAlpha = 1; x.textAlign = 'left'; };
 const back = pl.filter(q => q.z < 0).sort((a, b) => a.z - b.z), front = pl.filter(q => q.z >= 0).sort((a, b) => a.z - b.z);
 ringNames();
 back.forEach(drawPlanet);
 /* disk: far half first, then the bent light over the top, then the hole, then the near half */
 const pts = DISK.map(d => { const rr = rin + (rout - rin) * d.f; d.a += dt * (1 + heat * 1) * .26 * Math.pow(rin / rr, 1.5); const ca = Math.cos(d.a), sa = Math.sin(d.a);
   const ci = Math.min(HEATC.length - 1, Math.floor(d.f * HEATC.length)), dop = 1 + .6 * ca; return { px: X + ca * rr, py: Y + sa * rr * KY, sa, ca, ci, al: Math.min(1, (.35 + .65 * (1 - d.f)) * dop * (.75 + .25 * Math.sin(T * 2 + d.j * 30)) * (.85 + heat * .3)), s: d.s * (narrow ? .85 : 1) * (1 + (1 - d.f) * .5), f: d.f }; });
 x.save(); x.translate(X, Y); x.scale(1, KY); g = x.createRadialGradient(0, 0, rin * .9, 0, 0, rout * 1.15); g.addColorStop(0, `rgba(255,214,150,${.5 + heat * .2})`); g.addColorStop(.45, 'rgba(255,150,80,.22)'); g.addColorStop(1, 'rgba(120,60,120,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, rout * 1.15, 0, 6.283); x.fill(); x.restore();
 x.save(); x.translate(X, Y); x.scale(1, .94); g = x.createRadialGradient(0, 0, Rh * 1.05, 0, 0, Rh * 1.9); g.addColorStop(0, `rgba(255,220,170,${.38 + heat * .15})`); g.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, Rh * 1.9, Math.PI, 0); x.fill(); x.restore();
 x.globalCompositeOperation = 'lighter';
 for (const q of pts) if (q.sa < 0) { x.globalAlpha = q.al * .8; x.fillStyle = HEATC[q.ci]; x.fillRect(q.px - q.s / 2, q.py - q.s / 2, q.s, q.s); }
 /* lensed image of the far side, arching over the top and a thin ring underneath */
 for (const q of pts) { const lr = Rh * (1.12 + .6 * q.f), ang = Math.atan2(q.sa, q.ca); const top = Math.PI + (ang < 0 ? ang + Math.PI : ang);
   x.globalAlpha = q.al * .8; x.fillStyle = HEATC[q.ci]; const ax = X + Math.cos(top) * lr, ay = Y + Math.sin(top) * lr * .96; x.fillRect(ax - q.s * .5, ay - q.s * .5, q.s, q.s);
   if (q.f < .45) { const br = Rh * (1.06 + .22 * q.f), bt = top - Math.PI; x.globalAlpha = q.al * .28; x.fillRect(X + Math.cos(bt) * br - .6, Y + Math.sin(bt) * br * .94 - .6, 1.2, 1.2); } }
 x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
 /* event horizon and photon ring */
 g = x.createRadialGradient(X, Y, Rh * .6, X, Y, Rh * 1.14); g.addColorStop(0, '#000'); g.addColorStop(.86, '#000'); g.addColorStop(.93, `rgba(255,236,200,${.85 + heat * .15})`); g.addColorStop(1, 'rgba(255,200,130,0)');
 x.fillStyle = g; x.beginPath(); x.arc(X, Y, Rh * 1.14, 0, 6.283); x.fill();
 x.globalCompositeOperation = 'lighter';
 for (const q of pts) if (q.sa >= 0) { x.globalAlpha = q.al; x.fillStyle = HEATC[q.ci]; x.fillRect(q.px - q.s / 2, q.py - q.s / 2, q.s, q.s); }
 x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
 ring(true);
 front.forEach(drawPlanet);
 /* pulses: something was masked, blocked or held; the core reaches that planet */
 for (let i = PULSES.length - 1; i >= 0; i--) { const u = PULSES[i]; u.t += dt / .75; const q = pl.find(v => v.p === u.p); if (!q || u.t > 1.8) { PULSES.splice(i, 1); continue; }
   const k = Math.min(1, u.t), sx = X + (q.px - X) * .16, sy = Y + (q.py - Y) * .16, hx = sx + (q.px - sx) * ease(k), hy = sy + (q.py - sy) * ease(k), tail = Math.max(0, ease(k) - .35);
   if (u.t < 1) { const lg = x.createLinearGradient(sx, sy, hx, hy); lg.addColorStop(0, 'rgba(245,230,200,0)'); lg.addColorStop(1, `rgba(245,230,200,${.85 * u.k})`); x.strokeStyle = lg; x.lineWidth = 1.6; x.beginPath(); x.moveTo(sx + (q.px - sx) * tail, sy + (q.py - sy) * tail); x.lineTo(hx, hy); x.stroke();
     x.fillStyle = '#FFF6E4'; x.globalAlpha = u.k; x.beginPath(); x.arc(hx, hy, 1.8, 0, 6.283); x.fill(); }
   else { if (u.label && !u.tagged) { u.tagged = 1; tag(u.p, u.label, CREAM, 2.6); } const e = (u.t - 1) / .8; x.globalAlpha = (1 - e) * .9 * u.k; x.strokeStyle = rgba(CREAM, 1); x.lineWidth = 1.4; x.beginPath(); x.arc(q.px, q.py, 6 + e * 16, 0, 6.283); x.stroke(); }
   x.globalAlpha = 1; }
 if (!still && on && (!o.active || o.active())) requestAnimationFrame(f); else running = false; }
const draw1 = () => { if (!dead) requestAnimationFrame(t => { if (!running) f(t); }); };
const kick = () => { if (still) draw1(); else go(); };
if (still) requestAnimationFrame(f);
return {
  setPlanets(list) { const want = new Set(); (list || []).forEach((q, i) => { want.add(q.n); let p = find(q.n); const st = statusOf(q.g), o1 = q.o == null ? place(st, hashT(q.n)) : q.o;
      if (!p) { p = mk(q, (P.length + i) * 2.399); p.al = still ? 1 : 0; p.fade = still ? 0 : 1; P.push(p); }
      if (!p.mv) { p.st = st; p.to = o1; p.ct = STATUS[st].rgb; } p.paused = !!q.paused; p.szt = q.s == null ? 1 : q.s;
      if (still) { p.o = o1; p.c = STATUS[st].rgb; p.dash = STATUS[st].dashed ? 1 : 0; p.sz = p.szt; p.pv = p.paused ? 1 : 0; } });
    for (const p of P) if (!want.has(p.n)) { if (still) p.al = 0; p.out = 1; }
    if (still) for (let i = P.length - 1; i >= 0; i--) if (P[i].out) P.splice(i, 1);
    kick(); },
  pulse(n, opt) { const p = find(n); if (!p || still) return; pulseP(p, opt && opt.strength, opt && opt.label); kick(); },
  beam(n, opt) { const p = find(n); if (!p) return; beamP(p, opt && opt.label); kick(); },
  govern(n, opt) { opt = opt || {}; const p = find(n); if (!p) return; const st = statusOf(opt.g == null ? 'approved' : opt.g), o1 = opt.o == null ? place(st) : opt.o;
    if (still) { p.st = st; p.o = p.to = o1; p.c = STATUS[st].rgb; p.dash = STATUS[st].dashed ? 1 : 0; } else { moveTo(p, st, o1, 2.6); chime(880, .04); }
    if (opt.label) tag(p, opt.label, STATUS[st].rgb, 6); kick(); },
  drill(n, opt) { opt = opt || {}; const p = find(n); if (!p) return false; p.brk = { t: still ? (opt.held ? 1.5 : 2) : 0, held: !!opt.held, label: opt.label || '', m: 1, beam: 0 }; if (still) { const b = p.brk; b.m = opt.held ? 1.2 : 1.45; b.beam = opt.held ? 1 : 0; b.t = 0; b.frozen = 1; } if (!opt.held) chime(196, .05); kick(); return true; },
  sound(v) { return audio(v); },
  get soundOn() { return sndOn; },
  wake: go,
  destroy() { dead = true; on = false; io.disconnect(); removeEventListener('resize', size); sec.removeEventListener('pointermove', pm); sec.removeEventListener('pointerleave', pl0); if (AU) { try { AU.ac.close(); } catch (e) {} AU = null; } }
};
}
Object.assign(umbraSystem, { RINGS, STATUS, RADII, EXTENT, DEFAULT_PLANETS, statusOf, place, radiusOf, ringsAround, bandOf, version: 2 });
root.umbraSystem = umbraSystem;
})(typeof window !== 'undefined' ? window : globalThis);
