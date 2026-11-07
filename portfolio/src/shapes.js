// Shape generators for the "One Thread" element.
// Every shape returns positions in the element's local space (roughly a 2.4-unit tall box),
// so the particle system can morph between them: stone → hair → knot → dust → stone.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// ---------- random + noise ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  const c000 = c(0, 0, 0), c100 = c(1, 0, 0), c010 = c(0, 1, 0), c110 = c(1, 1, 0);
  const c001 = c(0, 0, 1), c101 = c(1, 0, 1), c011 = c(0, 1, 1), c111 = c(1, 1, 1);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
function fbm(x, y, z, oct = 4, s = 0) {
  let a = 0.5, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * (vnoise(x * f, y * f, z * f, s + i * 17) * 2 - 1);
    n += a; f *= 2.03; a *= 0.5;
  }
  return sum / n;
}
function worley(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let d = 9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const cx = xi + i, cy = yi + j, cz = zi + k;
    const dx = cx + hash3(cx, cy, cz, s) - x;
    const dy = cy + hash3(cx, cy, cz, s + 1) - y;
    const dz = cz + hash3(cx, cy, cz, s + 2) - z;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd < d) d = dd;
  }
  return Math.sqrt(d);
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 1. the stone (procedural scholar's stone; replaced by /assets/stone.glb when present) ----------
// Two versions share one topology: "rough" (fresh rock) and "smooth" (worn by water).
// The smooth one is stored as a morph target so erosion is a single GPU blend.
export function makeStoneGeometry(detail = 40, seed = 7) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position, n = pos.count;
  const rough = new Float32Array(n * 3), smooth = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const sc = [0.8, 1.18, 0.72];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const low = fbm(v.x * 1.1 + seed, v.y * 1.1, v.z * 1.1, 3, seed);
    const w = worley(v.x * 1.5 + seed * 0.37, v.y * 1.5, v.z * 1.5, seed);
    const pit = sstep(0.3, 0.04, w); // fewer, deeper water-worn hollows (Taihu-style)
    const det = fbm(v.x * 5.5, v.y * 5.5, v.z * 5.5, 4, seed + 5) * 0.075 + fbm(v.x * 17, v.y * 17, v.z * 17, 3, seed + 9) * 0.028;
    const rR = 1 + low * 0.3 - pit * 0.36 + det;
    const rS = 1 + low * 0.3 - pit * 0.5 + det * 0.1;
    for (let k = 0; k < 3; k++) {
      const c = v.getComponent(k);
      rough[i * 3 + k] = c * rR * sc[k];
      smooth[i * 3 + k] = c * rS * sc[k];
    }
    const cav = Math.min(1, pit * 0.85 + Math.max(0, -det) * 3.5);
    const tint = 0.95 + fbm(v.x * 3, v.y * 3, v.z * 3, 2, seed + 3) * 0.1;
    const b = (1 - cav * 0.6) * tint;
    col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b * 1.02;
  }
  g.setAttribute('position', new THREE.BufferAttribute(rough, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const g2 = g.clone();
  g2.setAttribute('position', new THREE.BufferAttribute(smooth, 3));
  g2.computeVertexNormals();
  g.morphAttributes.position = [new THREE.BufferAttribute(smooth, 3)];
  g.morphAttributes.normal = [g2.attributes.normal.clone()];
  g2.dispose();
  g.userData.surface = rough;
  return g;
}

export function samplePoints(src, n, rand, scale = 1, jitter = 0.012) {
  const cnt = src.length / 3, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rand() * cnt) * 3;
    out[i * 3] = src[k] * scale + (rand() - 0.5) * jitter;
    out[i * 3 + 1] = src[k + 1] * scale + (rand() - 0.5) * jitter;
    out[i * 3 + 2] = src[k + 2] * scale + (rand() - 0.5) * jitter;
  }
  return out;
}

