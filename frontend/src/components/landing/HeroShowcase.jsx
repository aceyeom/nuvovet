import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { DurIsland } from '../dur/DurIsland';
import { analyzeRegimen } from '../dur/findings';
import { describeFinding, fmt } from '../dur/describe';
import {
  EmrTitleBar, EmrToolbar, EmrStatusBar, WaitingList, PatientInfo, EmrTabs, VisitStrip, RxGrid, RxMemo, EmrButton,
} from '../emr/EmrUI';
import { getDemoPatients } from '../../data/breedProfiles';
import { makeRxLine, productLabel } from '../../data/emrCatalog';
import { getDrugById } from '../../data/drugDatabase';
import { usePrefersReducedMotion } from './motion';

// ──────────────────────────────────────────────────────────────────
// Hero showcase — a scripted "screen capture" of nuvoDUR on top of a
// clinic EMR, built from the same components as the live demo and
// driven by the real DUR engine (the alert you see is what the engine
// returns for this regimen).
//
//   boot  the EMR window powers on (CRT line → boot log → wipe) and the
//         nuvoDUR island docks onto it; HUD instruments plug in
//   01    Prescribe  — the vet types "Predn…" and adds prednisolone
//   02    Scan       — a beam sweeps the chart, every engine reports
//   03    Alert      — NSAID + corticosteroid: the island expands, the
//                      rows light up, the instruments flag GI risk
//   04    Resolve    — one tap swaps meloxicam for gabapentin; all clear
//
// Pauses off-screen and on hidden tabs; reduced-motion users get a
// static frame of chapter 3 and can step through chapters manually.
// ──────────────────────────────────────────────────────────────────

const LOOP_MS = 15000;
const CHAPTER_START = [0, 3450, 5600, 8800];
const DESIGN = { full: { w: 1120, h: 640 }, compact: { w: 440, h: 668 } };
const TOP = 30; // stage space above the window — the island straddles the window's top edge
const HUD_W = 214;
const HUD_GAP = 34;

const CAMERA = [
  'rotateX(7deg) rotateY(-5deg) scale(0.975)',
  'rotateX(4deg) rotateY(3deg) scale(0.99)',
  'rotateX(1.5deg) rotateY(0deg) scale(1.012)',
  'rotateX(0deg) rotateY(0deg) scale(1)',
];
const CAMERA_BOOT = 'rotateX(20deg) rotateY(0deg) scale(0.9) translateY(30px)';

const INITIAL = {
  lines: 'base', typed: '', focused: false, dropdown: false, cursor: 'rest', click: 0,
  island: 'clear0', hud: 'idle', scan: 0, alert: 0, wave: 0,
};

function buildScript(typedText) {
  const chars = Array.from(typedText);
  const typeStart = 1450;
  const typeStep = chars.length > 3 ? 130 : 210;
  return [
    { at: 600, patch: { cursor: 'search' } },
    { at: 1250, patch: (s) => ({ click: s.click + 1, focused: true }) },
    ...chars.map((_, i) => ({ at: typeStart + i * typeStep, patch: { typed: chars.slice(0, i + 1).join('') } })),
    { at: typeStart + chars.length * typeStep + 120, patch: { dropdown: true } },
    { at: 2650, patch: { cursor: 'result' } },
    { at: 3250, patch: (s) => ({ click: s.click + 1 }) },
    { at: 3450, patch: (s) => ({ lines: 'added', typed: '', dropdown: false, focused: false, island: 'checking', hud: 'scan', scan: s.scan + 1 }) },
    { at: 4650, patch: (s) => ({ island: 'glance', hud: 'alert', alert: s.alert + 1 }) },
    { at: 5600, patch: { island: 'expanded' } },
    { at: 7900, patch: { cursor: 'resolve' } },
    { at: 8800, patch: (s) => ({ click: s.click + 1, island: 'pressed' }) },
    { at: 9150, patch: (s) => ({ lines: 'resolved', island: 'applied', hud: 'resolved', wave: s.wave + 1 }) },
    { at: 10500, patch: (s) => ({ island: 'checking2', hud: 'scan', scan: s.scan + 1 }) },
    { at: 11300, patch: { island: 'clear1', hud: 'clear' } },
    { at: 11700, patch: { cursor: 'rest' } },
  ].sort((a, b) => a.at - b.at);
}

function reduceTo(script, pos) {
  let s = { ...INITIAL };
  for (const step of script) {
    if (step.at > pos) break;
    s = { ...s, ...(typeof step.patch === 'function' ? step.patch(s) : step.patch) };
  }
  return s;
}

function chapterAt(pos) {
  let c = 0;
  CHAPTER_START.forEach((start, i) => { if (pos >= start) c = i; });
  return c;
}

function chapterBounds(i) {
  return [CHAPTER_START[i], CHAPTER_START[i + 1] ?? LOOP_MS];
}

/** Scripted timeline with jump / pause / resume. */
function useTimeline(script, { initialPos }) {
  const [state, setState] = useState(() => reduceTo(script, initialPos));
  const [run, setRun] = useState({ id: 0, pos: initialPos, playing: false });
  const timers = useRef([]);
  const startedAt = useRef(0);
  const scriptRef = useRef(script);
  scriptRef.current = script;

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const schedule = useCallback((pos) => {
    clear();
    startedAt.current = performance.now() - pos;
    for (const step of scriptRef.current) {
      if (step.at <= pos) continue;
      timers.current.push(setTimeout(() => {
        setState((s) => ({ ...s, ...(typeof step.patch === 'function' ? step.patch(s) : step.patch) }));
      }, step.at - pos));
    }
    timers.current.push(setTimeout(() => {
      setState(reduceTo(scriptRef.current, 0));
      setRun((r) => ({ id: r.id + 1, pos: 0, playing: true }));
    }, LOOP_MS - pos));
  }, []);

  useEffect(() => {
    if (run.playing) schedule(run.pos);
    else clear();
    return clear;
  }, [run, schedule]);

  const position = useCallback(
    () => (run.playing ? Math.min(LOOP_MS, performance.now() - startedAt.current) : run.pos),
    [run],
  );

  const jump = (pos, playing = run.playing) => {
    setState(reduceTo(scriptRef.current, pos));
    setRun((r) => ({ id: r.id + 1, pos, playing }));
  };
  const pause = () => { if (run.playing) setRun((r) => ({ id: r.id + 1, pos: position(), playing: false })); };
  const play = () => { if (!run.playing) setRun((r) => ({ id: r.id + 1, pos: r.pos >= LOOP_MS ? 0 : r.pos, playing: true })); };

  return { state, run, jump, pause, play, position };
}

