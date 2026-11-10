/* Движок: чётки (canvas), частицы фона (canvas), звук (Web Audio). */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- ЗВУК ---------- */
const Sound = {
  ctx: null, on: true,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, vol, type = 'sine', when = 0, slideTo) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  },
  /* щелчок стеклянной бусины */
  click() {
    if (!this.on || !this.ctx) return;
    const p = 0.94 + Math.random() * 0.12;
    this.noise(0.035, 0.5, 3200 * p);
    this.tone(1900 * p, 0.07, 0.16, 'sine', 0, 1250 * p);
    this.tone(640 * p, 0.05, 0.10, 'triangle');
  },
  /* мягкий звон — закончился круг */
  chime() {
    if (!this.on || !this.ctx) return;
    this.tone(880, 0.9, 0.14); this.tone(1320, 1.1, 0.09, 'sine', 0.09);
  },
  /* завершение всех шагов */
  finish() {
    if (!this.on || !this.ctx) return;
    [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => this.tone(f, 1.4, 0.11, 'sine', i * 0.16));
  }
};

function haptic(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }

/* ---------- ЧЁТКИ ---------- */
class Beads {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.count = 0; this.pos = 0; this.vel = 0; this.target = 33;
    this.pulse = 0; this.t = 0;
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 3);
    this.W = r.width; this.H = r.height;
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
    this.c.setTransform(d, 0, 0, d, 0, 0);
    this.R = Math.max(8, Math.min(11, this.W / 40));
    this.gap = this.R * 2.35;
  }
  set(count, target, jump) {
    this.count = count; this.target = target;
    if (jump) { this.pos = count; this.vel = 0; }
  }
  tap() { this.pulse = 1; }
  curveY(x) {
    const u = (x - this.W / 2) / (this.W / 2);
    return this.H * 0.60 - this.H * 0.34 * u * u;
  }
  isImam(i) { return i === -1 || (this.target > 0 && i === this.target); }
  isMarker(i) {
    const n = this.target;
    /* оранжевые бусины-маркеры: при 100 — каждая 33-я, иначе каждая 11-я; при малой цели и после кисточки их нет */
    if (i < 0 || (n > 0 && (n <= 11 || i > n))) return false;
    return (i + 1) % (n === 100 ? 33 : 11) === 0;
  }
  xOf(i) {
    const d = i - this.pos;
    return this.W / 2 + d * this.gap + Math.tanh(d * 1.4) * this.R * 0.75;
  }
  bead(x, y, r, orange, glow) {
    const c = this.c;
    c.beginPath(); c.ellipse(x + r * 0.15, y + r * 0.95, r * 0.8, r * 0.3, 0, 0, 7);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fill();
    if (glow > 0.01) {
      const gg = c.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
      gg.addColorStop(0, `rgba(${orange ? '255,170,110' : '170,240,250'},${0.45 * glow})`);
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill();
    }
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    if (orange) { g.addColorStop(0, '#ffd9b8'); g.addColorStop(0.45, '#f58a4a'); g.addColorStop(1, '#b84f20'); }
    else { g.addColorStop(0, '#e2fbfc'); g.addColorStop(0.45, '#6cc0cb'); g.addColorStop(1, '#2b7482'); }
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.ellipse(x - r * 0.36, y - r * 0.42, r * 0.2, r * 0.13, -0.6, 0, 7); c.fill();
  }
  tassel(x, y, r) {
    const c = this.c, sway = REDUCED ? 0 : Math.sin(this.t * 1.6) * 2.2 + this.vel * 14;
    const len = r * 3.4, top = y + r * 0.9;
    c.fillStyle = '#f58a4a';
    c.beginPath(); c.arc(x, top + r * 0.25, r * 0.42, 0, 7); c.fill();
    const g = c.createLinearGradient(0, top, 0, top + len);
    g.addColorStop(0, '#f58a4a'); g.addColorStop(1, '#c25524');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - r * 0.28, top + r * 0.5); c.lineTo(x + r * 0.28, top + r * 0.5);
    c.lineTo(x + r * 0.85 + sway, top + len); c.lineTo(x - r * 0.85 + sway, top + len); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,40,10,.35)'; c.lineWidth = 0.7;
    for (let k = -2; k <= 2; k++) {
      c.beginPath(); c.moveTo(x + k * r * 0.1, top + r * 0.6); c.lineTo(x + k * r * 0.34 + sway, top + len); c.stroke();
    }
  }
  step(dt) {
    this.t += dt;
    const k = 190, damp = 21;
    const a = (this.count - this.pos) * k - this.vel * damp;
    this.vel += a * dt; this.pos += this.vel * dt;
    if (Math.abs(this.count - this.pos) < 0.0005 && Math.abs(this.vel) < 0.001) { this.pos = this.count; this.vel = 0; }
    this.pulse = Math.max(0, this.pulse - dt * 2.6);
  }
  draw() {
    const c = this.c, W = this.W, H = this.H, R = this.R;
    c.clearRect(0, 0, W, H);
    const span = Math.ceil(W / this.gap / 2) + 3;
    const from = Math.max(-1, Math.floor(this.pos) - span), to = Math.floor(this.pos) + span;
    /* нить */
    c.beginPath();
    const x0 = Math.max(-20, this.xOf(from)), x1 = W + 20;
    for (let x = x0; x <= x1; x += 8) { const y = this.curveY(x); x === x0 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.stroke();
    /* кольцо вокруг центральной бусины */
    const cy = this.curveY(W / 2);
    c.beginPath(); c.arc(W / 2, cy, R * 2.05 + this.pulse * R * 0.9, 0, 7);
    c.strokeStyle = `rgba(255,255,255,${0.32 + this.pulse * 0.4})`; c.lineWidth = 1; c.stroke();
    /* бусины: сначала дальние, центральная последней */
    const order = [];
    for (let i = from; i <= to; i++) order.push(i);
    order.sort((a, b) => Math.abs(b - this.pos) - Math.abs(a - this.pos));
    for (const i of order) {
      const x = this.xOf(i); if (x < -30 || x > W + 30) continue;
      const d = i - this.pos, focus = Math.exp(-d * d * 1.6);
      const y = this.curveY(x);
      if (this.isImam(i)) { this.tassel(x, y, R * 1.25); this.bead(x, y, R * (1.25 + 0.3 * focus), true, focus); }
      else this.bead(x, y, R * (1 + 0.55 * focus), this.isMarker(i), focus * (0.6 + this.pulse * 0.6));
    }
  }
}