// ---------- 2. hair, seen from behind (placeholder until /assets/hair.jpg exists) ----------
export function makeHair(n, rand) {
  const out = new Float32Array(n * 3);
  const per = 46;
  const crown = new THREE.Vector3(0.12, 0.8, 0.58).normalize();
  const p = new THREE.Vector3(), nrm = new THREE.Vector3(), a = new THREE.Vector3();
  const dir = new THREE.Vector3(), sw = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  let idx = 0, guard = 0;
  while (idx < n && guard++ < n * 4) {
    p.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    const l2 = p.lengthSq();
    if (l2 > 1 || l2 < 0.01) continue;
    p.normalize();
    if (p.y < -0.25 || p.z < -0.35) continue;
    const layer = rand(), len = 0.7 + rand() * 0.9, phase = rand() * 6.28, curl = 0.25 + rand() * 0.35;
    for (let k = 0; k < per && idx < n; k++) {
      const t = k / (per - 1);
      nrm.copy(p).normalize();
      a.copy(nrm).sub(crown);
      a.addScaledVector(nrm, -a.dot(nrm));
      if (a.lengthSq() < 1e-6) a.set(0, -1, 0);
      a.normalize();
      sw.crossVectors(nrm, a);
      dir.copy(a).multiplyScalar(0.55).addScaledVector(down, 0.7 + t * 0.6).addScaledVector(sw, Math.sin(t * 5 + phase) * curl);
      dir.addScaledVector(nrm, -dir.dot(nrm)).normalize();
      p.addScaledVector(dir, len / per);
      p.setLength(1.05 + layer * 0.11 + Math.sin(t * Math.PI) * 0.06);
      let x = p.x, y = p.y, z = p.z;
      if (y < -1.05) break;
      if (y < -0.35) { const q = Math.min(1, (-0.35 - y) / 0.7); x *= 1 - q * 0.55; z *= 1 - q * 0.3; } // tapered nape
      out[idx * 3] = x * 1.0 + (rand() - 0.5) * 0.004;
      out[idx * 3 + 1] = y * 1.1 + 0.1 + (rand() - 0.5) * 0.004;
      out[idx * 3 + 2] = z * 0.95 + (rand() - 0.5) * 0.004;
      idx++;
    }
  }
  return out;
}

// Turns a cut-out of the user's hair (transparent PNG, see tools/hair_cutout.py) into particles.
// Opaque pixels = hair; brightness = shine (aShade); the silhouette is inflated into a dome for depth.
export async function hairFromImage(url, n, rand) {
  const img = await new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = url;
  });
  if (!img || !img.width) return null;
  const W = 440, H = Math.round((440 * img.height) / img.width); // full detail: strands are 1–2px wide
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  // shine is read from a softened copy: single strands are finer than the particle density,
  // but the broad light bands of the sweep survive and read as flow
  ctx.clearRect(0, 0, W, H);
  ctx.filter = 'blur(3px)';
  ctx.drawImage(img, 0, 0, W, H);
  ctx.filter = 'none';
  const soft = ctx.getImageData(0, 0, W, H).data;
  const cand = [];
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 110) continue;
    const lum = (0.299 * soft[i] + 0.587 * soft[i + 1] + 0.114 * soft[i + 2]) / 255; // getImageData is already un-premultiplied
    cand.push(x, y, lum);
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const m = cand.length / 3;
  if (m < 400) return null;
  // normalise shine to 0..1 within this photo
  let lo = 1, hi = 0;
  for (let k = 2; k < cand.length; k += 3) { lo = Math.min(lo, cand[k]); hi = Math.max(hi, cand[k]); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  const s = 2.5 / Math.max(maxX - minX, maxY - minY);
  const pos = new Float32Array(n * 3), shade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rand() * m) * 3;
    const px = cand[k] + rand(), py = cand[k + 1] + rand();
    const t = Math.min(1, Math.max(0, ((cand[k + 2] - lo) / Math.max(0.01, hi - lo) - 0.12) / 0.7));
    const sh = t * t * (3 - 2 * t); // contrast
    const nx = (px - cx) / rx, ny = (py - cy) / ry;
    const dome = Math.sqrt(Math.max(0, 1 - nx * nx * 0.75 - ny * ny * 0.6));
    pos[i * 3] = (px - cx) * s;
    pos[i * 3 + 1] = -(py - cy) * s + 0.05;
    pos[i * 3 + 2] = dome * 0.75 + sh * 0.08 + (rand() - 0.5) * 0.03;
    shade[i] = sh;
  }
  return { pos, shade };
}

