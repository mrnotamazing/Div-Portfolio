// The sound of the site: a cinematic mix in the browser, built like a trailer or theatre mix.
//
//   sources ─┬─ dry ─────────────────────────────┐
//            └─ send → pre-delay → hall (4.6 s) ─┤→ mastering EQ (sub weight, less mud, air) → glue compressor
//                                                │   → warm soft saturation → limiter → out
// Big moments also go wide (a Haas split across the speakers) and get a dry sub layer for weight you feel.
// Recorded effects in /audio (roar, whoosh, splash, rise .mp3) replace the synthesised layers when present.
let ctx = null, bus = null, master = null, verb = null, enabled = false, offline = false;
const samples = {};
const SAMPLE_FILES = { roar: '/audio/roar.mp3', whoosh: '/audio/whoosh.mp3', splash: '/audio/splash.mp3', rise: '/audio/rise.mp3' };
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // C major pentatonic, rising

function noiseBuffer(seconds, brown = false) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}
// a large hall: early reflections, then two decorrelated tails whose highs die first
function hallImpulse(seconds = 4.6) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds), buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, k = 0.18 + 0.78 * t;
      lp += ((Math.random() * 2 - 1) - lp) * (1 - k);
      d[i] = lp * Math.pow(1 - t, 3) * (i < sr * 0.008 ? i / (sr * 0.008) : 1);
    }
    for (let r = 0; r < 9; r++) {                                   // early reflections off far walls
      const at = Math.floor(sr * (0.011 + r * 0.0137 + c * 0.0041)), g = 0.55 * Math.pow(0.78, r) * (r % 2 ? -1 : 1);
      if (at < len) d[at] += g;
    }
  }
  return buf;
}
function softClip(amount = 1.6) {
  const n = 2048, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  const ws = ctx.createWaveShaper(); ws.curve = curve; ws.oversample = '4x';
  return ws;
}

function build(destination) {
  master = ctx.createGain(); master.gain.value = offline ? 0.9 : 0;
  // mastering: weight under 90 Hz, less mud at 280 Hz, presence and air on top
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 90; low.gain.value = 5;
  const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 280; mud.Q.value = 0.9; mud.gain.value = -2.5;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 0.8; pres.gain.value = 1.5;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9500; air.gain.value = 3;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 14; glue.ratio.value = 3; glue.attack.value = 0.012; glue.release.value = 0.25;
  const warm = softClip(1.4);
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -4; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.12;
  bus = ctx.createGain(); bus.gain.value = 0.85;
  // the hall: pre-delay so the dry hit lands first, then a wide tail kept out of the sub range
  const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.028;
  verb = ctx.createGain();
  const conv = ctx.createConvolver(); conv.buffer = hallImpulse();
  const vHp = ctx.createBiquadFilter(); vHp.type = 'highpass'; vHp.frequency.value = 140;
  const vLp = ctx.createBiquadFilter(); vLp.type = 'lowpass'; vLp.frequency.value = 9000;
  const vOut = ctx.createGain(); vOut.gain.value = 0.55;
  verb.connect(pre).connect(conv).connect(vHp).connect(vLp).connect(vOut);
  bus.connect(low); vOut.connect(low);
  low.connect(mud).connect(pres).connect(air).connect(glue).connect(warm).connect(limit).connect(master).connect(destination);
}

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  build(ctx.destination);
  // water ambience: brown noise through a slowly breathing low-pass, wide and low
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(6, true); src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 140;
  lfo.connect(lfoG).connect(lp.frequency);
  const amb = ctx.createGain(); amb.gain.value = 0.14;
  src.connect(lp).connect(amb); out(amb, { wide: true, wet: 0.15 });
  src.start(); lfo.start();
  for (const [k, url] of Object.entries(SAMPLE_FILES)) {
    fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => ctx.decodeAudioData(b)).then((buf) => { samples[k] = buf; }).catch(() => {});
  }
}

