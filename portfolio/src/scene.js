// The world: one pond, one element.
// The element changes form with scroll: crystal → cleaves in two (About) → its light becomes a constellation (Work) → sparks → thread.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { makeCrystalGeometry, splitConvex, makeDust, mulberry32, helixFibre, innerLight, constellationStars, constellationCum, constellationFibre, makeConstellation } from './shapes.js';

export const ACCENT = '#7ea6ff'; // crystal light (sparkles, current star); ripples use the full blue→teal→green band

// Scroll keyframes. S = section index + progress (0 hero, 1 intro, 2 about, 3 work, 4 play, 5 contact).
// [S, x, y, z, scale]
const ELEMENT = [
  [0, 0, 1.15, 0, 0.72], [0.6, 0, 1.15, 0, 0.72],
  [1.3, 1.3, 1.05, 0, 0.8], [1.9, 1.3, 1.05, 0, 0.8],
  [2.4, 1.15, 1.2, 0, 0.82], [2.85, 1.15, 1.2, 0, 0.82],
  [3.25, 1.2, 1.05, 0, 0.86], [3.9, 1.2, 1.05, 0, 0.86],
  [4.35, 0, 1.0, 0, 1.0], [4.8, 0, 1.0, 0, 1.0],
  // the last section can only scroll ~35% of its height, so contact lives in S 5.0–5.35
  [5.2, 0, 1.94, 0, 0.42], [6, 0, 1.94, 0, 0.42],   // small and high: the crystal keeps clear of the contact words
];
// THE STORY (see DESIGN-LANGUAGE.md):
// loader: something glows under the pond → hero: the crystal rises out of the ripple → intro: it refracts light
// into beams that land and ripple → about: too much light, a crack glows, it cleaves, a thread of light is inside
// → work: the light scatters into the sky and becomes a constellation, one star per project; the halves go dark
// → play: the constellation loosens into sparks
// → contact: sparks gather into the thread, the halves close around it, its other end reaches the visitor.
const BEAMS = [[1.05, 0], [1.2, 1], [1.75, 1], [1.9, 0]];          // intro: refracted light (count lit = progress)
const CRACK = [[0, 0], [1.9, 0], [2.18, 1], [2.3, 1], [2.5, 0]];   // about: light builds along the break
const SPLIT = [[0, 0], [2.22, 0], [2.6, 1], [3.25, 2.1], [5.0, 2.1], [5.28, 0]];
const DISSOLVE = [[0, 0], [3.95, 0], [4.35, 1], [4.98, 1], [5.2, 0]];       // halves leave for play, return at contact
// light inside the crystal (0) → one rising filament (1) → constellation (2) → sparks (3) → thread (4)
const PSTATE = [[0, 0], [2.3, 0], [2.78, 1], [3.0, 1], [3.35, 2], [3.9, 2], [4.3, 3], [4.75, 3], [5.08, 4], [6, 4]];
const PVIS = [[0, 0], [2.26, 0], [2.38, 1], [5.2, 1], [5.33, 0]];         // the light shows as the crystal opens
const DIM = [[0, 0], [2.95, 0], [3.3, 1], [4.95, 1], [5.1, 0]];           // the halves go dark and matte: their light is in the sky now

const ease = (t) => t * t * (3 - 2 * t);
function kf(frames, s) {
  if (s <= frames[0][0]) return frames[0].slice(1);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (s <= b[0]) {
      const t = ease((s - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t);
    }
  }
  return frames[frames.length - 1].slice(1);
}
const kf1 = (f, s) => kf(f, s)[0];

const waterVert = /* glsl */ `
varying vec2 vXZ; varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vXZ = wp.xz; vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const waterFrag = /* glsl */ `
uniform float uTime, uNight;
uniform vec3 uDay, uDeep, uAccent, uShadow;
uniform vec4 uCaustic; // x, z, strength
uniform vec4 uUnder;   // x, z, strength: light glowing under the surface before the crystal rises
uniform vec4 uRip[16];
varying vec2 vXZ; varying vec3 vWorld;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 bg = mix(uDay, uDeep, uNight);
  vec3 col = bg;
  // paper / water grain
  float g = noise(vXZ * 55.) * 0.6 + noise(vXZ * 140.) * 0.4;
  col += (g - 0.5) * mix(0.045, 0.02, uNight);
  // stars reflected in the night water
  vec2 sp = vXZ * 4.0 + vec2(0., uTime * 0.02);
  vec2 cell = floor(sp), fr = fract(sp) - 0.5;
  float h = hash(cell);
  vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  float star = (1. - smoothstep(0.0, 0.05, length(fr - o * 0.7))) * step(0.82, h) * (0.55 + 0.45 * sin(uTime * 1.7 + h * 40.));
  col += star * uNight * 0.5;
  // night: a faint moon glade so the surface reads as water
  float glade = exp(-pow(vXZ.x * 0.35, 2.)) * smoothstep(-14., -2., vXZ.y) * (0.6 + 0.4 * noise(vec2(vXZ.x * 3., vXZ.y * 0.8 + uTime * 0.15)));
  col += vec3(0.75, 0.78, 0.85) * glade * uNight * 0.035;
  // ripples: hand-drawn concentric rings, only ever in the accent colour
  float ring = 0.;
  float aa = max(length(fwidth(vXZ)) / 0.12 * 1.2, 1e-4); // derivatives must be taken outside the loop
  for (int i = 0; i < 16; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (r.w <= 0. || age < 0. || age > 7.) continue;
    vec2 dv = vXZ - r.xy;
    float d = length(dv);
    float ang = atan(dv.y, dv.x);
    d += (noise(vec2(ang * 2.5 + r.z, r.z)) - 0.5) * 0.08 * min(d, 2.);
    float R = age * 0.85;
    if (d > R + 0.05) continue;
    float behind = R - d;
    float q = behind / 0.12;
    float k = 0.5 - abs(fract(q) - 0.5);
    float w = 0.06 + 0.03 * noise(vec2(ang * 8., d * 3.));
    float ln = 1. - smoothstep(w, w + aa, k);
    float env = (1. - smoothstep(R - 0.05, R + 0.02, d)) * exp(-behind * 1.35) * (1. - smoothstep(4., 7., age)) * (1. - smoothstep(2.5, 5.5, d));
    ring += ln * env * r.w;
  }
  // the rings carry the crystal's light: blue → teal → green drifting around the pond; quieter than before
  float hue = fract(length(vXZ - uShadow.xy) * 0.12 + atan(vXZ.y - uShadow.y, vXZ.x - uShadow.x) * 0.08 - uTime * 0.04);
  vec3 irisN = mix(mix(vec3(0.42, 0.55, 1.0), vec3(0.34, 0.84, 0.81), smoothstep(0., 0.5, hue)), vec3(0.68, 0.9, 0.56), smoothstep(0.55, 1., hue));
  vec3 irisD = mix(mix(vec3(0.18, 0.33, 0.83), vec3(0.07, 0.58, 0.56), smoothstep(0., 0.5, hue)), vec3(0.29, 0.58, 0.22), smoothstep(0.55, 1., hue));
  col = mix(col, mix(irisD, irisN, uNight), clamp(ring, 0., 1.) * mix(0.62, 0.55, uNight));
  // something under the water: a soft, breathing glow in the crystal's colours
  if (uUnder.z > 0.001) {
    float gd = length(vXZ - uUnder.xy);
    float g = exp(-gd * gd * 1.6) * uUnder.z * (0.85 + 0.15 * sin(uTime * 2.3));
    vec3 gc = mix(vec3(0.32, 0.55, 1.0), vec3(0.34, 0.92, 0.84), 0.5 + 0.5 * sin(uTime * 0.6 + gd * 2.));
    col = mix(col, gc * mix(0.7, 1.35, uNight), clamp(g, 0., 1.) * mix(0.5, 0.75, uNight));
  }
  // light thrown through the crystal onto the water: caustic web in the stone's own colours
  if (uCaustic.z > 0.001) {
    vec2 cp = vXZ - uCaustic.xy - vec2(0.04, 0.14); // right under the crystal, a touch toward the viewer
    float m = 1. - smoothstep(0.1, 1.15, length(cp * vec2(1., 1.4)));
    if (m > 0.) {
      // two drifting layers of a Voronoi edge web = the bright lines of light on a pool floor
      float c = 0.;
      for (int L = 0; L < 2; L++) {
        vec2 p = cp * (5.5 + float(L) * 3.1) + float(L) * 7.3;
        vec2 g = floor(p), f = fract(p);
        float d1 = 9., d2 = 9.;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y));
          vec2 h = vec2(hash(g + o), hash(g + o + 17.3));
          vec2 pt = o + 0.5 + 0.42 * sin(uTime * (0.35 + 0.15 * float(L)) + 6.2831 * h) - f;
          float dd = dot(pt, pt);
          if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
        }
        float e = sqrt(d2) - sqrt(d1);
        c += (1. - smoothstep(0.0, 0.07 + 0.03 * float(L), e)) * (L == 0 ? 0.75 : 0.45);
      }
      float hue = fract(atan(cp.y, cp.x) / 6.2832 + length(cp) * 0.6);
      vec3 cc = mix(mix(vec3(0.3, 0.5, 1.0), vec3(0.2, 0.85, 0.8), smoothstep(0., 0.5, hue)), vec3(0.5, 0.95, 0.5), smoothstep(0.5, 1., hue));
      float k = clamp(c, 0., 1.) * m * uCaustic.z;
      col = mix(col, cc * mix(0.8, 1.2, uNight), k * mix(0.55, 0.32, uNight));
    }
  }
  // soft contact shadow under the element
  col *= 1. - uShadow.z * 0.22 * (1. - smoothstep(0., 1.3, length(vXZ - uShadow.xy)));
  col = mix(col, bg, smoothstep(12., 26., distance(vWorld, cameraPosition))); // per-pixel: the plane only has 4 vertices
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

