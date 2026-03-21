import { useRef, useCallback } from 'react';

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

export default function ColorWheel({ onPick, size = 190 }) {
  const ref = useRef(null);
  const dragging = useRef(false);

  const draw = useCallback((canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sz = canvas.width;
    const cx = sz / 2, cy = sz / 2, r = sz / 2 - 4;

    for (let a = 0; a < 360; a++) {
      const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
      g.addColorStop(0, `hsla(${a},100%,50%,0)`);
      g.addColorStop(1, `hsl(${a},100%,50%)`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, (a - 1) * Math.PI / 180, (a + 1) * Math.PI / 180);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // White centre gradient
    const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45);
    wg.addColorStop(0, 'rgba(255,255,255,1)');
    wg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = wg; ctx.fill();

    // Dark edge vignette
    const dg = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    dg.addColorStop(0, 'rgba(0,0,0,0)');
    dg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = dg; ctx.fill();
  }, []);

  const pick = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
    const px = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
    onPick(rgbToHex([px[0], px[1], px[2]]));
  };

  return (
    <canvas
      ref={el => { ref.current = el; draw(el); }}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        cursor: 'crosshair',
        border: '3px solid rgba(180,170,230,0.35)',
        boxShadow: '0 0 36px rgba(180,160,230,0.3), 0 0 60px rgba(180,160,230,0.1)',
        touchAction: 'none',
        flexShrink: 0,
      }}
      onMouseDown={e => { dragging.current = true; pick(e, ref.current); }}
      onMouseMove={e => { if (dragging.current) pick(e, ref.current); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    />
  );
}
