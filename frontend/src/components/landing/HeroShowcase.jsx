import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Search, Plus } from 'lucide-react';
import { useI18n } from '../../i18n';
import { DurIsland } from '../dur/DurIsland';
import { analyzeRegimen, topSeverity } from '../dur/findings';
import { describeFinding, fmt } from '../dur/describe';
import { EmrTitleBar, EmrMenuBar, EmrStatusBar, WaitingList, PatientBanner, EmrTabs, RxTable } from '../emr/EmrUI';
import { getDemoPatients } from '../../data/breedProfiles';
import { makeRxLine, productLabel } from '../../data/emrCatalog';
import { getDrugById } from '../../data/drugDatabase';

// ──────────────────────────────────────────────────────────────────
// Hero showcase — a scripted "screen capture" of nuvovet DUR on top of
// a clinic EMR, built from the same components as the live demo and
// driven by the real DUR engine (the alert you see is what the engine
// returns for this regimen).
//
//   01 Prescribe  → the vet types "Predn…" and adds prednisolone
//   02 Check      → the island screens the new line
//   03 Alert      → it expands: NSAID + corticosteroid, the why, a fix
//   04 Resolve    → one tap swaps meloxicam for gabapentin; all clear
//
// Pauses off-screen and on hidden tabs; reduced-motion users get a
// static frame of chapter 3 and can step through chapters manually.
// ──────────────────────────────────────────────────────────────────

const LOOP_MS = 14000;
const CHAPTER_START = [0, 3450, 5600, 8800];
// full: desktop EMR with waiting list · compact: portrait "mobile EMR" so an
// expanded island always fits inside the frame on phones
const DESIGN = { full: { w: 1120, h: 624, sidebar: true }, compact: { w: 440, h: 720, sidebar: false } };
const TITLEBAR_H = 44;

const INITIAL = {
  lines: 'base',
  typed: '',
  focused: false,
  dropdown: false,
  cursor: 'rest',
  click: 0,
  island: 'clear0',
};

