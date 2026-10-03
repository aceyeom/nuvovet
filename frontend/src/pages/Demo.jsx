import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, FileText, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { ProductLockup } from '../components/NuvovetLogo';
import { DurIsland } from '../components/dur/DurIsland';
import { useDurMonitor } from '../components/dur/useDurMonitor';
import { analyzeRegimen, SEVERITY_RANK, topSeverity } from '../components/dur/findings';
import {
  EmrTitleBar, EmrMenuBar, EmrStatusBar, WaitingList, PatientBanner, EmrTabs,
  RxSearch, RxTable, RxToolbar, SoapPanel, LabsPanel, HistoryPanel, VitalsStrip,
  patientName, loc,
} from '../components/emr/EmrUI';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { getDemoPatients } from '../data/breedProfiles';
import { getDrugById } from '../data/drugDatabase';
import { makeRxLine } from '../data/emrCatalog';
import { useI18n, LangToggle } from '../i18n';

const GUIDE_KEY = 'nuvovet-demo-guide-v2';
const FAVORITES = ['gabapentin', 'omeprazole', 'amoxicillin', 'maropitant', 'prednisolone', 'meloxicam'];

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

function useClock(lang) {
  const fmt = useCallback(
    () => new Date().toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    [lang],
  );
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 30000);
    return () => clearInterval(id);
  }, [fmt]);
  return now;
}