// ---------- 3. the Chinese knot: one continuous cord ----------
function bez(p0, p1, p2, p3, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, m = 1 - t;
    pts.push([
      m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
      m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}
const line = (a, b, steps = 24) => Array.from({ length: steps + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * (i / steps), a[1] + (b[1] - a[1]) * (i / steps)]);

let knotCache = null;
export function buildKnot() {
  if (knotCache) return knotCache;
  const a = 0.36, S = Math.SQRT1_2;
  const xy = (u, v) => [(u + v) * S, (u - v) * S];
  const polys = [], lobes = [];
  const L = [-a, -a / 3, a / 3, a];
  // woven lattice
  for (const c of L) { polys.push(line(xy(c, -a), xy(c, a))); polys.push(line(xy(-a, c), xy(a, c))); }
  // lobes around the four sides
  const sides = [
    { pt: (t) => xy(a, t), out: xy(1, 0) },
    { pt: (t) => xy(-a, t), out: xy(-1, 0) },
    { pt: (t) => xy(t, a), out: xy(0, 1) },
    { pt: (t) => xy(t, -a), out: xy(0, -1) },
  ];
  const lobe = (A, B, N, h) => {
    const cx = B[0] - A[0], cy = B[1] - A[1], cl = Math.hypot(cx, cy), ux = cx / cl, uy = cy / cl;
    const P1 = [A[0] + N[0] * h * 1.35 - ux * h * 0.55, A[1] + N[1] * h * 1.35 - uy * h * 0.55];
    const P2 = [B[0] + N[0] * h * 1.35 + ux * h * 0.55, B[1] + N[1] * h * 1.35 + uy * h * 0.55];
    const pts = bez(A, P1, P2, B);
    polys.push(pts);
    return pts[Math.floor(pts.length / 2)];
  };
  for (const s of sides) {
    const P = L.map(s.pt);
    lobes.push(lobe(P[0], P[1], s.out, 0.42));
    lobes.push(lobe(P[2], P[3], s.out, 0.42));
    lobe(P[1], P[2], s.out, 0.16);
  }
  // hanging loop on top
  const yT = 2 * a * S, y0 = yT + 0.38;
  polys.push(line([0, yT], [0, y0], 12));
  polys.push(bez([0, y0], [-0.42, y0 + 0.5], [-0.3, y0 + 0.98], [0, y0 + 0.98]));
  polys.push(bez([0, y0], [0.42, y0 + 0.5], [0.3, y0 + 0.98], [0, y0 + 0.98]));
  // bead + tassel
  const yb = -yT - 0.4;
  polys.push(line([0, -yT], [0, yb], 12));
  const bead = [];
  for (let i = 0; i <= 32; i++) { const t = (i / 32) * Math.PI * 2; bead.push([Math.cos(t) * 0.06, yb - 0.06 + Math.sin(t) * 0.06]); }
  polys.push(bead);
  polys.push(bez([-0.02, yb - 0.12], [-0.05, yb - 0.5], [-0.12, yb - 0.75], [-0.3, yb - 0.95]));
  polys.push(bez([0.02, yb - 0.12], [0.03, yb - 0.5], [-0.02, yb - 0.8], [-0.14, yb - 1.02]));
  knotCache = { polys, lobes };
  return knotCache;
}

export function makeKnot(n, rand, scale = 0.82) {
  const { polys, lobes } = buildKnot();
  const edges = [];
  let total = 0;
  polys.forEach((poly, si) => {
    for (let i = 0; i < poly.length - 1; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      edges.push({ ax, ay, bx, by, cum: total, len, si, i });
      total += len;
    }
  });
  const out = new Float32Array(n * 3), order = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const r = rand() * total;
    order[k] = r / total; // where along the single cord this point sits (0 = top loop, 1 = tassel)
    let lo = 0, hi = edges.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (edges[mid].cum <= r) lo = mid; else hi = mid - 1; }
    const e = edges[lo], t = (r - e.cum) / e.len;
    const x = e.ax + (e.bx - e.ax) * t, y = e.ay + (e.by - e.ay) * t;
    const z = Math.sin((e.cum + t * e.len) * 26 + e.si) * 0.06; // over–under weave
    const th = 0.026 * Math.sqrt(rand()), ang = rand() * Math.PI * 2, ang2 = rand() * Math.PI * 2;
    out[k * 3] = (x + Math.cos(ang) * th) * scale;
    out[k * 3 + 1] = (y + Math.sin(ang) * th) * scale + 0.05;
    out[k * 3 + 2] = (z + Math.cos(ang2) * th) * scale;
  }
  return { points: out, order, lobes: lobes.map(([x, y]) => new THREE.Vector3(x * scale, y * scale + 0.05, 0)) };
}