function buildScript(typedText) {
  const chars = Array.from(typedText);
  const typeStart = 1450;
  const typeStep = chars.length > 3 ? 130 : 210;
  const steps = [
    { at: 600, patch: { cursor: 'search' } },
    { at: 1250, patch: (s) => ({ click: s.click + 1, focused: true }) },
    ...chars.map((_, i) => ({ at: typeStart + i * typeStep, patch: { typed: chars.slice(0, i + 1).join('') } })),
    { at: typeStart + chars.length * typeStep + 120, patch: { dropdown: true } },
    { at: 2650, patch: { cursor: 'result' } },
    { at: 3250, patch: (s) => ({ click: s.click + 1 }) },
    { at: 3450, patch: { lines: 'added', typed: '', dropdown: false, focused: false, island: 'checking' } },
    { at: 4650, patch: { island: 'glance' } },
    { at: 5600, patch: { island: 'expanded' } },
    { at: 7900, patch: { cursor: 'resolve' } },
    { at: 8800, patch: (s) => ({ click: s.click + 1, island: 'pressed' }) },
    { at: 9150, patch: { lines: 'resolved', island: 'applied' } },
    { at: 10500, patch: { island: 'checking2' } },
    { at: 11300, patch: { island: 'clear1' } },
    { at: 11700, patch: { cursor: 'rest' } },
  ];
  return steps.sort((a, b) => a.at - b.at);
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** Scripted timeline with jump / pause / resume. */
function useTimeline(script, { autoplay }) {
  const [state, setState] = useState(() => reduceTo(script, autoplay ? 0 : CHAPTER_START[2] + 600));
  const [run, setRun] = useState({ id: 0, pos: autoplay ? 0 : CHAPTER_START[2] + 600, playing: autoplay });
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

  const position = () => (run.playing ? Math.min(LOOP_MS, performance.now() - startedAt.current) : run.pos);

  const jump = (pos, playing = run.playing) => {
    setState(reduceTo(scriptRef.current, pos));
    setRun((r) => ({ id: r.id + 1, pos, playing }));
  };
  const pause = () => { if (run.playing) setRun((r) => ({ id: r.id + 1, pos: position(), playing: false })); };
  const play = () => { if (!run.playing) setRun((r) => ({ id: r.id + 1, pos: r.pos >= LOOP_MS ? 0 : r.pos, playing: true })); };

  return { state, run, jump, pause, play, position };
}

// Sum offsetLeft/Top up to an ancestor — layout coordinates, immune to the
// scale / tilt transforms applied to the showcase.
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

function Cursor({ pos, click }) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50 transition-transform duration-700 ease-out-expo"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      aria-hidden="true"
    >
      {click > 0 && (
        <span key={click} className="absolute left-0 top-0 h-9 w-9 animate-click-ring rounded-full border-2 border-dur-400 bg-dur-400/20" />
      )}
      <svg width="22" height="22" viewBox="0 0 24 24" className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
        <path d="M4.5 2.8l13.4 9.9-6 .9-3.4 5.6z" fill="#0B1220" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FakeSearch({ typed, focused, dropdown, lang, placeholder }) {
  const pred = getDrugById('prednisolone');
  return (
    <div className="relative">
      <div
        data-hero="search"
        className={`flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-[13px] transition-shadow ${
          focused ? 'border-emr-blue ring-2 ring-emr-blue/15' : 'border-emr-line'
        }`}
      >
        <Search size={15} className="text-emr-muted" />
        {typed ? (
          <span className="text-emr-text">
            {typed}
            <span className="ml-px inline-block h-[15px] w-px translate-y-[3px] animate-caret-blink bg-emr-text" />
          </span>
        ) : (
          <span className="text-[#9aa3b2]">
            {focused && <span className="mr-px inline-block h-[15px] w-px translate-y-[3px] animate-caret-blink bg-emr-text" />}
            {placeholder}
          </span>
        )}
      </div>
      {dropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 animate-sheet-up overflow-hidden rounded-md border border-emr-line bg-white shadow-lift">
          <div data-hero="result" className="flex items-center gap-3 bg-emr-blueSoft px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-emr-text">{productLabel(pred, lang)}</span>
              <span className="block text-[11.5px] text-emr-muted">Prednisolone · {pred?.class}</span>
            </span>
            <Plus size={14} className="text-emr-blue" />
          </div>
          <div className="flex items-center gap-3 border-t border-emr-line/70 px-3 py-2 opacity-60">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-emr-text">{productLabel(getDrugById('dexamethasone'), lang)}</span>
              <span className="block text-[11.5px] text-emr-muted">Dexamethasone · Corticosteroid</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterScrubber({ chapters, active, run, onJump, reduced, playing, onToggle, labels }) {
  return (
    <div className="mt-6 flex items-start gap-3 sm:mt-8 sm:gap-5">
      <ol className="grid flex-1 grid-cols-4 gap-2 sm:gap-5">
        {chapters.map((c, i) => {
          const [start, end] = chapterBounds(i);
          const dur = end - start;
          const elapsed = Math.max(0, Math.min(dur, run.pos - start));
          let barStyle;
          if (i < active) barStyle = { transform: 'scaleX(1)' };
          else if (i > active || reduced) barStyle = { transform: i === active ? 'scaleX(1)' : 'scaleX(0)' };
          else {
            barStyle = {
              animation: `progress-fill ${dur}ms linear forwards`,
              animationDelay: `-${elapsed}ms`,
              animationPlayState: playing ? 'running' : 'paused',
            };
          }
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={i === active ? 'step' : undefined}
                className="group w-full text-left"
              >
                <span className="block h-[3px] overflow-hidden rounded-full bg-ink-200/80">
                  <span key={`${run.id}-${i}-${active}`} className="block h-full origin-left rounded-full bg-ink-900" style={barStyle} />
                </span>
                <span className="mt-3 flex items-baseline gap-2">
                  <span className={`font-mono text-[11px] font-semibold tnum ${i === active ? 'text-dur-600' : 'text-ink-300'}`}>0{i + 1}</span>
                  <span className={`text-[12.5px] font-semibold leading-snug tracking-[-0.01em] sm:text-[14px] ${i === active ? 'text-ink-900' : 'text-ink-400 group-hover:text-ink-700'}`}>
                    {c.title}
                  </span>
                </span>
                <span className={`mt-1 hidden text-[12.5px] leading-relaxed sm:block ${i === active ? 'text-ink-500' : 'text-ink-300 group-hover:text-ink-500'}`}>
                  {c.desc}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {!reduced && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? labels.pause : labels.play}
          className="mt-[-9px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="translate-x-[1px]" />}
        </button>
      )}
    </div>
  );
}

export function HeroShowcase() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const reduced = usePrefersReducedMotion();
  const script = useMemo(() => buildScript(L.heroTyped), [L.heroTyped]);
  const { state, run, jump, pause, play } = useTimeline(script, { autoplay: !reduced });

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
    return f ? describeFinding(f, { t, lang, species: 'dog', patientName: buddy.profile.name }) : null;
  }, [lineSets, buddy, t, lang]);

  const otherTones = useMemo(() => {
    const out = {};
    for (const e of patients) {
      if (e.id === buddy.id) continue;
      const ds = e.profile.rx.map((r) => getDrugById(r.id)).filter(Boolean);
      out[e.id] = topSeverity(analyzeRegimen({ drugs: ds, species: e.species, patient: { ...e.profile, breed: e.breed } }).findings) || 'clear';
    }
    return out;
  }, [patients, buddy]);

  // ── Layout / scaling ───────────────────────────────────────────
  const rootRef = useRef(null);
  const designRef = useRef(null);
  const emrRef = useRef(null);
  const tiltRef = useRef(null);
  const [width, setWidth] = useState(1120);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const variant = width < 720 ? 'compact' : 'full';
  const D = DESIGN[variant];
  const scale = Math.min(1, width / D.w);
  const frameH = Math.round(D.h * scale);
  const islandSize = scale < 0.7 ? 'sm' : 'md';
  const islandH = islandSize === 'sm' ? 36 : 40;
  const islandTop = Math.round((TITLEBAR_H * scale) / 2 - islandH / 2);

  // The EMR is a picture here — keep it out of the tab order and a11y tree
  useEffect(() => { emrRef.current?.setAttribute('inert', ''); }, []);

  // ── Pause when off-screen / tab hidden ─────────────────────────
  const wantPlay = useRef(!reduced);
  useEffect(() => {
    if (reduced) return undefined;
    const el = rootRef.current;
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden && wantPlay.current) play();
      else pause();
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0.15 });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, run.playing]);

  // ── Scroll-linked tilt (settles flat as the hero scrolls) ──────
  useEffect(() => {
    if (reduced) return undefined;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / 420));
      const el = tiltRef.current;
      if (el) el.style.transform = `perspective(2400px) rotateX(${(1 - p) * 9}deg) scale(${0.965 + p * 0.035})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [reduced]);

  // ── Cursor targeting ───────────────────────────────────────────
  const [cursorPos, setCursorPos] = useState(null); // mounted at its first target — no slide-in
  useLayoutEffect(() => {
    const root = rootRef.current;
    const design = designRef.current;
    if (!root || !design) return;
    const leftPad = (width - D.w * scale) / 2;
    const fromDesign = (sel, dx, dyRatio = 0.5) => {
      const el = design.querySelector(sel);
      const o = el && offsetWithin(el, design);
      if (!o) return null;
      return { x: leftPad + (o.x + dx) * scale, y: (o.y + el.offsetHeight * dyRatio) * scale };
    };
    let p = null;
    if (state.cursor === 'search') p = fromDesign('[data-hero="search"]', 150);
    if (state.cursor === 'result') p = fromDesign('[data-hero="result"]', 120);
    if (state.cursor === 'resolve') {
      const btn = root.querySelector('[data-island-action="resolve"]');
      const o = btn && offsetWithin(btn, root);
      if (o) p = { x: o.x + btn.offsetWidth * 0.55, y: o.y + btn.offsetHeight * 0.6 };
    }
    if (!p) p = { x: width * (variant === 'full' ? 0.8 : 0.82), y: frameH * 0.86 };
    setCursorPos(p);
  }, [state.cursor, state.dropdown, state.island, width, scale, D.w, frameH, variant]);

  // ── Island model for the current moment ────────────────────────
  const I = t.island;
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
      islandMode === 'checking' ? { tone: 'checking', title: fmt(I.ui.screening, { n: 3 }), detail: '' }
      : islandMode === 'checking2' ? { tone: 'checking', title: fmt(I.ui.screening, { n: 3 }), detail: '' }
      : islandMode === 'glance' ? { tone: 'critical', title: I.severity.critical, detail: focusModel?.drugsLabel }
      : islandMode === 'applied' ? { tone: 'clear', title: I.ui.applied, detail: focusModel?.resolvedShort }
      : { tone: 'clear', title: 'nuvovet DUR', detail: fmt(I.ui.medsClear, { n: islandMode === 'clear1' ? 3 : 2 }) };
    islandProps = { view: 'compact', status };
  }
  const noop = () => {};

  const lines = lineSets[state.lines];
  const tones = alertish ? { meloxicam: 'critical', prednisolone: 'critical' } : {};
  const focusIds = islandMode === 'expanded' || islandMode === 'pressed' ? ['meloxicam', 'prednisolone'] : [];

  const chapterIndex = useChapter(run, chapterAt(run.pos));

  const onJump = (i) => {
    wantPlay.current = !reduced;
    jump(CHAPTER_START[i] + (reduced ? (i === 0 ? 2600 : i === 1 ? 1300 : i === 2 ? 600 : 2800) : 0), !reduced);
  };
  const onToggle = () => {
    if (run.playing) { wantPlay.current = false; pause(); }
    else { wantPlay.current = true; play(); }
  };

  const glow = alertish ? 'rgba(255,90,78,0.20)' : 'rgba(18,163,156,0.20)';
  const dateLabel = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });

  return (
    <figure aria-label={L.heroAria} className="relative">
      {/* What is what — the EMR (left) and nuvovet DUR (centred over the island) */}
      <div className="relative mb-3 h-9 sm:mb-4" aria-hidden="true">
        {/* brand motif: a monitoring pulse running into the nuvovet DUR label */}
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-12 w-screen -translate-x-1/2 -translate-y-[38%] text-dur-400/60 mask-fade-x sm:block"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path d="M0 30 H548 l14 -24 l18 40 l16 -32 l12 16 H1440" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute bottom-0 left-1 z-10 hidden items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 text-[12px] font-medium text-ink-600 ring-1 ring-ink-200 backdrop-blur md:inline-flex">
          <span className="flex h-5 items-center rounded-full bg-emr-blue px-1.5 text-[9px] font-black tracking-wide text-white">EMR</span>
          <span className="font-semibold text-ink-800">{L.heroLabelEmr}</span>
          <span className="text-ink-400">· {L.heroLabelEmrSub}</span>
        </span>
        <span className="absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/90 py-1 pl-1.5 pr-3 text-[12px] font-medium text-ink-500 ring-1 ring-dur-200 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dur-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-dur-500" />
          </span>
          <span className="font-semibold text-ink-900">nuvovet <span className="text-dur-600">DUR</span></span>
          <span className="hidden sm:inline">· {L.heroLabelDurSub}</span>
        </span>
        {/* connector down to the island */}
        <span className="absolute left-1/2 top-full h-3 w-px -translate-x-1/2 bg-gradient-to-b from-dur-300 to-transparent sm:h-4" />
      </div>

      <div ref={tiltRef} className="relative origin-top will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
        {/* ambient glow reacting to the island state */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-10 -top-16 h-56 rounded-[100%] blur-3xl transition-colors duration-700"
          style={{ background: `radial-gradient(closest-side, ${glow}, transparent)` }}
        />

        <div ref={rootRef} className="relative" style={{ height: frameH }}>
          {/* EMR window (scaled picture) */}
          <div
            ref={emrRef}
            aria-hidden="true"
            className="absolute top-0 overflow-hidden rounded-2xl bg-emr-bg shadow-window ring-1 ring-ink-900/10"
            style={{ left: (width - D.w * scale) / 2, width: D.w * scale, height: frameH }}
          >
            <div
              ref={designRef}
              className="absolute left-0 top-0 flex flex-col"
              style={{ width: D.w, height: D.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
              <EmrTitleBar chrome clock={lang === 'ko' ? '오후 2:12' : '2:12 PM'} />
              <EmrMenuBar active={1} />
              <div className="flex min-h-0 flex-1">
                {D.sidebar && (
                  <aside className="w-[236px] shrink-0 border-r border-emr-line bg-white">
                    <WaitingList
                      patients={patients}
                      selectedId={buddy.id}
                      durTone={{ ...otherTones, [buddy.id]: alertish ? 'critical' : 'clear' }}
                      dateLabel={dateLabel}
                    />
                  </aside>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <PatientBanner entry={buddy} compact />
                  <EmrTabs
                    tabs={[
                      { id: 'soap', label: t.emr.tabs.soap },
                      { id: 'rx', label: t.emr.tabs.rx, badge: lines.length, dot: alertish ? 'critical' : undefined },
                      { id: 'labs', label: t.emr.tabs.labs },
                      { id: 'history', label: t.emr.tabs.history },
                    ]}
                    active="rx"
                  />
                  <div className="space-y-3 p-4">
                    <FakeSearch typed={state.typed} focused={state.focused} dropdown={state.dropdown} lang={lang} placeholder={t.emr.rx.addPlaceholder} />
                    <RxTable
                      lines={lines}
                      txItems={['consultRecheck', 'otoscopy']}
                      weight={buddy.profile.weight}
                      drugTone={tones}
                      focusIds={focusIds}
                      focusTone="critical"
                      readOnly
                      density="compact"
                      layout={D.sidebar ? 'table' : 'cards'}
                    />
                  </div>
                </div>
              </div>
              <EmrStatusBar patientsToday={patients.length} />
            </div>
          </div>

          {/* nuvovet DUR island — unscaled so it stays legible on phones */}
          <div className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-2" style={{ top: islandTop }} aria-hidden="true">
            <DurIsland
              {...islandProps}
              size={islandSize}
              interactive={false}
              labels={I.ui}
              maxWidth={Math.max(280, width - 16)}
              onResolve={noop}
              onAck={noop}
              onOpenReport={noop}
              onCollapse={noop}
            />
          </div>

          {!reduced && cursorPos && <Cursor pos={cursorPos} click={state.click} />}
        </div>
      </div>

      <figcaption className="sr-only">{L.chapters[chapterIndex]?.title}: {L.chapters[chapterIndex]?.desc}</figcaption>

      <ChapterScrubber
        chapters={L.chapters}
        active={chapterIndex}
        run={run}
        onJump={onJump}
        reduced={reduced}
        playing={run.playing}
        onToggle={onToggle}
        labels={{ pause: L.pause, play: L.play }}
      />
      {/* mobile: description of the active chapter */}
      <p className="mt-3 text-[13px] leading-relaxed text-ink-500 sm:hidden">{L.chapters[chapterIndex]?.desc}</p>
    </figure>
  );
}

// Tracks the active chapter while the timeline plays (re-renders on chapter
// boundaries only, not every frame).
function useChapter(run, initial) {
  const [chapter, setChapter] = useState(initial);
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