// route a source: level, stereo position (or a pan that moves), width, how much hall
function out(node, { gain = 1, pan = 0, panTo = null, panDur = 1, wet = 0.3, wide = false, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const g = ctx.createGain(); g.gain.value = gain;
  node.connect(g);
  if (wide) {                                                      // Haas: the same sound, a few ms apart left and right
    const merger = ctx.createChannelMerger(2), dl = ctx.createDelay(0.05), dr = ctx.createDelay(0.05);
    dl.delayTime.value = 0; dr.delayTime.value = 0.013;
    g.connect(dl).connect(merger, 0, 0); g.connect(dr).connect(merger, 0, 1);
    merger.connect(bus);
  } else if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.setValueAtTime(pan, t);
    if (panTo != null) p.pan.linearRampToValueAtTime(panTo, t + panDur);
    g.connect(p).connect(bus);
  } else g.connect(bus);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s).connect(verb); }
  return g;
}
function play(name, opts = {}) {
  const buf = samples[name]; if (!buf) return false;
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = opts.rate || 1;
  out(s, opts); s.start(ctx.currentTime + (opts.delay || 0));
  return true;
}
function env(param, t, a, peak, d, end = 0.0001) {
  param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(end, t + a + d);
}
function noise(seconds, { type = 'bandpass', freq = 1000, q = 0.8, gain = 0.3, t = ctx.currentTime, a = 0.005, brown = false, sweep = null } = {}, opts) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(seconds, brown);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) for (const [dt, v] of sweep) f.frequency.exponentialRampToValueAtTime(v, t + dt);
  const g = ctx.createGain(); env(g.gain, t, a, gain, Math.max(0.01, seconds - a));
  n.connect(f).connect(g); out(g, opts); n.start(t); n.stop(t + seconds + 0.05);
  return f;
}
function tone(type, f0, f1, t, dur, peak, opts, a = 0.02) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
  const g = ctx.createGain(); env(g.gain, t, Math.min(a, dur * 0.3), peak, dur);
  o.connect(g); out(g, opts); o.start(t); o.stop(t + dur + 0.1);
  return o;
}
// a dry sub layer: weight you feel in the chest, kept centred and out of the hall
const sub = (f0, f1, t, dur, peak) => tone('sine', f0, f1, t, dur, peak, { wet: 0 }, 0.012);
// a trailer hit: sub drop + a dark wide thump
function hit(t, size = 1) {
  sub(72, 28, t, 1.8 * size, 0.85 * size);
  noise(0.9 * size, { type: 'lowpass', freq: 420, gain: 0.5 * size, t, sweep: [[0.6, 120]] }, { wide: true, wet: 0.5 });
}
const on = () => (enabled || offline) && ctx;