let knotSvgId = 0;
export function knotSVG({ stroke = 'currentColor', width = 0.085, gradient = false } = {}) {
  // gradient: the mark is drawn in the crystal's light (blue → teal → green), like the fibre in the scene
  const gid = `knot-iris-${++knotSvgId}`;
  const defs = gradient ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" style="stop-color:var(--i1)"/><stop offset="0.55" style="stop-color:var(--i2)"/><stop offset="1" style="stop-color:var(--i3)"/></linearGradient></defs>` : '';
  if (gradient) stroke = `url(#${gid})`;
  const { polys } = buildKnot();
  let minX = 9, maxX = -9, minY = 9, maxY = -9, d = '';
  for (const p of polys) {
    for (const [x, y] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    d += 'M' + p.map(([x, y]) => `${x.toFixed(3)} ${(-y).toFixed(3)}`).join('L');
  }
  const pad = 0.12;
  return `<svg viewBox="${(minX - pad).toFixed(3)} ${(-maxY - pad).toFixed(3)} ${(maxX - minX + 2 * pad).toFixed(3)} ${(maxY - minY + 2 * pad).toFixed(3)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${defs}<path d="${d}"/></svg>`;
}

// ---------- 4. dust (the playground: everything loosens) ----------
export function makeDust(n, rand) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.cbrt(rand()) * 3.4, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
    out[i * 3] = r * Math.sin(ph) * Math.cos(th) * 1.5;
    out[i * 3 + 1] = r * Math.cos(ph) * 0.55 + 0.2;
    out[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) * 0.8;
  }
  return out;
}

// ---------- real stone from Blender (/assets/stone.glb) ----------
// Normalises size, adds cavity shading (vertex colours) and a water-worn morph target,
// so it behaves exactly like the procedural stone.
export function prepareStone(src, targetHeight = 2.3) {
  let g = src.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.morphAttributes = {};
  g = mergeVertices(g, 1e-4);
  g.computeBoundingBox();
  const c = new THREE.Vector3();
  g.boundingBox.getCenter(c);
  const s = targetHeight / (g.boundingBox.max.y - g.boundingBox.min.y);
  g.translate(-c.x, -c.y, -c.z);
  g.scale(s, s, s);
  g.computeVertexNormals();
  const pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count, idx = g.index.array;
  const nb = Array.from({ length: n }, () => []);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], d = idx[i + 2];
    nb[a].push(b, d); nb[b].push(a, d); nb[d].push(a, b);
  }
  const orig = Float32Array.from(pos.array);
  let cur = Float32Array.from(orig), next = new Float32Array(orig.length);
  for (let it = 0; it < 10; it++) {
    for (let v = 0; v < n; v++) {
      const list = nb[v];
      let x = 0, y = 0, z = 0;
      for (const u of list) { x += cur[u * 3]; y += cur[u * 3 + 1]; z += cur[u * 3 + 2]; }
      const k = list.length || 1;
      next[v * 3] = cur[v * 3] * 0.5 + (x / k) * 0.5;
      next[v * 3 + 1] = cur[v * 3 + 1] * 0.5 + (y / k) * 0.5;
      next[v * 3 + 2] = cur[v * 3 + 2] * 0.5 + (z / k) * 0.5;
    }
    [cur, next] = [next, cur];
  }
  const col = new Float32Array(n * 3), worn = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const dx = orig[v * 3] - cur[v * 3], dy = orig[v * 3 + 1] - cur[v * 3 + 1], dz = orig[v * 3 + 2] - cur[v * 3 + 2];
    const d = dx * nrm.getX(v) + dy * nrm.getY(v) + dz * nrm.getZ(v);
    const cav = Math.min(1, Math.max(0, -d * 14));
    const b = 1 - cav * 0.55;
    col[v * 3] = b; col[v * 3 + 1] = b; col[v * 3 + 2] = b * 1.02;
    for (let k = 0; k < 3; k++) worn[v * 3 + k] = orig[v * 3 + k] * 0.45 + cur[v * 3 + k] * 0.55; // softened, shape kept
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const g2 = g.clone();
  g2.setAttribute('position', new THREE.BufferAttribute(worn, 3));
  g2.computeVertexNormals();
  g.morphAttributes.position = [new THREE.BufferAttribute(worn, 3)];
  g.morphAttributes.normal = [g2.attributes.normal.clone()];
  g2.dispose();
  g.userData.surface = orig;
  return g;
}

