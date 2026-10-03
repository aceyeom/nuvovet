import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductLockup } from '../components/NuvovetLogo';
import { DurIsland } from '../components/dur/DurIsland';
import { useDurMonitor } from '../components/dur/useDurMonitor';
import { SEVERITY_RANK } from '../components/dur/findings';
import {
  EmrTitleBar, EmrMenuBar, EmrToolbar, EmrStatusBar, WaitingList, PatientInfo, EmrTabs,
  VisitStrip, RxSearch, RxGrid, RxMemo, RxHistory, OwnerPanel, SoapPanel, LabsPanel, HistoryPanel, EmrButton,
  patientName, loc,
} from '../components/emr/EmrUI';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { getDemoPatients } from '../data/breedProfiles';
import { getDrugById } from '../data/drugDatabase';
import { makeRxLine } from '../data/emrCatalog';
import { useI18n, LangToggle } from '../i18n';
import { usePageCanvas, CANVAS } from '../lib/usePageCanvas';

// ──────────────────────────────────────────────────────────────────
// /demo — nuvoDUR on top of a simulated clinic EMR.
//
//   dark bar     nuvoDUR: what this is, the scenario, guide, report
//   grey window  the clinic's EMR (a classic Windows desktop app)
//   island       nuvoDUR, docked across the EMR window's top edge
// ──────────────────────────────────────────────────────────────────

const GUIDE_KEY = 'nuvovet-demo-guide-v3';
const FAVORITES = ['gabapentin', 'omeprazole', 'amoxicillin', 'maropitant', 'prednisolone', 'meloxicam', 'trazodone'];

function readGuideDone() {
  try { return localStorage.getItem(GUIDE_KEY) === '1'; } catch { return false; }
}
function writeGuideDone() {
  try { localStorage.setItem(GUIDE_KEY, '1'); } catch { /* storage unavailable */ }
}

function initialLines(entry) {
  return entry.profile.rx
    .map((r) => {
      const line = makeRxLine(r.id, entry.species, { days: r.days });
      return line ? { ...line, chronic: Boolean(r.chronic) } : null;
    })
    .filter(Boolean);
}