// Tracks the active chapter while the timeline plays (re-renders on chapter
// boundaries only, not every frame).
function useChapter(run) {
  const [chapter, setChapter] = useState(chapterAt(run.pos));
  useEffect(() => {
    setChapter(chapterAt(run.pos));
    if (!run.playing) return undefined;
    const timers = CHAPTER_START
      .map((start, i) => ({ start, i }))
      .filter(({ start }) => start > run.pos)
      .map(({ start, i }) => setTimeout(() => setChapter(i), start - run.pos));
    return () => timers.forEach(clearTimeout);
  }, [run]);
  return chapter;
}

// Sum offsetLeft/Top up to an ancestor — layout coordinates, immune to the
// scale / camera transforms applied to the stage.
function offsetWithin(el, ancestor) {
  let x = 0;
  let y = 0;
  let node = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return node === ancestor ? { x, y } : null;
}

// ── Small parts ──────────────────────────────────────────────────

function Cursor({ pos, click }) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50 transition-transform duration-700 ease-out-expo"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      aria-hidden="true"
    >
      {click > 0 && (
        <span key={click} className="absolute left-0 top-0 h-10 w-10 animate-click-ring rounded-full border-2 border-dur-300 bg-dur-300/20" />
      )}
      <svg width="22" height="22" viewBox="0 0 24 24" className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]">
        <path d="M4.5 2.8l13.4 9.9-6 .9-3.4 5.6z" fill="#0B1220" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** The EMR's Rx search box, typed into by the script. */
function FakeSearch({ typed, focused, dropdown, lang, labels }) {
  const pred = getDrugById('prednisolone');
  const dexa = getDrugById('dexamethasone');
  const cols = 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]';
  return (
    <div className="border border-emr-line bg-white">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="shrink-0 text-[11.5px] font-semibold text-[#3B4450]">{labels.search}</span>
        <div className="relative min-w-0 flex-1">
          <div
            data-hero="search"
            className={`flex h-[24px] items-center rounded-[2px] border bg-white px-2 text-[12px] ${focused ? 'border-emr-blue shadow-[0_0_0_2px_rgba(31,111,209,0.15)]' : 'border-[#AEB6C1]'}`}
          >
            {typed ? (
              <span className="text-emr-text">
                {typed}
                <span className="ml-px inline-block h-[13px] w-px translate-y-[2px] animate-caret-blink bg-emr-text" />
              </span>
            ) : (
              <span className="truncate text-emr-faint">
                {focused && <span className="mr-px inline-block h-[13px] w-px translate-y-[2px] animate-caret-blink bg-emr-text" />}
                {labels.placeholder}
              </span>
            )}
          </div>
          {dropdown && (
            <div className="absolute left-0 right-0 top-full z-20 mt-px border border-[#8E99A8] bg-white shadow-[2px_3px_8px_rgba(0,0,0,0.18)]">
              <div className={`${cols} h-[22px] border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]`}>
                {[labels.cols.product, labels.cols.generic, labels.cols.cls].map((c) => (
                  <span key={c} className="flex items-center border-r border-emr-line px-1.5 last:border-r-0">{c}</span>
                ))}
              </div>
              <div data-hero="result" className={`${cols} h-[24px] bg-emr-select text-[12px]`}>
                <span className="truncate px-1.5 font-semibold">{productLabel(pred, lang)}</span>
                <span className="truncate px-1.5 text-emr-muted">Prednisolone</span>
                <span className="truncate px-1.5 text-emr-muted">{pred?.class}</span>
              </div>
              <div className={`${cols} h-[24px] text-[12px] text-emr-muted`}>
                <span className="truncate px-1.5 font-semibold text-emr-text">{productLabel(dexa, lang)}</span>
                <span className="truncate px-1.5">Dexamethasone</span>
                <span className="truncate px-1.5">{dexa?.class}</span>
              </div>
            </div>
          )}
        </div>
        <EmrButton tabIndex={-1}>{labels.searchBtn}</EmrButton>
      </div>
    </div>
  );
}

// ── HUD instruments ──────────────────────────────────────────────

const STATUS_TONE = {
  idle: 'text-white/35',
  scan: 'text-island-info',
  pass: 'text-island-clear',
  flag: 'text-island-critical',
};

