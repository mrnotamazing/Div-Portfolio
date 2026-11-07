import Lenis from 'lenis';
import { createScene } from './scene.js';
import { audio } from './audio.js';
import { initDoodles, DOODLES } from './doodles.js';
import { createThread } from './thread.js';
import { knotSVG } from './shapes.js';
import { createJaguar } from './jaguar.js';
const PROJECTS = document.querySelectorAll('.work-card').length || 4;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowPower = isTouch || (navigator.hardwareConcurrency || 8) <= 4;
const debug = new URLSearchParams(location.search).has('debug');

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ---------- theme ----------
let theme = 'night';
try { theme = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night'); } catch {}
// the saved theme applies instantly on load (no fade from night): fades are only for a visitor's own switch
html.style.transition = 'none';
html.dataset.theme = theme;
void html.offsetWidth;
requestAnimationFrame(() => requestAnimationFrame(() => { html.style.transition = ''; }));

// ---------- small static bits ----------
(function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d'), d = x.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  html.style.setProperty('--noise', `url(${c.toDataURL()})`);
})();
$$('.knot-mark').forEach((el) => (el.innerHTML = knotSVG({ gradient: true, width: 0.07 }))); // the mark = the knot the thread ties at the end, in crystal light

function split(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
          w.appendChild(inner); frag.appendChild(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) {
        const w = document.createElement('span'); w.className = 'w';
        const inner = document.createElement('span'); inner.style.setProperty('--i', i++);
        ch.replaceWith(w); inner.appendChild(ch); w.appendChild(inner);
      }
    });
  };
  walk(el);
}
$$('[data-split]').forEach(split);

const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.25 });

// clock
const clock = $('#clock');
const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }); }; // Bengaluru time
tick(); setInterval(tick, 15000);

// ---------- loader: you're looking down into the pond ----------
// A drop falls; with each step of the counter another ring spreads, and something begins to glow under the water.
// When the visitor reaches in, a mystic jaguar roars, leaps over the pond and dives into its centre; its splash
// raises the crystal. (It waits for that click because browsers only allow sound after one.)
const loader = $('#loader'), countEl = $('.loader-count');
const jaguar = createJaguar(loader, { reduce });
if (debug) window.__jaguar = jaguar;
let shown = 0, target = 5, lastTick = 0, lastRingT = -1, rings = 0;
const COUNT_PER_SEC = 66;   // 0 → 100 in about 1.5 s, the same on every screen (it used to count per frame, ~3 s)
const RING_EVERY = 0.42;    // a new ring every 0.42 s: the same rhythm as before, whatever the counter does
function loaderTick(now) {
  const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
  lastTick = now;
  shown = Math.min(target, shown + COUNT_PER_SEC * dt);
  const v = Math.floor(shown);
  countEl.textContent = String(v).padStart(3, '0');
  if (scene) {
    scene.setFound(shown / 100);
    const t = now / 1000;
    if (lastRingT < 0 || t - lastRingT >= RING_EVERY) { lastRingT = t; scene.addRipple(0, 0, rings === 0 ? 1.3 : 0.55 + v / 250); rings++; }
  }
  if (v >= 100) { loader.classList.add('ready'); return; }
  requestAnimationFrame(loaderTick);
}

// ---------- world ----------
const canvas = $('#gl');
let scene = null;
const mouse = { x: 0, y: 0, cx: window.innerWidth / 2, cy: window.innerHeight * 0.7, active: false };

document.fonts.ready.then(() => { target = Math.max(target, 35); });
setTimeout(() => {
  scene = createScene(canvas, { lowPower, reduce, projects: PROJECTS });
  scene.snapNight(theme === 'night');
  scene.onImpact = () => audio.rise();                         // the crystal breaks the surface
  if (debug) window.__scene = scene;
  // everything is generated in code (crystal, thread, knot), so loading ends here
  target = 100;
  scene.onBeam = (i) => audio.chime(i);                     // each discipline: the crystal flashes, turns and chimes
  requestAnimationFrame(frame);
  requestAnimationFrame(loaderTick);
  const freezeCat = debug && new URLSearchParams(location.search).get('cat'); // ?debug&cat=0.5 holds one frame
  if (freezeCat) jaguar.ready.then(() => jaguar.pose(+freezeCat));
}, 60);

// ---------- smooth scroll ----------
const lenis = reduce ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
lenis && lenis.stop();
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  const t = $(id);
  if (!t) return;
  lenis ? lenis.scrollTo(t, { duration: 2.2 }) : t.scrollIntoView({ behavior: 'smooth' });
}));