function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function useClock(lang) {
  const fmt = useCallback(() => {
    const d = new Date();
    const wd = d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${isoDate(d)} (${wd}) ${time}`;
  }, [lang]);
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 20000);
    return () => clearInterval(id);
  }, [fmt]);
  return now;
}

function useElementWidth(ref) {
  const [w, setW] = useState(1000);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// ── First-run guide (spotlight coach marks) ──────────────────────
function Guide({ step, steps, onNext, onSkip }) {
  const { t } = useI18n();
  const [rect, setRect] = useState(null);
  const current = steps[step];

  useLayoutEffect(() => {
    if (!current) return undefined;
    const find = () => [...document.querySelectorAll(`[data-tour="${current.target}"]`)].find((n) => n.offsetParent !== null);
    const measure = () => {
      const el = find();
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    find()?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    measure();
    const id = setInterval(measure, 250); // follows island morphs / layout shifts
    window.addEventListener('resize', measure);
    return () => { clearInterval(id); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, current?.target]);

  if (!current) return null;
  const pad = current.pad ?? 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cardW = Math.min(352, vw - 24);
  let top = rect ? rect.top + rect.height + pad + 12 : vh / 2 - 90;
  if (rect && top + 210 > vh) top = Math.max(12, rect.top - pad - 12 - 200);
  if (rect && rect.height > vh * 0.6) top = Math.min(vh - 230, Math.max(rect.top + 90, 80));
  let left = rect ? rect.left + rect.width / 2 - cardW / 2 : vw / 2 - cardW / 2;
  left = Math.max(12, Math.min(left, vw - cardW - 12));

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={current.title}>
      {rect ? (
        <div
          className="pointer-events-none absolute ring-2 ring-dur-300 transition-all duration-300 ease-out-expo"
          style={{
            borderRadius: current.radius ?? 6,
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(6,10,18,0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink-950/60" />
      )}
      <div
        className="absolute animate-sheet-up rounded-2xl bg-island-bg p-5 text-white shadow-island ring-1 ring-white/10"
        style={{ top, left, width: cardW }}
      >
        <div className="kicker flex items-baseline gap-3 text-[10.5px]">
          <span className="text-island-info tnum">{String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
          <span className="text-white/45">{current.kicker}</span>
        </div>
        <p className="mt-2.5 text-[16px] font-semibold tracking-[-0.015em]">{current.title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{current.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={onSkip} className="h-9 rounded-full px-1 text-[12.5px] font-medium text-white/45 hover:text-white">{t.demoX.skip}</button>
          <button type="button" onClick={onNext} className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-ink-900 hover:bg-white/90">
            {step === steps.length - 1 ? t.demoX.start : t.demoX.next}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full report sheet ────────────────────────────────────────────
function ReportSheet({ open, onClose, entry, analysis, drugs, contextFindings }) {
  const { t, lang } = useI18n();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const p = entry.profile;
  const flaggedLabs = Object.entries(p.labResults)
    .filter(([, l]) => l.status !== 'normal')
    .map(([key, l]) => ({ key, ...l }));
  const patientInfo = {
    name: patientName(entry, lang),
    species: entry.species,
    breed: lang === 'ko' ? entry.breedKo : entry.breed,
    weight: p.weight,
    conditions: p.conditions,
    flaggedLabs,
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={t.results.durReport}>
      <button type="button" aria-label={t.close} className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-6xl animate-sheet-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-window sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-ink-200/70 bg-white px-4 py-3 sm:px-6">
          <ProductLockup product="dur" size="sm" />
          <button type="button" onClick={onClose} className="ml-auto h-9 rounded-full px-3 text-[13px] font-semibold text-ink-600 hover:bg-ink-100 hover:text-ink-900">
            {t.close}
          </button>
        </div>
        <div className="emr-scroll min-h-0 flex-1 overflow-y-auto">
          <ResultsDisplay
            results={analysis.results}
            patientInfo={patientInfo}
            drugs={drugs}
            species={entry.species}
            embedded
            isFullSystem
            contextFindings={contextFindings}
            onBack={onClose}
            onNewAnalysis={onClose}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function Demo() {
  usePageCanvas(CANVAS.dark);
  const { t, lang } = useI18n();
  const patients = useMemo(() => getDemoPatients(), []);
  // /demo?patient=<id> opens straight on that chart (linked from the landing page)
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(() => {
    const id = searchParams.get('patient');
    return patients.some((e) => e.id === id) ? id : 'golden_retriever';
  });
  const [charts, setCharts] = useState(() => Object.fromEntries(patients.map((e) => [e.id, initialLines(e)])));
  const [tab, setTab] = useState('rx');
  const [selectedLine, setSelectedLine] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(() => (readGuideDone() ? -1 : 0));
  const [toast, setToast] = useState(null);
  const clock = useClock(lang);
  const mainRef = useRef(null);
  const mainW = useElementWidth(mainRef);

  const entry = patients.find((e) => e.id === selectedId) || patients[0];
  const lines = charts[entry.id];
  const species = entry.species;

  const drugs = useMemo(
    () => lines.map((l) => ({ ...l.drug, dosePerKg: Number(l.qty) > 0 ? Number(l.qty) : undefined })),
    [lines],
  );
  const patient = useMemo(() => ({ ...entry.profile, breed: entry.breed, name: patientName(entry, lang) }), [entry, lang]);

  const toastTimer = useRef(null);
  const showToast = (word, msg, tone = 'clear') => {
    setToast({ word, msg, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => { setSelectedLine(null); }, [entry.id]);

  const updateLines = (fn) => setCharts((c) => ({ ...c, [entry.id]: fn(c[entry.id]) }));

  const applyResolution = useCallback((res) => {
    if (!res) return;
    setCharts((c) => {
      const cur = c[entry.id];
      let next = cur;
      if (res.type === 'replace') {
        next = cur.map((l) => {
          if (l.drugId !== res.fromId) return l;
          const repl = makeRxLine(res.toId, species, { days: l.days, isNew: true });
          return repl || l;
        });
      } else if (res.type === 'remove') {
        next = cur.filter((l) => l.drugId !== res.fromId);
      } else if (res.type === 'dose') {
        next = cur.map((l) => {
          if (l.drugId !== res.drugId) return l;
          const base = Number(l.qty) || l.drug.defaultDose?.[species] || 0;
          const qty = res.value != null ? res.value : +(base * res.factor).toFixed(3);
          return { ...l, qty };
        });
      } else if (res.type === 'add') {
        const line = makeRxLine(res.toId, species, { isNew: true });
        if (line && !cur.some((l) => l.drugId === res.toId)) next = [...cur, line];
      }
      return { ...c, [entry.id]: next };
    });
  }, [entry.id, species]);

  const monitor = useDurMonitor({ drugs, species, patient, patientKey: entry.id, t, lang, onApplyResolution: applyResolution });
  const island = monitor.islandProps;

  // nuvoDUR overlay on the EMR grid: unreviewed findings, strongest severity per drug
  const overlay = useMemo(() => {
    const out = {};
    for (const f of monitor.findings) {
      if (f.reviewed) continue;
      for (const d of f.raw.drugs || []) {
        if (!out[d.id] || SEVERITY_RANK[f.severity] > SEVERITY_RANK[out[d.id]]) out[d.id] = f.severity;
      }
    }
    return out;
  }, [monitor.findings]);
  const focus = island.view === 'expanded' ? island.focus : null;
  const focusIds = focus ? (focus.raw?.drugs || []).map((d) => d.id) : [];

  const scenarioDrug = entry.profile.scenario ? getDrugById(entry.profile.scenario.add) : null;
  const scenario = scenarioDrug ? { ...entry.profile.scenario, drug: scenarioDrug } : null;
  const scenarioReady = scenario && !lines.some((l) => l.drugId === scenario.drug.id);
  const favorites = FAVORITES.map(getDrugById).filter(Boolean);

  const addDrug = (drug) => {
    const isScenario = scenario && drug.id === scenario.drug.id;
    const line = makeRxLine(drug, species, {
      isNew: true,
      qty: isScenario ? scenario.qty : undefined,
      days: isScenario ? scenario.days : undefined,
    });
    if (line) updateLines((cur) => (cur.some((l) => l.drugId === line.drugId) ? cur : [...cur, line]));
  };
  const runScenario = () => {
    if (!scenario) return;
    setTab('rx');
    addDrug(scenario.drug);
  };

  const resetPatient = () => {
    setCharts((c) => ({ ...c, [entry.id]: initialLines(entry) }));
    setSelectedLine(null);
    showToast(t.demoX.savedWord, t.demoX.resetDone);
  };
  const deleteSelected = () => {
    if (!selectedLine) return;
    updateLines((cur) => cur.filter((l) => l.lineId !== selectedLine));
    setSelectedLine(null);
  };

  const abnormalLabs = Object.values(entry.profile.labResults).filter((l) => l.status !== 'normal').length;
  const tabs = [
    { id: 'soap', label: t.emr.tabs.soap },
    { id: 'rx', label: t.emr.tabs.rx, count: lines.length + (entry.profile.visit.tx?.length || 0) },
    { id: 'labs', label: t.emr.tabs.labs, count: abnormalLabs ? `H/L ${abnormalLabs}` : undefined },
    { id: 'history', label: t.emr.tabs.history },
  ];

  const today = isoDate();
  const weekday = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'short' });
  const density = mainW >= 960 ? 'wide' : mainW >= 700 ? 'mid' : 'narrow';

  const guideSteps = t.demoX.guideSteps.map((s, i) => ({
    ...s,
    target: ['emr', 'island', 'scenario'][i],
    pad: i === 0 ? 4 : 6,
    radius: i === 0 ? 4 : 999,
  }));
  const startGuide = () => {
    setSelectedId('golden_retriever');
    setTab('rx');
    setGuideStep(0);
  };
  const nextGuide = () => {
    if (guideStep >= guideSteps.length - 1) { setGuideStep(-1); writeGuideDone(); }
    else setGuideStep((s) => s + 1);
  };
  const skipGuide = () => { setGuideStep(-1); writeGuideDone(); };

  const contextFindings = monitor.findings.filter((f) => f.kind !== 'interaction');

  const scenarioButton = (place) => scenario && (
    <button
      type="button"
      data-tour="scenario"
      data-place={place}
      onClick={runScenario}
      disabled={!scenarioReady}
      className="group inline-flex min-w-0 items-center gap-2.5 rounded-full px-3 py-1.5 text-left ring-1 ring-inset ring-white/15 transition-colors enabled:hover:bg-white/[0.06] enabled:hover:ring-island-info/50 disabled:opacity-45"
    >
      <span className="kicker shrink-0 text-[10px] text-island-info">{t.demoX.scenario}</span>
      <span className="truncate text-[12.5px] font-medium text-white/85">{loc(scenario.hint, lang)}</span>
      <span aria-hidden="true" className="shrink-0 text-[12.5px] text-white/40 transition-transform group-enabled:group-hover:translate-x-0.5 group-enabled:group-hover:text-white">→</span>
    </button>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-[#05070D]">
      {/* nuvoDUR bar — what you are looking at, and how to drive it */}
      <header className="relative z-30 shrink-0 border-b border-white/[0.07] bg-[#05070D] text-white">
        <div className="flex h-12 items-center justify-between gap-3 px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/" aria-label={t.demoX.backHome} className="flex h-9 items-center rounded-full px-2.5 text-[13px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white">
              ←<span className="ml-1.5 hidden sm:inline">nuvovet</span>
            </Link>
            <span className="h-4 w-px bg-white/15" aria-hidden="true" />
            <ProductLockup product="dur" size="sm" tone="dark" />
            <span className="kicker hidden text-[10px] text-white/40 sm:inline">{t.demoX.badge}</span>
            <span className="ml-2 hidden min-w-0 lg:flex">{scenarioButton('bar')}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <button type="button" onClick={startGuide} className="h-9 rounded-full px-3 text-[12.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white">
              {t.demoX.guide}
            </button>
            <LangToggle tone="dark" />
            <button type="button" onClick={() => setReportOpen(true)} className="hidden h-9 rounded-full px-3 text-[12.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex sm:items-center">
              {t.demoX.report}
            </button>
            <button type="button" onClick={() => setAccessOpen(true)} className="hidden h-9 items-center rounded-full bg-white px-4 text-[12.5px] font-semibold text-ink-900 transition-colors hover:bg-white/90 md:inline-flex">
              {t.nav.requestAccess}
            </button>
          </div>
        </div>
        {scenario && <div className="no-scrollbar flex overflow-x-auto px-2 pb-2 lg:hidden">{scenarioButton('strip')}</div>}
      </header>

      {/* Stage: the clinic's EMR window, with nuvoDUR docked on top */}
      <div className="relative flex min-h-0 flex-1 flex-col bg-[radial-gradient(120%_80%_at_50%_0%,#1a2333_0%,#0b111b_45%,#05070D_100%)] sm:px-3 sm:pb-3 sm:pt-6 lg:px-5 lg:pb-4 lg:pt-7">
        <div
          data-tour="emr"
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-[#7D8794] bg-emr-bg shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] sm:border"
        >
          <EmrTitleBar docTitle={`${t.emr.toolbar[1].label} — ${entry.profile.name} (${entry.profile.animalChartId})`} />
          <div className="hidden sm:block">
            <EmrMenuBar />
          </div>
          <EmrToolbar
            active="consult"
            compact={mainW < 900}
            right={
              <>
                <EmrButton onClick={resetPatient} className="hidden md:inline-flex">{t.emr.rx.loadPrev}</EmrButton>
                <EmrButton onClick={() => setReportOpen(true)} className="sm:hidden">{t.demoX.report}</EmrButton>
              </>
            }
          />

          <div className="flex min-h-0 flex-1 gap-[3px] p-[3px]">
            <aside className="hidden w-[248px] shrink-0 flex-col gap-[3px] lg:flex">
              <div className="min-h-0 flex-1">
                <WaitingList
                  patients={patients}
                  selectedId={entry.id}
                  onSelect={(id) => { setSelectedId(id); setReportOpen(false); }}
                  dateLabel={`${today} (${weekday})`}
                />
              </div>
              <OwnerPanel entry={entry} />
            </aside>

            <main ref={mainRef} className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <PatientInfo
                entry={entry}
                patients={patients}
                onSelectPatient={setSelectedId}
                density={density}
                photoSize={density === 'narrow' ? 64 : 84}
              />
              <div className="flex min-h-0 flex-1 flex-col border border-emr-line bg-emr-bg">
                <EmrTabs tabs={tabs} active={tab} onChange={setTab} className="bg-[#E9ECF0]" />
                <div className="emr-scroll min-h-0 flex-1 overflow-y-auto bg-white p-1.5">
                  {tab === 'rx' && (
                    <div className="space-y-1.5">
                      <VisitStrip entry={entry} dateLabel={today} />
                      <RxSearch species={species} existingIds={lines.map((l) => l.drugId)} onAdd={addDrug} favorites={favorites} />
                      <RxGrid
                        lines={lines}
                        txItems={entry.profile.visit.tx}
                        weight={entry.profile.weight}
                        overlay={overlay}
                        focusIds={focusIds}
                        columns={mainW >= 1000 ? 'full' : mainW >= 600 ? 'mid' : 'compact'}
                        selectedLineId={selectedLine}
                        onSelectLine={setSelectedLine}
                        onChange={(lineId, patch) => updateLines((cur) => cur.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)))}
                        onRemove={(lineId) => updateLines((cur) => cur.filter((l) => l.lineId !== lineId))}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EmrButton onClick={() => document.getElementById('rx-search')?.focus()}>{t.emr.rx.addRow}</EmrButton>
                        <EmrButton onClick={deleteSelected} disabled={!selectedLine}>{t.emr.rx.deleteRow}</EmrButton>
                        <EmrButton onClick={resetPatient} className="md:hidden">{t.emr.rx.loadPrev}</EmrButton>
                        <span className="ml-auto" />
                        <EmrButton onClick={() => showToast(t.demoX.noteWord, t.demoX.printDisabled, 'info')}>{t.emr.rx.print}</EmrButton>
                        <EmrButton primary onClick={() => showToast(t.demoX.savedWord, t.demoX.saved)}>{t.emr.rx.save}</EmrButton>
                      </div>
                      <RxMemo entry={entry} />
                      <RxHistory entry={entry} />
                    </div>
                  )}
                  {tab === 'soap' && <SoapPanel entry={entry} dateLabel={today} />}
                  {tab === 'labs' && <LabsPanel entry={entry} dateLabel={today} />}
                  {tab === 'history' && <HistoryPanel entry={entry} />}
                </div>
              </div>
            </main>
          </div>

          <EmrStatusBar clock={clock} patientsToday={patients.length} />
        </div>

        {/* nuvoDUR island — docked across the EMR window's top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-[3px] z-40 flex justify-center px-2 sm:top-[6px] lg:top-[7px]">
          <div className="pointer-events-auto" data-tour="island">
            <DurIsland {...island} onOpenReport={() => setReportOpen(true)} />
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-8 left-1/2 z-[70] flex -translate-x-1/2 animate-sheet-up items-center gap-3 whitespace-nowrap rounded-full bg-island-bg px-4 py-2.5 text-[13px] text-white shadow-island ring-1 ring-white/10">
          <span className={`kicker text-[10.5px] ${toast.tone === 'info' ? 'text-island-info' : 'text-island-clear'}`}>{toast.word}</span>
          <span className="text-white/85">{toast.msg}</span>
        </div>
      )}

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        entry={entry}
        analysis={monitor.analysis}
        drugs={drugs}
        contextFindings={contextFindings}
      />
      <RequestAccessModal isOpen={accessOpen} onClose={() => setAccessOpen(false)} />
      {guideStep >= 0 && <Guide step={guideStep} steps={guideSteps} onNext={nextGuide} onSkip={skipGuide} />}
    </div>
  );
}
