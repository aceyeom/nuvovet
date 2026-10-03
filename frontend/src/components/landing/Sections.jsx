import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ShieldCheck, Activity, Layers, Scale, RefreshCcw, Ban, Timer,
  BookOpen, FileText, Paperclip, Send, Lock, MousePointerClick, ListChecks, Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { ProductGlyph, ProductLockup, ProductTag } from '../NuvovetLogo';
import { DurIsland } from '../dur/DurIsland';
import { analyzeRegimen } from '../dur/findings';
import { describeFinding, fmt } from '../dur/describe';
import { getDrugById } from '../../data/drugDatabase';
import { getDemoPatients } from '../../data/breedProfiles';
import { formatWon, productLabel, lineMetrics, makeRxLine, TX_ITEMS } from '../../data/emrCatalog';

// ── Reveal on scroll ─────────────────────────────────────────────
export function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out-expo ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

function SectionIntro({ kicker, product, title, desc, center = false, tone = 'light', className = '' }) {
  const kickerColor = product === 'claims' ? 'text-claims-600' : product === 'dur' ? 'text-dur-600' : 'text-ink-400';
  return (
    <Reveal className={`${center ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      <p className={`inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] ${tone === 'dark' ? 'text-white/50' : kickerColor}`}>
        {product && <ProductGlyph product={product} size={18} />}
        {kicker}
      </p>
      <h2 className={`mt-4 text-balance text-[30px] font-bold leading-[1.12] tracking-[-0.035em] sm:text-[42px] ${tone === 'dark' ? 'text-white' : 'text-ink-900'}`}>
        {title}
      </h2>
      {desc && <p className={`mt-4 text-pretty text-[16px] leading-relaxed ${tone === 'dark' ? 'text-white/60' : 'text-ink-500'} ${center ? 'mx-auto max-w-xl' : ''}`}>{desc}</p>}
    </Reveal>
  );
}

// ── Stats ─────────────────────────────────────────────────────────
function CountUp({ value, suffix = '' }) {
  const [ref, visible] = useReveal(0.4);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return undefined;
    const end = Number(value);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setN(end); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1100);
      setN(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, value]);
  return <span ref={ref} className="tnum">{n}{suffix}</span>;
}

export function TrustStats() {
  const { t } = useI18n();
  const L = t.landing;
  const stats = [
    { v: 877, s: '+', label: L.statsProducts },
    { v: 10, s: '', label: L.statsRules },
    { v: 8, s: '', label: L.statsEngines },
    { v: 2, s: '', label: L.statsSpecies },
  ];
  return (
    <section className="border-y border-ink-200/70 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 divide-ink-200/70 md:grid-cols-4 md:divide-x">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-2 py-8 text-center md:py-10 ${i < 2 ? 'border-b border-ink-200/70 md:border-b-0' : ''} ${i % 2 === 0 ? 'border-r border-ink-200/70 md:border-r-0' : ''}`}>
              <p className="text-[34px] font-bold tracking-[-0.04em] text-ink-900 sm:text-[44px]"><CountUp value={s.v} suffix={s.s} /></p>
              <p className="mt-1 text-[12.5px] font-medium text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="flex items-center justify-center gap-2 border-t border-ink-200/70 py-4 text-center text-[12.5px] text-ink-500">
          <BookOpen size={14} className="shrink-0 text-ink-400" /> {L.trustLine}
        </p>
      </div>
    </section>
  );
}

// ── Island models shared by the product + "how" sections ──────────
function useIslandSamples() {
  const { t, lang } = useI18n();
  return useMemo(() => {
    const buddy = getDemoPatients().find((p) => p.id === 'golden_retriever');
    const drugs = ['meloxicam', 'omeprazole', 'prednisolone'].map((id) => ({ ...getDrugById(id) }));
    const { findings } = analyzeRegimen({ drugs, species: 'dog', patient: { ...buddy.profile, breed: buddy.breed } });
    const f = describeFinding(findings[0], { t, lang, species: 'dog', patientName: buddy.profile.name });
    const I = t.island;
    return {
      glance: { tone: 'clear', title: 'nuvovet DUR', detail: fmt(I.ui.medsClear, { n: 4 }) },
      alert: { tone: 'critical', title: I.severity.critical, detail: f.drugsLabel, extra: 1 },
      focus: { ...f, severityLabel: I.severity[f.severity], index: 0, total: 2, reviewed: false },
      labels: I.ui,
    };
  }, [t, lang]);
}