let entering = false;
function enter(withSound) {
  if (entering) return;
  entering = true;
  if (withSound) { audio.enable(); setSound(true); }
  loader.classList.add('leaping');                            // the buttons step aside for the jaguar
  jaguar.leap({
    cues: [{ at: 0.34, fn: () => audio.roar() }, { at: 0.66, fn: () => audio.whoosh() }],
    onSplash: () => {
      scene && scene.addRipple(0, 0, 1.7);
      audio.splash();
      setTimeout(begin, 380);                                  // the crystal answers the splash
    },
  });
}
function begin() {
  loader.classList.add('gone');
  document.body.classList.remove('locked');
  document.body.classList.add('entered');
  lenis && lenis.start();
  scene && scene.rise();                                      // you reach in: the crystal rises out of the ripple
  $$('[data-split], [data-reveal]').forEach((el) => { if (!el.closest('.s-hero')) io.observe(el); });
  $$('.s-hero [data-split]').forEach((el) => setTimeout(() => el.classList.add('is-in'), 1700));
}
$('#enter-sound').addEventListener('click', () => enter(true));
$('#enter-quiet').addEventListener('click', () => enter(false));

// ---------- sound + theme toggles ----------
const soundBtn = $('#sound-toggle');
function setSound(on) { soundBtn.querySelector('span').textContent = on ? 'on' : 'off'; soundBtn.setAttribute('aria-pressed', on); }
soundBtn.addEventListener('click', () => { if (audio.enabled) { audio.disable(); setSound(false); } else { audio.enable(); setSound(true); } });

$$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.themeSet;
  if (t === theme) return;
  theme = t; html.dataset.theme = t;
  // the thread follows the colour fade frame by frame
  const t0 = performance.now(); (function fade(now) { thread.setColors(iris()); if (now - t0 < 1100) requestAnimationFrame(fade); })(t0);
  try { localStorage.setItem('theme', t); } catch {}
  $('meta[name="theme-color"]').setAttribute('content', t === 'night' ? '#07080C' : '#ECEEF1');
  if (scene) {
    scene.setNight(t === 'night');
    const p = scene.elementScreen();
    scene.addRippleScreen(p.x, p.y + 140, 1.4);
  }
  audio.theme(t === 'night');
}));

// ---------- pointer: the world answers ----------
window.addEventListener('pointermove', (e) => {
  mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.active = true;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}, { passive: true });   // the pond only answers clicks: moving the mouse should not keep the screen busy
window.addEventListener('pointerdown', (e) => {
  if (!scene || e.target.closest('a,button,.doodle,#loader')) return;
  if (scene.addRippleScreen(e.clientX, e.clientY, 1.1)) audio.drop(0.8);
});
$$('a').forEach((a, i) => a.addEventListener('pointerenter', () => audio.pluck(i)));

// ---------- doodles + thread ----------
const doodles = initDoodles($('#doodles'), { onPoke: (x, y) => { scene && scene.addRippleScreen(x, y + 60, 1); audio.stamp(); } });
const thread = createThread($('#thread'));
// the thread takes the crystal's light, read from the theme tokens
const iris = () => ['--i1', '--i2', '--i3'].map((v) => getComputedStyle(html).getPropertyValue(v).trim());
thread.setColors(iris());

// ---------- scroll → state ----------
const sections = $$('main > section');
let layout = [];
function measure() { layout = sections.map((s) => ({ top: s.offsetTop, h: s.offsetHeight })); }
measure();
window.addEventListener('resize', () => { measure(); scene && scene.resize(); thread.resize(); });
new ResizeObserver(measure).observe(document.body);

function scrollState() {
  const y = (lenis ? lenis.scroll : window.scrollY) + window.innerHeight * 0.25;
  for (let k = layout.length - 1; k >= 0; k--) if (y >= layout[k].top) return Math.min(k + 0.999, k + (y - layout[k].top) / layout[k].h);
  return 0;
}

const work = $('#work'), workCards = $$('.work-card'), workI = $('#work-i');
let workIdx = 0, workP = 0, gemAnchor = null;
function workState() {
  const r = work.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
  workP = p;
  const active = r.top < window.innerHeight * 0.4 && r.bottom > window.innerHeight * 0.6;
  const idx = Math.min(workCards.length - 1, Math.floor(p * workCards.length));
  if (idx !== workIdx) {
    workCards[workIdx].classList.remove('is-active');
    workCards[idx].classList.add('is-active');
    workI.textContent = String(idx + 1).padStart(2, '0');
    audio.chime(idx);                       // the same frame the star arrives and flares
    workIdx = idx;
  }
  // the gem sits in the card's left column, level with the title; the text runs in the column to its right
  const card = workCards[workIdx], cr = card.getBoundingClientRect(), tr = card.querySelector('.work-title').getBoundingClientRect();
  const col = parseFloat(getComputedStyle(card).paddingLeft) || 80;
  const size = Math.min(96, Math.max(46, Math.min(col * 0.95, tr.height * 1.05)));
  gemAnchor = active ? { x: cr.left + col * 0.42, y: tr.top + tr.height * 0.5, size } : null;
  return active;
}

