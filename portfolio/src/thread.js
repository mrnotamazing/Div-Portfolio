// The thread of fate: in the contact section a single cord of crystal light runs from the element to the visitor's cursor.
export function createThread(canvas) {
  const ctx = canvas.getContext('2d');
  const N = 36;
  const nodes = Array.from({ length: N }, () => ({ x: 0, y: 0, px: 0, py: 0 }));
  let dpr = 1, inited = false, colors = ['#6b8dff', '#57d6cf', '#aee68f'];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  resize();

  return {
    resize,
    setColors(c) { if (c.every(Boolean)) colors = c; },
    update(dt, active, anchor, target) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (active < 0.01) { inited = false; return; }
      if (!inited) {
        nodes.forEach((n, i) => { const t = i / (N - 1); n.x = n.px = anchor.x + (target.x - anchor.x) * t; n.y = n.py = anchor.y + (target.y - anchor.y) * t; });
        inited = true;
      }
      // verlet rope
      for (let i = 1; i < N; i++) {
        const n = nodes[i], vx = (n.x - n.px) * 0.95, vy = (n.y - n.py) * 0.95;
        n.px = n.x; n.py = n.y; n.x += vx; n.y += vy + 0.35;
      }
      nodes[0].x = anchor.x; nodes[0].y = anchor.y;
      const end = nodes[N - 1];
      end.x += (target.x - end.x) * 0.35; end.y += (target.y - end.y) * 0.35;
      const seg = Math.max(6, (Math.hypot(target.x - anchor.x, target.y - anchor.y) / (N - 1)) * 1.12);
      for (let k = 0; k < 14; k++) {
        for (let i = 0; i < N - 1; i++) {
          const a = nodes[i], b = nodes[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, diff = (d - seg) / d;
          const wa = i === 0 ? 0 : 0.5, wb = i + 1 === N - 1 ? 0.15 : 0.5;
          a.x += dx * diff * wa; a.y += dy * diff * wa;
          b.x -= dx * diff * wb; b.y -= dy * diff * wb;
        }
        nodes[0].x = anchor.x; nodes[0].y = anchor.y;
      }
      // draw
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.globalAlpha = active;
      const g = ctx.createLinearGradient(nodes[0].x, nodes[0].y, end.x, end.y);
      g.addColorStop(0, colors[0]); g.addColorStop(0.5, colors[1]); g.addColorStop(1, colors[2]);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      for (let i = 1; i < N - 1; i++) {
        const mx = (nodes[i].x + nodes[i + 1].x) / 2, my = (nodes[i].y + nodes[i + 1].y) / 2;
        ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = colors[2];
      ctx.beginPath(); ctx.arc(end.x, end.y, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  };
}