function HudPanel({ index, title, status, statusLabel, children, side, delay, live, sweepKey }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border bg-[#070C15]/80 px-3 pb-3 pt-2.5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors duration-500 ${
        status === 'flag' ? 'border-island-critical/45' : status === 'scan' ? 'border-island-info/40' : 'border-white/[0.09]'
      } ${live ? 'hud-panel-in' : 'opacity-0'}`}
      style={{ '--d': `${delay}ms`, '--from': side === 'left' ? '-26px' : '26px' }}
    >
      {/* corner brackets */}
      <span className="pointer-events-none absolute left-1 top-1 h-2 w-2 border-l border-t border-white/30" />
      <span className="pointer-events-none absolute right-1 top-1 h-2 w-2 border-r border-t border-white/30" />
      <span className="pointer-events-none absolute bottom-1 left-1 h-2 w-2 border-b border-l border-white/30" />
      <span className="pointer-events-none absolute bottom-1 right-1 h-2 w-2 border-b border-r border-white/30" />
      {status === 'scan' && <span key={sweepKey} className="hud-sweep" style={{ '--d': `${index * 110}ms` }} />}
      <div className="relative flex items-baseline justify-between gap-2">
        <span className="kicker truncate text-[9.5px] text-white/55">
          <span className="font-mono text-white/30">{String(index + 1).padStart(2, '0')} </span>{title}
        </span>
        <span className={`kicker shrink-0 text-[9.5px] transition-colors duration-300 ${STATUS_TONE[status]} ${status === 'scan' ? 'hud-blink' : ''}`}>{statusLabel}</span>
      </div>
      <div className="relative mt-2">{children}</div>
    </div>
  );
}

function Meter({ label, value, tone = 'teal' }) {
  const bar = tone === 'red' ? 'bg-island-critical shadow-[0_0_10px_rgba(255,107,94,0.7)]' : tone === 'green' ? 'bg-island-clear' : 'bg-island-info';
  return (
    <div className="grid grid-cols-[52px_1fr_30px] items-center gap-2">
      <span className="truncate text-[10.5px] text-white/55">{label}</span>
      <span className="relative h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-700 ease-out-expo ${bar}`} style={{ width: `${value}%` }} />
      </span>
      <span className={`text-right font-mono text-[10px] tnum ${tone === 'red' ? 'text-island-critical' : 'text-white/60'}`}>{value}</span>
    </div>
  );
}