const noop = () => {};

/** Purely illustrative UI — hidden from assistive tech and the tab order. */
function Decorative({ children, className = '' }) {
  return (
    // eslint-disable-next-line react/no-unknown-property
    <div aria-hidden="true" inert="" className={className}>{children}</div>
  );
}

/** Renders an island that fits its container width (no transform scaling, so text stays crisp). */
function FitIsland({ render }) {
  const ref = useRef(null);
  const [w, setW] = useState(436);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="flex w-full justify-center">
      {render(Math.max(260, w - 16))}
    </div>
  );
}

// ── Product family ───────────────────────────────────────────────
function Bullet({ children, product }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ink-700">
      <span className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${product === 'dur' ? 'bg-dur-100 text-dur-700' : 'bg-claims-100 text-claims-700'}`}>
        <Check size={11} strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

export function ProductFamily({ onWaitlist }) {
  const { t } = useI18n();
  const L = t.landing;
  const samples = useIslandSamples();
  return (
    <section id="products" className="relative scroll-mt-20 overflow-hidden bg-[#f7f8fa] py-20 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-clinical-grid opacity-60 mask-radial-fade" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionIntro kicker={L.productsKicker} title={L.productsTitle} desc={L.productsDesc} center />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* nuvovet DUR */}
          <Reveal className="group relative flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-ink-900/[0.06] shadow-card">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-dur-200/40 blur-3xl" />
            <div className="relative p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ProductLockup product="dur" size="lg" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-dur-50 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-dur-700 ring-1 ring-inset ring-dur-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-dur-500" /> {L.durStatus}
                </span>
              </div>
              <p className="mt-6 text-[21px] font-semibold leading-snug tracking-[-0.02em] text-ink-900">{L.durTagline}</p>
              <ul className="mt-5 space-y-2.5">
                {L.durBullets.map((b) => <Bullet key={b} product="dur">{b}</Bullet>)}
              </ul>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link to="/demo" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-white hover:bg-ink-800">
                  {L.durCta} <ArrowRight size={15} />
                </Link>
                <a href="#how" className="inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-dur-700 ring-1 ring-inset ring-dur-200 hover:bg-dur-50">
                  {L.durCta2}
                </a>
              </div>
            </div>
            <div className="relative mt-auto border-t border-ink-100 bg-gradient-to-b from-[#e9edf2] to-[#f3f5f8] px-5 pb-6 pt-5">
              <Decorative className="flex flex-col items-center gap-3">
                <DurIsland view="compact" status={samples.glance} labels={samples.labels} interactive={false} />
                <DurIsland view="compact" status={samples.alert} labels={samples.labels} interactive={false} />
              </Decorative>
              <div aria-hidden="true" className="mx-auto mt-5 max-w-sm space-y-2 opacity-70">
                <div className="h-2.5 w-3/4 rounded-full bg-white" />
                <div className="h-2.5 w-full rounded-full bg-white" />
                <div className="h-2.5 w-5/6 rounded-full bg-white" />
              </div>
            </div>
          </Reveal>

          {/* nuvovet Claims */}
          <Reveal delay={120} className="group relative flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-ink-900/[0.06] shadow-card">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-claims-200/50 blur-3xl" />
            <div className="relative p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ProductLockup product="claims" size="lg" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-claims-50 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-claims-700 ring-1 ring-inset ring-claims-200">
                  <span className="h-1.5 w-1.5 rounded-full border border-claims-500" /> {L.claimsStatus}
                </span>
              </div>
              <p className="mt-6 text-[21px] font-semibold leading-snug tracking-[-0.02em] text-ink-900">{L.claimsTagline}</p>
              <ul className="mt-5 space-y-2.5">
                {L.claimsBullets.map((b) => <Bullet key={b} product="claims">{b}</Bullet>)}
              </ul>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <button type="button" onClick={onWaitlist} className="inline-flex h-11 items-center gap-2 rounded-full bg-claims-600 px-5 text-[14px] font-semibold text-white hover:bg-claims-700">
                  {L.claimsCta} <ArrowRight size={15} />
                </button>
                <a href="#claims" className="inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-claims-700 ring-1 ring-inset ring-claims-200 hover:bg-claims-50">
                  {L.claimsCta2}
                </a>
              </div>
            </div>
            <div className="relative mt-auto border-t border-ink-100 bg-gradient-to-b from-claims-50 to-white px-5 pb-6 pt-5">
              <ClaimMini />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// Buddy's visit after the DUR fix — the same lines the hero and demo end on
function sampleClaim(lang) {
  const weight = 32.5;
  const rx = [
    makeRxLine('gabapentin', 'dog', { days: 30 }),
    makeRxLine('omeprazole', 'dog', { days: 30 }),
    makeRxLine('prednisolone', 'dog', { qty: 0.5, days: 7 }),
  ];
  const tx = ['consultRecheck', 'otoscopy', 'earFlush'].map((k) => ({ k, ...TX_ITEMS[k] }));
  const items = [
    ...tx.map((x) => ({ name: lang === 'ko' ? x.ko : x.en, price: x.price })),
    ...rx.map((l) => ({ name: productLabel(l.drug, lang), price: lineMetrics(l, weight).price })),
  ];
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  return { items, total: subtotal + Math.round(subtotal * 0.1) };
}

// Small claim document used on the product card
function ClaimMini() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const { total } = sampleClaim(lang);
  return (
    <div className="mx-auto max-w-sm">
      <div className="flex justify-center">
        <span className="inline-flex h-9 items-center gap-2 rounded-full bg-[#14102a] pl-2 pr-3.5 text-[12.5px] font-semibold text-white shadow-island">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-claims-500/25 text-claims-300"><FileText size={12} /></span>
          {L.claimsMockReady}
          <span className="font-normal text-white/55">{formatWon(total)}</span>
        </span>
      </div>
      <div aria-hidden="true" className="mt-4 rounded-xl bg-white p-3 ring-1 ring-claims-200/70">
        <div className="flex items-center justify-between text-[11px] font-semibold text-claims-700">
          <span>{L.claimsMockTitle}</span>
          <span className="text-ink-400">{L.claimsMockItems} · {L.claimsMockAttachments}</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {[0.9, 0.7, 0.8].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 rounded-full bg-ink-100" style={{ width: `${w * 70}%` }} />
              <span className="ml-auto h-2 w-10 rounded-full bg-claims-100" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-400">{L.claimsPreviewNote}</p>
    </div>
  );
}

// ── DUR · How the island works ───────────────────────────────────
function EmrSkeleton() {
  return (
    <div aria-hidden="true" className="px-4 pb-5 pt-16">
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink-900/[0.05]">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-amber-100" />
          <span className="h-2.5 w-20 rounded-full bg-ink-200" />
          <span className="h-2.5 w-12 rounded-full bg-ink-100" />
          <span className="ml-auto h-4 w-10 rounded bg-emr-blue/80" />
        </div>
        <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
          {[0.92, 0.74, 0.84].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${i === 1 ? 'bg-ink-300' : 'bg-emerald-400'}`} />
              <span className="h-2 rounded-full bg-ink-100" style={{ width: `${w * 100}%` }} />
              <span className="ml-auto h-2 w-8 shrink-0 rounded-full bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IslandStates() {
  const { t } = useI18n();
  const L = t.landing;
  const samples = useIslandSamples();
  const tiles = [
    <DurIsland key="g" view="compact" status={samples.glance} labels={samples.labels} interactive={false} />,
    <DurIsland key="a" view="compact" status={samples.alert} labels={samples.labels} interactive={false} />,
    <FitIsland
      key="e"
      render={(mw) => (
        <DurIsland view="expanded" focus={samples.focus} labels={samples.labels} interactive={false} maxWidth={mw} onResolve={noop} onAck={noop} onOpenReport={noop} onCollapse={noop} onNav={noop} />
      )}
    />,
  ];
  return (
    <section id="dur" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mb-14 flex flex-col items-start gap-5 border-b border-ink-100 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <ProductLockup product="dur" size="xl" />
          <p className="max-w-md text-[15px] leading-relaxed text-ink-500">{L.durTagline}</p>
        </Reveal>

        <div id="how" className="scroll-mt-24">
          <SectionIntro product="dur" kicker={`01 · ${L.islandKicker}`} title={L.islandTitle} desc={L.islandDesc} />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {L.islandStates.map((s, i) => (
              <Reveal key={s.title} delay={i * 110}>
                <div className="relative min-h-[300px] overflow-hidden rounded-3xl bg-[#eef1f5] ring-1 ring-ink-900/[0.06] md:min-h-[348px]">
                  <div className="absolute inset-x-0 top-0 h-11 border-b border-[#cfd5de] bg-[#e7ebf0]" />
                  <div className="absolute inset-x-0 top-0"><EmrSkeleton /></div>
                  {i === 2 && <div className="absolute inset-0 bg-ink-950/[0.04]" />}
                  <Decorative className={`flex justify-center px-2 ${i === 2 ? 'relative pb-4 pt-[3px]' : 'absolute inset-x-0 top-[3px]'}`}>{tiles[i]}</Decorative>
                </div>
                <div className="mt-4 flex items-baseline gap-3 px-1">
                  <span className="font-mono text-[12px] font-semibold text-dur-600 tnum">0{i + 1}</span>
                  <div>
                    <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink-900">{s.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-500">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── DUR · Engines (bento) ────────────────────────────────────────
function MiniPanel({ children, className = '' }) {
  return <div className={`mt-5 rounded-2xl bg-ink-50 p-3.5 ring-1 ring-inset ring-ink-900/[0.04] ${className}`}>{children}</div>;
}

function DDIMini() {
  const { t } = useI18n();
  return (
    <MiniPanel>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-lg bg-white px-2 py-1 text-[12px] font-semibold text-ink-800 ring-1 ring-ink-200">Meloxicam</span>
          <span className="text-[12px] font-bold text-red-500">⇄</span>
          <span className="rounded-lg bg-white px-2 py-1 text-[12px] font-semibold text-ink-800 ring-1 ring-ink-200">Prednisolone</span>
        </div>
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-red-600 ring-1 ring-inset ring-red-200">{t.island.severity.critical}</span>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-600">{t.island.rules['NSAID + Corticosteroid GI Risk'].summary}</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        {[[t.island.severity.critical, 'bg-red-500'], [t.island.severity.moderate, 'bg-amber-400'], [t.island.severity.minor, 'bg-yellow-300']].map(([l, c]) => (
          <span key={l} className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-1.5 text-[11px] font-medium text-ink-600 ring-1 ring-ink-200/70">
            <span className={`h-1.5 w-1.5 rounded-full ${c}`} />{l}
          </span>
        ))}
      </div>
    </MiniPanel>
  );
}

// Compact cumulative-load visual (same thresholds as the report panel:
// ≥40 % renal load with elevated creatinine escalates to critical).
const ORGAN_DEMO = [
  { name: 'Meloxicam', renal: 15, color: 'bg-dur-300' },
  { name: 'Enalapril', renal: 60, color: 'bg-dur-500' },
  { name: 'Gabapentin', renal: 80, color: 'bg-dur-700' },
];

function OrganMini() {
  const { t } = useI18n();
  const total = ORGAN_DEMO.reduce((s, d) => s + d.renal, 0);
  const max = 200;
  return (
    <MiniPanel>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{t.results.renalEliminationBurden}</span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">CREA 2.1 ↑</span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-200 tnum">{total}%</span>
        </span>
      </div>
      <div className="relative mt-3 h-3.5 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-ink-200/70">
        <div className="flex h-full">
          {ORGAN_DEMO.map((d) => (
            <span key={d.name} className={`h-full ${d.color} border-r border-white/70 last:border-0`} style={{ width: `${(d.renal / max) * 100}%` }} />
          ))}
        </div>
        <span className="absolute inset-y-0 w-px bg-red-500" style={{ left: `${(40 / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-400 tnum">
        <span>0</span><span className="text-red-500" style={{ marginLeft: `${(40 / max) * 100 - 6}%` }}>40%</span><span className="ml-auto">200%</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {ORGAN_DEMO.map((d) => (
          <span key={d.name} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11.5px] text-ink-600 ring-1 ring-ink-200/70">
            <span className={`h-2 w-2 rounded-sm ${d.color}`} />{d.name} <span className="font-mono text-ink-400 tnum">{d.renal}%</span>
          </span>
        ))}
      </div>
    </MiniPanel>
  );
}

function SpeciesMini() {
  return (
    <MiniPanel className="space-y-2">
      <div className="flex items-start gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-red-200">
        <Ban size={14} className="mt-0.5 shrink-0 text-red-500" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-600">Species hardstop · Cat</p>
          <p className="text-[12.5px] leading-snug text-ink-600">Acetaminophen — cats lack glucuronyl transferase.</p>
        </div>
      </div>
      <div className="flex items-start gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-amber-200">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-500" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">MDR1 · Ivermectin</p>
          <p className="text-[12.5px] leading-snug text-ink-600">Sheltie, ABCB1-1Δ on chart → switch to Selamectin.</p>
        </div>
      </div>
    </MiniPanel>
  );
}

function DosingMini() {
  const weight = 12;
  return (
    <MiniPanel>
      <div className="flex items-center justify-between text-[11.5px] text-ink-500">
        <span>Meloxicam · <b className="text-ink-800 tnum">{weight} kg</b></span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">CREA 2.4 ↑</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex-1 rounded-xl bg-white p-2.5 text-center ring-1 ring-ink-200/70">
          <p className="text-[10.5px] text-ink-400 line-through">0.2 mg/kg</p>
          <p className="font-mono text-[15px] font-semibold text-ink-400 line-through tnum">2.4 mg</p>
        </div>
        <ArrowRight size={14} className="shrink-0 text-ink-300" />
        <div className="flex-1 rounded-xl bg-dur-50 p-2.5 text-center ring-1 ring-dur-200">
          <p className="text-[10.5px] font-medium text-dur-700">0.1 mg/kg · ×0.5</p>
          <p className="font-mono text-[15px] font-semibold text-dur-800 tnum">1.2 mg</p>
        </div>
      </div>
    </MiniPanel>
  );
}

function WashoutMini() {
  const rows = [
    { name: 'Tramadol', t: 1.8 },
    { name: 'Trazodone', t: 3.5 },
  ];
  return (
    <MiniPanel>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700"><Timer size={12} /> Serotonergic switch · 5 × t½</p>
      <div className="mt-2.5 space-y-2">
        {rows.map((r) => {
          const hours = r.t * 5;
          return (
            <div key={r.name}>
              <div className="flex justify-between text-[11.5px] text-ink-600"><span className="font-medium">{r.name}</span><span className="tnum">t½ {r.t} h → {Math.round(hours)} h</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-white ring-1 ring-ink-200/70">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${(hours / 24) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </MiniPanel>
  );
}

function EngineCard({ icon: Icon, title, desc, children, className = '', delay = 0 }) {
  return (
    <Reveal delay={delay} className={`flex flex-col rounded-3xl bg-white p-6 ring-1 ring-ink-900/[0.06] shadow-card ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dur-50 text-dur-700 ring-1 ring-inset ring-dur-100">
          <Icon size={18} />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">{desc}</p>
        </div>
      </div>
      {children}
    </Reveal>
  );
}

export function Engines() {
  const { t } = useI18n();
  const L = t.landing;
  return (
    <section className="relative overflow-hidden bg-[#f7f8fa] py-20 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-clinical-grid opacity-50 mask-radial-fade" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionIntro product="dur" kicker={`02 · ${L.clinicalFeaturesLabel}`} title={L.clinicalFeaturesTitle} desc={L.clinicalFeaturesDesc} />
        <div className="mt-12 grid gap-5 md:grid-cols-6">
          <EngineCard icon={ShieldCheck} title={L.featureDDI} desc={L.featureDDIDesc} className="md:col-span-3">
            <DDIMini />
          </EngineCard>
          <EngineCard icon={Activity} title={L.featureOrganLoad} desc={L.featureOrganLoadDesc} className="md:col-span-3" delay={80}>
            <OrganMini />
          </EngineCard>
          <EngineCard icon={Layers} title={L.featureSpeciesBreed} desc={L.featureSpeciesBreedDesc} className="md:col-span-2" delay={0}>
            <SpeciesMini />
          </EngineCard>
          <EngineCard icon={Scale} title={L.featureDosing} desc={L.featureDosingDesc} className="md:col-span-2" delay={80}>
            <DosingMini />
          </EngineCard>
          <EngineCard icon={RefreshCcw} title={L.featureWashout} desc={L.featureWashoutDesc} className="md:col-span-2" delay={160}>
            <WashoutMini />
          </EngineCard>
        </div>
      </div>
    </section>
  );
}

// ── DUR · Coverage (pipeline + severity) ─────────────────────────
export function Coverage() {
  const { t } = useI18n();
  const L = t.landing;
  const steps = [1, 2, 3, 4, 5, 6].map((n) => ({ n, title: L[`pipeline${n}`], sub: L[`pipeline${n}Sub`] }));
  const levels = [
    { label: t.island.severity.critical, desc: L.severityCritical, bar: 'bg-red-500', w: '100%' },
    { label: t.island.severity.moderate, desc: L.severityModerate, bar: 'bg-amber-400', w: '66%' },
    { label: t.island.severity.minor, desc: L.severityMinor, bar: 'bg-yellow-300', w: '36%' },
    { label: t.results.none, desc: L.severityNone, bar: 'bg-emerald-500', w: '8%' },
  ];
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <SectionIntro product="dur" kicker={`03 · ${L.pipelineKicker}`} title={L.pipelineTitle} desc={L.pipelineDesc} />
          <ol className="mt-10 grid gap-3 sm:grid-cols-2">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 60} className="flex items-start gap-3 rounded-2xl p-4 ring-1 ring-ink-200/70">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 font-mono text-[12px] font-semibold text-white tnum">{s.n}</span>
                <span>
                  <span className="block text-[14px] font-semibold text-ink-900">{s.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">{s.sub}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal delay={120} className="self-start rounded-3xl bg-ink-950 p-7 text-white shadow-lift sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">{L.severityTitle}</p>
          <div className="mt-6 space-y-5">
            {levels.map((l) => (
              <div key={l.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold">{l.label}</span>
                  <span className="text-right text-[12.5px] text-white/50">{l.desc}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${l.bar}`} style={{ width: l.w }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-white/10 pt-6">
            <ProductLockup product="dur" size="sm" tone="dark" />
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t.results.disclaimer}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── nuvovet Claims (coming soon) ─────────────────────────────────
function ClaimsVisual() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const { items, total } = sampleClaim(lang);
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[40px] bg-claims-200/40 blur-3xl" />
      <div className="relative flex justify-center">
        <span className="z-10 inline-flex h-10 items-center gap-2 rounded-full bg-[#14102a] pl-2 pr-4 text-[13px] font-semibold text-white shadow-island">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-claims-500/25 text-claims-300"><FileText size={13} /></span>
          nuvovet <span className="text-claims-300">Claims</span>
          <span className="font-normal text-white/55">· {L.claimsMockReady}</span>
        </span>
      </div>
      <div className="relative -mt-4 rounded-3xl bg-white p-5 pt-8 shadow-lift ring-1 ring-claims-200/70">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-900">{L.claimsMockTitle}</p>
          <span className="rounded-full bg-claims-50 px-2 py-0.5 text-[11px] font-semibold text-claims-700">{L.claimsMockItems}</span>
        </div>
        <ul className="mt-3 divide-y divide-ink-100 text-[12.5px]">
          {items.map((i) => (
            <li key={i.name} className="flex items-center justify-between gap-3 py-1.5">
              <span className="truncate text-ink-600">{i.name}</span>
              <span className="shrink-0 text-ink-900 tnum">{formatWon(i.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-claims-50 px-3 py-2">
          <span className="text-[12px] font-medium text-claims-800">{t.emr.rx.total}</span>
          <span className="text-[15px] font-bold text-claims-800 tnum">{formatWon(total)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['진단서 / Dx', '영수증 / Receipt', 'SOAP'].map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-1 text-[11px] text-ink-600 ring-1 ring-inset ring-ink-200/70">
              <Paperclip size={11} /> {a}
            </span>
          ))}
        </div>
      </div>
      <p className="relative mt-3 text-center text-[11.5px] text-ink-400">{L.claimsPreviewNote}</p>
    </div>
  );
}

export function ClaimsSection({ onWaitlist }) {
  const { t } = useI18n();
  const L = t.landing;
  return (
    <section id="claims" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-white via-claims-50/60 to-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <Reveal className="flex flex-wrap items-center gap-3">
            <ProductLockup product="claims" size="xl" />
            <span className="rounded-full bg-claims-100 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-claims-700">{L.claimsKicker}</span>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="mt-8 text-balance text-[30px] font-bold leading-[1.12] tracking-[-0.035em] text-ink-900 sm:text-[42px]">{L.claimsTitle}</h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-500">{L.claimsDesc}</p>
          </Reveal>
          <Reveal delay={120}>
            <ol className="mt-8 flex flex-wrap items-center gap-2">
              {L.claimsSteps.map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <span className="h-px w-6 bg-claims-300" aria-hidden="true" />}
                  <li className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-ink-700 ring-1 ring-claims-200">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-claims-600 font-mono text-[10.5px] font-semibold text-white tnum">{i + 1}</span>
                    {s}
                  </li>
                </React.Fragment>
              ))}
            </ol>
            <button type="button" onClick={onWaitlist} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-claims-600 px-6 text-[14.5px] font-semibold text-white shadow-sm hover:bg-claims-700">
              {L.claimsCta} <ArrowRight size={16} />
            </button>
          </Reveal>
        </div>
        <Reveal delay={150}>
          <ClaimsVisual />
        </Reveal>
      </div>
    </section>
  );
}

// ── Demo band ────────────────────────────────────────────────────
export function DemoBand() {
  const { t } = useI18n();
  const L = t.landing;
  const samples = useIslandSamples();
  const icons = [ListChecks, MousePointerClick, Sparkles];
  return (
    <section className="bg-white px-3 py-10 sm:px-6 sm:py-16">
      <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-ink-950 px-6 py-14 sm:px-12 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-clinical-grid-dark mask-radial-fade" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-28 h-80 w-80 rounded-full bg-dur-500/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 h-80 w-96 rounded-full bg-claims-500/15 blur-3xl" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-dur-300">{L.demoBandKicker}</p>
            <h2 className="mt-4 text-balance text-[30px] font-bold leading-[1.1] tracking-[-0.035em] text-white sm:text-[42px]">{L.demoBandTitle}</h2>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-white/60">{L.demoBandDesc}</p>
            <ol className="mt-8 space-y-3">
              {L.demoBandPoints.map((p, i) => {
                const Icon = icons[i];
                return (
                  <li key={p} className="flex items-center gap-3 text-[14.5px] text-white/85">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-dur-300 ring-1 ring-inset ring-white/10"><Icon size={15} /></span>
                    {p}
                  </li>
                );
              })}
            </ol>
            <Link to="/demo" className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[14.5px] font-semibold text-ink-900 hover:bg-ink-100">
              {t.nav.launchDemo} <ArrowRight size={16} />
            </Link>
          </div>
          <Decorative className="flex flex-col items-center gap-4">
            <div className="animate-float-slow"><DurIsland view="compact" status={samples.glance} labels={samples.labels} interactive={false} className="ring-1 ring-white/10" /></div>
            <div className="w-full max-w-[460px] animate-float-slow" style={{ animationDelay: '-2s' }}>
              <FitIsland
                render={(mw) => (
                  <DurIsland view="expanded" focus={samples.focus} labels={samples.labels} interactive={false} maxWidth={mw} onResolve={noop} onAck={noop} onOpenReport={noop} onCollapse={noop} onNav={noop} className="ring-1 ring-white/10" />
                )}
              />
            </div>
          </Decorative>
        </div>
      </Reveal>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────
export function FinalCta({ onRequestAccess }) {
  const { t } = useI18n();
  const L = t.landing;
  return (
    <section className="bg-white pb-24 pt-10 sm:pb-28">
      <Reveal className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <div className="mx-auto mb-6 flex justify-center gap-2">
          <ProductTag product="dur" />
          <ProductTag product="claims" status={t.nav.soon} />
        </div>
        <h2 className="text-balance text-[30px] font-bold leading-[1.12] tracking-[-0.035em] text-ink-900 sm:text-[44px]">{L.ctaTitle}</h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ink-500">{L.ctaDesc}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onRequestAccess} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-[14.5px] font-semibold text-white hover:bg-ink-800">
            <Send size={15} /> {t.nav.requestAccess}
          </button>
          <Link to="/system" className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[14.5px] font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50">
            <Lock size={14} /> {t.nav.signIn}
          </Link>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-400">{t.nav.signInDesc}</p>
      </Reveal>
    </section>
  );
}