/* ---------- ЧАСТИЦЫ ФОНА ---------- */
const FX_PRESETS = {
  forest: { rain: 70, fire: 16, bokeh: 9 },
  falls: { rain: 110, mist: 5 },
  alpine: { motes: 26 },
  orchard: { motes: 22, petal: 10, petalColor: '#fff3d6' },
  desert: { stars: 70 },
  sea: { motes: 18, glint: 26 },
  sakura: { petal: 34, petalColor: '#ffc4dc', stars: 30 },
  mosque: { fire: 20, stars: 18 },
  aurora: { snow: 60, stars: 50 },
  dawn: { motes: 30, mist: 4 },
  dusk: { stars: 60, fire: 8 }
};

class Fx {
  constructor(canvas) { this.cv = canvas; this.c = canvas.getContext('2d'); this.p = []; this.t = 0; this.resize(); }
  resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.cv.clientWidth; this.H = this.cv.clientHeight;
    this.cv.width = this.W * d; this.cv.height = this.H * d; this.c.setTransform(d, 0, 0, d, 0, 0);
  }
  rnd(a, b) { return a + Math.random() * (b - a); }
  setScene(name) {
    const cfg = FX_PRESETS[name] || {}, W = this.W, H = this.H, p = [], k = REDUCED ? 0.35 : 1;
    const add = (type, n, make) => { for (let i = 0; i < Math.round((n || 0) * k); i++) p.push(Object.assign({ type, x: this.rnd(0, W), y: this.rnd(0, H), ph: this.rnd(0, 7) }, make())); };
    add('star', cfg.stars, () => ({ y: this.rnd(0, H * 0.5), r: this.rnd(0.5, 1.5), sp: this.rnd(0.6, 2) }));
    add('bokeh', cfg.bokeh, () => ({ r: this.rnd(14, 46), vx: this.rnd(-4, 4), vy: this.rnd(-6, -1), a: this.rnd(0.04, 0.11) }));
    add('mist', cfg.mist, () => ({ y: this.rnd(H * 0.3, H * 0.75), r: this.rnd(140, 260), vx: this.rnd(4, 12), a: this.rnd(0.04, 0.08) }));
    add('rain', cfg.rain, () => ({ len: this.rnd(10, 24), vy: this.rnd(520, 880), a: this.rnd(0.10, 0.3) }));
    add('snow', cfg.snow, () => ({ r: this.rnd(1, 3.2), vy: this.rnd(18, 55), sw: this.rnd(8, 26), a: this.rnd(0.5, 0.95) }));
    add('petal', cfg.petal, () => ({ r: this.rnd(3, 6), vy: this.rnd(22, 55), sw: this.rnd(20, 50), rot: this.rnd(0, 7), vr: this.rnd(-2, 2), col: cfg.petalColor }));
    add('mote', cfg.motes, () => ({ r: this.rnd(0.8, 2.2), vx: this.rnd(-6, 6), vy: this.rnd(-12, -3), a: this.rnd(0.3, 0.8) }));
    add('fire', cfg.fire, () => ({ y: this.rnd(H * 0.35, H), r: this.rnd(1.2, 2.6), vx: this.rnd(-10, 10), vy: this.rnd(-12, 4), sp: this.rnd(1, 3) }));
    add('glint', cfg.glint, () => ({ y: this.rnd(H * 0.62, H * 0.82), w: this.rnd(8, 30), sp: this.rnd(1, 3) }));
    this.p = p;
  }
  frame(dt) {
    const c = this.c, W = this.W, H = this.H; this.t += dt;
    c.clearRect(0, 0, W, H);
    for (const o of this.p) {
      switch (o.type) {
        case 'star': {
          const a = 0.35 + 0.65 * Math.abs(Math.sin(this.t * o.sp + o.ph));
          c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill(); break;
        }
        case 'bokeh': case 'mist': {
          o.x += (o.vx || 0) * dt; o.y += (o.vy || 0) * dt;
          if (o.y < -o.r) o.y = H + o.r; if (o.x > W + o.r) o.x = -o.r; if (o.x < -o.r) o.x = W + o.r;
          const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
          const a = o.a * (0.7 + 0.3 * Math.sin(this.t * 0.6 + o.ph));
          g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(o.type === 'bokeh' ? 0.85 : 0.4, `rgba(255,255,255,${a * 0.6})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill(); break;
        }
        case 'rain': {
          o.y += o.vy * dt; o.x -= o.vy * 0.22 * dt;
          if (o.y > H) { o.y = -o.len; o.x = this.rnd(0, W * 1.25); }
          c.strokeStyle = `rgba(220,235,245,${o.a})`; c.lineWidth = 1;
          c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x - o.len * 0.22, o.y + o.len); c.stroke(); break;
        }
        case 'snow': {
          o.y += o.vy * dt; const x = o.x + Math.sin(this.t * 0.8 + o.ph) * o.sw;
          if (o.y > H + 4) { o.y = -4; o.x = this.rnd(0, W); }
          c.fillStyle = `rgba(255,255,255,${o.a})`; c.beginPath(); c.arc(x, o.y, o.r, 0, 7); c.fill(); break;
        }
        case 'petal': {
          o.y += o.vy * dt; o.rot += o.vr * dt; const x = o.x + Math.sin(this.t * 0.7 + o.ph) * o.sw;
          if (o.y > H + 8) { o.y = -8; o.x = this.rnd(0, W); }
          c.save(); c.translate(x, o.y); c.rotate(o.rot); c.globalAlpha = 0.85; c.fillStyle = o.col;
          c.beginPath(); c.ellipse(0, 0, o.r, o.r * 0.55, 0, 0, 7); c.fill(); c.restore(); break;
        }
        case 'mote': {
          o.x += o.vx * dt; o.y += o.vy * dt;
          if (o.y < -4) { o.y = H + 4; o.x = this.rnd(0, W); }
          const a = o.a * (0.4 + 0.6 * Math.abs(Math.sin(this.t + o.ph)));
          c.fillStyle = `rgba(255,250,225,${a})`; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill(); break;
        }
        case 'fire': {
          o.x += (o.vx + Math.sin(this.t + o.ph) * 8) * dt; o.y += o.vy * dt;
          if (o.y < H * 0.3) o.y = H; if (o.x < 0) o.x = W; if (o.x > W) o.x = 0;
          const a = Math.max(0, Math.sin(this.t * o.sp + o.ph));
          const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 5);
          g.addColorStop(0, `rgba(255,225,150,${a})`); g.addColorStop(1, 'rgba(255,200,100,0)');
          c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.r * 5, 0, 7); c.fill(); break;
        }
        case 'glint': {
          const a = 0.3 * Math.max(0, Math.sin(this.t * o.sp + o.ph));
          c.fillStyle = `rgba(255,240,215,${a})`; c.fillRect(o.x, o.y, o.w, 1.2); break;
        }
      }
    }
  }
}