// ---------- portrait with real depth (/assets/face.png + /assets/face_depth.png) ----------
// Particles are placed like a pencil drawing: more along edges and dark features (eyes, glasses,
// hairline, smile), fewer on flat skin. Each one sits at its estimated depth, so the face has relief.
export async function portraitFromImages(colorUrl, depthUrl, n, rand) {
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
  const [img, dimg] = await Promise.all([load(colorUrl), load(depthUrl)]);
  if (!img || !dimg) return null;
  const W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const col = ctx.getImageData(0, 0, W, H).data;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(dimg, 0, 0, W, H);
  const dep = ctx.getImageData(0, 0, W, H).data;

  const lum = new Float32Array(W * H), alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    lum[i] = (0.299 * col[i * 4] + 0.587 * col[i * 4 + 1] + 0.114 * col[i * 4 + 2]) / 255;
    alpha[i] = col[i * 4 + 3] / 255;
  }
  // tone range of the subject only
  let lo = 1, hi = 0;
  for (let i = 0; i < W * H; i++) if (alpha[i] > 0.5) { lo = Math.min(lo, lum[i]); hi = Math.max(hi, lum[i]); }
  const weight = new Float32Array(W * H);
  let total = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (alpha[i] < 0.5) continue;
    const gx = lum[i + 1] - lum[i - 1] + 0.5 * (lum[i - W + 1] - lum[i - W - 1] + lum[i + W + 1] - lum[i + W - 1]);
    const gy = lum[i + W] - lum[i - W] + 0.5 * (lum[i + W - 1] - lum[i - W - 1] + lum[i + W + 1] - lum[i - W + 1]);
    const edge = Math.min(1, Math.hypot(gx, gy) * 4);
    const dark = 1 - (lum[i] - lo) / Math.max(0.01, hi - lo);
    weight[i] = 0.3 + dark * 0.7 + edge * 2.2;
    total += weight[i];
  }
  const cum = new Float32Array(W * H);
  let acc = 0;
  for (let i = 0; i < W * H; i++) { acc += weight[i]; cum[i] = acc; }

  const s = 2.45 / Math.max(W, H);
  const pos = new Float32Array(n * 3), shade = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const r = rand() * total;
    let a = 0, b = W * H - 1;
    while (a < b) { const m = (a + b) >> 1; if (cum[m] < r) a = m + 1; else b = m; }
    const x = a % W, y = (a / W) | 0;
    const z = dep[a * 4] / 255;
    const t = Math.min(1, Math.max(0, ((lum[a] - lo) / Math.max(0.01, hi - lo) - 0.08) / 0.8));
    pos[k * 3] = (x + rand() - W / 2) * s;
    pos[k * 3 + 1] = -(y + rand() - H / 2) * s + 0.05;
    pos[k * 3 + 2] = (z - 0.45) * 1.15 + (rand() - 0.5) * 0.01;
    shade[k] = t * t * (3 - 2 * t);
  }
  return { pos, shade };
}

// ---------- the crystal: a faceted, double-terminated quartz (reference: rotating crystal GIF) ----------
// Built as the convex hull of a jittered hexagonal prism with pointed ends and a few chipped corners,
// so every face is a real flat facet. Flat normals keep the edges sharp for the rainbow dispersion.
export function makeCrystalGeometry(seed = 4) {
  const r = mulberry32(seed), pts = [];
  const R = 0.56, rings = [-0.72, -0.3, 0.12, 0.55]; // chunky, like the reference
  for (const h of rings) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + (r() - 0.5) * 0.18;
      const rr = R * (0.86 + r() * 0.24);
      pts.push(new THREE.Vector3(Math.cos(a) * rr + h * 0.1, h * 1.18, Math.sin(a) * rr * 0.8));
    }
  }
  // pointed terminations, slightly off-axis, with chipped facets around them
  pts.push(new THREE.Vector3(0.06, 1.32, 0.02), new THREE.Vector3(-0.08, -1.24, -0.03));
  for (let k = 0; k < 7; k++) {
    const top = r() < 0.55, a = r() * Math.PI * 2, rr = R * (0.35 + r() * 0.45);
    pts.push(new THREE.Vector3(Math.cos(a) * rr, (top ? 1 : -1) * (0.9 + r() * 0.25), Math.sin(a) * rr * 0.8));
  }
  const geo = new ConvexGeometry(pts);
  geo.computeVertexNormals();
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).build();
  const surf = new Float32Array(8000 * 3), v = new THREE.Vector3();
  for (let i = 0; i < 8000; i++) { sampler.sample(v); surf[i * 3] = v.x; surf[i * 3 + 1] = v.y; surf[i * 3 + 2] = v.z; }
  geo.userData.surface = surf;
  return geo;
}

