import React, { useMemo } from 'react';
import { useI18n } from '../i18n';

// ── Comprehensive PK parameters aligned with drugDatabase.js ─────
// Values sourced from drug.pk fields: halfLife, timeToPeak, bioavailability
// Therapeutic index approximations for visualization
const PK_PARAMS = {
  meloxicam:      { tmax: 7.5, halfLife: 24,  interval: 24, bioavail: 0.89, therapMin: 0.25, therapMax: 0.85, unit: 'mg/kg' },
  prednisolone:   { tmax: 1.5, halfLife: 3,   interval: 24, bioavail: 0.76, therapMin: 0.15, therapMax: 0.90, unit: 'mg/kg' },
  carprofen:      { tmax: 3,   halfLife: 8,   interval: 12, bioavail: 0.90, therapMin: 0.20, therapMax: 0.85, unit: 'mg/kg' },
  phenobarbital:  { tmax: 4,   halfLife: 52,  interval: 12, bioavail: 0.86, therapMin: 0.40, therapMax: 0.80, unit: 'µg/mL' },
  furosemide:     { tmax: 1,   halfLife: 1.5, interval: 12, bioavail: 0.77, therapMin: 0.15, therapMax: 0.90, unit: 'mg/L' },
  gabapentin:     { tmax: 2,   halfLife: 3.5, interval: 8,  bioavail: 0.80, therapMin: 0.20, therapMax: 0.85, unit: 'µg/mL' },
  ketoconazole:   { tmax: 2,   halfLife: 6,   interval: 12, bioavail: 0.75, therapMin: 0.20, therapMax: 0.80, unit: 'µg/mL' },
  metronidazole:  { tmax: 1,   halfLife: 4.5, interval: 12, bioavail: 0.80, therapMin: 0.25, therapMax: 0.85, unit: 'µg/mL' },
  cyclosporine:   { tmax: 2,   halfLife: 18,  interval: 12, bioavail: 0.29, therapMin: 0.35, therapMax: 0.75, unit: 'ng/mL' },
  tramadol:       { tmax: 1.5, halfLife: 1.8, interval: 8,  bioavail: 0.65, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  amoxicillin:    { tmax: 1,   halfLife: 1.2, interval: 8,  bioavail: 0.80, therapMin: 0.25, therapMax: 0.90, unit: 'µg/mL' },
  enrofloxacin:   { tmax: 2,   halfLife: 4,   interval: 24, bioavail: 0.80, therapMin: 0.20, therapMax: 0.85, unit: 'µg/mL' },
  ivermectin:     { tmax: 4,   halfLife: 25,  interval: 24, bioavail: 0.95, therapMin: 0.30, therapMax: 0.70, unit: 'ng/mL' },
  digoxin:        { tmax: 2,   halfLife: 27,  interval: 12, bioavail: 0.60, therapMin: 0.45, therapMax: 0.70, unit: 'ng/mL' },
  enalapril:      { tmax: 4,   halfLife: 11,  interval: 12, bioavail: 0.60, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  maropitant:     { tmax: 2,   halfLife: 7.5, interval: 24, bioavail: 0.91, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  omeprazole:     { tmax: 0.5, halfLife: 1,   interval: 12, bioavail: 0.50, therapMin: 0.20, therapMax: 0.90, unit: 'µg/mL' },
  trazodone:      { tmax: 1.5, halfLife: 7,   interval: 12, bioavail: 0.85, therapMin: 0.20, therapMax: 0.80, unit: 'ng/mL' },
  amlodipine:     { tmax: 6,   halfLife: 30,  interval: 24, bioavail: 0.88, therapMin: 0.30, therapMax: 0.80, unit: 'ng/mL' },
  fluoxetine:     { tmax: 6,   halfLife: 48,  interval: 24, bioavail: 0.72, therapMin: 0.30, therapMax: 0.75, unit: 'ng/mL' },
  methimazole:    { tmax: 1,   halfLife: 5,   interval: 12, bioavail: 0.80, therapMin: 0.25, therapMax: 0.80, unit: 'µg/mL' },
  dexamethasone:  { tmax: 1,   halfLife: 2,   interval: 24, bioavail: 0.80, therapMin: 0.15, therapMax: 0.90, unit: 'ng/mL' },
  selamectin:     { tmax: 72,  halfLife: 264, interval: 720, bioavail: 0.50, therapMin: 0.20, therapMax: 0.80, unit: 'ng/mL' },
  pimobendan:     { tmax: 3,   halfLife: 0.5, interval: 12, bioavail: 0.60, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  oclacitinib:    { tmax: 1,   halfLife: 4,   interval: 12, bioavail: 0.89, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  firocoxib:      { tmax: 1.5, halfLife: 7.8, interval: 24, bioavail: 0.94, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
};

// ── Resolve PK params from drug object ───────────────────────────
function getPkParams(drug) {
  if (!drug) return null;
  const id = drug.id || drug.name?.toLowerCase();
  if (PK_PARAMS[id]) return { ...PK_PARAMS[id], name: drug.name, nameKr: drug.nameKr };

  // Fallback to drug.pk field from drugDatabase
  const pk = drug.pk;
  if (pk?.timeToPeak && pk?.halfLife) {
    return {
      tmax: pk.timeToPeak,
      halfLife: pk.halfLife,
      interval: drug.freq === 'TID' ? 8 : drug.freq === 'BID' ? 12 : drug.freq === 'Monthly' ? 720 : 24,
      bioavail: pk.bioavailability || 0.8,
      therapMin: 0.20,
      therapMax: 0.85,
      unit: 'relative',
      name: drug.name,
      nameKr: drug.nameKr,
    };
  }
  return null;
}

// ── One-compartment PK model: absorption + elimination ───────────
// First-order absorption, Bateman equation, normalised to the
// single-dose Cmax.
function generateConcentrationCurve(pk, startHour, maxHour = 24) {
  const { tmax, halfLife, bioavail } = pk;
  const ke = Math.LN2 / halfLife;                    // elimination rate constant
  const ka = (tmax > 0) ? (2.5 / tmax) : 5;         // absorption rate constant (approximation)
  const points = [];
  const resolution = 200;

  const tMaxTheory = Math.log(ka / ke) / (ka - ke);
  const cmax = Math.abs(ka - ke) < 0.001
    ? bioavail * ka * tMaxTheory * Math.exp(-ke * tMaxTheory)
    : bioavail * (ka / (ka - ke)) * (Math.exp(-ke * tMaxTheory) - Math.exp(-ka * tMaxTheory));

  for (let i = 0; i <= resolution; i++) {
    const t = (i / resolution) * (maxHour - startHour);
    const absT = startHour + t;
    if (absT > maxHour) break;
    const conc = Math.abs(ka - ke) < 0.001
      ? bioavail * ka * t * Math.exp(-ke * t)
      : bioavail * (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
    const normalized = cmax > 0 ? conc / cmax : 0;
    points.push({ x: absT, y: Math.max(0, Math.min(1, normalized)) });
  }
  return points;
}

// ── Multi-dose superposition over 24h ────────────────────────────
function buildMultiDoseCurve(pk) {
  const { interval } = pk;
  const maxHour = 24;

  const doseCurves = [];
  for (let start = 0; start < maxHour; start += Math.min(interval, maxHour)) {
    doseCurves.push(generateConcentrationCurve(pk, start, maxHour));
  }

  const resolution = 200;
  const merged = [];
  for (let i = 0; i <= resolution; i++) {
    const hour = (i / resolution) * maxHour;
    let totalConc = 0;
    for (const curve of doseCurves) {
      let best = 0;
      let bestDist = Infinity;
      for (let j = 0; j < curve.length; j++) {
        const dist = Math.abs(curve[j].x - hour);
        if (dist < bestDist) { bestDist = dist; best = j; }
      }
      if (bestDist < 0.2) totalConc += curve[best].y;
    }
    merged.push({ x: hour, y: Math.min(1.3, totalConc) }); // allow slight overshoot for accumulation
  }
  return merged;
}

const findPeak = (points) => points.reduce((max, p) => (p.y > max.y ? p : max), points[0]);

function findTrough(points, interval) {
  if (interval >= 24) return null;
  const candidates = points.filter((p) => Math.abs(p.x - interval) < 1.5);
  if (candidates.length === 0) return null;
  return candidates.reduce((min, p) => (p.y < min.y ? p : min), candidates[0]);
}

// ── Plot geometry ────────────────────────────────────────────────
// The SVG stretches to the plot box (preserveAspectRatio="none") and all
// strokes are non-scaling, so lines stay hairline at any width. Every
// label is HTML positioned in %, so text stays legible on phones.
const VB_W = 240;
const VB_H = 100;

const SERIES = {
  A: { stroke: '#0B1220', dash: undefined, swatch: 'bg-ink-900' },
  B: { stroke: '#0B847F', dash: '5 3', swatch: 'bg-dur-600' },
};

function toPath(points, maxY) {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((p.x / 24) * VB_W).toFixed(2)},${(VB_H - (p.y / maxY) * VB_H).toFixed(2)}`)
    .join(' ');
}

function Swatch({ series }) {
  const s = SERIES[series];
  return (
    <svg aria-hidden="true" width="18" height="6" className="shrink-0">
      <line x1="0" y1="3" x2="18" y2="3" stroke={s.stroke} strokeWidth="1.75" strokeDasharray={s.dash ? '4 2' : undefined} />
    </svg>
  );
}

export function DrugTimeline({ drugA, drugB }) {
  const { t, lang } = useI18n();

  const pkA = useMemo(() => getPkParams(drugA), [drugA]);
  const pkB = useMemo(() => getPkParams(drugB), [drugB]);
  const curveA = useMemo(() => (pkA ? buildMultiDoseCurve(pkA) : []), [pkA]);
  const curveB = useMemo(() => (pkB ? buildMultiDoseCurve(pkB) : []), [pkB]);

  const hasA = !!pkA;
  const hasB = !!pkB;
  if (!hasA && !hasB) return null;

  const maxY = Math.max(...curveA.map((p) => p.y), ...curveB.map((p) => p.y), 1);
  const yPct = (y) => 100 - (y / maxY) * 100; // % from top
  const xPct = (h) => (h / 24) * 100;

  const peakA = hasA ? findPeak(curveA) : null;
  const peakB = hasB ? findPeak(curveB) : null;
  const troughA = hasA ? findTrough(curveA, pkA.interval) : null;

  const therapMinA = hasA ? pkA.therapMin : 0.2;
  const therapMaxA = hasA ? pkA.therapMax : 0.85;

  const xTicks = [0, 4, 8, 12, 16, 20, 24];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  const doseTimes = (pk) => (pk ? Array.from({ length: Math.ceil(24 / pk.interval) }, (_, i) => i * pk.interval).filter((h) => h < 24) : []);

  const freqLabel = (interval) => {
    if (interval <= 8) return t.pk.freqTID;
    if (interval <= 12) return t.pk.freqBID;
    return t.pk.freqSID;
  };
  const nameOf = (drug) => drug?.name;
  const mono = lang === 'ko' ? '' : 'font-mono'; // Geist Mono has no Hangul

  const rows = [hasA && { key: 'A', pk: pkA, drug: drugA }, hasB && { key: 'B', pk: pkB, drug: drugB }].filter(Boolean);

  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="kicker text-[11px] text-ink-500">{t.pk.title}</span>
        <span className={`text-[10.5px] text-ink-400 ${mono}`}>{t.pk.concentrationRelative}</span>
      </figcaption>

      {/* Plot */}
      <div className="relative mt-2 h-[170px] pb-6 pl-9 pr-1 pt-5 sm:h-[196px]">
        <div className="relative h-full">
          {/* y labels */}
          {yTicks.map((v) => (
            <span key={v} aria-hidden="true" className="absolute -left-9 w-7 -translate-y-1/2 text-right font-mono text-[10px] text-ink-400 tnum" style={{ top: `${yPct(v)}%` }}>
              {Math.round(v * 100)}
            </span>
          ))}
          {/* x labels */}
          {xTicks.map((h) => (
            <span key={h} aria-hidden="true" className="absolute top-full mt-1.5 -translate-x-1/2 font-mono text-[10px] text-ink-400 tnum" style={{ left: `${xPct(h)}%` }}>
              {h}h
            </span>
          ))}

          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={`${t.pk.title}: ${rows.map((r) => `${nameOf(r.drug)} — t½ ${r.pk.halfLife}h, Tmax ${r.pk.tmax}h`).join('; ')}`}
          >
            {/* Therapeutic window */}
            {hasA && (
              <g>
                <rect x="0" y={(yPct(therapMaxA) / 100) * VB_H} width={VB_W} height={((yPct(therapMinA) - yPct(therapMaxA)) / 100) * VB_H} fill="#10b981" fillOpacity="0.07" />
                {[therapMaxA, therapMinA].map((v) => (
                  <line key={v} x1="0" x2={VB_W} y1={(yPct(v) / 100) * VB_H} y2={(yPct(v) / 100) * VB_H} stroke="#10b981" strokeOpacity="0.45" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                ))}
              </g>
            )}

            {/* Grid */}
            {yTicks.map((v) => (
              <line key={`y${v}`} x1="0" x2={VB_W} y1={(yPct(v) / 100) * VB_H} y2={(yPct(v) / 100) * VB_H} stroke="#0B1220" strokeOpacity={v === 0 ? 0.35 : 0.07} vectorEffect="non-scaling-stroke" />
            ))}
            {xTicks.map((h) => (
              <line key={`x${h}`} x1={(h / 24) * VB_W} x2={(h / 24) * VB_W} y1="0" y2={VB_H} stroke="#0B1220" strokeOpacity={h === 0 ? 0.35 : 0.06} strokeDasharray={h % 12 === 0 ? undefined : '2 3'} vectorEffect="non-scaling-stroke" />
            ))}

            {/* Dose administrations — short ticks on the baseline */}
            {['A', 'B'].map((k) => doseTimes(k === 'A' ? pkA : pkB).map((h) => (
              <line key={`${k}${h}`} x1={(h / 24) * VB_W + (k === 'B' ? 1.6 : 0)} x2={(h / 24) * VB_W + (k === 'B' ? 1.6 : 0)} y1={VB_H - 7} y2={VB_H} stroke={SERIES[k].stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            )))}

            {/* Tmax guide for drug A */}
            {peakA && (
              <line x1={(peakA.x / 24) * VB_W} x2={(peakA.x / 24) * VB_W} y1={(yPct(peakA.y) / 100) * VB_H} y2={VB_H} stroke="#0B1220" strokeOpacity="0.3" strokeDasharray="1 2.5" vectorEffect="non-scaling-stroke" />
            )}

            {/* Curves */}
            {hasA && <path d={toPath(curveA, maxY)} fill="none" stroke={SERIES.A.stroke} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {hasB && <path d={toPath(curveB, maxY)} fill="none" stroke={SERIES.B.stroke} strokeWidth="1.75" strokeDasharray={SERIES.B.dash} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          </svg>

          {/* Annotations (HTML, so they never scale) */}
          {hasA && (
            <span aria-hidden="true" className={`absolute right-1 -translate-y-1/2 text-[10px] font-medium text-emerald-700 ${mono}`} style={{ top: `${(yPct(therapMinA) + yPct(therapMaxA)) / 2}%` }}>
              {t.pk.therapeuticBand}
            </span>
          )}
          {peakA && (
            <span aria-hidden="true" className="absolute -translate-y-full whitespace-nowrap pb-1 pl-1 font-mono text-[10px] font-semibold text-ink-900" style={{ left: `${xPct(peakA.x)}%`, top: `${yPct(peakA.y)}%` }}>
              Cmax
            </span>
          )}
          {peakB && (
            <span aria-hidden="true" className="absolute -translate-x-full -translate-y-full whitespace-nowrap pb-1 pr-1 font-mono text-[10px] font-semibold text-dur-700" style={{ left: `${xPct(peakB.x)}%`, top: `${yPct(peakB.y)}%` }}>
              Cmax
            </span>
          )}
          {troughA && (
            <span aria-hidden="true" className="absolute translate-y-1 whitespace-nowrap pl-1 font-mono text-[9.5px] text-ink-400" style={{ left: `${xPct(troughA.x)}%`, top: `${yPct(troughA.y)}%` }}>
              Cmin
            </span>
          )}
        </div>
      </div>
      <p className={`mt-1 text-center text-[10.5px] text-ink-400 ${mono}`} aria-hidden="true">{t.pk.timeAxis}</p>

      {/* PK parameters — doubles as the legend */}
      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-ink-200">
            <th scope="col" className="py-1.5 text-[11px] font-medium text-ink-500">{t.pk.drugColumn}</th>
            <th scope="col" className="py-1.5 text-right font-mono text-[11px] font-medium text-ink-500">t½</th>
            <th scope="col" className="py-1.5 text-right font-mono text-[11px] font-medium text-ink-500">Tmax</th>
            <th scope="col" className="hidden py-1.5 text-right text-[11px] font-medium text-ink-500 sm:table-cell">{t.pk.bioavailColumn}</th>
            <th scope="col" className="py-1.5 pl-3 text-right text-[11px] font-medium text-ink-500">{t.pk.dosingColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, pk, drug }) => (
            <tr key={key} className="border-b border-ink-100">
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
                  <Swatch series={key} />
                  <span className="truncate">{nameOf(drug)}</span>
                </span>
              </td>
              <td className="py-2 text-right font-mono text-[12px] text-ink-800 tnum">{pk.halfLife}h</td>
              <td className="py-2 text-right font-mono text-[12px] text-ink-800 tnum">{pk.tmax}h</td>
              <td className="hidden py-2 text-right font-mono text-[12px] text-ink-800 tnum sm:table-cell">{(pk.bioavail * 100).toFixed(0)}%</td>
              <td className="whitespace-nowrap py-2 pl-3 text-right text-[12px] text-ink-700">{freqLabel(pk.interval)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasA && (
        <p className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-500">
          <span aria-hidden="true" className="h-2 w-4 shrink-0 border-y border-dashed border-emerald-500/60 bg-emerald-500/10" />
          <span>
            {t.pk.therapeuticWindow} <span className="font-mono tnum">({(therapMinA * 100).toFixed(0)}–{(therapMaxA * 100).toFixed(0)}% Cmax)</span>
          </span>
        </p>
      )}

      {hasA !== hasB && (
        <p className="mt-2 text-[12px] text-amber-700">
          {t.pk.pkDataUnavailable.replace('{name}', !hasA ? drugA?.name : drugB?.name)}
        </p>
      )}
    </figure>
  );
}