// ── First-run guide (spotlight coach marks) ──────────────────────
function Guide({ step, steps, onNext, onSkip }) {
  const { t } = useI18n();
  const [rect, setRect] = useState(null);
  const current = steps[step];

  useLayoutEffect(() => {
    if (!current) return undefined;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${current.target}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
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
  const cardW = Math.min(340, vw - 24);
  let top = rect ? rect.top + rect.height + pad + 12 : vh / 2 - 90;
  if (rect && top + 200 > vh) top = Math.max(12, rect.top - pad - 12 - 190);
  let left = rect ? rect.left + rect.width / 2 - cardW / 2 : vw / 2 - cardW / 2;
  left = Math.max(12, Math.min(left, vw - cardW - 12));

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={current.title}>
      {rect ? (
        <div
          className="pointer-events-none absolute ring-2 ring-dur-300 transition-all duration-300 ease-out-expo"
          style={{
            borderRadius: current.radius ?? 16,
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(6,10,18,0.58)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink-950/60" />
      )}
      <div
        className="absolute animate-sheet-up rounded-2xl bg-white p-4 shadow-lift ring-1 ring-ink-900/5"
        style={{ top, left, width: cardW }}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-dur-50 px-2 py-0.5 text-[11px] font-bold text-dur-700 tnum">{step + 1} / {steps.length}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">{current.kicker}</span>
        </div>
        <p className="mt-2 text-[15px] font-bold tracking-[-0.01em] text-ink-900">{current.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{current.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onSkip} className="text-[12.5px] font-medium text-ink-400 hover:text-ink-700">{t.demoX.skip}</button>
          <button type="button" onClick={onNext} className="inline-flex h-9 items-center rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white hover:bg-ink-800">
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
      <button type="button" aria-label={t.close} className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-6xl animate-sheet-up flex-col overflow-hidden rounded-t-3xl bg-[#f7f8fa] shadow-window sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-ink-200/70 bg-white px-4 py-3 sm:px-6">
          <ProductLockup product="dur" size="sm" />
          <span className="hidden text-[12.5px] text-ink-400 sm:inline">·</span>
          <span className="hidden truncate text-[13px] font-medium text-ink-600 sm:inline">{t.results.durReport} — {patientName(entry, lang)}</span>
          <button type="button" onClick={onClose} aria-label={t.close} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900">
            <X size={18} />
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
  const { t, lang } = useI18n();
  const patients = useMemo(() => getDemoPatients(), []);
  const [selectedId, setSelectedId] = useState('golden_retriever');
  const [charts, setCharts] = useState(() => Object.fromEntries(patients.map((e) => [e.id, initialLines(e)])));
  const [tab, setTab] = useState('rx');
  const [reportOpen, setReportOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(() => (readGuideDone() ? -1 : 0));
  const [toast, setToast] = useState(null);
  const clock = useClock(lang);

  const entry = patients.find((e) => e.id === selectedId) || patients[0];
  const lines = charts[entry.id];
  const species = entry.species;

  const drugs = useMemo(
    () => lines.map((l) => ({ ...l.drug, dosePerKg: Number(l.qty) > 0 ? Number(l.qty) : undefined })),
    [lines],
  );
  const patient = useMemo(() => ({ ...entry.profile, breed: entry.breed, name: patientName(entry, lang) }), [entry, lang]);

  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

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

  // Per-patient DUR state for the waiting list (current chart uses the live monitor)
  const durTone = useMemo(() => {
    const out = {};
    for (const e of patients) {
      if (e.id === entry.id) continue;
      const ds = charts[e.id].map((l) => ({ ...l.drug, dosePerKg: Number(l.qty) || undefined }));
      const { findings } = analyzeRegimen({ drugs: ds, species: e.species, patient: { ...e.profile, breed: e.breed } });
      out[e.id] = topSeverity(findings) || 'clear';
    }
    const live = monitor.findings.filter((f) => !f.reviewed);
    out[entry.id] = live.length ? topSeverity(live.map((f) => f.raw)) : monitor.findings.length ? 'reviewed' : 'clear';
    return out;
  }, [patients, charts, entry.id, monitor.findings]);

  // Table highlighting driven by the island
  const drugTone = useMemo(() => {
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

  const resetPatient = () => {
    setCharts((c) => ({ ...c, [entry.id]: initialLines(entry) }));
    showToast(t.demoX.resetDone);
  };

  const abnormalLabs = Object.values(entry.profile.labResults).filter((l) => l.status !== 'normal').length;
  const rxTone = topSeverity(monitor.findings.filter((f) => !f.reviewed).map((f) => f.raw));
  const tabs = [
    { id: 'soap', label: t.emr.tabs.soap },
    { id: 'rx', label: t.emr.tabs.rx, badge: lines.length, dot: rxTone || undefined },
    { id: 'labs', label: t.emr.tabs.labs, badge: abnormalLabs ? `${abnormalLabs} H/L` : undefined },
    { id: 'history', label: t.emr.tabs.history },
  ];

  const dateLabel = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
  });

  const guideSteps = t.demoX.guideSteps.map((s, i) => ({
    ...s,
    target: ['emr', 'island', 'scenario'][i],
    pad: i === 1 ? 6 : 8,
    radius: i === 1 ? 999 : i === 2 ? 999 : 16,
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

  return (
    <div className="flex h-[100dvh] flex-col bg-ink-50">
      {/* nuvovet product bar — what you are looking at */}
      <header className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-ink-200/70 bg-white/90 px-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link to="/" aria-label={t.demoX.backHome} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900">
            <ArrowLeft size={18} />
          </Link>
          <ProductLockup product="dur" size="sm" />
          <span className="hidden items-center gap-1.5 rounded-full bg-dur-50 px-2 py-0.5 text-[11px] font-semibold text-dur-700 ring-1 ring-inset ring-dur-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-dur-500" />
            {t.demoX.badge}
          </span>
          <span className="hidden truncate text-[12.5px] text-ink-500 xl:inline">{t.demoX.desc}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button type="button" onClick={startGuide} className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-ink-600 hover:bg-ink-100">
            <HelpCircle size={15} /> <span className="hidden md:inline">{t.demoX.guide}</span>
          </button>
          <LangToggle />
          <button type="button" onClick={() => setReportOpen(true)} className="hidden h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-ink-800 hover:bg-ink-50 sm:inline-flex">
            <FileText size={14} /> {t.demoX.report}
          </button>
          <button type="button" onClick={() => setAccessOpen(true)} className="hidden h-9 items-center rounded-full bg-ink-900 px-3.5 text-[12.5px] font-semibold text-white hover:bg-ink-800 md:inline-flex">
            {t.nav.requestAccess}
          </button>
        </div>
      </header>

      {/* Simulated clinic EMR */}
      <div className="flex min-h-0 flex-1 flex-col sm:p-3 lg:p-4">
        <div
          data-tour="emr"
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-emr-bg sm:rounded-xl sm:shadow-window"
        >
          <EmrTitleBar chrome clock={clock} />

          {/* nuvovet DUR island, docked in the title bar like a Dynamic Island */}
          <div className="pointer-events-none absolute inset-x-0 top-[2px] z-40 flex justify-center px-2">
            <div className="pointer-events-auto" data-tour="island">
              <DurIsland {...island} onOpenReport={() => setReportOpen(true)} />
            </div>
          </div>

          <EmrMenuBar
            active={1}
            right={
              <button type="button" onClick={resetPatient} className="hidden shrink-0 items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium text-emr-muted hover:bg-emr-head hover:text-emr-text sm:inline-flex">
                <RotateCcw size={12} /> {t.demoX.resetChart}
              </button>
            }
          />

          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-[272px] shrink-0 border-r border-emr-line bg-white lg:block">
              <WaitingList
                patients={patients}
                selectedId={entry.id}
                onSelect={(id) => { setSelectedId(id); setReportOpen(false); }}
                durTone={durTone}
                dateLabel={dateLabel}
              />
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
              <PatientBanner entry={entry} patients={patients} onSelectPatient={setSelectedId} />
              <EmrTabs tabs={tabs} active={tab} onChange={setTab} />

              <div className="emr-scroll min-h-0 flex-1 overflow-y-auto">
                <div className="flex gap-4 p-3 sm:p-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    {tab === 'rx' && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[13.5px] font-bold text-emr-text">{t.emr.rx.title}</h3>
                            <p className="hidden text-[11.5px] text-emr-muted sm:block">{t.emr.rx.subtitle}</p>
                          </div>
                          <RxToolbar onPrint={() => setReportOpen(true)} onSave={() => showToast(t.demoX.saved)} />
                        </div>
                        <RxSearch
                          species={species}
                          existingIds={lines.map((l) => l.drugId)}
                          onAdd={addDrug}
                          scenario={scenario}
                          favorites={favorites}
                        />
                        <RxTable
                          lines={lines}
                          txItems={entry.profile.visit.tx}
                          weight={entry.profile.weight}
                          drugTone={drugTone}
                          focusIds={focusIds}
                          focusTone={focus?.severity}
                          onChange={(lineId, patch) => updateLines((cur) => cur.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)))}
                          onRemove={(lineId) => updateLines((cur) => cur.filter((l) => l.lineId !== lineId))}
                        />
                      </>
                    )}
                    {tab === 'soap' && <SoapPanel entry={entry} />}
                    {tab === 'labs' && <LabsPanel entry={entry} />}
                    {tab === 'history' && <HistoryPanel entry={entry} />}
                  </div>

                  {/* Context rail (wide screens) */}
                  <aside className="hidden w-[300px] shrink-0 space-y-3 2xl:block">
                    <div className="rounded-md border border-emr-line bg-white p-3">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-emr-muted">{t.emr.soap.complaint}</p>
                      <p className="mt-0.5 text-[13px] font-semibold text-emr-text">{loc(entry.profile.visit.complaint, lang)}</p>
                      <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-emr-muted">{t.emr.soap.a}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-emr-text">{loc(entry.profile.visit.soap.a, lang)}</p>
                      <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-emr-muted">{t.emr.soap.p}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-emr-text">{loc(entry.profile.visit.soap.p, lang)}</p>
                    </div>
                    {tab !== 'soap' && <VitalsStrip entry={entry} />}
                    <div className="rounded-md border border-dashed border-dur-300 bg-dur-50/60 p-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-dur-700">{t.demoX.focusLabel}</p>
                      <p className="mt-0.5 text-[13px] font-semibold text-ink-900">{loc(entry.focus, lang)}</p>
                      {scenario && <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{loc(scenario.hint, lang)}</p>}
                    </div>
                  </aside>
                </div>
              </div>
            </main>
          </div>

          <EmrStatusBar patientsToday={patients.length} />
        </div>
      </div>

      {/* Mobile report button */}
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="fixed bottom-11 right-3 z-30 inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white shadow-lift sm:hidden"
      >
        <FileText size={15} /> {t.demoX.report}
      </button>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 animate-sheet-up items-center gap-2 rounded-full bg-ink-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-lift">
          <CheckCircle2 size={15} className="text-island-clear" /> {toast}
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
