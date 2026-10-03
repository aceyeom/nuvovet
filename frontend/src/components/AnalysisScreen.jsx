import React, { useState, useEffect, useRef } from 'react';
import { MolecularBackground } from './MolecularBackground';
import { ProductLockup } from './NuvovetLogo';
import { useI18n } from '../i18n';

// ──────────────────────────────────────────────────────────────────
// Scan in progress — a typographic readout shown between "Run DUR
// check" and the report. Six engine steps as a ruled list, each with a
// status word (queued / running / done), a hairline progress rule and a
// chart that draws itself underneath. ~2.9 s end to end.
// ──────────────────────────────────────────────────────────────────

const fmt = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

export function AnalysisScreen({ onComplete, drugCount, species }) {
  const { t, lang } = useI18n();
  const A = t.analysis;
  const mono = lang === 'ko' ? '' : 'font-mono'; // Geist Mono has no Hangul
  const [completed, setCompleted] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const STEPS = [
    { id: 'resolve', label: A.step1, detail: A.step1Sub, duration: 350 },
    { id: 'korean_db', label: A.step2, detail: A.step2Sub, duration: 450 },
    { id: 'cyp', label: A.step3, detail: A.step3Sub, duration: 400 },
    { id: 'ddi', label: A.step4, detail: A.step4Sub, duration: 500 },
    { id: 'species', label: A.step5, detail: A.step5Sub, duration: 350 },
    { id: 'literature', label: A.step6, detail: A.step6Sub, duration: 400 },
  ];
  // Total: ~2.45 s of steps + 200 ms lead-in + 250 ms hand-off ≈ 2.9 s

  useEffect(() => {
    let timer;
    const durations = STEPS.map((s) => s.duration);
    const runStep = (index) => {
      if (index >= durations.length) {
        timer = setTimeout(() => onCompleteRef.current(), 250);
        return;
      }
      setActiveStep(index);
      timer = setTimeout(() => {
        setCompleted(index + 1);
        runStep(index + 1);
      }, durations[index]);
    };
    timer = setTimeout(() => runStep(0), 200);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const n = drugCount || 0;
  const pairs = (n * (n - 1)) / 2;
  const speciesLabel = species === 'cat' ? t.species.catShort : t.species.dogShort;
  const subtitle = fmt(A.subtitle, {
    species: speciesLabel,
    drugs: fmt(n === 1 ? A.drugs1 : A.drugsN, { n }),
    pairs: fmt(pairs === 0 ? A.pairs0 : pairs === 1 ? A.pairs1 : A.pairsN, { n: pairs }),
  });
  const pct = Math.round((completed / STEPS.length) * 100);
  const current = STEPS[Math.min(Math.max(activeStep, 0), STEPS.length - 1)];

  return (
    <div className="relative flex min-h-[calc(100dvh-56px)] flex-1 flex-col items-center justify-center overflow-hidden bg-white px-4 pb-[max(22vh,170px)] pt-10 sm:px-6">
      {/* Chart paper completing itself along the bottom edge */}
      <div className="absolute inset-x-0 bottom-0 h-[20vh] min-h-[140px]">
        <MolecularBackground />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white to-transparent" />
      </div>

      <section className="relative w-full max-w-[560px]" aria-labelledby="scan-title">
        <div className="flex items-baseline justify-between gap-4">
          <p className="kicker text-[11px] text-dur-700">{A.kicker}</p>
          <p className="font-mono text-[11px] font-medium text-ink-400 tnum" aria-hidden="true">{String(pct).padStart(3, ' ')}%</p>
        </div>
        <h2 id="scan-title" className="mt-3 text-balance text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink-900 sm:text-[30px]">
          {A.analyzingPrescription}
        </h2>
        <p className="mt-1.5 text-[14px] text-ink-500">{subtitle}</p>

        {/* Screen-reader progress */}
        <p className="sr-only" role="status" aria-live="polite">
          {activeStep >= 0 && completed < STEPS.length ? `${fmt(A.stepOf, { i: activeStep + 1, n: STEPS.length })} — ${current.label}` : ''}
        </p>

        <ol className="mt-8 border-t border-ink-900/80" aria-hidden="true">
          {STEPS.map((step, index) => {
            const done = index < completed;
            const running = index === activeStep && !done;
            const queued = !done && !running;
            return (
              <li key={step.id} className="relative grid grid-cols-[26px_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-ink-100 py-3">
                <span className={`font-mono text-[11px] tnum ${queued ? 'text-ink-300' : 'text-ink-400'}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className={`text-[14px] leading-snug transition-colors duration-300 ${queued ? 'text-ink-300' : running ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                    {step.label}
                  </p>
                  <p className={`mt-0.5 truncate text-[12px] transition-colors duration-300 ${mono} ${running ? 'text-ink-500' : done ? 'text-ink-400' : 'text-ink-300'}`}>
                    {step.detail}
                  </p>
                </div>
                <span
                  className={`kicker text-[10.5px] transition-colors duration-300 ${
                    done ? 'text-dur-700' : running ? 'text-ink-900' : 'text-ink-300'
                  }`}
                >
                  {done ? A.statusDone : running ? A.statusRunning : A.statusQueued}
                </span>
                {running && (
                  <span className="absolute inset-x-0 -bottom-px h-px overflow-hidden">
                    <span className="absolute inset-y-0 left-0 w-1/3 animate-load-sweep bg-dur-500" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Overall progress */}
        <div className="mt-6 h-[2px] w-full bg-ink-100" aria-hidden="true">
          <div className="h-full bg-ink-900 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div className={`mt-2 flex items-baseline justify-between text-[11.5px] text-ink-400 tnum ${mono}`} aria-hidden="true">
          <span>{fmt(A.stepOf, { i: Math.min(completed + (completed < STEPS.length ? 1 : 0), STEPS.length), n: STEPS.length })}</span>
          <ProductLockup product="dur" size="xs" />
        </div>
      </section>
    </div>
  );
}