// ---------- cleavage: split the crystal along a plane into two closed halves ----------
// Each half is the convex hull of the original corners on its side plus the points where edges cross the plane,
// so both pieces are solid crystals with a fresh flat face where they broke.
export function splitConvex(geo, n, d = 0) {
  const pos = geo.attributes.position, A = new Map(), B = new Map(), C = new Map();
  const key = (p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
  const add = (m, p) => m.set(key(p), p.clone());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const side = (p) => p.dot(n) - d;
  const edge = (p, q) => {
    const dp = side(p), dq = side(q);
    if (dp * dq < 0) { const x = p.clone().lerp(q, dp / (dp - dq)); add(A, x); add(B, x); add(C, x); }
  };
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    for (const p of [a, b, c]) add(side(p) >= 0 ? A : B, p);
    edge(a, b); edge(b, c); edge(c, a);
  }
  const [ga, gb] = [A, B].map((m) => {
    const g = new ConvexGeometry([...m.values()]);
    g.computeVertexNormals();
    return g;
  });
  // the break outline, ordered around its centre (for the glowing crack before it opens)
  const cut = [...C.values()], cen = cut.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(cut.length || 1);
  const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(n, u);
  cut.sort((p, q) => Math.atan2(p.clone().sub(cen).dot(w), p.clone().sub(cen).dot(u)) - Math.atan2(q.clone().sub(cen).dot(w), q.clone().sub(cen).dot(u)));
  return [ga, gb, cut, cen];
}

export function sampleSurface(geo, n, matrix) {
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).build();
  const out = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    sampler.sample(v);
    if (matrix) v.applyMatrix4(matrix);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  return out;
}

// ---------- the fibre of light: the thread and the knot drawn as one glowing filament ----------
// Each vertex carries aOrder = how far along the single cord it sits (same mapping as the knot particles),
// so the knot can draw itself on in order, one loop after another.
function tubeWithOrder(points, radius, o0, o1, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubular = Math.max(8, points.length * 2);
  const g = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  const n = g.attributes.position.count, ord = new Float32Array(n);
  for (let i = 0; i < n; i++) ord[i] = o0 + (o1 - o0) * (Math.floor(i / (radial + 1)) / tubular);
  g.setAttribute('aOrder', new THREE.BufferAttribute(ord, 1));
  return g;
}

export function knotFibre(radius = 0.02, scale = 0.82) {
  const { polys } = buildKnot();
  let total = 0;
  const lens = polys.map((p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); total += L; return L; });
  let cum = 0;
  const parts = polys.map((poly, si) => {
    let arc = cum;
    const pts = poly.map((pt, i) => {
      if (i > 0) arc += Math.hypot(pt[0] - poly[i - 1][0], pt[1] - poly[i - 1][1]);
      return new THREE.Vector3(pt[0] * scale, pt[1] * scale + 0.05, Math.sin(arc * 26 + si) * 0.06 * scale);
    });
    const g = tubeWithOrder(pts, radius, cum / total, (cum + lens[si]) / total);
    cum += lens[si];
    return g;
  });
  return mergeGeometries(parts);
}

export function threadFibre(radius = 0.014) {
  const pts = [];
  for (let i = 0; i <= 60; i++) { const o = i / 60; pts.push(new THREE.Vector3(Math.sin(o * Math.PI * 2) * 0.07, (o - 0.5) * 2.05, 0)); }
  return tubeWithOrder(pts, radius, 0, 1, 10);
}

