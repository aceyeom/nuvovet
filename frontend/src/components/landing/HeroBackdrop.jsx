import React, { useEffect, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────
// Hero backdrop — the sci-fi stage the product sits on.
//
//   aurora mesh      four light sources drifting on separate clocks
//   particle field   canvas: drifting motes + horizontal data streaks
//   HUD rings        concentric dashed rings turning at different speeds
//   floor            perspective grid rolling toward the viewer
//   scanlines        CRT texture, a slow refresh band, grain, vignette
//
// Purely decorative (aria-hidden). Everything stops while off-screen,
// and reduced-motion users get a single still frame.
// ──────────────────────────────────────────────────────────────────

const PALETTE = [
  [110, 234, 223], // teal
  [79, 209, 197],
  [190, 255, 250], // ice
  [159, 136, 255], // violet
];

function ParticleField({ active, reduced }) {
  const canvasRef = useRef(null);
  const state = useRef({ parts: [], streaks: [], w: 0, h: 0, raf: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const S = state.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const seed = () => {
      const area = S.w * S.h;
      const n = Math.max(36, Math.min(140, Math.round(area / 15000)));
      S.parts = Array.from({ length: n }, () => ({
        x: Math.random() * S.w,
        y: Math.random() * S.h,
        vy: -(0.05 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.06,
        r: 0.5 + Math.random() * 1.4,
        a: 0.18 + Math.random() * 0.6,
        tw: Math.random() * Math.PI * 2,
        c: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      }));
      S.streaks = Array.from({ length: Math.max(3, Math.round(S.w / 260)) }, () => newStreak(true));
    };
    const newStreak = (anywhere = false) => ({
      x: anywhere ? Math.random() * S.w : -200,
      y: S.h * (0.08 + Math.random() * 0.84),
      len: 60 + Math.random() * 170,
      v: 1.2 + Math.random() * 2.6,
      a: 0.25 + Math.random() * 0.45,
      c: PALETTE[Math.floor(Math.random() * 2)],
    });

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      S.w = Math.max(1, rect.width);
      S.h = Math.max(1, rect.height);
      canvas.width = Math.round(S.w * dpr);
      canvas.height = Math.round(S.h * dpr);
      canvas.style.width = `${S.w}px`;
      canvas.style.height = `${S.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw(0, true);
    };

    const draw = (t, still = false) => {
      ctx.clearRect(0, 0, S.w, S.h);
      for (const p of S.parts) {
        if (!still) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -4) { p.y = S.h + 4; p.x = Math.random() * S.w; }
          if (p.x < -4) p.x = S.w + 4;
          if (p.x > S.w + 4) p.x = -4;
        }
        const tw = 0.55 + 0.45 * Math.sin(t / 900 + p.tw);
        ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${(p.a * tw).toFixed(3)})`;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
      for (let i = 0; i < S.streaks.length; i += 1) {
        const s = S.streaks[i];
        if (!still) s.x += s.v;
        if (s.x - s.len > S.w) S.streaks[i] = newStreak();
        const g = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
        g.addColorStop(0, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},0)`);
        g.addColorStop(1, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${s.a})`);
        ctx.fillStyle = g;
        ctx.fillRect(s.x - s.len, s.y, s.len, 1);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const loop = (t) => {
      draw(t);
      S.raf = requestAnimationFrame(loop);
    };
    if (active && !reduced) S.raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(S.raf);
    };
  }, [active, reduced]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

function Rings() {
  const ticks = Array.from({ length: 144 }, (_, i) => i);
  return (
    <svg viewBox="-600 -600 1200 1200" className="h-full w-full" fill="none">
      <defs>
        <radialGradient id="ring-fade" cx="0" cy="0" r="600" gradientUnits="userSpaceOnUse">
          <stop offset="0.3" stopColor="#6EEADF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6EEADF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g stroke="url(#ring-fade)">
        <circle r="250" strokeWidth="1" strokeDasharray="2 10" className="spin-cw" style={{ '--spin': '90s' }} />
        <circle r="318" strokeWidth="1" opacity="0.6" />
        <circle r="318" strokeWidth="3" strokeDasharray="60 340 12 90" className="spin-ccw" style={{ '--spin': '60s' }} />
        <g className="spin-cw" style={{ '--spin': '160s' }}>
          {ticks.map((i) => {
            const a = (i / ticks.length) * Math.PI * 2;
            const r1 = 392;
            const r2 = i % 12 === 0 ? 410 : 400;
            return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} strokeWidth="1" />;
          })}
        </g>
        <circle r="470" strokeWidth="1" strokeDasharray="1 6" opacity="0.7" />
        <circle r="540" strokeWidth="1.5" strokeDasharray="180 120 40 260" className="spin-cw" style={{ '--spin': '140s' }} />
      </g>
      <g fill="#6EEADF" fillOpacity="0.45" fontFamily="'Geist Mono Variable', monospace" fontSize="11" letterSpacing="2">
        <text x="-14" y="-420">000</text>
        <text x="418" y="4">090</text>
        <text x="-14" y="432">180</text>
        <text x="-448" y="4">270</text>
      </g>
    </svg>
  );
}

export function HeroBackdrop({ active = true, reduced = false }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* base light */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_75%_at_50%_-8%,#0F2033_0%,#07101B_46%,#03050A_100%)]" />

      {/* aurora mesh */}
      <div className="absolute inset-0" style={{ transform: 'translateY(calc(var(--hs, 0) * -60px))' }}>
        <span className="aurora-blob" style={{ left: '4%', top: '-14%', width: '46vw', height: '34vw', maxWidth: 760, maxHeight: 560, background: 'radial-gradient(closest-side, rgba(18,163,156,0.55), transparent)', animation: 'aurora-a 24s ease-in-out infinite' }} />
        <span className="aurora-blob" style={{ right: '0%', top: '-6%', width: '40vw', height: '30vw', maxWidth: 680, maxHeight: 500, background: 'radial-gradient(closest-side, rgba(108,75,230,0.42), transparent)', animation: 'aurora-b 31s ease-in-out infinite' }} />
        <span className="aurora-blob" style={{ left: '30%', top: '18%', width: '38vw', height: '22vw', maxWidth: 640, maxHeight: 380, background: 'radial-gradient(closest-side, rgba(79,209,197,0.30), transparent)', animation: 'aurora-c 17s ease-in-out infinite' }} />
        <span className="aurora-blob" style={{ left: '-10%', top: '40%', width: '36vw', height: '30vw', maxWidth: 600, maxHeight: 500, background: 'radial-gradient(closest-side, rgba(29,78,216,0.30), transparent)', animation: 'aurora-b 27s ease-in-out infinite reverse' }} />
      </div>

      {/* particles + data streaks */}
      <ParticleField active={active} reduced={reduced} />

      {/* HUD rings, framing the stage */}
      <div
        className="absolute left-1/2 top-[64%] aspect-square w-[min(1500px,170vw)] -translate-x-1/2 -translate-y-1/2 opacity-[0.22]"
        style={{ transform: 'translate(-50%, calc(-50% + var(--hs, 0) * 90px))' }}
      >
        <Rings />
      </div>

      {/* perspective floor + horizon */}
      <div className="absolute inset-x-0 bottom-0 h-[46%] overflow-hidden">
        <div className="hero-floor"><div className="hero-floor-grid" /></div>
      </div>
      <div className="absolute inset-x-[8%] bottom-[46%] h-px bg-gradient-to-r from-transparent via-dur-300/40 to-transparent shadow-[0_0_24px_4px_rgba(79,209,197,0.25)]" />

      {/* CRT texture */}
      <div className="hero-scanlines absolute inset-0" />
      <div className="hero-refresh" />
      <div className="grain absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
}
