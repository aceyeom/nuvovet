import React from 'react';

// ──────────────────────────────────────────────────────────────────
// Analytical backdrop for the scan screen — chart paper with three
// plasma-concentration curves that are revealed once, left to right,
// while the DUR scan runs. No looping motion and no markers: the chart
// simply completes. With prefers-reduced-motion the global rule in
// index.css collapses the animation, so the finished chart shows
// immediately.
//
// The SVG stretches to its positioned parent (preserveAspectRatio
// "none") with non-scaling hairline strokes; callers decide where it
// sits (the scan screen anchors it to the bottom of the viewport).
// ──────────────────────────────────────────────────────────────────

const GRID_Y = [18, 34, 50, 66];
const TICKS_X = [20, 50, 80, 110, 140, 170];

// One-compartment oral profiles (rise → peak → elimination), hand-tuned
// so the three peaks stagger across the frame.
const CURVES = [
  { d: 'M 0,82 C 26,82 42,24 62,24 C 86,24 128,66 200,77', stroke: '#0B1220', opacity: 0.18 },
  { d: 'M 0,82 C 38,82 58,40 82,40 C 108,40 146,69 200,75', stroke: '#0B1220', opacity: 0.1 },
  { d: 'M 0,82 C 52,82 76,30 104,30 C 130,30 164,58 200,66', stroke: '#12A39C', opacity: 0.55 },
];

export function MolecularBackground({ className = '', duration = 2.6 }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 select-none overflow-hidden ${className}`}>
      <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>{`
            @keyframes nvChartReveal { from { transform: scaleX(0); } to { transform: scaleX(1); } }
            @keyframes nvChartFade { from { opacity: 0; } to { opacity: 1; } }
            .nv-chart-reveal { transform-box: fill-box; transform-origin: 0 50%; transform: scaleX(0);
              animation: nvChartReveal ${duration}s cubic-bezier(0.45, 0, 0.25, 1) 0.2s forwards; }
          `}</style>
          <linearGradient id="nvChartEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.1" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.9" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="nvChartMask" maskContentUnits="userSpaceOnUse">
            <rect x="0" y="0" width="200" height="100" fill="url(#nvChartEdge)" />
          </mask>
          <clipPath id="nvChartClip">
            <rect className="nv-chart-reveal" x="0" y="0" width="200" height="100" />
          </clipPath>
        </defs>

        <g mask="url(#nvChartMask)" style={{ animation: 'nvChartFade 500ms ease-out both' }}>
          {/* Chart paper */}
          {GRID_Y.map((y) => (
            <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#0B1220" strokeOpacity="0.06" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" y1="82" x2="200" y2="82" stroke="#0B1220" strokeOpacity="0.16" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {TICKS_X.map((x) => (
            <line key={x} x1={x} y1="82" x2={x} y2="86" stroke="#0B1220" strokeOpacity="0.18" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Plasma-concentration curves, revealed left → right */}
          <g clipPath="url(#nvChartClip)">
            {CURVES.map((c) => (
              <path
                key={c.d}
                d={c.d}
                fill="none"
                stroke={c.stroke}
                strokeOpacity={c.opacity}
                strokeWidth="1.25"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