const pointsVert = /* glsl */ `
attribute vec3 aStone, aHair, aKnot, aDust;
attribute vec4 aRand;
attribute float aShade;
attribute float aOrder; // where it arrives in the sky from the rising filament (bottom first)
attribute float aStar;  // sky: 1 a star, 0.55 the line, 0 the faint field
uniform float uState, uTime, uSize, uScale, uFlow, uHighlightOn;
uniform vec3 uHighlight;
varying float vAlpha, vAccent, vHL, vShade, vHair, vDust, vMote;
vec3 shapeAt(float k){
  if (k < 0.5) return aStone;
  if (k < 1.5) return aHair;
  if (k < 2.5) return aKnot;
  if (k < 3.5) return aDust;
  return aHair; // back to the thread
}
vec3 flow(vec3 p, float t){
  return vec3(sin(p.y * 2.1 + t * 1.3 + aRand.x * 6.28), sin(p.z * 1.7 + t * 1.1 + aRand.y * 6.28), sin(p.x * 1.9 + t * 0.9 + aRand.z * 6.28));
}
void main(){
  float s = clamp(uState, 0., 4.);
  float i = min(floor(s), 3.);
  float f = s - i;
  float del = (i > 0.5 && i < 1.5) ? aOrder : aRand.w; // filament → sky, bottom first
  float ff = smoothstep(0., 1., clamp(f * 1.6 - del * 0.6, 0., 1.));
  vec3 p = mix(shapeAt(i), shapeAt(i + 1.), ff);
  float tr = sin(3.14159 * ff);
  p += flow(p * 1.3, uTime * 0.6) * 0.32 * tr * uFlow;          // the flow between forms
  float dust = smoothstep(2.6, 3.0, s) * (1. - smoothstep(3.6, 4.0, s));
  p += flow(p * 0.8, uTime * 0.25) * (0.012 + dust * 0.25) * uFlow; // idle breathing
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float hairness = 1. - clamp(abs(s - 1.), 0., 1.);
  float sky = 1. - clamp(abs(s - 2.), 0., 1.);
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aRand.y * 2.2) + aRand.x * 40.);            // the field twinkles
  gl_PointSize = max(1.6, uSize * (0.6 + aRand.x * 0.8) * uScale / -mv.z * (1. + dust * 0.1) * (1. - hairness * 0.45) * mix(1., mix(0.75, 1.15, aStar), sky));
  vAccent = step(0.965, aRand.y);
  vHL = uHighlightOn * (1. - smoothstep(0.0, 0.2, distance(p, uHighlight))) * sky;
  vAlpha = mix((0.5 + 0.5 * aRand.z) * (1. - dust * 0.42), 0.95, hairness); // loose ends glow as sparks
  vAlpha *= mix(1., aStar > 0.9 ? 0.8 : aStar > 0.5 ? 0.4 : (0.18 + aStar * 2.) * tw, sky);              // stars bright, the field faint
  vHair = hairness;
  vShade = aShade;
  vDust = dust;
  vMote = 1. - clamp(s, 0., 1.); // the light inside, before it rises
}`;

const pointsFrag = /* glsl */ `
uniform vec3 uInk, uLight, uAccent;
uniform float uNight, uOpacity;
varying float vAlpha, vAccent, vHL, vShade, vHair, vDust, vMote;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float aa = max(fwidth(d), 0.02);                              // one pixel of edge, whatever the point's size
  float a = (1. - smoothstep(0.5 - aa * 1.5, 0.5, d)) * (0.72 + 0.28 * (1. - smoothstep(0., 0.42, d))); // crisp disc, bright core
  vec3 base = mix(uInk, uLight, uNight);
  // hair keeps the photo's light: dark roots, bright sheen (day = graphite drawing, night = glowing strands)
  // features read through density (more particles on edges and dark areas), like a drawing;
  // tone only nudges brightness so every skin tone stays visible in both themes
  vec3 hairCol = mix(mix(uInk, vec3(0.5, 0.48, 0.46), vShade * 0.8), uLight * mix(0.62, 1.0, vShade), uNight);
  float hairA = mix(mix(1., 0.7, vShade), mix(0.78, 1., vShade), uNight);
  vec3 col = mix(base, hairCol, vHair);
  col = mix(col, uAccent, vAccent * 0.9 * (1. - vHair * 0.8));
  col = mix(col, uAccent * mix(0.8, 1.4, uNight), vDust * 0.75); // sparks carry the crystal's light
  col = mix(col, uAccent * mix(0.8, 1.3, uNight), vMote * 0.85); // the light inside carries the crystal's colour
  // the current project's star glows in crystal teal (deeper on paper, luminous at night)
  col = mix(col, mix(vec3(0.07, 0.42, 0.62), vec3(0.42, 0.98, 0.9), uNight), vHL);
  gl_FragColor = vec4(col, a * vAlpha * uOpacity * mix(1., hairA * 1.2, vHair) * (1. + vHL * 0.5) * (1. - vMote * 0.62)); // a light stream, not snow
  #include <colorspace_fragment>
}`;

const starsVert = /* glsl */ `
attribute float aSeed;
uniform float uTime, uScale;
varying float vTw;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.4, (0.05 + aSeed * 0.08) * uScale / -mv.z);
  vTw = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 2.) + aSeed * 40.);
}`;
const starsFrag = /* glsl */ `
uniform float uNight;
varying float vTw;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float aa = max(fwidth(d), 0.03);
  float a = (1. - smoothstep(0.5 - aa * 1.5, 0.5, d)) * (0.55 + 0.45 * (1. - smoothstep(0., 0.35, d)));   // crisp point, bright core
  gl_FragColor = vec4(vec3(0.92, 0.9, 0.86), a * vTw * uNight * 0.85);
  #include <colorspace_fragment>
}`;

// the project stars: a crisp point with a soft halo and four fine rays. Visited stars stay lit; the current one pulses.
const pstarVert = /* glsl */ `
attribute float aIdx;
uniform float uLit, uCur, uCurOn, uScale, uTime, uCount, uFlash, uGem;
varying float vLit, vCur, vHue, vFlash;
void main(){
  vLit = clamp(uLit - aIdx, 0., 1.);
  vCur = uCurOn * (1. - clamp(abs(uCur - aIdx), 0., 1.));
  float gemHere = uGem * vCur;                               // once its gem has formed, the star steps back to a faint halo
  vCur *= 1. - 0.85 * uGem;
  vHue = uCount > 1.5 ? aIdx / (uCount - 1.) : 0.5;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  vFlash = uFlash * vCur;                                   // peaks the moment the project switches (with the chime)
  gl_PointSize = uScale * (0.3 + 0.32 * vLit + 0.75 * vCur * (0.92 + 0.5 * uFlash)) / -mv.z;
}`;
const pstarFrag = /* glsl */ `
uniform float uNight, uAlpha, uTime;
varying float vLit, vCur, vHue, vFlash;
vec3 irisN(float t){ return mix(mix(vec3(0.42, 0.56, 1.0), vec3(0.36, 0.9, 0.85), smoothstep(0., 0.5, t)), vec3(0.7, 0.95, 0.58), smoothstep(0.55, 1., t)); }
vec3 irisD(float t){ return mix(mix(vec3(0.17, 0.31, 0.82), vec3(0.05, 0.55, 0.55), smoothstep(0., 0.5, t)), vec3(0.27, 0.55, 0.2), smoothstep(0.55, 1., t)); }
void main(){
  vec2 q = gl_PointCoord - 0.5; float d = length(q);
  float on = max(vLit, vCur);
  float core = exp(-d * d * 260.);
  float halo = exp(-d * d * 26.) * 0.5;
  float rays = (exp(-abs(q.x) * 90.) * exp(-abs(q.y) * 7.) + exp(-abs(q.y) * 90.) * exp(-abs(q.x) * 7.)) * (0.25 + 0.75 * vCur);
  float a = core + (halo + rays) * (0.2 + 0.8 * on);
  vec3 night = mix(irisN(vHue), vec3(1.), core * 0.85);
  vec3 day = mix(irisD(vHue), vec3(0.04, 0.06, 0.1), core * 0.5);
  a *= 1. + vFlash * 0.9;
  gl_FragColor = vec4(mix(day, night, uNight) * (1. + vFlash * 0.35 * uNight), min(1., a) * (0.35 + 0.65 * on) * uAlpha);
  #include <colorspace_fragment>
}`;