function DdiMatrix({ drugs, cellState }) {
  const n = drugs.length;
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `30px repeat(${n}, 18px)` }}>
      <span />
      {drugs.map((d) => <span key={`h-${d}`} className="text-center font-mono text-[8.5px] text-white/40">{d.slice(0, 2)}</span>)}
      {drugs.map((row, i) => (
        <React.Fragment key={`r-${row}`}>
          <span className="font-mono text-[8.5px] leading-[18px] text-white/40">{row}</span>
          {drugs.map((col, j) => {
            if (j <= i) return <span key={`${row}-${col}`} className="h-[18px] w-[18px] rounded-[3px] bg-white/[0.025]" />;
            const st = cellState(row, col);
            return (
              <span
                key={`${row}-${col}`}
                className={`h-[18px] w-[18px] rounded-[3px] border transition-colors duration-300 ${
                  st === 'flag' ? 'hud-pulse border-island-critical bg-island-critical/70 shadow-[0_0_12px_rgba(255,107,94,0.8)]'
                  : st === 'pass' ? 'border-island-clear/50 bg-island-clear/25'
                  : st === 'scan' ? 'border-island-info/70 bg-island-info/35'
                  : 'border-white/10 bg-white/[0.04]'
                }`}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

const TERMINAL_BRAND = { fontFamily: "'Pretendard Variable', Pretendard, sans-serif" };

/** The monitor before power-on: a dim terminal prompt and a resting phosphor line. */
function BootStandby({ fontSize }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#08121B_0%,#04070C_70%)]">
      <div className="hero-scanlines absolute inset-0 opacity-70" />
      <div className="relative px-[7%] pt-[7%] font-mono" style={{ fontSize }}>
        <div className="flex items-baseline gap-[0.8em]">
          <span className="text-[1.6em] font-bold tracking-[-0.03em] text-white/30" style={TERMINAL_BRAND}>
            nuvo<span className="text-island-info/45">DUR</span>
          </span>
          <span className="text-white/25">overlay · standby</span>
          <span className="hud-blink text-island-info/80">_</span>
        </div>
      </div>
      <span className="boot-standby-line" />
    </div>
  );
}

function BootLog({ lines, ready, fontSize }) {
  const base = 980; // ms — after the CRT opens
  const step = 250;
  const total = base + lines.length * step + 300;
  return (
    <div className="relative flex h-full flex-col justify-start px-[7%] pt-[7%] font-mono text-[#BFF5EF]" style={{ fontSize }}>
      <div className="boot-row mb-[1.4em] flex items-baseline gap-[0.8em]" style={{ '--d': `${base - 200}ms` }}>
        <span className="text-[1.6em] font-bold tracking-[-0.03em] text-white" style={TERMINAL_BRAND}>
          nuvo<span className="text-island-info">DUR</span>
        </span>
        <span className="text-white/35">overlay · boot</span>
      </div>
      {lines.map((line, i) => (
        <div key={line} className="flex items-baseline gap-[0.9em] leading-[1.9]">
          <span className="boot-ok shrink-0 text-island-clear" style={{ '--d': `${base + i * step + 170}ms` }}>[ OK ]</span>
          <span className="boot-row truncate text-white/75" style={{ '--d': `${base + i * step}ms` }}>{line}</span>
        </div>
      ))}
      <div className="boot-row mt-[0.9em] flex items-baseline gap-[0.6em] text-island-info" style={{ '--d': `${base + lines.length * step + 60}ms` }}>
        <span>&gt;</span>
        <span>{ready}</span>
        <span className="hud-blink">_</span>
      </div>
      <span className="relative mt-[1.6em] block h-[2px] w-full max-w-[460px] overflow-hidden bg-white/[0.08]">
        <span className="boot-progress absolute inset-0 bg-island-info shadow-[0_0_10px_rgba(79,209,197,0.8)]" style={{ '--dur': `${total - base}ms`, animationDelay: `${base}ms` }} />
      </span>
    </div>
  );
}

function ChapterScrubber({ chapters, active, run, onJump, reduced, playing, onToggle, labels, booted }) {
  return (
    <>
    <div className="mt-8 flex items-start gap-4 sm:mt-10 sm:gap-6">
      <ol className="grid flex-1 grid-cols-4 gap-2 sm:gap-6">
        {chapters.map((c, i) => {
          const [start, end] = chapterBounds(i);
          const dur = end - start;
          const elapsed = Math.max(0, Math.min(dur, run.pos - start));
          let barStyle;
          if (!booted) barStyle = { transform: 'scaleX(0)' };
          else if (i < active) barStyle = { transform: 'scaleX(1)' };
          else if (i > active || reduced) barStyle = { transform: i === active ? 'scaleX(1)' : 'scaleX(0)' };
          else {
            barStyle = {
              animation: `progress-fill ${dur}ms linear forwards`,
              animationDelay: `-${elapsed}ms`,
              animationPlayState: playing ? 'running' : 'paused',
            };
          }
          const on = i === active && booted;
          return (
            <li key={i}>
              <button type="button" onClick={() => onJump(i)} aria-current={on ? 'step' : undefined} className="group w-full text-left">
                <span className="block h-px overflow-hidden bg-white/[0.12]">
                  <span key={`${run.id}-${i}-${active}`} className="block h-full origin-left bg-island-info shadow-[0_0_8px_rgba(79,209,197,0.9)]" style={barStyle} />
                </span>
                <span className="mt-3 flex items-baseline gap-2">
                  <span className={`font-mono text-[10.5px] tnum ${on ? 'text-island-info' : 'text-white/30'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={`hidden text-[14px] font-semibold leading-snug tracking-[-0.01em] sm:inline ${on ? 'text-white' : 'text-white/40 group-hover:text-white/75'}`}>
                    {c.title}
                  </span>
                </span>
                <span className={`mt-1 hidden text-[12.5px] leading-relaxed sm:block ${on ? 'text-white/55' : 'text-white/30 group-hover:text-white/50'}`}>{c.desc}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* phones: the active chapter, spelled out */}
      <div className="sr-only" aria-live="polite">{booted ? chapters[active]?.title : ''}</div>
      {!reduced && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? labels.pause : labels.play}
          className="kicker -mt-2 h-9 shrink-0 rounded-full px-3.5 text-[10px] text-white/60 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {playing ? labels.pause : labels.play}
        </button>
      )}
    </div>
    <div className="mt-4 min-h-[64px] sm:hidden">
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-white">{chapters[active]?.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/55">{chapters[active]?.desc}</p>
    </div>
    </>
  );
}

// ── Showcase ─────────────────────────────────────────────────────

const ABBR = { meloxicam: 'MLX', omeprazole: 'OMP', prednisolone: 'PRD', gabapentin: 'GBP' };
// Illustrative engine read-outs for the three moments of the story
const CYP = {
  base: { '3A4': 22, '2C9': 38, '2C19': 41, '2D6': 5 },
  added: { '3A4': 49, '2C9': 38, '2C19': 41, '2D6': 5 },
  resolved: { '3A4': 49, '2C9': 6, '2C19': 41, '2D6': 5 },
};
const ORGAN = {
  base: { renal: 24, hepatic: 18, gi: 34 },
  added: { renal: 31, hepatic: 22, gi: 88 },
  resolved: { renal: 18, hepatic: 24, gi: 26 },
};
const DOSE_RANGE = { meloxicam: [0.05, 0.1], prednisolone: [0.5, 1], gabapentin: [5, 20] };

export function HeroShowcase({ active = true }) {
  const { t, lang } = useI18n();
  const L = t.landing;
  const H = L.heroHud;
  const R = t.emr.rx;
  const I = t.island;
  const reduced = usePrefersReducedMotion();
  const script = useMemo(() => buildScript(L.heroTyped), [L.heroTyped]);
  const { state, run, jump, pause, play, position } = useTimeline(script, { initialPos: reduced ? CHAPTER_START[2] + 600 : 0 });
  const chapterIndex = useChapter(run);

  const patients = useMemo(() => getDemoPatients(), []);
  const buddy = patients.find((p) => p.id === 'golden_retriever');

  // Stable Rx lines for the three moments of the story
  const lineSets = useMemo(() => {
    const melox = { ...makeRxLine('meloxicam', 'dog', { days: 30 }), chronic: true };
    const omep = { ...makeRxLine('omeprazole', 'dog', { days: 30 }), chronic: true };
    const pred = makeRxLine('prednisolone', 'dog', { qty: 0.5, days: 7, isNew: true });
    const gaba = makeRxLine('gabapentin', 'dog', { days: 30, isNew: true });
    return { base: [melox, omep], added: [melox, omep, pred], resolved: [gaba, omep, { ...pred, isNew: false }] };
  }, []);

  // The finding shown in the island comes from the real engine
  const focusModel = useMemo(() => {
    const drugs = lineSets.added.map((l) => ({ ...l.drug, dosePerKg: l.qty }));
    const { findings } = analyzeRegimen({ drugs, species: 'dog', patient: { ...buddy.profile, breed: buddy.breed } });
    const f = findings[0];
    return f ? describeFinding(f, { t, lang, species: 'dog', patientName: lang === 'ko' ? buddy.profile.nameKo : buddy.profile.name }) : null;
  }, [lineSets, buddy, t, lang]);

  // ── Layout / scaling ───────────────────────────────────────────
  const rootRef = useRef(null);
  const designRef = useRef(null);
  const emrRef = useRef(null);
  const [width, setWidth] = useState(1200);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const variant = width < 760 ? 'compact' : 'full';
  const D = DESIGN[variant];
  const showHud = variant === 'full' && width >= 1180;
  const windowW = showHud ? Math.min(D.w, width - 2 * (HUD_W + HUD_GAP)) : Math.min(D.w, width);
  const scale = windowW / D.w;
  const windowH = Math.round(D.h * scale);
  const windowLeft = Math.round((width - windowW) / 2);
  const stageH = TOP + windowH;
  const islandSize = scale < 0.6 ? 'sm' : 'md';
  const islandH = islandSize === 'sm' ? 36 : 40;
  const islandTop = Math.round(TOP - islandH / 2) + 3;

  // The EMR is a picture here — keep it out of the tab order and a11y tree
  useEffect(() => { emrRef.current?.setAttribute('inert', ''); }, []);

  // ── Boot sequence: off → crt → log → reveal → dock → done ──────
  const [boot, setBoot] = useState(reduced ? 'done' : 'off');
  const figRef = useRef(null);
  const windowRef = useRef(null);
  useEffect(() => {
    if (reduced) { setBoot('done'); return undefined; }
    if (boot !== 'off') return undefined;
    // power on once the top 40% of the monitor is in view — the power-on
    // line (36%), the boot log and the dock all happen up there
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.4) setBoot('crt'); },
      { threshold: [0, 0.2, 0.4, 0.6, 1] },
    );
    io.observe(windowRef.current);
    return () => io.disconnect();
  }, [boot, reduced]);
  const bootLines = L.heroBoot;
  useEffect(() => {
    let timer;
    if (boot === 'crt') timer = setTimeout(() => setBoot('log'), 900);
    if (boot === 'log') timer = setTimeout(() => setBoot('reveal'), bootLines.length * 250 + 700);
    if (boot === 'reveal') timer = setTimeout(() => setBoot('dock'), 640);
    if (boot === 'dock') timer = setTimeout(() => { setBoot('done'); jump(0, true); }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot]);
  const booted = boot === 'dock' || boot === 'done';

  // ── Pause when off-screen / tab hidden (after boot) ────────────
  const wantPlay = useRef(!reduced);
  useEffect(() => {
    if (reduced || boot !== 'done') return;
    if (active && wantPlay.current) play();
    else pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, boot, reduced]);

  // ── Timecode (written straight to the DOM, no re-render) ───────
  const tcRef = useRef(null);
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const ms = boot === 'done' ? position() : 0;
      const s = Math.floor(ms / 1000);
      const cs = Math.floor((ms % 1000) / 10);
      if (tcRef.current) tcRef.current.textContent = `T+00:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
      if (run.playing && active) raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [run, active, boot, position]);

  // ── Cursor targeting ───────────────────────────────────────────
  const [cursorPos, setCursorPos] = useState(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const design = designRef.current;
    if (!root || !design) return;
    const fromDesign = (sel, dx, dyRatio = 0.5) => {
      const el = design.querySelector(sel);
      const o = el && offsetWithin(el, design);
      if (!o) return null;
      return { x: windowLeft + (o.x + dx) * scale, y: TOP + (o.y + el.offsetHeight * dyRatio) * scale };
    };
    let p = null;
    if (state.cursor === 'search') p = fromDesign('[data-hero="search"]', 150);
    if (state.cursor === 'result') p = fromDesign('[data-hero="result"]', 120);
    if (state.cursor === 'resolve') {
      const btn = root.querySelector('[data-island-action="resolve"]');
      const o = btn && offsetWithin(btn, root);
      if (o) p = { x: o.x + btn.offsetWidth * 0.55, y: o.y + btn.offsetHeight * 0.6 };
    }
    if (!p) p = { x: windowLeft + windowW * (variant === 'full' ? 0.78 : 0.8), y: TOP + windowH * 0.84 };
    setCursorPos(p);
  }, [state.cursor, state.dropdown, state.island, width, scale, windowLeft, windowW, windowH, variant]);

  // ── Island model for the current moment ────────────────────────
  const islandMode = state.island;
  const alertish = islandMode === 'glance' || islandMode === 'expanded' || islandMode === 'pressed';
  let islandProps;
  if ((islandMode === 'expanded' || islandMode === 'pressed') && focusModel) {
    islandProps = {
      view: 'expanded',
      focus: { ...focusModel, severityLabel: I.severity[focusModel.severity], index: 0, total: 1, reviewed: false },
      highlightAction: islandMode === 'pressed' ? 'resolve' : undefined,
    };
  } else {
    const status =
      islandMode === 'checking' || islandMode === 'checking2' ? { tone: 'checking', title: fmt(I.ui.screening, { n: 3 }), detail: '' }
      : islandMode === 'glance' ? { tone: 'critical', title: I.severity.critical, detail: focusModel?.drugsLabel }
      : islandMode === 'applied' ? { tone: 'clear', title: I.ui.applied, detail: focusModel?.resolvedShort }
      : { tone: 'clear', title: I.ui.noIssues, detail: fmt(I.ui.medsCount, { n: islandMode === 'clear1' ? 3 : 2 }) };
    islandProps = { view: 'compact', status };
  }
  const noop = () => {};

  const lines = lineSets[state.lines];
  const overlay = alertish ? { meloxicam: 'critical', prednisolone: 'critical' } : {};
  const focusIds = islandMode === 'expanded' || islandMode === 'pressed' ? ['meloxicam', 'prednisolone'] : [];

  // ── HUD model ──────────────────────────────────────────────────
  const hud = state.hud;
  const statusOf = (key) => {
    if (!booted || hud === 'idle') return 'idle';
    if (hud === 'scan') return 'scan';
    if (hud === 'alert') return ['ddi', 'organ', 'evidence'].includes(key) ? 'flag' : 'pass';
    return 'pass';
  };
  const statusLabel = (st) => (st === 'idle' ? H.idle : st === 'scan' ? H.scanning : st === 'flag' ? H.flag : H.pass);
  const drugAbbr = lines.map((l) => ABBR[l.drugId] || l.drugId.slice(0, 3).toUpperCase());
  const cellState = (a, b) => {
    const st = statusOf('ddi');
    if (st === 'flag') return (a === 'MLX' && b === 'PRD') || (a === 'PRD' && b === 'MLX') ? 'flag' : 'pass';
    return st;
  };
  const cyp = CYP[state.lines];
  const organ = ORGAN[state.lines];
  const organFlag = statusOf('organ') === 'flag';
  const doseLine = state.lines === 'added' ? lines[2] : lines[0];
  const doseRange = DOSE_RANGE[doseLine?.drugId] || [0, 1];
  const span = [doseRange[0] * 0.5, doseRange[1] * 1.25];
  const pct = (v) => Math.min(100, Math.max(0, ((v - span[0]) / (span[1] - span[0])) * 100));
  const doseQty = Number(doseLine?.qty) || 0;
  const doseCalc = +(doseQty * buddy.profile.weight).toFixed(2);
  const drugName = (id) => {
    const d = getDrugById(id);
    return lang === 'ko' && d?.nameKr ? d.nameKr : (d?.name || id).replace(/\s*\(.*\)$/, '');
  };

  const onJump = (i) => {
    wantPlay.current = !reduced;
    if (boot !== 'done') setBoot('done');
    jump(CHAPTER_START[i] + (reduced ? (i === 0 ? 2600 : i === 1 ? 1300 : i === 2 ? 600 : 2800) : 0), !reduced);
  };
  const onToggle = () => {
    if (run.playing) { wantPlay.current = false; pause(); }
    else { wantPlay.current = true; play(); }
  };

  const now = new Date();
  const dateLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekday = now.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'short' });

  // Stage geometry for the instruments and their circuit traces
  const colTop = TOP + 18;
  const colH = windowH - 36;
  const leftX = windowLeft - HUD_GAP - HUD_W;
  const rightX = windowLeft + windowW + HUD_GAP;
  const cx = width / 2;
  const beamTone = hud === 'alert' ? 'rgba(255,107,94,0.95)' : hud === 'scan' ? 'rgba(110,234,223,0.95)' : hud === 'resolved' || hud === 'clear' ? 'rgba(61,220,151,0.75)' : 'rgba(110,234,223,0.35)';
  const traceL = `M ${cx - 40} ${TOP - 9} H ${leftX + HUD_W / 2 + 10} Q ${leftX + HUD_W / 2} ${TOP - 9} ${leftX + HUD_W / 2} ${TOP + 1} V ${colTop}`;
  const traceR = `M ${cx + 40} ${TOP - 9} H ${rightX + HUD_W / 2 - 10} Q ${rightX + HUD_W / 2} ${TOP - 9} ${rightX + HUD_W / 2} ${TOP + 1} V ${colTop}`;
  const ports = [0.2, 0.5, 0.8].map((f) => Math.round(colTop + colH * f));
  const flowing = booted && (hud === 'scan' || hud === 'alert');

  const camera = variant === 'full' && !reduced ? (booted ? CAMERA[chapterIndex] : CAMERA_BOOT) : 'none';
  const ticker = (() => {
    if (!booted || hud === 'idle') return [H.idle, fmt(I.ui.medsCount, { n: 2 })];
    if (hud === 'scan') return [H.scanning, `${H.ddi} · ${H.species} · ${H.dose} · ${H.organ}`];
    if (hud === 'alert') return [H.flag, focusModel ? `${focusModel.title} · ${focusModel.drugsLabel}` : ''];
    if (hud === 'resolved') return [I.ui.applied, focusModel?.resolvedShort || ''];
    return [H.pass, `${fmt(I.ui.medsCount, { n: 3 })} · ${I.ui.noIssues}`];
  })();

  return (
    <figure ref={figRef} aria-label={L.heroAria} className="relative">
      {/* Telemetry */}
      <div className="mb-4 flex items-center justify-between gap-4 px-1 sm:mb-5" aria-hidden="true">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="kicker shrink-0 text-[10px]">
            <span className="hud-blink mr-2 inline-block text-island-critical">REC</span>
            <span className="text-island-info">{H.live}</span>
          </span>
          <span className="hidden truncate text-[11.5px] text-white/40 sm:inline">{H.simulated}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-3 font-mono text-[11px] text-white/50 tnum">
          <span ref={tcRef}>T+00:00.00</span>
          <span className="text-white/25">/</span>
          <span>CH {String(chapterIndex + 1).padStart(2, '0')}/04</span>
        </span>
      </div>

      <div style={{ perspective: '2200px', perspectiveOrigin: '50% 30%' }}>
        <div
          className="relative transition-transform duration-[1600ms] ease-out-expo will-change-transform"
          style={{ transform: camera, transformStyle: 'preserve-3d' }}
        >
          <div ref={rootRef} className="relative" style={{ height: stageH }}>
            {/* light pool under the window */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-[100%] blur-3xl transition-colors duration-700"
              style={{ background: `radial-gradient(closest-side, ${alertish ? 'rgba(255,90,78,0.32)' : 'rgba(47,192,184,0.30)'}, transparent)` }}
            />

            {/* Circuit traces: island ⇄ instruments */}
            {showHud && (
              <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={stageH}>
                {[traceL, traceR].map((d, i) => (
                  <g key={i}>
                    <path d={d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
                    {booted && (
                      <path
                        d={d}
                        fill="none"
                        stroke={beamTone}
                        strokeWidth="1.2"
                        className={flowing ? 'hud-beam' : 'hud-draw'}
                        style={{ '--len': 900, '--d': `${i * 120}ms`, transition: 'stroke 400ms' }}
                      />
                    )}
                  </g>
                ))}
                {ports.map((y) => (
                  <g key={y}>
                    <path d={`M ${windowLeft} ${y} H ${windowLeft - HUD_GAP}`} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    <path d={`M ${windowLeft + windowW} ${y} H ${windowLeft + windowW + HUD_GAP}`} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    {flowing && (
                      <>
                        <path d={`M ${windowLeft} ${y} H ${windowLeft - HUD_GAP}`} stroke={beamTone} strokeWidth="1.2" className="hud-beam" />
                        <path d={`M ${windowLeft + windowW} ${y} H ${windowLeft + windowW + HUD_GAP}`} stroke={beamTone} strokeWidth="1.2" className="hud-beam" />
                      </>
                    )}
                  </g>
                ))}
              </svg>
            )}

            {/* Instruments */}
            {showHud && (
              <>
                <div className="absolute flex flex-col justify-between" style={{ left: leftX, top: colTop, width: HUD_W, height: colH }}>
                  <HudPanel index={0} title={H.ddi} status={statusOf('ddi')} statusLabel={statusLabel(statusOf('ddi'))} side="left" delay={150} live={booted} sweepKey={state.scan}>
                    <DdiMatrix drugs={drugAbbr} cellState={cellState} />
                    <p className="mt-2 font-mono text-[9.5px] text-white/40 tnum">{drugAbbr.length} × {drugAbbr.length} · {(drugAbbr.length * (drugAbbr.length - 1)) / 2} pairs</p>
                  </HudPanel>
                  <HudPanel index={1} title={H.cyp} status={statusOf('cyp')} statusLabel={statusLabel(statusOf('cyp'))} side="left" delay={260} live={booted} sweepKey={state.scan}>
                    <div className="space-y-1.5">
                      {Object.entries(cyp).map(([k, v]) => <Meter key={k} label={`CYP${k}`} value={v} />)}
                    </div>
                  </HudPanel>
                  <HudPanel index={2} title={H.species} status={statusOf('species')} statusLabel={statusLabel(statusOf('species'))} side="left" delay={370} live={booted} sweepKey={state.scan}>
                    <p className="truncate text-[11px] text-white/80">{H.speciesLine}</p>
                    <p className="mt-1 truncate text-[10.5px] text-white/45">{H.mdr1}</p>
                    <p className="mt-1 font-mono text-[10px] text-white/35 tnum">32.5 kg · BCS 6/9 · CREA 1.1</p>
                  </HudPanel>
                </div>
                <div className="absolute flex flex-col justify-between" style={{ left: rightX, top: colTop, width: HUD_W, height: colH }}>
                  <HudPanel index={3} title={H.dose} status={statusOf('dose')} statusLabel={statusLabel(statusOf('dose'))} side="right" delay={200} live={booted} sweepKey={state.scan}>
                    {doseLine && (
                      <>
                        <p className="truncate text-[11px] text-white/80">{drugName(doseLine.drugId)}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-white/50 tnum">{doseQty} mg/kg × 32.5 kg = <span className="text-white/85">{doseCalc} mg</span></p>
                        <span className="relative mt-2 block h-[3px] rounded-full bg-white/[0.08]">
                          <span className="absolute inset-y-0 rounded-full bg-island-clear/40" style={{ left: `${pct(doseRange[0])}%`, width: `${pct(doseRange[1]) - pct(doseRange[0])}%` }} />
                          <span className="absolute top-1/2 h-[9px] w-[2px] -translate-y-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-[left] duration-700 ease-out-expo" style={{ left: `${pct(doseQty)}%` }} />
                        </span>
                        <p className="mt-1.5 font-mono text-[9.5px] text-white/35 tnum">{H.range} {doseRange[0]}–{doseRange[1]} mg/kg</p>
                      </>
                    )}
                  </HudPanel>
                  <HudPanel index={4} title={H.organ} status={statusOf('organ')} statusLabel={statusLabel(statusOf('organ'))} side="right" delay={310} live={booted} sweepKey={state.scan}>
                    <div className="space-y-1.5">
                      <Meter label={H.renal} value={organ.renal} />
                      <Meter label={H.hepatic} value={organ.hepatic} />
                      <Meter label={H.gi} value={organ.gi} tone={organFlag ? 'red' : hud === 'resolved' || hud === 'clear' ? 'green' : 'teal'} />
                    </div>
                  </HudPanel>
                  <HudPanel index={5} title={H.evidence} status={statusOf('evidence')} statusLabel={statusLabel(statusOf('evidence'))} side="right" delay={420} live={booted} sweepKey={state.scan}>
                    {hud === 'alert' && focusModel?.citation ? (
                      <p className="line-clamp-3 font-mono text-[10px] leading-relaxed text-white/75">{focusModel.citation}</p>
                    ) : (
                      <p className="font-mono text-[10px] leading-relaxed text-white/40">
                        {hud === 'resolved' || hud === 'clear' ? `${drugName('gabapentin')} · ${drugName('omeprazole')} · ${drugName('prednisolone')}` : 'Plumb’s · JVIM · JAVMA'}
                      </p>
                    )}
                  </HudPanel>
                </div>
              </>
            )}

            {/* EMR window (scaled picture) */}
            <div
              ref={windowRef}
              className="absolute overflow-hidden rounded-[6px] bg-[#04070C] shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_40px_90px_-30px_rgba(0,0,0,0.9),0_0_80px_-20px_rgba(47,192,184,0.35)]"
              style={{ left: windowLeft, top: TOP, width: windowW, height: windowH }}
            >
              <div
                ref={emrRef}
                aria-hidden="true"
                className={`absolute inset-0 ${boot === 'reveal' ? 'boot-glitch' : ''} ${boot === 'off' || boot === 'crt' || boot === 'log' ? 'invisible' : ''}`}
              >
                <div
                  ref={designRef}
                  className="absolute left-0 top-0 flex flex-col bg-emr-bg"
                  style={{ width: D.w, height: D.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                  <EmrTitleBar docTitle={`${t.emr.toolbar[1].label} — Buddy (1548)`} />
                  <EmrToolbar active="consult" compact={variant === 'compact'} />
                  <div className="flex min-h-0 flex-1 gap-[3px] p-[3px]">
                    {variant === 'full' && (
                      <aside className="w-[214px] shrink-0">
                        <WaitingList patients={patients} selectedId={buddy.id} dateLabel={`${dateLabel} (${weekday})`} showOwner={false} />
                      </aside>
                    )}
                    <main className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <PatientInfo entry={buddy} density={variant === 'full' ? 'wide' : 'narrow'} photoSize={variant === 'full' ? 78 : 60} />
                      <div className="flex min-h-0 flex-1 flex-col border border-emr-line">
                        <EmrTabs
                          tabs={[
                            { id: 'soap', label: t.emr.tabs.soap },
                            { id: 'rx', label: t.emr.tabs.rx, count: lines.length + 3 },
                            { id: 'labs', label: t.emr.tabs.labs },
                            { id: 'history', label: t.emr.tabs.history },
                          ]}
                          active="rx"
                          className="bg-[#E9ECF0]"
                        />
                        <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden bg-white p-1.5">
                          {variant === 'full' && <VisitStrip entry={buddy} dateLabel={dateLabel} />}
                          <FakeSearch typed={state.typed} focused={state.focused} dropdown={state.dropdown} lang={lang} labels={R} />
                          <RxGrid
                            lines={lines}
                            txItems={['consultRecheck', 'otoscopy', 'earFlush']}
                            weight={buddy.profile.weight}
                            overlay={overlay}
                            focusIds={focusIds}
                            readOnly
                            columns={variant === 'full' ? 'mid' : 'compact'}
                          />
                          {variant === 'full' && <RxMemo entry={buddy} />}
                        </div>
                      </div>
                    </main>
                  </div>
                  <EmrStatusBar clock={`${dateLabel} (${weekday}) 14:12`} patientsToday={patients.length} />
                </div>
              </div>

              {/* effects on the glass */}
              {booted && <span className="hero-glare" aria-hidden="true" />}
              {booted && hud === 'scan' && <span key={`s${state.scan}`} className="hero-scanbeam" style={{ '--scan-h': `${windowH}px` }} aria-hidden="true" />}
              {booted && hud === 'alert' && state.alert > 0 && <span key={`a${state.alert}`} className="hero-alert-pulse" aria-hidden="true" />}
              {booted && hud === 'resolved' && state.wave > 0 && <span key={`w${state.wave}`} className="hero-resolve-wave" aria-hidden="true" />}

              {/* boot: power-on line → boot log → wipe */}
              {(boot === 'off' || boot === 'crt' || boot === 'log' || boot === 'reveal') && (
                <div aria-hidden="true" className="absolute inset-0">
                  {boot !== 'off' && (
                    <div className={`absolute inset-0 ${boot === 'reveal' ? 'boot-wipe' : ''}`}>
                      <div className="boot-screen absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#0B1824_0%,#04070C_70%)]">
                        <div className="hero-scanlines absolute inset-0" />
                        <BootLog lines={bootLines} ready={L.heroBootReady} fontSize={Math.max(8.5, Math.min(13, windowW / 82))} />
                      </div>
                    </div>
                  )}
                  {boot === 'crt' && <span className="boot-line" />}
                  {boot === 'reveal' && <span className="boot-wipe-edge" />}
                  {boot === 'off' && <BootStandby fontSize={Math.max(8.5, Math.min(13, windowW / 82))} />}
                </div>
              )}
            </div>

            {/* nuvoDUR island — unscaled so it stays legible on phones */}
            <div className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-2" style={{ top: islandTop }} aria-hidden="true">
              <div className={`relative ${booted ? (boot === 'dock' ? 'hero-dock' : '') : 'opacity-0'}`}>
                <DurIsland
                  {...islandProps}
                  size={islandSize}
                  interactive={false}
                  labels={I.ui}
                  maxWidth={Math.max(280, Math.min(460, width - 16))}
                  onResolve={noop}
                  onAck={noop}
                  onOpenReport={noop}
                  onCollapse={noop}
                />
                {boot === 'dock' && <span className="hero-shock" style={{ top: islandH / 2 }} />}
                {booted && state.alert > 0 && hud === 'alert' && islandMode === 'glance' && (
                  <span key={`sa${state.alert}`} className="hero-shock" style={{ top: islandH / 2, '--c': '255, 107, 94' }} />
                )}
                {booted && state.wave > 0 && hud === 'resolved' && (
                  <span key={`sw${state.wave}`} className="hero-shock" style={{ top: islandH / 2, '--c': '61, 220, 151' }} />
                )}
              </div>
            </div>

            {!reduced && boot === 'done' && cursorPos && <Cursor pos={cursorPos} click={state.click} />}
          </div>
        </div>
      </div>

      <figcaption className="sr-only">{L.chapters[chapterIndex]?.title}: {L.chapters[chapterIndex]?.desc}</figcaption>

      {/* phones: one-line read-out of what the engines are doing */}
      {!showHud && (
        <div className="mt-5 flex items-baseline gap-3 overflow-hidden border-y border-white/[0.08] py-2.5" aria-hidden="true">
          <span className={`kicker shrink-0 text-[10px] ${hud === 'alert' ? 'text-island-critical' : hud === 'scan' ? 'text-island-info' : hud === 'idle' || !booted ? 'text-white/40' : 'text-island-clear'}`}>{ticker[0]}</span>
          <span className="truncate text-[12.5px] text-white/65">{ticker[1]}</span>
        </div>
      )}

      <ChapterScrubber
        chapters={L.chapters}
        active={chapterIndex}
        run={run}
        onJump={onJump}
        reduced={reduced}
        playing={run.playing}
        onToggle={onToggle}
        labels={{ pause: L.pause, play: L.play }}
        booted={boot === 'done'}
      />
    </figure>
  );
}