// ---------- the gene: two strands of light in a double helix that merge into one strong thread ----------
// Every vertex also stores where it goes when merged (aMerged: on the thread's axis, thicker),
// and rungs (base pairs) carry aRung = 1 so they can fade as the strands become one.
export function helixFibre(tube = 0.022, R = 0.17, turns = 3.2) {   // proportions of a real DNA double helix
  const axis = (o) => new THREE.Vector3(Math.sin(o * Math.PI * 2) * 0.07, (o - 0.5) * 2.05, 0);
  const strandPt = (o, ph) => { const a = o * turns * Math.PI * 2 + ph; return axis(o).add(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); };
  const radial = 8, parts = [];
  const finish = (g, curve, tubular, isRung, o0, o1, mergedAt) => {
    const pos = g.attributes.position, n = pos.count;
    const ord = new Float32Array(n), merged = new Float32Array(n * 3), rung = new Float32Array(n).fill(isRung);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = Math.floor(i / (radial + 1)) / tubular;
      ord[i] = o0 + (o1 - o0) * u;
      p.fromBufferAttribute(pos, i);
      const m = mergedAt(u, p.clone().sub(curve.getPointAt(u)));
      merged[i * 3] = m.x; merged[i * 3 + 1] = m.y; merged[i * 3 + 2] = m.z;
    }
    g.setAttribute('aOrder', new THREE.BufferAttribute(ord, 1));
    g.setAttribute('aMerged', new THREE.BufferAttribute(merged, 3));
    g.setAttribute('aRung', new THREE.BufferAttribute(rung, 1));
    parts.push(g);
  };
  // the two strands
  for (const ph of [0, Math.PI]) {
    const pts = []; for (let i = 0; i <= 160; i++) pts.push(strandPt(i / 160, ph));
    const curve = new THREE.CatmullRomCurve3(pts), tubular = 320;
    const g = new THREE.TubeGeometry(curve, tubular, tube, radial, false);
    finish(g, curve, tubular, 0, 0, 1, (u, ring) => axis(u).add(ring.multiplyScalar(1.9))); // merged: one thicker thread
  }
  // base pairs: each rung is two halves reaching in from either strand, with a small gap where they pair
  const RUNGS = 30;
  for (let k = 1; k < RUNGS; k++) {
    const o = k / RUNGS, a = strandPt(o, 0), b = strandPt(o, Math.PI), c = axis(o);
    for (const [from, to] of [[a, b], [b, a]]) {
      const end = from.clone().lerp(to, 0.45);
      const curve = new THREE.CatmullRomCurve3([from, from.clone().lerp(end, 0.5), end]);
      const g = new THREE.TubeGeometry(curve, 3, tube * 0.62, 6, false);
      const n = g.attributes.position.count, ord = new Float32Array(n).fill(o), merged = new Float32Array(n * 3), rung = new Float32Array(n).fill(1);
      for (let i = 0; i < n; i++) { merged[i * 3] = c.x; merged[i * 3 + 1] = c.y; merged[i * 3 + 2] = c.z; }
      g.setAttribute('aOrder', new THREE.BufferAttribute(ord, 1));
      g.setAttribute('aMerged', new THREE.BufferAttribute(merged, 3));
      g.setAttribute('aRung', new THREE.BufferAttribute(rung, 1));
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

// motes of light high above the crystal: the gene's raw material, which streams down and forms it
export function skyMotes(n, rand) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rand()) * 0.9, a = rand() * Math.PI * 2;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = 1.6 + rand() * 2.2;
    out[i * 3 + 2] = Math.sin(a) * r * 0.7;
  }
  return out;
}

// ---------- the light inside: a soft cloud in the crystal's core, released when it cracks ----------
export function innerLight(n, rand) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.cbrt(rand()) * 0.22, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
    out[i * 3] = r * Math.sin(ph) * Math.cos(th);
    out[i * 3 + 1] = r * Math.cos(ph) * 3.2;            // stretched along the crystal's long axis
    out[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  return out;
}