export const audio = {
  get enabled() { return enabled; },
  async enable() {
    ensure();
    await ctx.resume();
    enabled = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);
  },
  disable() {
    enabled = false;
    if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  },

  // ---- the jaguar ----
  roar() {
    if (!on()) return;
    const t = ctx.currentTime;
    hit(t, 0.8);                                                   // the room shakes as it opens its jaws
    if (play('roar', { gain: 1, wet: 0.45, wide: true })) { sub(58, 34, t + 0.05, 2.2, 0.5); return; }
    const D = 2.6;
    // the voice: three detuned saws and a sub-octave, pitch swelling up then falling away
    const voice = ctx.createGain(); voice.gain.value = 0.32;
    const pitch = [[0, 104], [0.32, 168], [0.9, 140], [D * 0.95, 56]];
    const oscs = [1, 1.012, 0.994, 0.5].map((m, i) => {
      const o = ctx.createOscillator(); o.type = i === 3 ? 'triangle' : 'sawtooth';
      o.frequency.setValueAtTime(pitch[0][1] * m, t);
      for (const [dt, f] of pitch.slice(1)) o.frequency.exponentialRampToValueAtTime(f * m, t + dt);
      o.connect(voice); o.start(t); o.stop(t + D + 0.1);
      return o;
    });
    // the growl: a fast, uneven flutter in the amplitude
    const gr = ctx.createGain(); gr.gain.value = 0.55;
    const f1 = ctx.createOscillator(); f1.frequency.setValueAtTime(23, t); f1.frequency.linearRampToValueAtTime(31, t + D);
    const f2 = ctx.createOscillator(); f2.frequency.value = 37.5;
    const fg1 = ctx.createGain(); fg1.gain.value = 0.32; const fg2 = ctx.createGain(); fg2.gain.value = 0.18;
    f1.connect(fg1).connect(gr.gain); f2.connect(fg2).connect(gr.gain);
    f1.start(t); f2.start(t); f1.stop(t + D + 0.1); f2.stop(t + D + 0.1);
    // grit, then the throat: two formants and a closing low-pass
    const grit = softClip(3.2);
    const fa = ctx.createBiquadFilter(); fa.type = 'bandpass'; fa.frequency.value = 420; fa.Q.value = 2.8;
    const fb = ctx.createBiquadFilter(); fb.type = 'bandpass'; fb.frequency.value = 1150; fb.Q.value = 3.5;
    const fbG = ctx.createGain(); fbG.gain.value = 0.55;
    const close = ctx.createBiquadFilter(); close.type = 'lowpass';
    close.frequency.setValueAtTime(900, t); close.frequency.exponentialRampToValueAtTime(3200, t + 0.35); close.frequency.exponentialRampToValueAtTime(520, t + D);
    const shape = ctx.createGain(); env(shape.gain, t, 0.16, 1, D - 0.16);
    voice.connect(gr).connect(grit); grit.connect(fa).connect(close); grit.connect(fb).connect(fbG).connect(close);
    close.connect(shape);
    out(shape, { gain: 1.1, pan: -0.55, panTo: 0.35, panDur: D, wet: 0.55 });   // it moves across as it roars
    out(shape, { gain: 0.7, wide: true, wet: 0.2 });                             // and fills the room around you
    // breath and rasp through the same growl
    // breath and rasp: a different noise in each ear, so it surrounds rather than sits in one place
    noise(D, { type: 'bandpass', freq: 1700, q: 1.1, gain: 0.13, t, a: 0.12, sweep: [[0.35, 2400], [D, 700]] }, { pan: -0.85, wet: 0.5 });
    noise(D, { type: 'bandpass', freq: 1500, q: 1.3, gain: 0.13, t, a: 0.14, sweep: [[0.4, 2200], [D, 650]] }, { pan: 0.85, wet: 0.5 });
    sub(60, 36, t + 0.04, D, 0.55);                                // the chest
    void oscs;
  },
  whoosh() {
    if (!on()) return;
    const t = ctx.currentTime;
    if (play('whoosh', { gain: 0.85, wet: 0.3, pan: -0.5, panTo: 0.6, panDur: 1 })) return;
    // two independent air layers, one per ear, sweeping past from left to right
    noise(1.25, { type: 'bandpass', freq: 220, q: 1.3, gain: 0.32, t, a: 0.5, sweep: [[0.62, 1900], [1.2, 380]] }, { pan: -0.95, panTo: 0.6, panDur: 1.2, wet: 0.3 });
    noise(1.25, { type: 'bandpass', freq: 240, q: 1.1, gain: 0.32, t: t + 0.035, a: 0.5, sweep: [[0.66, 2100], [1.2, 360]] }, { pan: -0.6, panTo: 0.95, panDur: 1.2, wet: 0.3 });
    noise(1.1, { type: 'lowpass', freq: 260, gain: 0.32, t, a: 0.45, brown: true }, { wide: true, wet: 0.1 });
    sub(95, 55, t + 0.35, 0.9, 0.3);                               // the body passing close
  },
  splash() {
    if (!on()) return;
    const t = ctx.currentTime;
    if (!play('splash', { gain: 1, wet: 0.5, wide: true })) {
      noise(0.32, { type: 'highpass', freq: 2600, gain: 0.55, t, a: 0.002 }, { wide: true, wet: 0.45 });             // the surface breaks
      noise(1.1, { type: 'lowpass', freq: 1500, gain: 0.34, t: t + 0.015, a: 0.004, sweep: [[1, 400]] }, { pan: -0.9, wet: 0.55 }); // the spray, a different splash in each ear
      noise(1.2, { type: 'lowpass', freq: 1700, gain: 0.34, t: t + 0.03, a: 0.004, sweep: [[1.1, 380]] }, { pan: 0.9, wet: 0.55 });
    }
    sub(70, 24, t + 0.03, 2.8, 0.95);                              // the plunge, felt more than heard
    noise(2.8, { type: 'lowpass', freq: 220, gain: 0.4, t: t + 0.12, a: 0.25, brown: true, sweep: [[2.6, 90]] }, { wide: true, wet: 0.35 }); // under the water
    for (let i = 0; i < 20; i++) {                                 // bubbles rising
      const bt = t + 0.35 + Math.random() * 2, f = 260 + Math.random() * 380;
      tone('sine', f, f * 2.6, bt, 0.06 + Math.random() * 0.05, 0.05 + Math.random() * 0.04, { pan: Math.random() * 1.2 - 0.6, wet: 0.5 }, 0.004);
    }
  },

  // ---- the crystal ----
  rise() {                                                       // it breaks the surface: a deep brass-like hit and a shimmer
    if (!on()) return;
    const t = ctx.currentTime;
    if (play('rise', { gain: 0.9, wet: 0.45, wide: true })) { sub(50, 34, t, 2.4, 0.6); return; }
    hit(t, 1);
    const brass = ctx.createGain(); env(brass.gain, t, 0.06, 0.3, 2.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1700, t + 0.28); lp.frequency.exponentialRampToValueAtTime(260, t + 2.8);
    [55, 55.4, 82.4, 110, 164.8].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 2) * 6; o.connect(lp); o.start(t); o.stop(t + 3); });
    lp.connect(brass); out(brass, { wide: true, wet: 0.5 });
    [1567.98, 2093, 2637, 3136].forEach((f, i) => tone('sine', f, 0, t + 0.45 + i * 0.08, 2.6, 0.045, { wet: 0.8, pan: (i - 1.5) * 0.45 }));
  },
  drop(strength = 1) {                                           // a drop into the pond
    if (!on()) return;
    const t = ctx.currentTime;
    tone('sine', 1300, 230, t, 0.35, 0.26 * strength, { wet: 0.4 }, 0.006);
    noise(0.3, { type: 'bandpass', freq: 1900, gain: 0.08 * strength, t: t + 0.01 }, { wet: 0.45 });
    sub(110, 48, t, 0.7, 0.3 * strength);
  },
  crack() {                                                      // the crystal splits: a glassy fracture over a sub thump
    if (!on()) return;
    const t = ctx.currentTime;
    noise(0.1, { type: 'highpass', freq: 3800, gain: 0.5, t, a: 0.001 }, { wide: true, wet: 0.45 });
    noise(0.6, { type: 'bandpass', freq: 1200, gain: 0.2, t: t + 0.02, sweep: [[0.5, 600]] }, { pan: -0.3, wet: 0.55 });
    [2349, 3136, 3951, 4699].forEach((f, i) => tone('triangle', f, f * 0.97, t + 0.01 + i * 0.03, 1.8, 0.045, { wet: 0.75, pan: (i - 1.5) * 0.5 }, 0.003));
    sub(66, 30, t, 1.1, 0.7);
  },
  shimmer() {                                                    // the light scatters into the sky
    if (!on()) return;
    const t = ctx.currentTime;
    noise(2.2, { type: 'highpass', freq: 5000, gain: 0.05, t, a: 0.8 }, { wide: true, wet: 0.7 });
    for (let i = 0; i < 11; i++) tone('sine', PENTA[(i * 3) % PENTA.length] * 2, 0, t + i * 0.07, 2, 0.035, { wet: 0.85, pan: Math.sin(i * 1.7) * 0.85 });
    sub(98, 0, t, 1.6, 0.12);
  },
  chime(i = 0) {                                                 // a star arrives: a crystal bell with a warm low body
    if (!on()) return;
    const t = ctx.currentTime, f = PENTA[Math.min(PENTA.length - 1, Math.max(0, i))];
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.8);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain(); env(g.gain, t, 0.005, 0.22, 3);
    car.connect(g); out(g, { wet: 0.65, pan: -0.4 + i * 0.25 });
    car.start(t); mod.start(t); car.stop(t + 3.1); mod.stop(t + 3.1);
    tone('sine', f * 2, 0, t, 2.2, 0.05, { wet: 0.85, pan: 0.4 - i * 0.2 });
    tone('sine', f / 4, 0, t, 2.4, 0.16, { wide: true, wet: 0.4 }, 0.01);   // the body under the bell
  },
  pluck(i = 0) {                                                 // beams and links: a plucked crystal string
    if (!on()) return;
    const freq = PENTA[((i % 6) + 6) % 6] * 0.75;
    const sr = ctx.sampleRate, len = Math.floor(sr * 1.6), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const period = Math.round(sr / freq);
    for (let k = 0; k < period; k++) d[k] = Math.random() * 2 - 1;
    for (let k = period; k < len; k++) d[k] = (d[k - period] + d[k - period + 1]) * 0.5 * 0.997;
    const s = ctx.createBufferSource(); s.buffer = buf;
    out(s, { gain: 0.12, wet: 0.5, pan: ((i % 5) - 2) * 0.22 }); s.start();
  },
  sparks() {                                                     // the constellation loosens
    if (!on()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 16; i++) tone('sine', 2000 + Math.random() * 3000, 0, t + Math.random() * 1, 0.28, 0.025, { wet: 0.75, pan: Math.random() * 2 - 1 }, 0.003);
    noise(1.4, { type: 'highpass', freq: 6000, gain: 0.04, t, a: 0.3 }, { wide: true, wet: 0.6 });
  },
  theme(night) {                                                 // day / night: a wide airy swell with a low bloom
    if (!on()) return;
    const t = ctx.currentTime;
    noise(1.4, { type: 'bandpass', freq: night ? 1600 : 450, q: 0.9, gain: 0.16, t, a: 0.4, sweep: [[1.2, night ? 360 : 2600]] }, { wide: true, wet: 0.55 });
    tone('sine', night ? 196 : 392, 0, t + 0.05, 1.8, 0.06, { wet: 0.75 });
    sub(night ? 55 : 82, 0, t, 1.4, 0.18);
  },
  stamp() {
    if (!on()) return;
    const t = ctx.currentTime;
    sub(170, 48, t, 0.3, 0.45);
    noise(0.06, { type: 'lowpass', freq: 700, gain: 0.22, t }, { wet: 0.25 });
  },

  // ---- checking: render a sound offline and measure it (used in development, never by the page) ----
  async _measure(name, seconds = 4, arg) {
    const keep = { ctx, bus, master, verb, offline };
    const sr = 48000, oc = new OfflineAudioContext(2, sr * seconds, sr);
    ctx = oc; offline = true; build(oc.destination);
    try { arg === undefined ? audio[name]() : audio[name](arg); } finally { ({ ctx, bus, master, verb, offline } = keep); }
    const buf = await oc.startRendering();
    let peak = 0, sum = 0, n = 0, low = 0, lp = 0;
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < L.length; i++) {
      const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); peak = Math.max(peak, v); sum += L[i] * L[i]; n++;
      lp += (L[i] - lp) * (2 * Math.PI * 120 / sr); low += lp * lp;       // energy under ~120 Hz
    }
    let corr = 0, ll = 0, rr = 0; for (let i = 0; i < L.length; i += 4) { corr += L[i] * R[i]; ll += L[i] * L[i]; rr += R[i] * R[i]; }
    return { name, peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1), rmsDb: +(10 * Math.log10(sum / n || 1e-12)).toFixed(1), lowShare: +(low / (sum || 1e-12)).toFixed(2), width: +(1 - corr / Math.sqrt(ll * rr || 1e-12)).toFixed(2) };
  },
};