// light trapped in the crystal: thin vertical shards, blue → teal → green, flickering
const shardVert = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aData; // height, width, phase, hue
uniform float uTime;
varying vec2 vUv; varying vec3 vCol; varying float vFlick;
vec3 pal(float t){
  return mix(mix(vec3(0.22, 0.42, 1.0), vec3(0.18, 0.92, 0.85), smoothstep(0., 0.6, t)), vec3(0.55, 1.0, 0.48), smoothstep(0.65, 1., t));
}
void main(){
  vUv = position.xy * 2.;
  vFlick = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (0.7 + aData.z * 1.9) + aData.z * 31.), 2.);
  vec4 mv = modelViewMatrix * vec4(aPos, 1.);
  mv.xy += vec2(position.x * aData.y, position.y * aData.x * (0.75 + 0.25 * vFlick)); // camera-facing, stays vertical
  gl_Position = projectionMatrix * mv;
  vCol = pal(aData.w);
}`;
const shardFrag = /* glsl */ `
uniform float uGlow, uNight;
varying vec2 vUv; varying vec3 vCol; varying float vFlick;
void main(){
  float x = abs(vUv.x), y = abs(vUv.y);
  float a = pow(max(0., 1. - x), 3.) * pow(max(0., 1. - y), 1.6);
  float core = pow(max(0., 1. - x * 3.), 4.) * pow(max(0., 1. - y), 3.);
  float k = (a + core * 1.5) * vFlick * uGlow;
  gl_FragColor = vec4(mix(vCol * vec3(0.45, 0.55, 0.75), vCol, uNight) * max(1., k), min(k, 1.)); // additive at night, inked light by day
}`;

// the fibre of light (constellation line + thread): a crisp glowing filament in the crystal's colours, drawn on along its cord
const fibreVert = /* glsl */ `
attribute float aOrder;
attribute vec3 aMerged;   // helix only: where this vertex goes when the strands merge
attribute float aRung;    // helix only: 1 on the rungs (base pairs)
uniform float uMerge;
varying float vOrder, vRung; varying vec3 vN, vV, vLocal;
void main(){
  vec3 p = mix(position, aMerged, uMerge * step(0.0001, dot(aMerged, aMerged) + aRung));
  vOrder = aOrder; vLocal = p; vRung = aRung;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const fibreFrag = /* glsl */ `
uniform float uReveal, uNight, uTime, uAlpha, uHalo, uHighlightOn, uMerge;
uniform float uProgress, uCurA, uCurB, uFlash;   // work: how far the constellation line is drawn, and the current project's segment
uniform float uFrom, uHueMix, uGlass;    // gene: forms from the top down (uFrom), its own cyan glass (uHueMix 0) vs the crystal's light (1)
uniform vec3 uHighlight;
varying float vOrder, vRung; varying vec3 vN, vV, vLocal;
float gh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 irisN(float t){ return mix(mix(vec3(0.42, 0.56, 1.0), vec3(0.36, 0.9, 0.85), smoothstep(0., 0.5, t)), vec3(0.7, 0.95, 0.58), smoothstep(0.55, 1., t)); }
vec3 irisD(float t){ return mix(mix(vec3(0.17, 0.31, 0.82), vec3(0.05, 0.55, 0.55), smoothstep(0., 0.5, t)), vec3(0.27, 0.55, 0.2), smoothstep(0.55, 1., t)); }
void main(){
  float edge = uReveal - vOrder;
  if (edge < 0. || vOrder < uFrom) discard;
  float tip = 1. - smoothstep(0., 0.03, edge);                  // the bright front, still being tied
  tip = max(tip, step(0.001, uFrom) * (1. - smoothstep(0., 0.035, vOrder - uFrom))); // the gene's forming front
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(facing, 2.5);
  float t = fract(vOrder * 1.4 - uTime * 0.04);                 // light travels along the cord
  // work: each project ties one part of the cord. Untied parts are a faint ghost, tied parts are lit,
  // and the current project's part glows and pulses. The light fills forward along the cord.
  float done = 1. - smoothstep(uProgress - 0.004, uProgress + 0.004, vOrder);
  float cur = smoothstep(uCurA - 0.004, uCurA + 0.004, vOrder) * (1. - smoothstep(uCurB - 0.004, uCurB + 0.004, vOrder));
  float ghost = uHighlightOn * (1. - done);
  float hl = uHighlightOn * cur * done * (0.72 + 0.6 * uFlash);
  float front = uHighlightOn * (1. - smoothstep(0., 0.02, abs(vOrder - uProgress))) * step(0.01, uProgress); // the spark where tying has reached
  vec3 night = irisN(t) * (0.55 + 0.9 * core) + core * core * 0.4 + tip * 0.9;
  vec3 day = mix(irisD(t), vec3(1.), core * core * 0.45 + tip * 0.3);
  vec3 crystalCol = mix(day, night, uNight);
  // the gene's own colour: luminous cyan glass, a bright rim, glints in the surface (like the reference DNA)
  float fres = pow(1. - facing, 1.6);
  float glint = step(0.986, gh(floor(vLocal * 90.))) * (0.4 + 0.6 * facing) * uGlass;
  vec3 geneN = vec3(0.3, 0.86, 1.0) * (0.22 + 1.15 * fres + 0.35 * core) + glint * 0.9 + tip * 0.8;
  vec3 geneD = mix(vec3(0.0, 0.42, 0.6) * (0.6 + 0.55 * fres), vec3(1.), glint * 0.7 + core * 0.12 + tip * 0.3);
  vec3 col = mix(mix(geneD, geneN, uNight), crystalCol, uHueMix);
  col *= 1. - uHighlightOn * done * (1. - cur) * 0.18 * uNight;                       // earlier parts: lit, a little calmer
  col = mix(col, mix(vec3(0.05, 0.4, 0.6), vec3(0.78, 1.0, 0.97), uNight), hl * 0.75);  // the current project's part
  col = mix(col, mix(vec3(0.62, 0.65, 0.7), vec3(0.32, 0.37, 0.45), uNight), ghost);   // not yet tied
  col += front * mix(0.2, 0.9, uNight);
  float a = uHalo > 0.5 ? 0.14 * facing * facing * (1. + hl * 2.) : mix(0.4 + 0.6 * core, 0.32 + 0.68 * fres + glint, uGlass * (1. - uHueMix));
  a *= mix(1., uHalo > 0.5 ? 0. : 0.2, ghost) * (1. + hl * 0.6 + front);
  float rungFade = 1. - vRung * smoothstep(0.05, 0.6, uMerge);   // base pairs dissolve as the strands become one
  if (rungFade < 0.01) discard;
  gl_FragColor = vec4(col, (a + tip * 0.5) * uAlpha * rungFade * (1. - vRung * 0.35));
  #include <colorspace_fragment>
}`;

export function createScene(canvas, { lowPower = false, reduce = false, projects = 4 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
  const maxDpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);   // full Retina sharpness where the device can hold it
  const quality = { dpr: maxDpr, particleFrac: 1 };
  renderer.setPixelRatio(quality.dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.transmissionResolutionScale = lowPower ? 0.45 : 0.8; // the glass refracts a copy of the scene: sharper inside the crystal

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const CAM_Y = 3.9;
  camera.position.set(0, CAM_Y, 8.5);
  const camTarget = new THREE.Vector3(0, 0.55, 0);
  let camBaseZ = 8.5, mobile = false;

  const cDay = new THREE.Color('#ECEEF1'), cNight = new THREE.Color('#07080C'), cBg = new THREE.Color();
  const accent = new THREE.Color(ACCENT);
  let night = 1, nightTarget = 1, nightFrom = 1, nightT0 = -10;
  const NIGHT_FADE = 1; // seconds, ease-in-out: the same curve as the page's colour fade

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.1);
  const key = new THREE.DirectionalLight(0xfff1e2, 2.4); key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0xc9d2e6, 0); rim.position.set(-4, 2.5, -3);
  scene.add(hemi, key, rim);

  // water
  const rip = Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, -100, 0));
  let ripIdx = 0, time = 0;
  const waterU = {
    uTime: { value: 0 }, uNight: { value: 1 },
    uDay: { value: cDay }, uDeep: { value: cNight }, uAccent: { value: accent },
    uRip: { value: rip }, uShadow: { value: new THREE.Vector3() }, uCaustic: { value: new THREE.Vector4() }, uUnder: { value: new THREE.Vector4() },
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: waterVert, fragmentShader: waterFrag }));
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  function addRipple(x, z, strength = 1) {
    rip[ripIdx].set(x, z, time, strength);
    ripIdx = (ripIdx + 1) % rip.length;
  }

  // stars (night sky)
  const SN = lowPower ? 900 : 2200, sPos = new Float32Array(SN * 3), sSeed = new Float32Array(SN), r0 = mulberry32(3);
  for (let i = 0; i < SN; i++) {
    const th = r0() * Math.PI * 2, y = 0.02 + r0() * 0.9, rr = Math.sqrt(1 - y * y);
    sPos[i * 3] = Math.cos(th) * rr * 30; sPos[i * 3 + 1] = y * 30; sPos[i * 3 + 2] = Math.sin(th) * rr * 30 - 6;
    sSeed[i] = r0();
  }
  const starsG = new THREE.BufferGeometry();
  starsG.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starsG.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const starsU = { uTime: { value: 0 }, uScale: { value: 1 }, uNight: { value: 1 } };
  const stars = new THREE.Points(starsG, new THREE.ShaderMaterial({ uniforms: starsU, vertexShader: starsVert, fragmentShader: starsFrag, transparent: true, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  // the element
  const element = new THREE.Group();
  scene.add(element);

  // the stone is crystal now: water-worn glass that holds its own light (reference: blue-green light shards)
  const GLOW = new THREE.Color('#5fe3d0');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const stoneU = { uDissolve: { value: 0 }, uAccent: { value: GLOW }, uFlare: { value: 1 }, uFlareDir: { value: new THREE.Vector3(0, 1, 0) } };
  const stoneMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.05, metalness: 0,
    transmission: 1, thickness: 1.6, ior: 1.58, dispersion: lowPower ? 0 : 6,
    attenuationColor: new THREE.Color('#8ea4ff'), attenuationDistance: 1.05,   // quartz-blue body
    iridescence: 0.32, iridescenceIOR: 1.35, iridescenceThicknessRange: [160, 560],
    envMap, envMapIntensity: 2.4, specularIntensity: 1, clearcoat: 0.6, clearcoatRoughness: 0.04,
  });
  stoneMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, stoneU);
    sh.vertexShader = 'varying vec3 vLocal;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader =
      'uniform float uDissolve; uniform vec3 uAccent; uniform float uFlare; uniform vec3 uFlareDir; varying vec3 vLocal;\nfloat h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }\n' +
      'float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y), mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }\n' +
      sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // facet flares (reference GIF): a whole flat face flashes white as it turns into the sweeping light,
        // fringed with rainbow bands — the big blown-out moments plain glass shading never reaches
        {
          vec3 Lf = normalize(uFlareDir), Vf = normalize(vViewPosition), Hf = normalize(Lf + Vf);
          float nh = max(dot(normal, Hf), 0.);
          float flash = pow(nh, 28.) * 1.5 + pow(nh, 6.) * 0.15; // big flat break faces must not blow out
          float band = dot(normal, Lf) * 1.7 + dot(normal, Vf) * 0.6;
          vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0., 0.33, 0.67)));
          float fringe = smoothstep(0.55, 0.85, nh) * (1. - smoothstep(0.9, 0.99, nh));
          totalEmissiveRadiance += (vec3(1., 0.96, 0.9) * flash + rainbow * fringe * 0.4) * uFlare;
        }`
      ).replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // frosted veils inside the quartz: patches of rough, milky glass between clear windows
        float fz = vn3(vLocal * vec3(2.2, 4.5, 2.2)) * 0.6 + vn3(vLocal * 7.3) * 0.4;
        roughnessFactor = clamp(roughnessFactor + smoothstep(0.5, 0.85, fz) * 0.38, 0.0, 1.0);`
      ).replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float dn = h3(floor(vLocal * 22.0)) * 0.55 + (vLocal.y * 0.4 + 0.5) * 0.45;
        if (dn < uDissolve * 1.05) discard;
        if (uDissolve > 0.001 && dn < uDissolve * 1.05 + 0.05) gl_FragColor.rgb = mix(gl_FragColor.rgb, uAccent, 0.9);`
      );
  };
  const stoneGeo = makeCrystalGeometry();
  const stone = new THREE.Group();          // spins; holds the whole crystal and its two halves
  stone.rotation.order = 'ZYX'; // spin around its own long axis, then tilt — like the reference GIF
  element.add(stone);
  const whole = new THREE.Mesh(stoneGeo, stoneMat);
  stone.add(whole);

  // cleavage: a lengthwise plane, so the halves open like a V with the light between them
  const CLEAVE = new THREE.Vector3(1, 0.16, 0.32).normalize();
  const HINGE = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), CLEAVE).normalize();
  const [geoA, geoB, cutPts, cutCen] = splitConvex(stoneGeo, CLEAVE);
  const halfA = new THREE.Mesh(geoA, stoneMat), halfB = new THREE.Mesh(geoB, stoneMat);
  halfA.visible = halfB.visible = false;
  stone.add(halfA, halfB);
  // the crack: light builds along the break before it opens
  const crackGeo = new THREE.BufferGeometry();
  {
    const v = [];
    for (let i = 0; i < cutPts.length; i++) {
      const a = cutPts[i], b = cutPts[(i + 1) % cutPts.length];
      v.push(cutCen.x, cutCen.y, cutCen.z, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  }
  const crackMat = new THREE.MeshBasicMaterial({ color: '#7ff0e2', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const crack = new THREE.Mesh(crackGeo, crackMat);
  const crackLineMat = new THREE.LineBasicMaterial({ color: '#d8fff9', transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending });
  const crackLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(cutPts), crackLineMat);
  crack.renderOrder = crackLine.renderOrder = 6;
  stone.add(crack, crackLine);

  function poseHalves(k) {
    halfA.position.copy(CLEAVE).multiplyScalar(0.42 * k);
    halfB.position.copy(CLEAVE).multiplyScalar(-0.42 * k);
    halfA.quaternion.setFromAxisAngle(HINGE, 0.26 * k);
    halfB.quaternion.setFromAxisAngle(HINGE, -0.26 * k);
  }

  const SHARDS = lowPower ? 140 : 280;
  const shardGeo = new THREE.InstancedBufferGeometry();
  shardGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  shardGeo.setIndex([0, 1, 2, 0, 2, 3]);
  shardGeo.instanceCount = SHARDS;
  const shardPos = new THREE.InstancedBufferAttribute(new Float32Array(SHARDS * 3), 3);
  const shardData = new THREE.InstancedBufferAttribute(new Float32Array(SHARDS * 4), 4);
  shardGeo.setAttribute('aPos', shardPos);
  shardGeo.setAttribute('aData', shardData);
  function placeShards(surface) {
    const r = mulberry32(17), cnt = surface.length / 3;
    for (let i = 0; i < SHARDS; i++) {
      const k = Math.floor(r() * cnt) * 3, f = 0.1 + r() * 0.72; // inside the crystal
      shardPos.setXYZ(i, surface[k] * f, surface[k + 1] * f, surface[k + 2] * f);
      const wide = r() < 0.14;                                      // a few soft wide ones make the glow
      shardData.setXYZW(i, wide ? 0.6 + r() * 0.9 : 0.25 + r() * 1.05, wide ? 0.14 + r() * 0.18 : 0.012 + r() * 0.03, r(), r());
    }
    shardPos.needsUpdate = shardData.needsUpdate = true;
  }
  placeShards(stoneGeo.userData.surface);
  const shardU = { uTime: { value: 0 }, uGlow: { value: 0 }, uNight: { value: 1 } };
  const shards = new THREE.Mesh(shardGeo, new THREE.ShaderMaterial({
    uniforms: shardU, vertexShader: shardVert, fragmentShader: shardFrag,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  shards.frustumCulled = false;
  shards.renderOrder = 5;
  stone.add(shards);

  // particles
  const rand = mulberry32(11);
  const N = lowPower ? 26000 : 60000;
  const aStone = innerLight(N, rand); // slot 0: the light inside the crystal
  const cStars = constellationStars(Math.max(1, projects)), starCum = constellationCum(cStars);
  const sky = makeConstellation(N, rand, cStars);
  const aRand = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) aRand[i] = rand();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(aStone, 3));
  pg.setAttribute('aStone', new THREE.BufferAttribute(aStone, 3));
  // the light rises as one filament along the crystal's axis, ordered by where it lands in the sky
  const aThread = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const o = sky.order[k], tw = o * 60 + aRand[k * 4] * 6.28, rr = 0.004 + aRand[k * 4 + 1] * 0.008;
    aThread[k * 3] = Math.sin(tw) * rr + Math.sin(o * Math.PI * 2) * 0.07;   // one gentle hanging curve, a fine fibre
    aThread[k * 3 + 1] = (o - 0.5) * 2.05;
    aThread[k * 3 + 2] = Math.cos(tw) * rr;
  }
  pg.setAttribute('aHair', new THREE.BufferAttribute(aThread, 3)); // slot 1 = the thread
  pg.setAttribute('aOrder', new THREE.BufferAttribute(sky.order, 1));
  pg.setAttribute('aKnot', new THREE.BufferAttribute(sky.points, 3)); // slot 2 = the constellation
  pg.setAttribute('aStar', new THREE.BufferAttribute(sky.star, 1));
  pg.setAttribute('aDust', new THREE.BufferAttribute(makeDust(N, rand), 3));
  pg.setAttribute('aRand', new THREE.BufferAttribute(aRand, 4));
  const aShade = new Float32Array(N);
  for (let i = 0; i < N; i++) aShade[i] = 0.7 + rand() * 0.3; // halves: bright, crystal-light particles
  pg.setAttribute('aShade', new THREE.BufferAttribute(aShade, 1));
  const pU = {
    uState: { value: 0 }, uTime: { value: 0 }, uSize: { value: 0.016 }, uScale: { value: 1 },
    uFlow: { value: reduce ? 0.15 : 1 }, uOpacity: { value: 0 }, uNight: { value: 1 },
    uInk: { value: new THREE.Color('#10131a') }, uLight: { value: new THREE.Color('#e7ecf5') }, uAccent: { value: accent },
    uHighlight: { value: new THREE.Vector3() }, uHighlightOn: { value: 0 },
  };
  const points = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: pU, vertexShader: pointsVert, fragmentShader: pointsFrag, transparent: true, depthWrite: false, depthTest: false })); // the thread lives inside the glass
  points.frustumCulled = false;
  points.renderOrder = 7;
  element.add(points);

  // the fibre: the thread at contact (stone space) and the constellation line (same space as the sky particles)
  const knotProg = { uProgress: { value: 0 }, uCurA: { value: 0 }, uCurB: { value: 0 }, uFlash: { value: 0 } }; // shared by every fibre material
  const fibreMat = (halo) => new THREE.ShaderMaterial({
    uniforms: { uReveal: { value: 1 }, uNight: { value: 1 }, uTime: { value: 0 }, uAlpha: { value: 0 }, uHalo: { value: halo ? 1 : 0 }, uMerge: { value: 0 }, uFrom: { value: 0 }, uHueMix: { value: 1 }, uGlass: { value: 0 }, uHighlightOn: pU.uHighlightOn, uHighlight: pU.uHighlight, ...knotProg },
    vertexShader: fibreVert, fragmentShader: fibreFrag, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  });
  const mkFibre = (geo, halo, parent) => { const m = new THREE.Mesh(geo, fibreMat(halo)); m.renderOrder = halo ? 8 : 9; m.frustumCulled = false; parent.add(m); return m; };
  const fibres = {
    thread: [mkFibre(helixFibre(), false, stone), mkFibre(helixFibre(0.075), true, stone)], // shown merged: one thread
    sky: [mkFibre(constellationFibre(cStars, 0.007), false, points), mkFibre(constellationFibre(cStars, 0.05), true, points)],
  };
  for (const m of fibres.thread) { m.material.uniforms.uMerge.value = 1; m.material.uniforms.uGlass.value = 1; }
  for (const m of fibres.sky) m.material.uniforms.uHueMix.value = 1;    // the line is the crystal's own light
  // the project stars
  const psGeo = new THREE.BufferGeometry().setFromPoints(cStars);
  psGeo.setAttribute('aIdx', new THREE.BufferAttribute(new Float32Array(cStars.map((_, i) => i)), 1));
  const psU = { uLit: { value: cStars.length }, uCur: { value: 0 }, uCurOn: { value: 0 }, uScale: { value: 1 }, uTime: { value: 0 }, uCount: { value: cStars.length }, uNight: { value: 1 }, uAlpha: { value: 0 }, uFlash: knotProg.uFlash, uGem: { value: 0 } };
  const projStars = new THREE.Points(psGeo, new THREE.ShaderMaterial({ uniforms: psU, vertexShader: pstarVert, fragmentShader: pstarFrag, transparent: true, depthWrite: false, depthTest: false }));
  projStars.frustumCulled = false; projStars.renderOrder = 10;
  points.add(projStars);
  let litStars = cStars.length, lastWi = -1, workLine = 0;
  function setFibre(list, alpha, reveal) {
    for (const m of list) {
      const u = m.material.uniforms;
      m.visible = alpha > 0.003;
      u.uAlpha.value = alpha * (u.uHalo.value > 0.5 ? 0.15 + 0.85 * night : 1); // the halo is a night glow; on paper the fibre stays crisp
      u.uReveal.value = reveal; u.uNight.value = night; u.uTime.value = time;
      m.material.blending = night > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
  }

  // intro: light refracted by the crystal, falling onto the water in beams (one per discipline)
  const BEAM_N = 5, beamCols = ['#6b8dff', '#5fb4ff', '#57d6cf', '#7fe0a8', '#aee68f'];
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const beams = Array.from({ length: BEAM_N }, (_, i) => {
    const mk = (r, o) => new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: beamCols[i], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const core = mk(), glow = mk();
    core.renderOrder = glow.renderOrder = 4;
    scene.add(core, glow);
    const th = (0.5 + (i / (BEAM_N - 1)) * 0.42) * Math.PI;      // fan across the front-left, toward the text, so every landing is seen
    return { core, glow, th, r: 1.7 + (i % 2) * 0.7, lit: false, k: 0 };
  });
  const bA = new THREE.Vector3(), bB = new THREE.Vector3(), bD = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let beamsLit = 0;

  // story timing
  let riseStart = Infinity, emerged = false, hasRisen = false, lastDrip = 0, found = 0, finale = -10;
  const TOP = new THREE.Vector3(0, 9.6, 2.4), TOPLOOK = new THREE.Vector3(0, 0, 0), look = new THREE.Vector3();
  const api = { onImpact: null };

  // night bloom: only the crystal's flares and the light shards are bright enough to glow
  let useBloom = !lowPower;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // the glass's dispersion can emit a stray NaN/Inf pixel; bloom would smear it over the whole frame
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        bool bad = any(isnan(c)) || any(isinf(c));
        gl_FragColor = bad ? vec4(0., 0., 0., 1.) : vec4(min(c.rgb, vec3(2.5)), c.a); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.4, 1.25);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    mobile = camera.aspect < 0.8;
    camBaseZ = mobile ? 11.5 : 8.5;
    camera.updateProjectionMatrix();
    const scale = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    pU.uScale.value = scale; starsU.uScale.value = scale;
  }

  // adaptive quality: drop resolution + particle count if frames get slow, raise them back if there's headroom
  let acc = 0, frames = 0, lastCheck = 0, slow = 0, fast = 0, lastUp = 0;
  function adapt(dt) {
    acc += dt; frames++;
    if (time < 6 || time - lastCheck < 3 || frames < 60) return;
    const avg = (acc / frames) * 1000;
    if (avg > 24) slow++; else slow = 0;
    if (avg < 12) fast++; else fast = 0;
    if (slow >= 2 && useBloom && quality.dpr <= 1.25) { useBloom = false; slow = 0; acc = 0; frames = 0; lastCheck = time; return; } // bloom goes first
    if (slow >= 2 && quality.dpr > 0.75) {
      slow = 0;
      quality.dpr = Math.max(0.75, quality.dpr - 0.25);
      quality.particleFrac = Math.max(0.35, quality.particleFrac - 0.15);
    } else if (fast >= 4 && quality.dpr < maxDpr && time - lastUp > 12) {
      fast = 0; lastUp = time;
      quality.dpr = Math.min(maxDpr, quality.dpr + 0.25);
      quality.particleFrac = Math.min(1, quality.particleFrac + 0.1);
    } else { acc = 0; frames = 0; lastCheck = time; return; }
    renderer.setPixelRatio(quality.dpr);
    pg.setDrawRange(0, Math.floor(N * quality.particleFrac));
    resize();
    acc = 0; frames = 0; lastCheck = time;
  }

  // ---- the work section's gems: one per project, beside its title ----
  // Each is the hero crystal's own glass in its own cut and colours (body tint + a second colour in the shine). When a
  // project comes in, a burst of particles in its colours snaps inward beside the title and the gem pops into being;
  // on the next switch it shrinks away and the next one snaps in. The page hands over the title's position each frame.
  const GEMS = [
    // soft, pale tones that sit inside the site's palette, each with a gentle glow of its own colour
    { seed: 11, body: '#ffb3a1', shine: '#ffd2a8', glow: '#ff9a7e' },   // FireWatchSafety: soft coral, peach shine
    { seed: 23, body: '#b4d8b4', shine: '#d7efc9', glow: '#9fcf9f' },   // MatterNet: sage, mint shine
    { seed: 37, body: '#f2b6d8', shine: '#cdb8ff', glow: '#e3a3d4' },   // Reva Clothing: soft rose, lilac shine
    { seed: 52, body: '#b3e6e2', shine: '#d3f0fb', glow: '#9fdcd8' },   // Pulp Culture: pale aqua
  ];
  const specGroup = new THREE.Group(); scene.add(specGroup);
  const gemGlowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  // one gem for the whole section: when the project changes it turns, and its colours flow into the next project's
  // (body tint, shine and glow), while it glides to the new title. One mesh, one material, one glow.
  const gemGeo = (() => { const g = makeCrystalGeometry(11); g.computeBoundingBox(); const bb = g.boundingBox, h = bb.max.y - bb.min.y;
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2); g.scale(1 / h, 1 / h, 1 / h); return g; })();
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.8, ior: 1.6, dispersion: lowPower ? 0 : 6,
    attenuationColor: new THREE.Color(GEMS[0].body), attenuationDistance: 1.1,
    specularColor: new THREE.Color(GEMS[0].shine), specularIntensity: 1,
    iridescence: 0.25, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600],
    emissive: new THREE.Color(GEMS[0].glow), emissiveIntensity: 0.02,
    envMap, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.03,
  });
  gemMat.roughness = 0.02; gemMat.iridescence = 0.35;
  // no glow disc: two small lights that only reach the gem, so its facets catch real glints as it turns
  const gemKey = new THREE.PointLight(0xfff4e8, 0, 1, 2), gemRim = new THREE.PointLight(0xd8e4ff, 0, 1, 2);
  specGroup.add(gemKey, gemRim);
  const gem = new THREE.Mesh(gemGeo, gemMat); gem.visible = false; gem.renderOrder = 11; gem.rotation.z = 0.16; specGroup.add(gem);
  const gemHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gemGlowTex, color: new THREE.Color(GEMS[0].glow), transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
  gemHalo.renderOrder = 10; gemHalo.visible = false; specGroup.add(gemHalo);
  const gemCols = GEMS.map((d) => ({ body: new THREE.Color(d.body), shine: new THREE.Color(d.shine), glow: new THREE.Color(d.glow) }));
  const specs = [{ mesh: gem, halo: gemHalo }];   // kept for the debug hook
  let specSpin = 0, specBoost = 0, gemFade = 0, gemIntro = 0, gemSnapT = 1, gemTarget = 0, gemSeen = false;
  const tmpGem = new THREE.Vector3(), gemAt = new THREE.Vector3(), gemAnchorPos = new THREE.Vector3(), gemBase = new THREE.Vector3();
  let gemSize = 0;
  const gemPos = new THREE.Vector3(), gemDir = new THREE.Vector3();
  // the snap: particles scattered around the anchor rush inward and become the gem
  const SNAP_N = 220, snapGeo = new THREE.BufferGeometry();
  const snapDir = new Float32Array(SNAP_N * 3), snapRand = new Float32Array(SNAP_N);
  { const r = mulberry32(77); for (let i = 0; i < SNAP_N; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, rad = 0.55 + r() * 0.9, q = Math.sqrt(1 - u * u); snapDir[i * 3] = Math.cos(a) * q * rad; snapDir[i * 3 + 1] = u * rad; snapDir[i * 3 + 2] = Math.sin(a) * q * rad; snapRand[i] = r(); } }
  snapGeo.setAttribute('position', new THREE.BufferAttribute(snapDir, 3));
  snapGeo.setAttribute('aRand', new THREE.BufferAttribute(snapRand, 1));
  const snapU = { uT: { value: 1 }, uCol: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() }, uScale: { value: 1 }, uAlpha: { value: 0 }, uSize: { value: 0.05 } };
  const snap = new THREE.Points(snapGeo, new THREE.ShaderMaterial({
    uniforms: snapU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aRand; uniform float uT, uScale, uSize; varying float vR; varying float vT;
      void main(){ float t = clamp(uT * (1.0 + aRand * 0.35) - aRand * 0.2, 0., 1.); float e = t * t * t;
        vec3 p = position * (1.0 - e); float sw = (1.0 - e) * 2.4; p.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; vR = aRand; vT = t;
        gl_PointSize = max(1.5, uSize * (0.6 + aRand) * uScale / -mv.z); }`,
    fragmentShader: `uniform vec3 uCol, uCol2; uniform float uAlpha; varying float vR; varying float vT;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = 1. - smoothstep(0.1, 0.5, d);
        gl_FragColor = vec4(mix(uCol, uCol2, vR), a * uAlpha * (0.35 + 0.65 * vT)); }`,
  }));
  snap.frustumCulled = false; snap.renderOrder = 12; snap.visible = false; specGroup.add(snap);

  const tmp = new THREE.Vector3();
  const pEuler = new THREE.Euler(), pQuat = new THREE.Quaternion(), flareDir = new THREE.Vector3();
  const attBlue = new THREE.Color('#8ea4ff'), attSmoke = new THREE.Color('#7a7f88');
  let spin = 0, spinVel = 0, pulse = 0;   // pulse + spinVel: the crystal's answer as each discipline lights
  function update(dt, p) {
    time += dt;
    const S = p.S;
    { const k = Math.min(1, (time - nightT0) / NIGHT_FADE); const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; night = nightFrom + (nightTarget - nightFrom) * e; }
    cBg.copy(cDay).lerp(cNight, night);
    renderer.setClearColor(cBg);
    waterU.uNight.value = pU.uNight.value = starsU.uNight.value = night;
    waterU.uTime.value = pU.uTime.value = starsU.uTime.value = time;
    hemi.intensity = THREE.MathUtils.lerp(1.1, 0.35, night);
    key.intensity = THREE.MathUtils.lerp(2.4, 1.3, night);
    rim.intensity = THREE.MathUtils.lerp(0, 1.1, night);

    let [x, y, z, s] = kf(ELEMENT, S);
    if (mobile) { x = 0; y += 0.45; s *= 0.78; }
    // the crystal waits under the water, then rises out of the ripple's centre (and can sink again for a replay)
    const DEEP = -3.6;
    let dy = DEEP;
    const t = time - riseStart;
    if (t < -0.7) dy = DEEP;
    else if (t < 0) {
      // the pre-roll before a rise: the first time it simply waits under the water; on a replay it sinks from the
      // surface down to the depths (it used to run backwards, popping up early so the crystal seemed to rise twice)
      const q = 1 + t / 0.7;
      dy = hasRisen ? DEEP * Math.min(1, q * q) : DEEP;
      emerged = false;
    }
    else if (t < 1.6) {
      const q = t / 1.6;
      dy = DEEP * Math.pow(1 - q, 3) + 0.2 * Math.sin(Math.PI * q) * q;
      if (!emerged && dy > -1.1) { emerged = true; hasRisen = true; addRipple(x, z, 1.4); setTimeout(() => addRipple(x, z, 0.8), 260); api.onImpact && api.onImpact(1); lastDrip = time; }
    } else dy = 0;
    const bob = reduce || t < 1.6 ? 0 : Math.sin(time * 0.9) * 0.05;
    element.position.set(t < 1.6 ? 0 : x, y + dy + bob, z);
    if (t >= 0 && t < 1.6) element.position.x = x * Math.min(1, t / 1.6);
    element.scale.setScalar(s);
    if (emerged && S < 1.05 && time - lastDrip > 2.8) { lastDrip = time; addRipple(element.position.x, z, 0.5); } // its drips ripple
    // the glow under the water: grows while loading, fades as the crystal comes up
    const under = found * (1 - Math.min(1, Math.max(0, t) / 0.9));
    waterU.uUnder.value.set(0, 0, under, 0);

    // spin slows while the halves are apart, so the gap and the released light stay readable
    const split = kf1(SPLIT, S);
    spin += dt * (reduce ? 0.06 : THREE.MathUtils.lerp(0.32, 0.07, split)) + spinVel * dt;
    spinVel *= Math.exp(-dt * 2.6);                                     // a quick turn that eases out
    pulse *= Math.exp(-dt * 3.2);
    // while it opens, ease the spin so the break faces sideways to the camera and the V reads clearly
    if (split > 0.01) { const goal = Math.round(spin / Math.PI) * Math.PI; spin += (goal - spin) * Math.min(1, dt * 2.2 * Math.min(1, split)); }
    stone.rotation.y = spin;
    poseHalves(split);
    whole.visible = split < 0.002;
    halfA.visible = halfB.visible = !whole.visible;
    stone.rotation.z = 0.36 + Math.sin(time * 0.21) * 0.06;
    stone.rotation.x = Math.sin(time * 0.17) * 0.08;
    // the key light orbits slowly, so flares sweep across the facets
    key.position.set(Math.cos(time * 0.37) * 5, 4.5, Math.sin(time * 0.37) * 4 + 2.5);
    flareDir.set(Math.cos(time * 0.29) * 0.9, 0.55 + Math.sin(time * 0.23) * 0.35, 0.7 + Math.sin(time * 0.29) * 0.5).normalize()
      .transformDirection(camera.matrixWorldInverse);
    stoneU.uFlareDir.value.copy(flareDir);
    // once the light is in the sky, the halves step back: dark, matte, no sheen, so the eye moves to the stars
    const dim = kf1(DIM, S), L = THREE.MathUtils.lerp;
    stoneU.uFlare.value = (0.55 + 0.45 * night) * (1 - dim) * (1 + pulse * 2.4);   // flares when a discipline lights
    stoneMat.envMapIntensity = L(2.4, 0.25, dim);
    stoneMat.roughness = L(0.05, 0.62, dim);
    stoneMat.clearcoat = L(0.6, 0.02, dim);
    stoneMat.iridescence = L(0.32, 0.02, dim);
    stoneMat.attenuationDistance = L(1.05, 0.7, dim);
    stoneMat.attenuationColor.copy(attBlue).lerp(attSmoke, dim);       // quartz-blue → neutral smoky glass
    stoneMat.color.setScalar(L(1, night > 0.5 ? 0.3 : 0.62, dim));
    const dis = kf1(DISSOLVE, S);
    stoneU.uDissolve.value = dis;
    stone.visible = dis < 0.999;
    shardU.uTime.value = time;
    // light builds inside until a crack glows; when it opens, the light leaves the shards and becomes the thread
    const ck = kf1(CRACK, S), opened = THREE.MathUtils.smoothstep(split, 0.15, 0.9);
    const flick = 0.75 + 0.25 * Math.sin(time * 9) * Math.sin(time * 5.3);
    crackMat.opacity = ck * 0.6 * flick * (0.4 + 0.6 * night);
    crackLineMat.opacity = ck * flick;
    crack.visible = crackLine.visible = ck > 0.01;
    shardU.uGlow.value = (0.5 + 0.5 * night) * Math.pow(1 - dis, 2) * 0.24 * (1 + ck * 2.2 + pulse * 2.6) * (1 - opened * 0.85);
    shardU.uNight.value = night;
    shards.material.blending = night > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;
    pU.uState.value = kf1(PSTATE, S);
    const pv = kf1(PVIS, S), st = pU.uState.value, sm = THREE.MathUtils.smoothstep;
    const reveal = sm(st, 1.25, 1.95);                                  // the line draws itself from star to star
    const skyW = sm(st, 1.25, 1.6) * (1 - sm(st, 2.05, 2.5));
    // at contact the light returns as one thread, now in the crystal's colour
    const atContact = 1 - sm(Math.abs(st - 4), 0, 0.3);
    setFibre(fibres.thread, atContact * pv, 1);
    for (const m of fibres.thread) { m.material.uniforms.uHueMix.value = 1; m.rotation.y = time * 0.12; }
    setFibre(fibres.sky, skyW * pv * (0.55 + 0.45 * dim), reveal);
    psU.uAlpha.value = sm(st, 1.4, 1.9) * (1 - sm(st, 2.05, 2.4)) * pv;
    projStars.visible = psU.uAlpha.value > 0.003;
    psU.uNight.value = night; psU.uTime.value = time; psU.uScale.value = pU.uScale.value;
    projStars.material.blending = night > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;
    // particles carry the light itself: inside, rising, the sky, the sparks; the crisp fibre is the thread at contact
    pU.uOpacity.value = pv * (1 - atContact);
    points.visible = pv > 0.001;

    // intro: one beat per discipline. No beam lines any more: as each discipline lights, the crystal flashes,
    // turns a little and chimes, and a soft ripple spreads under it
    const bk = kf1(BEAMS, S), u = THREE.MathUtils.clamp((S - 1.08) / 0.62, 0, 1);
    element.getWorldPosition(bA);
    beamsLit = 0;
    beams.forEach((b, i) => {
      const on = bk > 0.01 && u > i / BEAM_N ? 1 : 0;
      b.k += (on * bk - b.k) * Math.min(1, dt * 5);
      if (on && !b.lit) { pulse = 1; if (!reduce) spinVel += 2.4; addRipple(bA.x, bA.z, 0.4); api.onBeam && api.onBeam(i); }
      b.lit = !!on; if (on) beamsLit++;
      b.core.visible = b.glow.visible = false;
      return;
      bB.set(bA.x + Math.cos(b.th) * b.r * 1.2, 0.01, bA.z + Math.sin(b.th) * b.r);
      bD.subVectors(bB, bA);
      const len = bD.length();
      for (const [m, rad, op] of [[b.core, 0.008, 0.9], [b.glow, 0.05, 0.16]]) {
        m.position.copy(bA).addScaledVector(bD, 0.5);
        m.quaternion.setFromUnitVectors(UP, bD.clone().normalize());
        m.scale.set(rad, len, rad);
        m.material.opacity = b.k * op * (0.55 + 0.45 * night) * (0.85 + 0.15 * Math.sin(time * 3 + i));
        m.material.blending = night > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;
      }
    });
    const ry = Math.sin(time * 0.25) * 0.18, rx = 0;
    // while the particles are the crystal or its halves, they share its exact spin, so dissolving and reforming line up
    const ps = pU.uState.value;
    const asStone = ps <= 1 ? 1 : ps < 2 ? 2 - ps : Math.min(1, Math.max(0, ps - 3));
    pEuler.y += (ry - pEuler.y) * Math.min(1, dt * 3);
    pEuler.x += (rx - pEuler.x) * Math.min(1, dt * 3);
    pQuat.setFromEuler(pEuler);
    points.quaternion.copy(pQuat).slerp(stone.quaternion, asStone);

    const hlTarget = p.workActive ? 1 : 0;
    pU.uHighlightOn.value += (hlTarget - pU.uHighlightOn.value) * Math.min(1, dt * 3);
    const wi = Math.min(cStars.length - 1, Math.max(0, p.workIdx || 0)), nS = cStars.length;
    // work: the line is drawn by the scroll itself, so it reaches star i at exactly the scroll point where
    // project i switches in. That frame is the peak: the chime plays, the star lights and flares, then settles.
    if (p.workActive && p.workP != null) {
      const f = Math.min(nS - 1, p.workP * nS), i = Math.floor(f), frac = f - i;
      const seg = i + 1 < nS ? THREE.MathUtils.smoothstep(frac, 0.45, 1) : 0;    // draws toward the next star over the last half of each project
      const target = starCum[i] + ((starCum[Math.min(nS - 1, i + 1)] - starCum[i]) * seg);
      workLine += (target - workLine) * Math.min(1, dt * 14);                     // just enough smoothing to hide scroll steps
      knotProg.uProgress.value = Math.max(workLine, starCum[wi]);
    }
    if (p.workActive && wi !== lastWi) { if (lastWi >= 0) knotProg.uFlash.value = 1; lastWi = wi; }
    if (!p.workActive) lastWi = -1;
    knotProg.uFlash.value *= Math.exp(-dt * 2.4);
    const kSnap = Math.min(1, dt * 12);
    pU.uHighlight.value.lerp(cStars[wi], kSnap);
    knotProg.uCurA.value += (starCum[Math.max(0, wi - 1)] - knotProg.uCurA.value) * kSnap;
    knotProg.uCurB.value += (starCum[wi] - knotProg.uCurB.value) * kSnap;
    const hl = pU.uHighlightOn.value;
    litStars += ((p.workActive ? wi + 1 : nS) - litStars) * kSnap;
    psU.uLit.value = litStars; psU.uCurOn.value = hl;
    psU.uCur.value += (wi - psU.uCur.value) * kSnap;

    // the gem: appears once beside the title with a particle snap; on each switch it turns, its colours flow into the
    // next project's, and it glides to the new title. Everything eases, so there is no pop or reload.
    {
      const an = p.gemAnchor;
      const on = !!an && p.workActive && S > 3.15 && S < 4.3;
      gemFade += ((on ? 1 : 0) - gemFade) * Math.min(1, dt * 4);
      const idx = Math.min(gemCols.length - 1, Math.max(0, p.workIdx | 0));
      if (on && !gemSeen) { gemSeen = true; gemTarget = idx; gemSnapT = 0; gemIntro = 0; specBoost = 0;
        gemMat.attenuationColor.copy(gemCols[idx].body); gemMat.specularColor.copy(gemCols[idx].shine); gemMat.emissive.copy(gemCols[idx].glow); gemHalo.material.color.copy(gemCols[idx].glow); }
      if (!on && gemFade < 0.02) gemSeen = false;
      if (on && idx !== gemTarget) { gemTarget = idx; specBoost = 5.5; }            // a turn as the colour changes
      gemSnapT = Math.min(1, gemSnapT + dt / 0.5);
      if (gemSnapT >= 1) gemIntro = Math.min(1, gemIntro + dt / 0.5);
      specBoost *= Math.exp(-dt * 2.2);
      specSpin += dt * (0.5 + specBoost);
      // colours flow toward the active project's while it turns
      const ck = Math.min(1, dt * 2.6), c = gemCols[gemTarget];
      gemMat.attenuationColor.lerp(c.body, ck); gemMat.specularColor.lerp(c.shine, ck); gemMat.emissive.lerp(c.glow, ck); gemHalo.material.color.lerp(c.glow, ck);
      psU.uGem.value = 0;
      if (an) {
        const W = window.innerWidth, H = window.innerHeight, D = 6;
        gemAt.set((an.x / W) * 2 - 1, -(an.y / H) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
        gemAnchorPos.copy(camera.position).addScaledVector(gemAt, D);
        const wantSize = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (an.size / H);
        if (gemFade < 0.05) { gemBase.copy(gemAnchorPos); gemSize = wantSize; }        // first frame: start in place
        gemBase.lerp(gemAnchorPos, Math.min(1, dt * 6));                              // glide to the new title
        gemSize += (wantSize - gemSize) * Math.min(1, dt * 6);
      }
      const easeBack = (t) => { const k2 = 1.7; return 1 + (k2 + 1) * Math.pow(t - 1, 3) + k2 * Math.pow(t - 1, 2); };
      const k = (gemSnapT < 1 ? 0 : easeBack(gemIntro)) * gemFade;
      gem.visible = !!an && k > 0.004; gemHalo.visible = false;
      gemKey.intensity = gemRim.intensity = 0;
      if (gem.visible) {
        gem.scale.setScalar(Math.max(0.001, gemSize * k));
        gem.rotation.y = specSpin;
        const bob = reduce ? 0 : Math.sin(time * 1.2) * gemSize * 0.03;
        gem.position.copy(gemBase); gem.position.y += bob;
        // key light up-left in front, rim light behind on the right; both brighten for a moment as it turns
        const r = gemSize, glint = Math.min(1, k) * (1 + specBoost * 0.35);
        gemKey.position.copy(gem.position).add(tmpGem.set(-0.9 * r, 0.8 * r, 1.1 * r)); gemKey.distance = r * 4;
        gemRim.position.copy(gem.position).add(tmpGem.set(1.0 * r, 0.3 * r, -0.9 * r)); gemRim.distance = r * 4;
        gemKey.intensity = r * r * (34 + 14 * night) * glint;
        gemRim.intensity = r * r * (22 + 14 * night) * glint;
        gemMat.emissiveIntensity = 0.05 + 0.05 * night;
        gemMat.attenuationDistance = THREE.MathUtils.lerp(0.5, 1.1, night);
      }
      // the snap: only when the gem first appears
      snap.visible = !!an && gemSnapT < 1 && gemFade > 0.05;
      if (snap.visible) {
        const g = GEMS[gemTarget];
        snapU.uCol.value.set(g.body); snapU.uCol2.value.set(g.shine);
        snapU.uT.value = gemSnapT; snapU.uAlpha.value = gemFade * (0.7 + 0.3 * night);
        snapU.uScale.value = pU.uScale.value;
        snap.position.copy(gemAnchorPos); snap.scale.setScalar(gemSize * 1.1);
        snap.material.blending = night > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;
      }
    }

    // glass casts a light shadow and a pool of coloured light
    waterU.uShadow.value.set(element.position.x, element.position.z, (1 - night * 0.6) * 0.45 * THREE.MathUtils.clamp(1.8 - element.position.y, 0, 1) * (stone.visible ? 1 : 0.35));
    waterU.uCaustic.value.set(element.position.x, element.position.z, Math.pow(1 - dis, 2) * element.scale.x, 0);

    const mx = reduce ? 0 : p.mouse.x, my = reduce ? 0 : p.mouse.y;
    const above = 1 - THREE.MathUtils.smoothstep(time, riseStart - 0.3, riseStart + 2.2); // looking down into the pond until it rises
    camera.position.x += (mx * 0.35 * (1 - above) - camera.position.x) * Math.min(1, dt * 2);
    camera.position.y += (THREE.MathUtils.lerp(CAM_Y + my * 0.15, TOP.y, above) - camera.position.y) * Math.min(1, dt * 2.5);
    camera.position.z += (THREE.MathUtils.lerp(camBaseZ, TOP.z, above) - camera.position.z) * Math.min(1, dt * 2.5);
    camera.lookAt(look.copy(camTarget).lerp(TOPLOOK, above));
    // while it's still under the water, nothing of it may show through the surface
    const surfaced = THREE.MathUtils.smoothstep(dy, -1.5, -0.6);
    if (surfaced < 1) {
      waterU.uShadow.value.z *= surfaced;
      waterU.uCaustic.value.z *= surfaced;
      shards.visible = surfaced > 0.05;
      shardU.uGlow.value *= surfaced;
    } else shards.visible = true;

    if (useBloom && night > 0.02) {
      bloom.strength = 0.45 * night;
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping; // keep the pond's exact colours; the bloom handles the glare
      composer.render(dt);
      renderer.toneMapping = tm;
    } else renderer.render(scene, camera);
    adapt(dt);
  }

  // public api
  Object.assign(api, {
    update, resize,
    addRipple,
    addRippleScreen(cx, cy, strength = 1) {
      const nd = new THREE.Vector3((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
      if (nd.y >= -0.01) return false;
      const t = -camera.position.y / nd.y;
      if (t > 16) return false;
      addRipple(camera.position.x + nd.x * t, camera.position.z + nd.z * t, strength);
      return true;
    },
    rise() { if (riseStart === Infinity) riseStart = time + 0.25; },
    replay() { riseStart = time + 0.7; emerged = false; },         // sinks, then rises from the ripple again
    setFound(v) { found = v; },                                     // loader progress → glow under the water
    finalDrop() { addRipple(0, 0, 1.5); setTimeout(() => addRipple(0, 0, 0.9), 300); },
    setNight(on) { nightFrom = night; nightTarget = on ? 1 : 0; nightT0 = time; },
    snapNight(on) { night = nightFrom = nightTarget = on ? 1 : 0; nightT0 = -10; },
    elementScreen() {
      tmp.copy(element.position).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight };
    },
    setHair({ pos, shade }) {
      const a = pg.attributes.aHair, sh = pg.attributes.aShade;
      a.array.set(pos.subarray(0, a.array.length)); a.needsUpdate = true;
      sh.array.set(shade.subarray(0, sh.array.length)); sh.needsUpdate = true;
    },
    stats: () => ({ dpr: quality.dpr, particles: Math.floor(N * quality.particleFrac) }),
    _debug: { renderer, water, waterU, rip, composer, bloom, camera, knotProg, starCum, beams, specs, get night() { return night; }, setBloom(v) { useBloom = v; }, get time() { return time; }, get riseStart() { return riseStart; } },
  });
  resize();
  // a live getter: Object.assign above would freeze it at its value on the first frame
  Object.defineProperty(api, 'beamsLit', { get: () => beamsLit, enumerable: true });
  return api;
}
