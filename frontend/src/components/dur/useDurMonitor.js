import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeRegimen, SEVERITY_RANK, topSeverity } from './findings';
import { describeFinding, fmt } from './describe';

/**
 * Live DUR monitor behind the island in the EMR demo.
 *
 *  • Re-screens the open chart whenever drugs, doses or patient context
 *    change (short "checking" beat so the island visibly reacts).
 *  • Auto-expands only for findings that are *new* since the last screen
 *    — opening a chart never pops a card, editing one does.
 *  • Auto-collapses back to a glance after a few seconds unless hovered
 *    or opened deliberately.
 *  • Acknowledgements are remembered per patient for the session.
 */
const CHECK_MS = 620;
const AUTO_COLLAPSE_MS = 9000;
const FLASH_MS = 2400;

export function useDurMonitor({ drugs, species, patient, patientKey, t, lang, onApplyResolution }) {
  const signature = useMemo(
    () => JSON.stringify([
      patientKey,
      species,
      drugs.map((d) => [d.id, d.dosePerKg ?? null]),
      patient?.conditions,
      patient?.allergies,
      patient?.weight,
    ]),
    [patientKey, species, drugs, patient],
  );

  const [analysis, setAnalysis] = useState(() => analyzeRegimen({ drugs, species, patient }));
  const [phase, setPhase] = useState('ready');
  const [view, setView] = useState('compact');
  const [focusId, setFocusId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [ackVersion, setAckVersion] = useState(0);

  const ackMap = useRef(new Map()); // patientKey -> Set(findingId)
  const seenRef = useRef({ key: patientKey, ids: new Set(analysis.findings.map((f) => f.id)) });
  const hoverRef = useRef(false);
  const autoRef = useRef(false); // current expansion was automatic
  const collapseTimer = useRef(null);
  const flashTimer = useRef(null);

  const acknowledged = useMemo(() => {
    if (!ackMap.current.has(patientKey)) ackMap.current.set(patientKey, new Set());
    return ackMap.current.get(patientKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientKey, ackVersion]);

  const clearCollapse = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  };

  const scheduleCollapse = useCallback(() => {
    clearCollapse();
    collapseTimer.current = setTimeout(function tick() {
      if (hoverRef.current) {
        collapseTimer.current = setTimeout(tick, 1500);
        return;
      }
      if (autoRef.current) {
        setView('compact');
        autoRef.current = false;
      }
    }, AUTO_COLLAPSE_MS);
  }, []);

  // ── Re-screen on change ────────────────────────────────────────
  useEffect(() => {
    const switchedPatient = seenRef.current.key !== patientKey;
    if (switchedPatient) {
      setView('compact');
      setFocusId(null);
      autoRef.current = false;
      clearCollapse();
    }
    setPhase('checking');
    const timer = setTimeout(() => {
      const next = analyzeRegimen({ drugs, species, patient });
      setAnalysis(next);
      setPhase('ready');

      const prev = switchedPatient ? null : seenRef.current.ids;
      seenRef.current = { key: patientKey, ids: new Set(next.findings.map((f) => f.id)) };
      if (!prev) return; // opening a chart: glance only, never pop a card

      const ack = ackMap.current.get(patientKey) || new Set();
      const fresh = next.findings
        .filter((f) => !prev.has(f.id) && !ack.has(f.id))
        .sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
      if (fresh.length) {
        setFocusId(fresh[0].id);
        setView('expanded');
        autoRef.current = true;
        scheduleCollapse();
      } else {
        setView((v) => {
          if (v === 'expanded' && !next.findings.some((f) => f.id === focusIdRef.current)) return 'compact';
          return v;
        });
      }
    }, CHECK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;

  useEffect(() => () => { clearCollapse(); if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // ── Derived display models ─────────────────────────────────────
  const ctx = { t, lang, species, patientName: patient?.name };
  const sevLabel = (s) => t.island.severity[s] || s;

  const display = useMemo(
    () => analysis.findings.map((f) => ({ ...describeFinding(f, ctx), raw: f, reviewed: acknowledged.has(f.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysis, acknowledged, ackVersion, lang, species, patient?.name],
  );
  const unreviewed = display.filter((d) => !d.reviewed);

  const status = useMemo(() => {
    const I = t.island.ui;
    if (flash) return flash; // confirm the action first, then show the re-screen result
    if (phase === 'checking') return { tone: 'checking', title: drugs.length === 1 ? I.screeningOne : fmt(I.screening, { n: drugs.length }), detail: '' };
    if (drugs.length === 0) return { tone: 'idle', title: I.noMeds, detail: '' };
    if (unreviewed.length) {
      const sev = topSeverity(unreviewed.map((d) => d.raw));
      const top = unreviewed.find((d) => d.severity === sev) || unreviewed[0];
      return { tone: sev, title: sevLabel(sev), detail: top.drugsLabel || top.title, extra: unreviewed.length - 1 };
    }
    if (display.length) return { tone: 'reviewed', title: I.allReviewed, detail: fmt(I.reviewedCount, { n: display.length }) };
    return { tone: 'clear', title: I.noIssues, detail: drugs.length === 1 ? I.medsCountOne : fmt(I.medsCount, { n: drugs.length }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, flash, drugs.length, unreviewed, display, lang]);

  const focusIndex = display.findIndex((d) => d.id === focusId);
  const focus = focusIndex >= 0
    ? { ...display[focusIndex], severityLabel: sevLabel(display[focusIndex].severity), index: focusIndex, total: display.length }
    : null;

  const list = display.map((d) => ({ ...d, severityLabel: sevLabel(d.severity) }));

  const pairCount = (drugs.length * (drugs.length - 1)) / 2;
  const summary = {
    title: t.island.ui.noIssuesTitle,
    detail: pairCount === 1 ? t.island.ui.noIssuesDetailOne : fmt(t.island.ui.noIssuesDetail, { n: drugs.length, pairs: pairCount }),
    checks: t.island.ui.checks,
  };

  // ── Actions ────────────────────────────────────────────────────
  const showFlash = (f) => {
    setFlash(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  const toggle = () => {
    autoRef.current = false;
    clearCollapse();
    if (phase === 'checking' || drugs.length === 0) return;
    if (unreviewed.length === 1) {
      setFocusId(unreviewed[0].id);
      setView('expanded');
    } else if (display.length > 0) {
      setView('list');
    } else {
      setView('summary');
    }
  };

  const select = (id) => {
    autoRef.current = false;
    clearCollapse();
    setFocusId(id);
    setView('expanded');
  };

  const nav = (dir) => {
    if (!display.length) return;
    autoRef.current = false;
    clearCollapse();
    const i = focusIndex < 0 ? 0 : (focusIndex + dir + display.length) % display.length;
    setFocusId(display[i].id);
  };

  const collapse = () => {
    autoRef.current = false;
    clearCollapse();
    setView('compact');
  };

  const markAck = (id) => {
    const set = ackMap.current.get(patientKey) || new Set();
    set.add(id);
    ackMap.current.set(patientKey, set);
    setAckVersion((v) => v + 1);
  };

  const acknowledge = (id) => {
    markAck(id);
    autoRef.current = false;
    clearCollapse();
    const remaining = display.filter((d) => !d.reviewed && d.id !== id);
    if (remaining.length) {
      setFocusId(remaining[0].id);
    } else {
      setView('compact');
      showFlash({ tone: 'reviewed', title: t.island.ui.allReviewed, detail: fmt(t.island.ui.reviewedCount, { n: display.length }) });
    }
  };

  const resolve = (id) => {
    const d = display.find((x) => x.id === id);
    if (!d) return;
    const res = d.raw.resolution;
    autoRef.current = false;
    clearCollapse();
    // Dose changes don't remove an interaction from the engine's view —
    // record them as reviewed so the island settles.
    if (res?.type === 'dose') markAck(id);
    onApplyResolution?.(res, d.raw);
    setView('compact');
    showFlash({ tone: 'clear', title: t.island.ui.applied, detail: d.resolvedShort || d.suggestion });
  };

  const setHover = (h) => { hoverRef.current = h; };

  return {
    analysis,
    findings: display,
    unreviewedCount: unreviewed.length,
    phase,
    islandProps: {
      view,
      status,
      focus,
      list,
      summary,
      listHeading: display.length === 1 ? t.island.ui.findingsCountOne : fmt(t.island.ui.findingsCount, { n: display.length }),
      listFootnote: analysis.advisories ? fmt(t.island.ui.advisories, { n: analysis.advisories }) : t.island.ui.listFootnote,
      labels: t.island.ui,
      onToggle: toggle,
      onSelect: select,
      onNav: nav,
      onCollapse: collapse,
      onAck: acknowledge,
      onResolve: resolve,
      onHoverChange: setHover,
    },
    openFinding: select,
    acknowledge,
    resolve,
  };
}