const memories = $$('.memory'), about = $('#about'), play = $('#play');
// "I am currently ...": the scroll through the playground picks which line shows
const rotorItems = $$('.rotor-item'), nowLead = $('.now-lead');
let rotorIdx = 0, leadT = 0;
function rotor(pr) {
  if (!rotorItems.length) return;
  const p = Math.min(0.999, Math.max(0, -pr.top / Math.max(1, pr.height - window.innerHeight)));
  const idx = Math.min(rotorItems.length - 1, Math.floor(p * rotorItems.length));
  if (idx === rotorIdx) return;
  rotorItems.forEach((el, i) => { el.classList.toggle('is-on', i === idx); el.classList.toggle('was-on', i === rotorIdx); });
  rotorIdx = idx;
  // the lead can change with the line ("Most importantly, I am" for the last one): a quick fade, swap, fade back
  const want = rotorItems[idx].dataset.lead || nowLead.dataset.default;
  if (nowLead.textContent !== want) {
    nowLead.classList.add('swap');
    clearTimeout(leadT);
    leadT = setTimeout(() => { nowLead.textContent = want; nowLead.classList.remove('swap'); }, 260);
  }
  audio.pluck(idx + 2);
}
function parallax() {
  const top = about.getBoundingClientRect().top, vh = window.innerHeight;
  if (top > vh || top < -about.offsetHeight) return;
  memories.forEach((m) => {
    const sp = parseFloat(m.dataset.speed);
    const y = -(top + m.offsetTop - vh / 2) * sp;
    m.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  });
}

const disc = $$('.disciplines li');

// the ending: stay at the bottom and a drop falls into the pond; "Begin again" sinks the crystal and lets it rise once more
const again = $('#again');
let endIdle = 0, endDone = false;
function ending(dt) {
  const y = lenis ? lenis.scroll : window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
  if (!document.body.classList.contains('entered') || max < window.innerHeight) return; // only once the story has begun
  if (y >= max - 8) {
    endIdle += dt;
    if (endIdle > 2.2 && !endDone) { endDone = true; scene.finalDrop(); audio.drop(1); again.classList.add('show'); }
  } else {
    endIdle = 0;
    if (y < max - 240 && endDone) { endDone = false; again.classList.toggle('show', false); }
  }
}
again.addEventListener('click', (e) => {
  e.preventDefault();
  again.classList.toggle('show', false);
  const done = () => scene.replay();
  if (lenis) lenis.scrollTo(0, { duration: 3.2, onComplete: done });
  else { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(done, 1800); }
});


// ---------- frame ----------
let last = performance.now(), dbgEl = null, fpsAcc = 0, fpsN = 0, prevS = 0;
// story moments that make a sound as you scroll past them (forward only)
const CUES = [[2.2, () => audio.crack()], [3.05, () => audio.shimmer()], [4.3, () => audio.sparks()]];
if (debug) { dbgEl = document.createElement('div'); dbgEl.className = 'debug'; document.body.appendChild(dbgEl); }
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); // slow devices keep real time instead of slow motion
  last = now;
  lenis && lenis.raf(now);
  const S = debug && window.__forceS != null ? window.__forceS : scrollState(); // ?debug: pin the story to a point
  if (document.body.classList.contains('entered')) for (const [at, fn] of CUES) if (prevS < at && S >= at) fn();
  prevS = S;
  const workActive = workState();
  const fw = debug && window.__forceWork; // ?debug: pin which project is active
  scene.update(dt, { S, mouse, workIdx: fw ? fw.idx : workIdx, workActive: fw ? true : workActive, workCount: workCards.length, workP: fw ? (fw.idx + 0.02) / workCards.length : workP, gemAnchor });
  const pr = play.getBoundingClientRect();     // measure everything before writing any styles this frame
  parallax();
  rotor(pr);
  doodles.update(dt, pr.top < window.innerHeight && pr.bottom > 0);
  // intro: each discipline lights up as its beam lands
  const lit = scene.beamsLit;
  disc.forEach((li, i) => li.classList.toggle('lit', i < lit));
  ending(dt);
  const threadOn = Math.min(1, Math.max(0, (S - 5.12) / 0.18));
  const anchor = scene.elementScreen();
  thread.update(dt, threadOn, anchor, mouse.active ? { x: mouse.cx, y: mouse.cy } : { x: anchor.x + Math.min(innerWidth * 0.34, 440), y: anchor.y + 70 });
  if (dbgEl) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) {
      const st = scene.stats();
      dbgEl.textContent = `fps ${(fpsN / fpsAcc).toFixed(0)}\ndpr ${st.dpr}\nparticles ${st.particles}\nS ${S.toFixed(2)}`;
      fpsAcc = 0; fpsN = 0;
    }
  }
  requestAnimationFrame(frame);
}
