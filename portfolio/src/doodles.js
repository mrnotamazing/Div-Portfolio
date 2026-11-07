// The playful layer: hand-drawn doodles that answer back.
// Placeholder drawings in the spirit of the user's pins (tiger, daruma, lion mask, eye-star, seal).
const ACC = 'var(--doodle)', BG = 'var(--bg)'; // a pale tint of crystal light; the ink line does the talking
const S = 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';

export const DOODLES = {
  tiger: `<svg viewBox="0 0 120 120"><path ${S} d="M20 70C18 45 30 28 45 26L40 10 58 24C64 23 70 23 76 25L92 10 90 30C102 40 104 60 98 75 90 98 32 100 20 70Z"/><ellipse cx="47" cy="59" rx="7" ry="4.5" fill="currentColor"/><ellipse cx="76" cy="59" rx="7" ry="4.5" fill="currentColor"/><path d="M57 70l5 5 5-5z" fill="${ACC}"/><path ${S} d="M62 75c-2 6-8 6-10 3M62 75c2 6 8 6 10 3M55 33l7 10 7-10M47 40l-6 6M77 40l6 6M30 72l-14-2M30 78l-14 3M94 72l14-2M94 78l14 3"/></svg>`,
  daruma: `<svg viewBox="0 0 120 120"><path d="M60 14C88 14 104 38 104 66 104 94 86 108 60 108 34 108 16 94 16 66 16 38 32 14 60 14Z" fill="${ACC}"/><path d="M36 54C36 38 84 38 84 54 86 78 34 78 36 54Z" fill="${BG}"/><path ${S} d="M60 14C88 14 104 38 104 66 104 94 86 108 60 108 34 108 16 94 16 66 16 38 32 14 60 14ZM42 47c5-6 12-6 16-2M62 45c4-4 11-4 16 2M48 67c4 4 9 4 12 0 3 4 8 4 12 0"/><circle cx="49" cy="55" r="4" fill="currentColor"/><circle cx="71" cy="55" r="4" fill="currentColor"/><path ${S} d="M44 90c10 6 22 6 32 0"/></svg>`,
  eye: `<svg viewBox="0 0 120 120"><path d="M60 6 70 40 104 22 84 52 116 62 82 70 102 102 68 84 60 116 52 84 18 102 38 70 4 62 36 52 16 22 50 40Z" fill="${ACC}"/><path d="M28 61C44 44 76 44 92 61 76 78 44 78 28 61Z" fill="${BG}"/><path ${S} d="M28 61C44 44 76 44 92 61 76 78 44 78 28 61Z"/><circle cx="60" cy="61" r="9" fill="currentColor"/></svg>`,
  lion: `<svg viewBox="0 0 120 120"><path d="M20 62C20 32 40 20 60 20 80 20 100 32 100 62 100 92 80 106 60 106 40 106 20 92 20 62Z" fill="${ACC}"/><path d="M60 8 52 22H68Z" fill="${ACC}"/><path ${S} d="M36 52c0-11 18-11 18 0 0 7-9 7-9 0M66 52c0-11 18-11 18 0 0 7-9 7-9 0M50 70c3-5 17-5 20 0M30 84C44 98 76 98 90 84 76 90 44 90 30 84ZM26 40c-8-4-12-12-8-18M94 40c8-4 12-12 8-18"/></svg>`,
  seal: `<svg viewBox="0 0 120 120"><rect x="18" y="18" width="84" height="84" rx="8" fill="${ACC}" transform="rotate(-5 60 60)"/><path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" d="M38 40h44M60 40v40M42 58h36M40 80h40M46 64l-6 10M74 64l6 10" transform="rotate(-5 60 60)"/></svg>`,
  cloud: `<svg viewBox="0 0 120 120"><path ${S} d="M22 74c-10 0-12-16 0-18-2-14 16-20 24-10 4-14 26-14 30 0 10-8 26 0 22 12 12 2 12 18 0 18H22ZM40 74c0-8 12-8 12 0M62 60c0-10 16-10 16 0 0 6-8 6-8 0"/></svg>`,
};

const LAYOUT = [
  ['tiger', 16, 26, -6], ['eye', 76, 20, 8], ['daruma', 26, 72, 4],
  ['lion', 80, 68, -8], ['seal', 54, 84, 10], ['cloud', 10, 50, 0],
];

export function initDoodles(container, { onPoke }) {
  const items = LAYOUT.map(([name, x, y, rot], i) => {
    const el = document.createElement('button');
    el.className = 'doodle';
    el.setAttribute('aria-label', `${name} doodle`);
    el.innerHTML = DOODLES[name];
    el.style.left = x + '%';
    el.style.top = y + '%';
    container.appendChild(el);
    const it = { el, x: 0, y: 0, vx: 0, vy: 0, rot, r: rot, s: 1, vs: 0, i };
    el.addEventListener('click', (e) => {
      it.vs += 0.12; it.r += (Math.random() - 0.5) * 50;
      onPoke && onPoke(e.clientX, e.clientY);
    });
    return it;
  });
  let px = -9999, py = -9999, t = 0, boilT = 0, seed = 1;
  const turb = document.querySelector('#boil feTurbulence');
  window.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });

  return {
    update(dt, active) {
      if (!active) return;
      t += dt;
      // line boil: re-seed the wobble filter a few times a second, like hand-drawn animation
      boilT += dt;
      if (turb && boilT > 0.14) { boilT = 0; seed = (seed % 6) + 1; turb.setAttribute('seed', seed); }
      for (const it of items) {
        const r = it.el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - it.x, cy = r.top + r.height / 2 - it.y;
        let fx = -it.x * 9, fy = -it.y * 9;
        const dx = cx + it.x - px, dy = cy + it.y - py, d = Math.hypot(dx, dy);
        if (d < 200 && d > 0.1) { const push = (1 - d / 200) * 2600; fx += (dx / d) * push; fy += (dy / d) * push; }
        it.vx = (it.vx + fx * dt) * 0.9; it.vy = (it.vy + fy * dt) * 0.9;
        it.x += it.vx * dt; it.y += it.vy * dt;
        it.vs = (it.vs + (1 - it.s) * 60 * dt) * 0.86; it.s += it.vs;
        it.r += (it.rot + Math.sin(t * 1.3 + it.i) * 4 + it.vx * 0.02 - it.r) * Math.min(1, dt * 4);
        const bob = Math.sin(t * 1.1 + it.i * 1.7) * 6;
        it.el.style.transform = `translate(-50%,-50%) translate(${it.x.toFixed(1)}px,${(it.y + bob).toFixed(1)}px) rotate(${it.r.toFixed(1)}deg) scale(${it.s.toFixed(3)})`;
      }
    },
  };
}
