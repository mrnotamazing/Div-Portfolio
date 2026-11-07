// The mystic cat: a hand-printed tiger (the reference print's forward-facing tiger, mirrored and cut out as an
// ink mask) that drops in over the pond as the page opens, gathers itself in the air, and pounces head-first
// into the centre. Its splash is the first ripple, which is why something is under the water.
//
// It moves like real 2D character animation (the way Spine or Rive rigs work): the drawing sits on a fine mesh
// that is bound to a skeleton (spine, hind leg, two forelegs, head, an eight-bone tail), and every point of the
// mesh follows its nearest bones by weight. So the body bends like skin instead of breaking at cuts: the spine
// flexes and extends through the pounce, the legs swing at the hip and shoulders, the tail ripples like a rope,
// and the head counter-rotates to keep its eyes forward. The ink is painted in the crystal's colours.
import * as THREE from 'three';

const SRC = '/jaguar-mask.png';
const W = 768, H = 1410;                    // the mask's size; bones are in % of it
const PADX = 0.26 * W, PADY = 0.13 * H;     // room for limbs and tail to swing past the drawing's edges (see .jag-canvas)

// skeleton (rest pose, % of the image): start, end, parent. The root is the hips.
const BONES = [
  { id: 'sp0', a: [37, 27], b: [38, 44], parent: -1 },
  { id: 'sp1', a: [38, 44], b: [40, 58], parent: 0 },
  { id: 'sp2', a: [40, 58], b: [46, 71], parent: 1 },
  { id: 'hind', a: [18, 33], b: [11, 53], parent: 0 },
  { id: 'foreL', a: [30, 75], b: [28, 96], parent: 2 },
  { id: 'foreR', a: [56, 81], b: [76, 95], parent: 2 },
  { id: 'head', a: [57, 70], b: [86, 72], parent: 2 },
  { id: 't0', a: [27, 27], b: [19, 15], parent: 0, tail: true },
  { id: 't1', a: [19, 15], b: [24, 4], parent: 7, tail: true },
  { id: 't2', a: [24, 4], b: [40, 4], parent: 8, tail: true },
  { id: 't3', a: [40, 4], b: [58, 12], parent: 9, tail: true },
  { id: 't4', a: [58, 12], b: [68, 24], parent: 10, tail: true },
  { id: 't5', a: [68, 24], b: [71, 37], parent: 11, tail: true },
  { id: 't6', a: [71, 37], b: [82, 40], parent: 12, tail: true },
  { id: 't7', a: [82, 40], b: [90, 33], parent: 13, tail: true },
];
// the tail is separated from the body by empty paper everywhere except its root, so points inside this outline
// follow only the tail (and the hips), and points outside it never follow the tail
const TAIL_ZONE = [[0, 0], [100, 0], [100, 47], [60, 47], [59.2, 34], [57, 27], [50, 21], [40, 19], [30, 19.5], [24, 21], [20, 24], [0, 24]];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, smooth((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

// a big cat's pounce, in phases (t 0..1, about 3.2 s). Angles in degrees; positive turns clockwise on screen.
// drop in, stretched (hind leg trailing, forelegs reaching down) → settle → gather in the air (spine flexes,
// legs tuck under, tail curls) → explosive extension (spine opens, forelegs reach for the water, hind leg kicks
// back) → dive, held long
const K = {
  spine: [[0, -2], [0.2, -1], [0.44, 2], [0.56, 6], [0.68, 7], [0.8, -4], [1, -5]],
  hind: [[0, 12], [0.2, 5], [0.44, -2], [0.6, -10], [0.68, -11], [0.8, 16], [1, 18]],
  fore: [[0, -8], [0.2, -3], [0.44, 4], [0.6, 12], [0.68, 13], [0.8, -16], [1, -19]],
  head: [[0, -2], [0.44, 1], [0.66, 4], [0.8, -2], [1, -3]],
  tailAmp: [[0, 7], [0.44, 5], [0.66, 9], [0.85, 4], [1, 3]],
};

// how far along the path at time t: drop in (fast, slowing) → hang in the air → pounce (gathering speed)
function progress(t) {
  if (t < 0.44) return 0.58 * easeOut(t / 0.44);
  if (t < 0.68) return 0.58 + 0.08 * easeInOut((t - 0.44) / 0.24);
  const k = (t - 0.68) / 0.32;
  return 0.66 + 0.34 * k * k;
}

const px = ([x, y]) => [(x / 100) * W, (y / 100) * H];
function inPoly(x, y, poly) { // poly in px
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}

const FRAG = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uC1, uC2, uC3; varying vec2 vUv;
void main(){
  float a = texture2D(uMap, vUv).a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uC1 * a, a);                                  // one solid ink, like a stamp
}`;
const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function createJaguar(host, { reduce = false } = {}) {
  host.insertAdjacentHTML('beforeend', '<div class="jag-wrap" aria-hidden="true"><div class="jag-glow"><canvas class="jag-canvas"></canvas></div></div>');
  const wrap = host.querySelector('.jag-wrap'), canvas = wrap.querySelector('canvas');

  const bones = BONES.map((b) => { const a = px(b.a), e = px(b.b); return { ...b, A: a, B: e, delta: 0, cum: 0, cur: [a[0], a[1]] }; });
  const tailZone = TAIL_ZONE.map(px);
  const headIdx = bones.findIndex((b) => b.id === 'head');

  // the mesh: a grid over the drawing; each vertex keeps its 4 strongest bone weights
  const COLS = 26, ROWS = 46, NV = (COLS + 1) * (ROWS + 1);
  const rest = new Float32Array(NV * 2), pos = new Float32Array(NV * 3), uv = new Float32Array(NV * 2);
  const wIdx = new Uint8Array(NV * 4), wVal = new Float32Array(NV * 4);
  for (let j = 0, v = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++, v++) {
    const x = (i / COLS) * W, y = (j / ROWS) * H;
    rest[v * 2] = x; rest[v * 2 + 1] = y;
    pos[v * 3] = x; pos[v * 3 + 1] = -y;
    uv[v * 2] = i / COLS; uv[v * 2 + 1] = 1 - j / ROWS;
    const inTail = inPoly(x, y, tailZone);
    const cand = bones.map((b, k) => ({ k, w: (b.tail ? inTail : (!inTail || k === 0)) ? 1 / Math.pow(segDist(x, y, b.A, b.B) + 10, 6) : 0 }))
      .filter((c) => c.w > 0).sort((p, q) => q.w - p.w).slice(0, 4);
    const sum = cand.reduce((s, c) => s + c.w, 0) || 1;
    cand.forEach((c, n) => { wIdx[v * 4 + n] = c.k; wVal[v * 4 + n] = c.w / sum; });
  }
  const index = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const a = j * (COLS + 1) + i, b = a + 1, c = a + COLS + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);

  const css = getComputedStyle(document.documentElement);
  const col = (name, fallback) => new THREE.Color((css.getPropertyValue(name) || '').trim() || fallback);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uC1: { value: col('--text-hi', '#eef1f6') }, uC2: { value: col('--i2', '#57d6cf') }, uC3: { value: col('--i1', '#6b8dff') } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  // world units are image pixels, y up (so -y is down the drawing)
  const camera = new THREE.OrthographicCamera(-PADX, W + PADX, PADY, -(H + PADY), -1, 1);
  let renderer = null;

  const ready = new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img); tex.needsUpdate = true;
      mat.uniforms.uMap.value = tex;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      const r = canvas.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      ok();
    };
    img.onerror = no;
    img.src = SRC;
  });

  // forward kinematics, then skin every vertex by its weights
  function skin(tt) {
    const sp = track(K.spine, tt) + Math.sin(tt * 19) * 0.8;              // a breath runs through the spine
    const foreA = track(K.fore, tt), foreB = track(K.fore, clamp(tt - 0.05)) * 0.9; // the far foreleg trails a beat
    const amp = track(K.tailAmp, tt);
    const D = { sp0: 0, sp1: sp, sp2: sp * 0.9, hind: track(K.hind, tt), foreL: foreB, foreR: foreA };
    // the tail: a travelling wave from root to tip, plus a lag against the spine's bend
    for (let k = 0; k < 8; k++) D['t' + k] = amp * Math.sin(tt * Math.PI * 4.2 - k * 0.75) * (0.55 + k * 0.08) - sp * (k === 0 ? 0.9 : 0.15);
    for (const b of bones) b.delta = ((D[b.id] || 0) * Math.PI) / 180;
    // the head turns against everything above it, so its eyes stay forward
    let up = 0; for (let p = bones[headIdx].parent; p >= 0; p = bones[p].parent) up += bones[p].delta;
    bones[headIdx].delta = -up * 0.85 + (track(K.head, tt) * Math.PI) / 180;
    for (const b of bones) {
      if (b.parent < 0) { b.cum = b.delta; b.cur[0] = b.A[0]; b.cur[1] = b.A[1]; continue; }
      const p = bones[b.parent], c = Math.cos(p.cum), s = Math.sin(p.cum), dx = b.A[0] - p.A[0], dy = b.A[1] - p.A[1];
      b.cur[0] = p.cur[0] + dx * c - dy * s; b.cur[1] = p.cur[1] + dx * s + dy * c;
      b.cum = p.cum + b.delta;
    }
    const cs = bones.map((b) => Math.cos(b.cum)), sn = bones.map((b) => Math.sin(b.cum));
    for (let v = 0; v < NV; v++) {
      const x = rest[v * 2], y = rest[v * 2 + 1];
      let ox = 0, oy = 0;
      for (let n = 0; n < 4; n++) {
        const w = wVal[v * 4 + n]; if (!w) continue;
        const k = wIdx[v * 4 + n], b = bones[k], dx = x - b.A[0], dy = y - b.A[1];
        ox += w * (b.cur[0] + dx * cs[k] - dy * sn[k]);
        oy += w * (b.cur[1] + dx * sn[k] + dy * cs[k]);
      }
      pos[v * 3] = ox; pos[v * 3 + 1] = -oy;
    }
    geo.attributes.position.needsUpdate = true;
    if (renderer) renderer.render(scene, camera);
  }

  function pose(t) {
    const Wv = innerWidth, Hv = innerHeight, tt = clamp(t), u = progress(tt);
    // from above the top-left, down to hang in full view left of centre, then into the pond's centre
    const p0 = [0.1 * Wv, -0.55 * Hv], p1 = [0.2 * Wv, 0.42 * Hv], p2 = [0.5 * Wv, 0.52 * Hv];
    const x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0];
    const y = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1];
    const dive = clamp((u - 0.72) / 0.28);
    const lean = lerp(-5, 3, easeOut(clamp(tt / 0.5))) + Math.sin(Math.PI * clamp((tt - 0.4) / 0.32)) * 2;
    const bodyAng = lean + dive * dive * 16;
    const s = lerp(1, 0.22, dive * dive);
    wrap.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${bodyAng.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    wrap.style.opacity = (clamp(tt * 6) * (1 - Math.pow(dive, 2))).toFixed(3);
    wrap.style.filter = dive > 0.05 ? `blur(${(dive * dive * 6).toFixed(2)}px)` : '';
    skin(tt);
  }

  function dispose() {
    wrap.remove(); geo.dispose(); mat.dispose();
    if (mat.uniforms.uMap.value) mat.uniforms.uMap.value.dispose();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }

  return {
    // plays the moment; calls onSplash as it goes under (the caller makes the ripple there)
    leap({ duration = 3200, onSplash, cues = [] } = {}) {
      // ink by theme, read when it plays (not at load, when the page may still be fading between themes):
      // pale on the night pond, solid black on the day page
      mat.uniforms.uC1.value.set(document.documentElement.dataset.theme === 'day' ? '#050608' : '#eef1f6');
      if (reduce) { dispose(); onSplash && onSplash(); return; }
      // if the print is slow to arrive, the pond does not wait for it
      const late = new Promise((_, no) => setTimeout(() => no(new Error('late')), 2500));
      Promise.race([ready, late]).then(() => {
        const t0 = performance.now();
        let splashed = false;
        const todo = cues.slice();
        const step = (now) => {
          const t = (now - t0) / duration;
          pose(t);
          for (let i = todo.length - 1; i >= 0; i--) if (t >= todo[i].at) { todo[i].fn(); todo.splice(i, 1); }
          if (!splashed && t >= 0.95) { splashed = true; onSplash && onSplash(); }
          if (t < 1) requestAnimationFrame(step); else dispose();
        };
        requestAnimationFrame(step);
      }, () => { dispose(); onSplash && onSplash(); });
    },
    pose, ready, // for checking a single frame
  };
}