// ---------- the constellation: the crystal's light scattered into the sky, one star per project ----------
// A rising, slightly irregular path, like a real asterism. The same stars drive the scene, the line and the mark.
export function constellationStars(n = 4) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    // sized and lifted so it hangs in the sky above and behind the crystal's halves
    pts.push(new THREE.Vector3(
      (-0.95 + t * 1.9 + Math.sin(i * 2.3) * 0.12) * 1.55,
      (-0.55 + t * 1.25 + (i % 2 ? 0.42 : -0.12) + Math.cos(i * 1.7) * 0.08) * 1.3 + 0.02,
      Math.sin(i * 1.3) * 0.15 - 0.45,
    ));
  }
  return pts;
}
// where each star sits along the line (0..1 by length): project i draws the line up to star i
export function constellationCum(stars) {
  const seg = stars.slice(1).map((p, i) => p.distanceTo(stars[i]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let c = 0;
  return [0, ...seg.map((l) => (c += l) / total)];
}
// the line between the stars: straight segments of fibre, ordered along the path
export function constellationFibre(stars, radius = 0.014) {
  const cum = constellationCum(stars);
  if (stars.length < 2) return tubeWithOrder([stars[0], stars[0].clone().add(new THREE.Vector3(0, 0.001, 0))], radius, 0, 1);
  return mergeGeometries(stars.slice(1).map((b, i) => {
    const a = stars[i], pts = [];
    for (let k = 0; k <= 6; k++) pts.push(a.clone().lerp(b, k / 6));
    return tubeWithOrder(pts, radius, cum[i], cum[i + 1]);
  }));
}
// particles for the sky: a bright cluster at every star, a faint dusting along the line, and a sparse field of stars.
// order = where the particle arrives from the rising thread (bottom of the sky first); star = 1 node, 0.55 line, 0 field
export function makeConstellation(n, rand, stars) {
  const cum = constellationCum(stars);
  const points = new Float32Array(n * 3), order = new Float32Array(n), star = new Float32Array(n);
  const g = () => (rand() + rand() + rand() - 1.5) / 1.5; // soft gaussian-ish
  for (let k = 0; k < n; k++) {
    const r = rand();
    let x, y, z, o, s;
    if (r < 0.03) {                                       // the stars themselves
      const j = Math.floor(rand() * stars.length), p = stars[j], rr = 0.025 * Math.pow(rand(), 1.8);
      const a = rand() * Math.PI * 2, b = Math.acos(2 * rand() - 1);
      x = p.x + rr * Math.sin(b) * Math.cos(a); y = p.y + rr * Math.cos(b); z = p.z + rr * Math.sin(b) * Math.sin(a);
      o = cum[j]; s = 1;
    } else if (r < 0.045 && stars.length > 1) {             // the line, lightly dusted
      const u = rand(), i = Math.min(stars.length - 2, cum.findIndex((c, ci) => ci > 0 && u <= c) - 1);
      const ii = Math.max(0, i), t = (u - cum[ii]) / Math.max(1e-4, cum[ii + 1] - cum[ii]);
      const a = stars[ii], b = stars[ii + 1];
      x = a.x + (b.x - a.x) * t + g() * 0.012; y = a.y + (b.y - a.y) * t + g() * 0.012; z = a.z + (b.z - a.z) * t + g() * 0.012;
      o = u; s = 0.55;
    } else {                                              // the sky around it
      x = -5.2 + rand() * 8.4; y = -1.4 + rand() * 4.6; z = -1.4 + rand() * 1.4;   // wide enough that its edge never shows
      o = Math.min(1, Math.max(0, (y + 1.4) / 4.6)); s = rand() < 0.04 ? 0.3 : 0;   // a few brighter field stars
    }
    points[k * 3] = x; points[k * 3 + 1] = y; points[k * 3 + 2] = z;
    order[k] = Math.min(1, Math.max(0, o + (rand() - 0.5) * 0.06)); star[k] = s;
  }
  return { points, order, star };
}
// the mark: the same constellation, drawn in the crystal's light
let constSvgId = 0;
export function constellationSVG({ n = 4, width = 0.07, gradient = true } = {}) {
  const gid = `const-iris-${++constSvgId}`;
  const stars = constellationStars(n).map((p) => [p.x, -p.y]);
  const xs = stars.map((p) => p[0]), ys = stars.map((p) => p[1]), pad = 0.22;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, w = Math.max(...xs) - Math.min(...xs) + 2 * pad, h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
  const side = Math.max(w, h), ox = minX - (side - w) / 2, oy = minY - (side - h) / 2;
  const paint = gradient ? `url(#${gid})` : 'currentColor';
  const defs = gradient ? `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${xs[0]}" y1="${ys[0]}" x2="${xs[xs.length - 1]}" y2="${ys[ys.length - 1]}"><stop offset="0" style="stop-color:var(--i1)"/><stop offset="0.55" style="stop-color:var(--i2)"/><stop offset="1" style="stop-color:var(--i3)"/></linearGradient></defs>` : '';
  const line = `<path d="M${stars.map((p) => p.map((v) => v.toFixed(3)).join(' ')).join('L')}" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.75"/>`;
  const dots = stars.map((p, i) => `<circle cx="${p[0].toFixed(3)}" cy="${p[1].toFixed(3)}" r="${(i === stars.length - 1 ? 0.13 : 0.1).toFixed(3)}" fill="${paint}"/>`).join('');
  return `<svg viewBox="${ox.toFixed(3)} ${oy.toFixed(3)} ${side.toFixed(3)} ${side.toFixed(3)}" aria-hidden="true">${defs}${line}${dots}</svg>`;
}
