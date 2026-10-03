import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { ProductLockup, BrandText } from '../NuvovetLogo';
import { DurIsland } from '../dur/DurIsland';
import { analyzeRegimen } from '../dur/findings';
import { describeFinding, drugLabel, fmt } from '../dur/describe';
import { getDrugById, createUnknownDrug } from '../../data/drugDatabase';
import { getDemoPatients } from '../../data/breedProfiles';
import { formatWon, productLabel, lineMetrics, makeRxLine, TX_ITEMS } from '../../data/emrCatalog';
import {
  EmrTitleBar, EmrToolbar, EmrTabs, EmrStatusBar, RxGrid, RxMemo, LabsPanel, HistoryPanel, breedName, patientName, loc,
} from '../emr/EmrUI';

// ──────────────────────────────────────────────────────────────────
// Landing sections below the hero.
//
//   TrustStats     dark   readout band that continues the hero stage
//   ProductFamily  light  01  the platform: nuvoDUR + nuvoClaim
//   IslandStates   light  02  #dur / #how — the island's three shapes
//   Engines        dark   03  seven checks, live engine output + island
//   Coverage       light  04  six-case drug resolution, severity scale
//   ClaimsSection  light  05  #claims — nuvoClaim preview, waitlist
//   DemoBand       dark   06  today's demo patients, open the demo
//   FinalCta       dark   07  request access · sign in · demo
//
// Type does the talking: mono micro-labels, coloured product words,
// tabular numbers and hairline rules. Every clinical example on this
// page is produced by the real DUR engine (findings.js), so the copy
// can never drift from what the product actually says.
// ──────────────────────────────────────────────────────────────────

const cx = (...parts) => parts.filter(Boolean).join(' ');

const WRAP = 'mx-auto w-full max-w-7xl px-5 sm:px-8';
const STAGE = 'bg-[#05070D]';

// Severity — island tones on dark surfaces, ink-safe tones on light ones
const SEV_ON_DARK = { critical: '#FF6B5E', moderate: '#FFB340', minor: '#FFD84D', unknown: '#94A3B8' };
const SEV_RGB = { critical: '255,107,94', moderate: '255,179,64', minor: '255,216,77', unknown: '148,163,184' };
const SEV_ON_LIGHT = { critical: '#C9362B', moderate: '#B45309', minor: '#8A6D00', none: '#13805A' };
const SEV_RULE = { critical: '#FF6B5E', moderate: '#FFB340', minor: '#FFD84D', none: '#3DDC97' };

// ── Reveal on scroll ─────────────────────────────────────────────
export function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold, rootMargin: '0px 0px -6% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

export function Reveal({ children, className = '', delay = 0, as: Tag = 'div', style, ...rest }) {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      className={cx(
        'transition-[opacity,transform] duration-[900ms] ease-out-expo',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className,
      )}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Measures an element's layout box (offset size — unaffected by transforms). */
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** Purely illustrative UI — hidden from assistive tech and the tab order. */
function Decorative({ children, className = '', style, innerRef }) {
  return (
    // eslint-disable-next-line react/no-unknown-property
    <div ref={innerRef} aria-hidden="true" inert="" className={className} style={style}>{children}</div>
  );
}

const noop = () => {};

// ── Type atoms ───────────────────────────────────────────────────

/** Micro-label. `.kicker` is mono caps for Latin and Pretendard for Korean. */
function Kicker({ children, className = '', as: Tag = 'p', ...rest }) {
  return <Tag className={cx('kicker text-[11px] leading-[1.35]', className)} {...rest}>{children}</Tag>;
}

function SectionIndex({ n, label, dark = false }) {
  return (
    <p className={cx('kicker flex items-baseline gap-2.5 text-[11px] leading-none', dark ? 'text-white/45' : 'text-ink-500')}>
      <span className={cx('font-mono tnum', dark ? 'text-white' : 'text-ink-900')}>{n}</span>
      <span aria-hidden="true" className="font-mono">—</span>
      <span>{label}</span>
    </p>
  );
}

function Display({ children, className = '', as: Tag = 'h2', id }) {
  const { lang } = useI18n();
  return (
    <Tag
      id={id}
      className={cx(
        'text-balance text-[34px] font-semibold sm:text-[46px] lg:text-[54px]',
        lang === 'ko' ? 'leading-[1.24] tracking-[-0.03em]' : 'leading-[1.05] tracking-[-0.035em]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Ruled section header: index row, headline (7 cols) and lead (4 cols). */
function SectionHead({ n, label, title, desc, dark = false, id, children }) {
  return (
    <Reveal>
      <div className={cx('border-t pt-4', dark ? 'border-white/[0.14]' : 'border-ink-900/[0.14]')}>
        <SectionIndex n={n} label={label} dark={dark} />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 lg:grid-cols-12 lg:gap-8">
        <Display id={id} className={cx('lg:col-span-7', dark ? 'text-white' : 'text-ink-900')}>{title}</Display>
        {(desc || children) && (
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            {desc && (
              <p className={cx('text-pretty text-[16px] leading-[1.65] sm:text-[17px]', dark ? 'text-white/55' : 'text-ink-500')}>
                <BrandText tone={dark ? 'dark' : 'light'}>{desc}</BrandText>
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    </Reveal>
  );
}

/** Chapter opener for a product: status word, oversized lockup, tagline. */
function Masthead({ product, status, tagline, id }) {
  const accent = product === 'dur' ? 'text-dur-600' : 'text-claims-600';
  return (
    <Reveal className="border-t-2 border-ink-900 pt-5">
      <Kicker className={accent}>{status}</Kicker>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 lg:grid-cols-12 lg:items-end lg:gap-8">
        <h2 id={id} className="lg:col-span-7">
          <ProductLockup
            product={product}
            className="!text-[60px] !tracking-[-0.055em] sm:!text-[96px] lg:!text-[124px]"
          />
        </h2>
        <p className="max-w-md text-pretty text-[19px] leading-snug tracking-[-0.01em] text-ink-600 sm:text-[22px] lg:col-span-4 lg:col-start-9 lg:pb-3">
          {tagline}
        </p>
      </div>
    </Reveal>
  );
}

// ── Buttons ──────────────────────────────────────────────────────

const BTN_TONES = {
  ink: 'bg-ink-900 text-white hover:bg-ink-800',
  white: 'bg-white text-ink-900 hover:bg-white/90',
  violet: 'bg-claims-600 text-white hover:bg-claims-700',
  line: 'text-ink-900 ring-1 ring-inset ring-ink-900/15 hover:bg-ink-900/[0.04]',
  lineDark: 'text-white ring-1 ring-inset ring-white/20 hover:bg-white/[0.06]',
};

function Btn({ as = 'button', tone = 'ink', arrow = true, className = '', children, ...rest }) {
  const cls = cx(
    'group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[15px] font-semibold transition-colors',
    BTN_TONES[tone],
    className,
  );
  const body = (
    <>
      {children}
      {arrow && <span aria-hidden="true" className="transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5">→</span>}
    </>
  );
  if (as === 'link') return <Link className={cls} {...rest}>{body}</Link>;
  if (as === 'a') return <a className={cls} {...rest}>{body}</a>;
  return <button type="button" className={cls} {...rest}>{body}</button>;
}

// ── Shared case: Buddy, the hero's patient ───────────────────────
// Golden Retriever on meloxicam + omeprazole; the vet adds prednisolone
// for an allergy flare, nuvoDUR flags NSAID + corticosteroid, and the
// one-tap fix swaps meloxicam for gabapentin.

const BUDDY_TX = ['consultRecheck', 'otoscopy', 'earFlush'];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function useBuddy() {
  const { t, lang } = useI18n();
  const base = useMemo(() => {
    const patients = getDemoPatients();
    const entry = patients.find((p) => p.id === 'golden_retriever');
    const melox = makeRxLine('meloxicam', 'dog', { days: 30 });
    const omep = makeRxLine('omeprazole', 'dog', { days: 30 });
    const pred = makeRxLine('prednisolone', 'dog', { qty: 0.5, days: 7, isNew: true });
    const gaba = makeRxLine('gabapentin', 'dog', { days: 30 });
    return {
      entry,
      patientsToday: patients.length,
      before: [melox, omep],
      after: [melox, omep, pred],
      resolved: [gaba, omep, { ...pred, isNew: false }],
    };
  }, []);

  return useMemo(() => {
    const I = t.island;
    const drugs = base.after.map((l) => ({ ...l.drug, dosePerKg: l.qty }));
    const { findings } = analyzeRegimen({ drugs, species: 'dog', patient: { ...base.entry.profile, breed: base.entry.breed } });
    const f = findings[0];
    const d = describeFinding(f, { t, lang, species: 'dog', patientName: patientName(base.entry, lang) });
    return {
      ...base,
      glance: { tone: 'clear', title: I.ui.noIssues, detail: fmt(I.ui.medsCount, { n: base.before.length }) },
      alert: { tone: d.severity, title: I.severity[d.severity], detail: d.drugsLabel },
      focus: { ...d, severityLabel: I.severity[d.severity], index: 0, total: 1, reviewed: false },
      overlay: Object.fromEntries(f.drugs.map((x) => [x.id, d.severity])),
      focusIds: f.drugs.map((x) => x.id),
    };
  }, [base, t, lang]);
}

/** The visit after the fix, itemised the way nuvoClaim would bill it. */
function useClaim(buddy) {
  const { lang } = useI18n();
  return useMemo(() => {
    const w = buddy.entry.profile.weight;
    const tx = BUDDY_TX.map((k) => ({ key: k, name: loc(TX_ITEMS[k], lang), qty: '1', price: TX_ITEMS[k].price }));
    const rx = buddy.resolved.map((l) => ({
      key: l.drugId,
      name: productLabel(l.drug, lang),
      qty: lang === 'ko' ? `${l.days}일` : `${l.days} d`,
      price: lineMetrics(l, w).price,
    }));
    const items = [...tx, ...rx];
    const subtotal = items.reduce((s, i) => s + i.price, 0);
    const vat = Math.round(subtotal * 0.1);
    return { items, subtotal, vat, total: subtotal + vat };
  }, [buddy, lang]);
}

// ── EMR window crops (realistic Windows EMR, island docked on top) ─

function emrTabs(t) {
  return [
    { id: 'soap', label: t.emr.tabs.soap },
    { id: 'rx', label: t.emr.tabs.rx },
    { id: 'labs', label: t.emr.tabs.labs },
    { id: 'history', label: t.emr.tabs.history },
  ];
}

/**
 * The EMR's window title bar with an empty centre — the island docks
 * there. Mirrors EmrTitleBar's chrome; the hospital / document title are
 * left out so nothing ever runs underneath the island.
 */
function WindowBar() {
  const { t } = useI18n();
  return (
    <div className="relative flex h-[30px] shrink-0 select-none items-center border-b border-[#D5DAE1] bg-emr-chrome text-[12px] text-emr-text">
      <span className="flex items-center gap-1.5 pl-3">
        <span className="font-bold tracking-[-0.01em] text-emr-blue">{t.emr.appName}</span>
        <span className="text-emr-faint tnum">{t.emr.version}</span>
      </span>
      <span className="ml-auto flex h-full items-stretch">
        <span className="flex w-[42px] items-center justify-center"><span className="h-px w-[10px] bg-emr-text" /></span>
        <span className="flex w-[42px] items-center justify-center"><span className="h-[9px] w-[9px] border border-emr-text" /></span>
        <span className="relative flex w-[42px] items-center justify-center">
          <span className="absolute h-px w-[12px] rotate-45 bg-emr-text" />
          <span className="absolute h-px w-[12px] -rotate-45 bg-emr-text" />
        </span>
      </span>
    </div>
  );
}

/** Buddy's chart on the TX/RX tab — the screen every crop on this page is cut from. */
function BuddyScreen({ buddy, lines, overlay, focusIds, tx = [], toolbar = 'consult', extra = false }) {
  const { t } = useI18n();
  const e = buddy.entry;
  return (
    <>
      <WindowBar />
      <EmrToolbar active={toolbar} compact />
      <div className="p-[3px]">
        <div className="border border-emr-line bg-emr-bg">
          <EmrTabs tabs={emrTabs(t)} active="rx" className="bg-[#E9ECF0]" />
          <div className="space-y-1.5 bg-white p-1.5">
            <RxGrid
              lines={lines}
              txItems={tx}
              weight={e.profile.weight}
              overlay={overlay}
              focusIds={focusIds}
              readOnly
              columns="compact"
            />
            {extra && (
              <>
                <RxMemo entry={e} />
                <LabsPanel entry={e} dateLabel={todayIso()} />
                <HistoryPanel entry={e} />
              </>
            )}
          </div>
        </div>
      </div>
      {/* pinned to the window's bottom edge when the crop is taller than the chart */}
      <div className="mt-auto">
        <EmrStatusBar clock={`${todayIso()} ${e.profile.visit.time}`} patientsToday={buddy.patientsToday} />
      </div>
    </>
  );
}

/**
 * A cropped EMR window with the island docked across its top edge — the
 * same docking as the hero: the island's upper half sits above the
 * window, its lower half over the empty centre of the title bar.
 *
 * The EMR lays out at `minDesign` px (or wider) and is zoomed down to fit,
 * like the hero (CSS zoom, so its text is set at the final size); the
 * island is never scaled. `fill` lets the frame take the height its flex
 * parent gives it.
 */
function DockFrame({ height = 240, fill = false, minDesign = 760, screen, dock, dims = false, fade = false, className = '' }) {
  const [ref, { w }] = useElementSize();
  const [winRef, win] = useElementSize();
  const [dockRef, d] = useElementSize();
  const narrow = w > 0 && w < 520;
  const designW = Math.max(w, narrow ? 640 : minDesign);
  const s = w ? w / designW : 1;
  const above = dims ? 32 : 0; // room for the width dimension above the island
  const half = d.h ? Math.min(d.h, 40) / 2 : 20;
  const needWin = Math.max(0, d.h - half + 40); // the expanded card must fit inside
  const winH = Math.max(Math.round(height * s), needWin);
  const style = fill
    ? { minHeight: above + half + winH }
    : { height: above + half + winH };
  return (
    <Decorative innerRef={ref} className={cx('relative', fill && 'flex-1', className)} style={style}>
      <div
        ref={winRef}
        className={cx('absolute inset-x-0 bottom-0 isolate overflow-hidden border border-ink-900/[0.16] bg-emr-bg', fade && 'mask-fade-b')}
        style={{ top: above + half }}
      >
        {w > 0 && (
          <div
            className="absolute left-0 top-0 flex flex-col bg-emr-bg"
            style={{
              width: designW,
              minHeight: win.h / s,
              // zoom sets text at its final size (even spacing); tiny phone
              // crops scale as a picture instead, which keeps glyphs uniform
              ...(s < 1 ? (narrow ? { transform: `scale(${s})`, transformOrigin: 'top left' } : { zoom: s }) : null),
            }}
          >
            {screen}
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 z-10 flex justify-center px-3" style={{ top: above }}>
        <div ref={dockRef} className="relative">
          {typeof dock === 'function' ? dock(w) : dock}
          {dims && <Dims w={d.w} h={d.h} vertical={dims === 'both' && !narrow} />}
        </div>
      </div>
    </Decorative>
  );
}

/** Spec-drawing dimensions: width above the island, height beside it. */
function Dims({ w, h, vertical }) {
  if (!w) return null;
  const label = 'bg-white px-1 font-mono text-[10px] leading-[14px] text-dur-700 tnum';
  return (
    <>
      <span className="absolute inset-x-0 bottom-full mb-3 flex items-center">
        <span className="h-2 w-px bg-dur-600" />
        <span className="h-px flex-1 bg-dur-600/45" />
        <span className={cx('mx-1', label)}>{w}</span>
        <span className="h-px flex-1 bg-dur-600/45" />
        <span className="h-2 w-px bg-dur-600" />
      </span>
      {vertical && (
        <span className="absolute inset-y-0 left-full ml-3 flex items-center">
          <span className="flex h-full flex-col items-center">
            <span className="h-px w-2 bg-dur-600" />
            <span className="w-px flex-1 bg-dur-600/45" />
            <span className="h-px w-2 bg-dur-600" />
          </span>
          <span className={cx('ml-1', label)}>{h}</span>
        </span>
      )}
    </>
  );
}

/** nuvoClaim's pill — same anatomy as the island's compact view, in violet. */
function ClaimPill({ title, detail, size = 'md' }) {
  const sm = size === 'sm';
  return (
    <div className={cx('flex max-w-full items-center gap-2.5 whitespace-nowrap rounded-full bg-island-bg px-4 text-white shadow-island', sm ? 'h-9 text-[12.5px]' : 'h-10 text-[13px]')}>
      <span className="font-semibold tracking-[-0.02em] text-white/60">nuvo<span className="text-claims-300">Claim</span></span>
      <span className="h-3.5 w-px shrink-0 bg-white/15" aria-hidden="true" />
      <span className="font-semibold tracking-[-0.01em]">{title}</span>
      {detail && <span className="min-w-0 truncate text-white/50 tnum">· {detail}</span>}
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────

function CountUp({ value }) {
  const [ref, visible] = useReveal(0.4);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return undefined;
    const end = Number(value);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || end < 10) { setN(end); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1200);
      setN(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, value]);
  return (
    <span ref={ref} className="tnum">
      <span aria-hidden="true">{n}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

const STAT_VALUES = [877, 10, 7, 1];

export function TrustStats() {
  const { t } = useI18n();
  const L = t.landing;
  return (
    <section aria-label={L.statsLabel} className={cx(STAGE, 'relative text-white')}>
      <div className={WRAP}>
        <dl className="grid grid-cols-2 border-t border-white/[0.1] lg:grid-cols-4">
          {L.stats.map((s, i) => (
            <div
              key={s.kicker}
              className={cx(
                'flex flex-col border-white/[0.1] py-9 sm:py-12 lg:py-14',
                i % 2 === 1 ? 'border-l pl-5 sm:pl-8' : 'pr-4',
                i >= 2 && 'border-t lg:border-t-0',
                i === 2 && 'lg:border-l lg:pl-8',
              )}
            >
              <dt className="kicker order-1 text-[11px] text-white/40">{s.kicker}</dt>
              <dd className="order-2 mt-6 text-[56px] font-medium leading-[0.9] tracking-[-0.055em] text-white sm:text-[76px] lg:text-[92px]">
                <CountUp value={STAT_VALUES[i]} />
              </dd>
              <dd className="order-3 mt-5 max-w-[16rem] text-pretty text-[13.5px] leading-snug text-white/55">{s.label}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 border-t border-white/[0.1] py-5 sm:flex-row sm:items-baseline sm:gap-6">
          <Kicker className="shrink-0 text-white/40">{L.sourcesLabel}</Kicker>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/60">
            {L.sources.map((src, i) => (
              <React.Fragment key={src}>
                {i > 0 && <span aria-hidden="true" className="text-white/25">{'  /  '}</span>}
                <span className="whitespace-nowrap">{src}</span>
              </React.Fragment>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 01 · Product family ──────────────────────────────────────────

function ProductColumn({ product, status, tagline, bullets, specimen, actions, className = '', delay = 0 }) {
  const accent = product === 'dur' ? 'text-dur-600' : 'text-claims-600';
  return (
    <Reveal delay={delay} className={cx('flex flex-col', className)}>
      {specimen}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h3><ProductLockup product={product} size="2xl" className="!text-[44px] sm:!text-[54px]" /></h3>
        <Kicker className={cx('pb-1.5', accent)}>{status}</Kicker>
      </div>
      <p className="mt-5 max-w-lg text-balance text-[19px] font-medium leading-snug tracking-[-0.015em] text-ink-700 sm:text-[21px]">{tagline}</p>
      <ol className="mt-8 border-t border-ink-900/10">
        {bullets.map((b, i) => (
          <li key={b} className="flex gap-5 border-b border-ink-900/10 py-4">
            <span className="w-5 shrink-0 pt-[3px] font-mono text-[11.5px] text-ink-400 tnum">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[15px] leading-relaxed text-ink-600">{b}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
    </Reveal>
  );
}

export function ProductFamily({ onWaitlist }) {
  const { t } = useI18n();
  const L = t.landing;
  const buddy = useBuddy();
  const claim = useClaim(buddy);
  return (
    <section id="products" aria-labelledby="products-title" className="scroll-mt-16 bg-white py-24 text-ink-900 sm:py-32">
      <div className={WRAP}>
        <SectionHead n="01" label={L.productsKicker} title={L.productsTitle} desc={L.productsDesc} id="products-title" />
        <div className="mt-14 grid grid-cols-1 gap-20 sm:mt-20 lg:grid-cols-2 lg:gap-0">
          <ProductColumn
            product="dur"
            status={L.durStatus}
            tagline={L.durTagline}
            bullets={L.durBullets}
            className="lg:border-r lg:border-ink-900/10 lg:pr-10"
            specimen={(
              <DockFrame
                height={200}
                minDesign={700}
                fade
                screen={<BuddyScreen buddy={buddy} lines={buddy.before} />}
                dock={(w) => <DurIsland view="compact" size={w < 420 ? 'sm' : 'md'} status={buddy.glance} labels={t.island.ui} interactive={false} />}
              />
            )}
            actions={(
              <>
                <Btn as="link" to="/demo" tone="ink">{L.durCta}</Btn>
                <Btn as="a" href="#how" tone="line" arrow={false}>{L.durCta2}</Btn>
              </>
            )}
          />
          <ProductColumn
            product="claims"
            status={L.claimsStatus}
            tagline={L.claimsTagline}
            bullets={L.claimsBullets}
            delay={120}
            className="lg:pl-10"
            specimen={(
              <DockFrame
                height={200}
                minDesign={700}
                fade
                screen={<BuddyScreen buddy={buddy} lines={buddy.resolved} tx={BUDDY_TX} toolbar="billing" />}
                dock={(w) => (
                  <ClaimPill size={w < 420 ? 'sm' : 'md'} title={L.claimsMockReady} detail={w < 420 ? null : formatWon(claim.total)} />
                )}
              />
            )}
            actions={(
              <>
                <Btn tone="violet" onClick={onWaitlist}>{L.claimsCta}</Btn>
                <Btn as="a" href="#claims" tone="line" arrow={false}>{L.claimsCta2}</Btn>
              </>
            )}
          />
        </div>
      </div>
    </section>
  );
}

// ── 02 · nuvoDUR — the island's three shapes (#dur, #how) ────────

function StateCaption({ n, title, desc }) {
  return (
    <div className="mt-5 flex gap-5">
      <span className="w-5 shrink-0 pt-[5px] font-mono text-[11.5px] text-ink-400 tnum">{String(n).padStart(2, '0')}</span>
      <div>
        <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-ink-900">{title}</h3>
        <p className="mt-1.5 max-w-md text-pretty text-[15px] leading-relaxed text-ink-500">{desc}</p>
      </div>
    </div>
  );
}

export function IslandStates() {
  const { t } = useI18n();
  const L = t.landing;
  const buddy = useBuddy();
  const [s1, s2, s3] = L.islandStates;
  const labels = t.island.ui;
  return (
    <section id="dur" aria-labelledby="dur-title" className="scroll-mt-16 bg-white pb-24 pt-6 text-ink-900 sm:pb-32">
      <div className={WRAP}>
        <Masthead product="dur" status={L.durStatus} tagline={L.durTagline} id="dur-title" />

        <div className="pt-24 sm:pt-32">
          <div id="how" className="scroll-mt-24">
            <SectionHead n="02" label={L.islandKicker} title={L.islandTitle} desc={L.islandDesc} />
          </div>

          <div className="mt-14 grid grid-cols-1 gap-16 sm:mt-20 lg:grid-cols-2 lg:gap-8">
            <div className="flex flex-col gap-16 lg:gap-14">
              <Reveal>
                <DockFrame
                  height={252}
                  dims="both"
                  screen={<BuddyScreen buddy={buddy} lines={buddy.before} extra />}
                  dock={(w) => <DurIsland view="compact" size={w < 420 ? 'sm' : 'md'} status={buddy.glance} labels={labels} interactive={false} />}
                />
                <StateCaption n={1} title={s1.title} desc={s1.desc} />
              </Reveal>
              <Reveal delay={90}>
                <DockFrame
                  height={252}
                  dims="both"
                  screen={<BuddyScreen buddy={buddy} lines={buddy.after} overlay={buddy.overlay} extra />}
                  dock={(w) => <DurIsland view="compact" size={w < 420 ? 'sm' : 'md'} status={buddy.alert} labels={labels} interactive={false} />}
                />
                <StateCaption n={2} title={s2.title} desc={s2.desc} />
              </Reveal>
            </div>
            <Reveal delay={180} className="flex flex-col">
              <DockFrame
                fill
                height={560}
                dims
                screen={<BuddyScreen buddy={buddy} lines={buddy.after} overlay={buddy.overlay} focusIds={buddy.focusIds} tx={BUDDY_TX} extra />}
                dock={(w) => (
                  <DurIsland
                    view="expanded"
                    focus={buddy.focus}
                    labels={labels}
                    interactive={false}
                    maxWidth={Math.max(260, (w || 464) - 24)}
                    onResolve={noop}
                    onAck={noop}
                  />
                )}
              />
              <StateCaption n={3} title={s3.title} desc={s3.desc} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 03 · Seven checks — live engine output + an island to try ────

const LEDGER = [
  { key: 'interaction', patient: 'golden_retriever', drugs: ['meloxicam', 'omeprazole', ['prednisolone', 0.5]], pick: (f) => f.kind === 'interaction' },
  { key: 'species', patient: 'domestic_sh', drugs: ['methimazole', 'amlodipine', 'acetaminophen'], pick: (f) => f.kind === 'species' },
  { key: 'allergy', patient: 'australian_shepherd', drugs: ['enalapril', 'amoxicillin'], pick: (f) => f.kind === 'allergy' },
  { key: 'mdr1', patient: 'australian_shepherd', drugs: ['enalapril', 'ivermectin'], pick: (f) => f.rule === 'mdr1' },
  { key: 'disease', patient: 'domestic_sh', drugs: ['methimazole', 'amlodipine', 'meloxicam'], pick: (f) => f.kind === 'disease' },
  { key: 'dose', patient: 'golden_retriever', drugs: [['meloxicam', 0.3], 'omeprazole'], pick: (f) => f.kind === 'dose' },
  { key: 'organ', patient: 'australian_shepherd', drugs: ['prednisolone', 'metronidazole', 'enalapril'], pick: (f) => f.kind === 'organ' },
];

/** Formulary drug by id, or a free-text entry (how a human OTC drug arrives). */
function ledgerDrug(spec) {
  const [id, dose] = Array.isArray(spec) ? spec : [spec];
  const drug = getDrugById(id) || { ...createUnknownDrug(id.charAt(0).toUpperCase() + id.slice(1)), id };
  return dose != null ? { ...drug, dosePerKg: dose } : { ...drug };
}

function useLedger() {
  const { t, lang } = useI18n();
  return useMemo(() => {
    const I = t.island;
    const patients = getDemoPatients();
    return LEDGER.map((c) => {
      const entry = patients.find((p) => p.id === c.patient);
      if (!entry) return null;
      const drugs = c.drugs.map(ledgerDrug);
      const { findings } = analyzeRegimen({ drugs, species: entry.species, patient: { ...entry.profile, breed: entry.breed } });
      const f = findings.find(c.pick);
      if (!f) return null;
      let d = describeFinding(f, { t, lang, species: entry.species, patientName: patientName(entry, lang) });
      if (f.rule === 'hardstop') {
        // free-text drugs have no formulary label; name it from the finding
        const sentence = fmt(I.resolution.remove, { from: d.drugs[0] });
        d = { ...d, suggestion: sentence, resolvedShort: sentence };
      }
      const name = patientName(entry, lang);
      const breed = breedName(entry, lang);
      return {
        key: c.key,
        raw: f,
        d,
        check: I.ui.kindLabels?.[c.key] || c.key,
        severity: f.severity,
        severityLabel: I.severity[f.severity] || f.severity,
        drugsText: d.drugs.join(f.kind === 'interaction' ? '  ×  ' : ' · '),
        patientShort: `${name} · ${breed}`,
        patientLine: `${name} · ${breed} · ${entry.profile.weight} kg`,
      };
    }).filter(Boolean);
  }, [t, lang]);
}

function Brackets({ className = 'border-white/40' }) {
  const base = cx('pointer-events-none absolute h-3 w-3', className);
  return (
    <>
      <span aria-hidden="true" className={cx(base, '-left-px -top-px border-l border-t')} />
      <span aria-hidden="true" className={cx(base, '-right-px -top-px border-r border-t')} />
      <span aria-hidden="true" className={cx(base, '-bottom-px -left-px border-b border-l')} />
      <span aria-hidden="true" className={cx(base, '-bottom-px -right-px border-b border-r')} />
    </>
  );
}

function LedgerRow({ r, i, selected, onSelect, latinMono }) {
  const color = SEV_ON_DARK[r.severity] || SEV_ON_DARK.unknown;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-controls="engine-island"
        className={cx(
          'group relative grid w-full grid-cols-[34px_minmax(0,1fr)] gap-x-2 border-b border-white/[0.08] py-4 pr-2 text-left transition-colors duration-200',
          'lg:grid-cols-[40px_148px_minmax(0,1fr)_84px] lg:gap-x-0 lg:py-5 xl:grid-cols-[46px_176px_minmax(0,1fr)_92px]',
          selected ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025]',
        )}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] transition-colors duration-200" style={{ backgroundColor: selected ? color : 'transparent' }} />
        <span className={cx('pl-3.5 font-mono text-[11.5px] leading-[22px] tnum transition-colors', selected ? 'text-white' : 'text-white/35')}>
          {String(i + 1).padStart(2, '0')}
        </span>

        <span className="min-w-0 lg:pr-5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] font-medium leading-[22px] text-white/80 lg:text-[14px]">{r.check}</span>
            <Kicker as="span" className="shrink-0 text-[10.5px] lg:hidden" style={{ color }}>{r.severityLabel}</Kicker>
          </span>
          <span className="mt-0.5 hidden text-pretty text-[12.5px] leading-snug text-white/40 lg:block">{r.patientShort}</span>
        </span>

        <span className="col-start-2 mt-1.5 min-w-0 lg:col-start-auto lg:mt-0 lg:pr-5">
          <span className="block text-[15px] font-semibold leading-snug tracking-[-0.01em] text-white">{r.d.title}</span>
          <span className="mt-1 block truncate text-[12.5px] text-white/50">
            <span className={latinMono}>{r.drugsText}</span>
            <span className="lg:hidden"> — {r.patientShort}</span>
          </span>
          <span className="mt-2 block text-pretty text-[13px] leading-snug text-white/60">
            <span aria-hidden="true" className="text-island-info">→ </span>{r.d.suggestion}
          </span>
        </span>

        <Kicker as="span" className="hidden pt-[5px] text-right text-[10.5px] lg:block" style={{ color }}>{r.severityLabel}</Kicker>
      </button>
    </li>
  );
}

export function Engines() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const I = t.island;
  const rows = useLedger();
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState('expanded'); // expanded · compact · applied · reviewed
  const flashTimer = useRef(null);
  const [stageRef, stage] = useElementSize();
  const panelRef = useRef(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const ruleTitles = useMemo(
    () => Object.entries(I.rules).filter(([k]) => k !== 'Insufficient Data').map(([, v]) => v.title),
    [I.rules],
  );

  if (!rows.length) return null;
  const idx = Math.min(sel, rows.length - 1);
  const row = rows[idx];
  const latinMono = lang === 'en' ? 'font-mono' : '';

  const select = (i, fromList = false) => {
    clearTimeout(flashTimer.current);
    setSel(i);
    setMode('expanded');
    // on phones the island sits above the list — bring it back into view
    if (fromList && window.matchMedia?.('(max-width: 1023px)').matches) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  };
  const flash = (m) => {
    clearTimeout(flashTimer.current);
    setMode(m);
    flashTimer.current = setTimeout(() => setMode('expanded'), 2600);
  };

  const focus = {
    ...row.d,
    kindLabel: row.check,
    severityLabel: row.severityLabel,
    index: idx,
    total: rows.length,
    reviewed: false,
  };
  const status =
    mode === 'applied' ? { tone: 'clear', title: I.ui.applied, detail: row.d.resolvedShort || row.d.suggestion }
    : mode === 'reviewed' ? { tone: 'reviewed', title: I.ui.reviewed, detail: row.d.drugsLabel }
    : { tone: row.severity, title: row.severityLabel, detail: row.d.drugsLabel };

  return (
    <section aria-labelledby="checks-title" className={cx(STAGE, 'relative py-24 text-white sm:py-32')}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-clinical-grid-dark opacity-40 mask-radial-fade" />
        <div className="absolute -right-40 -top-48 h-[640px] w-[880px] rounded-full bg-[radial-gradient(closest-side,rgba(79,209,197,0.09),transparent)]" />
      </div>

      <div className={cx(WRAP, 'relative')}>
        <SectionHead dark n="03" label={L.clinicalFeaturesLabel} title={L.clinicalFeaturesTitle} desc={L.clinicalFeaturesDesc} id="checks-title" />

        <div className="mt-14 grid grid-cols-1 gap-12 sm:mt-20 lg:grid-cols-12 lg:gap-8">
          {/* Ledger */}
          <Reveal className="order-2 lg:order-1 lg:col-span-7">
            <div aria-hidden="true" className="hidden border-b border-white/[0.16] pb-3 lg:grid lg:grid-cols-[40px_148px_minmax(0,1fr)_84px] xl:grid-cols-[46px_176px_minmax(0,1fr)_92px]">
              <Kicker as="span" className="pl-3.5 text-[10px] text-white/35">#</Kicker>
              <Kicker as="span" className="text-[10px] text-white/35">{L.ledgerCols.check}</Kicker>
              <Kicker as="span" className="text-[10px] text-white/35">{L.ledgerCols.finding}</Kicker>
              <Kicker as="span" className="pr-2 text-right text-[10px] text-white/35">{L.ledgerCols.severity}</Kicker>
            </div>
            <ol className="border-t border-white/[0.16] lg:border-t-0">
              {rows.map((r, i) => (
                <LedgerRow key={r.key} r={r} i={i} selected={i === idx} onSelect={() => select(i, true)} latinMono={latinMono} />
              ))}
            </ol>
            <div className="mt-12">
              <Kicker className="text-white/40">{fmt(L.rulesLabel, { n: ruleTitles.length })}</Kicker>
              <ol className="mt-4 grid grid-cols-1 gap-x-8 border-b border-white/[0.08] sm:grid-cols-2">
                {ruleTitles.map((title, i) => (
                  <li key={title} className="flex min-w-0 items-baseline gap-4 border-t border-white/[0.08] py-2.5">
                    <span className="w-5 shrink-0 font-mono text-[11px] text-white/30 tnum">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 text-[13px] leading-snug text-white/60">{title}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>

          {/* Live island */}
          <Reveal delay={120} className="order-1 lg:order-2 lg:col-span-5">
            <div ref={panelRef} className="scroll-mt-24 lg:sticky lg:top-24">
              <div className="relative border border-white/[0.1] bg-white/[0.015]">
                <Brackets />
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-5">
                  <Kicker className="text-white/45">{L.ledgerOutput}</Kicker>
                  <span className="font-mono text-[11px] text-white/45 tnum">
                    {String(idx + 1).padStart(2, '0')} / {String(rows.length).padStart(2, '0')}
                  </span>
                </div>
                <div ref={stageRef} className="relative flex min-h-[412px] justify-center overflow-hidden px-3 pb-10 pt-10 lg:min-h-[396px]">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-[-60px] h-[420px] w-[560px] -translate-x-1/2"
                    style={{ background: `radial-gradient(closest-side, rgba(${SEV_RGB[row.severity] || SEV_RGB.unknown},0.13), transparent)` }}
                  />
                  <div id="engine-island" className="relative">
                    <DurIsland
                      view={mode === 'expanded' ? 'expanded' : 'compact'}
                      status={status}
                      focus={focus}
                      labels={I.ui}
                      interactive
                      maxWidth={Math.max(260, (stage.w || 440) - 24)}
                      onToggle={() => { clearTimeout(flashTimer.current); setMode('expanded'); }}
                      onNav={(dir) => select((idx + dir + rows.length) % rows.length)}
                      onCollapse={() => { clearTimeout(flashTimer.current); setMode('compact'); }}
                      onResolve={() => flash('applied')}
                      onAck={() => flash('reviewed')}
                    />
                  </div>
                </div>
                <dl className="grid grid-cols-1 border-t border-white/[0.08] sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <div className="min-w-0 px-4 py-3.5 sm:px-5">
                    <dt className="kicker text-[10px] text-white/35">{L.ledgerPatient}</dt>
                    <dd className="mt-1.5 truncate text-[12.5px] text-white/75">{row.patientLine}</dd>
                  </div>
                  <div className="min-w-0 border-t border-white/[0.08] px-4 py-3.5 sm:border-l sm:border-t-0 sm:px-5 lg:border-l-0 lg:border-t xl:border-l xl:border-t-0">
                    <dt className="kicker text-[10px] text-white/35">{L.ledgerId}</dt>
                    <dd className="mt-1.5 truncate font-mono text-[11.5px] text-white/50" title={row.raw.id}>{row.raw.id}</dd>
                  </div>
                </dl>
              </div>
              <p className="mt-4 text-[12.5px] text-white/40">{L.ledgerHint}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── 04 · Coverage — six cases, four severities ───────────────────

const SEVERITY_EXAMPLES = {
  critical: ['meloxicam', 'prednisolone'],
  moderate: ['ketoconazole', 'cyclosporine'],
  minor: ['phenobarbital', 'prednisolone'],
  none: ['gabapentin', 'omeprazole'],
};

export function Coverage() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const steps = [1, 2, 3, 4, 5, 6].map((n) => ({ n, title: L[`pipeline${n}`], sub: L[`pipeline${n}Sub`] }));
  const levels = [
    { key: 'critical', label: t.island.severity.critical, desc: L.severityCritical },
    { key: 'moderate', label: t.island.severity.moderate, desc: L.severityModerate },
    { key: 'minor', label: t.island.severity.minor, desc: L.severityMinor },
    { key: 'none', label: L.severityNoneLabel, desc: L.severityNone },
  ];
  const example = (key) => SEVERITY_EXAMPLES[key].map((id) => drugLabel(getDrugById(id), lang)).join(key === 'none' ? ' · ' : ' × ');
  return (
    <section aria-labelledby="coverage-title" className="bg-white py-24 text-ink-900 sm:py-32">
      <div className={WRAP}>
        <SectionHead n="04" label={L.pipelineKicker} title={L.pipelineTitle} desc={L.pipelineDesc} id="coverage-title" />

        <div className="mt-14 grid grid-cols-1 gap-16 sm:mt-20 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-7">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-900/20">
                  <th scope="col" className="w-12 pb-3 text-left font-normal"><Kicker as="span" className="text-[10.5px] text-ink-400">#</Kicker></th>
                  <th scope="col" className="pb-3 pr-6"><Kicker as="span" className="text-[10.5px] text-ink-400">{L.pipelineCols.case}</Kicker></th>
                  <th scope="col" className="hidden pb-3 sm:table-cell"><Kicker as="span" className="text-[10.5px] text-ink-400">{L.pipelineCols.handling}</Kicker></th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.n} className="border-b border-ink-900/10 align-baseline">
                    <td className="py-[18px] font-mono text-[12px] text-ink-400 tnum">{String(s.n).padStart(2, '0')}</td>
                    <th scope="row" className="py-[18px] pr-6 text-[16px] font-medium leading-snug tracking-[-0.01em] text-ink-900">
                      {s.title}
                      <span className="mt-1 block text-[14px] font-normal leading-snug tracking-normal text-ink-500 sm:hidden">{s.sub}</span>
                    </th>
                    <td className="hidden py-[18px] text-[14.5px] leading-snug text-ink-500 sm:table-cell">{s.sub}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-4 lg:col-start-9">
            <Kicker className="pb-3 text-[10.5px] text-ink-400">{L.severityTitle}</Kicker>
            <ul>
              {levels.map((l) => (
                <li key={l.key} className="relative grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[104px_minmax(0,1fr)]">
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-ink-900/10" />
                  <span aria-hidden="true" className="absolute left-0 top-0 h-[2px] w-10" style={{ backgroundColor: SEV_RULE[l.key] }} />
                  <span className="text-[17px] font-semibold tracking-[-0.015em]" style={{ color: SEV_ON_LIGHT[l.key] }}>{l.label}</span>
                  <span>
                    <span className="block text-[14px] leading-snug text-ink-700">{l.desc}</span>
                    <span className={cx('mt-1.5 block text-[12.5px] text-ink-400', lang === 'en' && 'font-mono text-[11.5px]')}>{example(l.key)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-ink-900/10 pt-5 text-[12.5px] leading-relaxed text-ink-400">
              <BrandText>{t.results.disclaimer}</BrandText>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── 05 · nuvoClaim (#claims) ─────────────────────────────────────

function ClaimBlock({ n, title, desc, children, className = '', delay = 0 }) {
  return (
    <Reveal delay={delay} className={cx('min-w-0', className)}>
      <div className="flex items-baseline gap-3 border-t border-ink-900/[0.14] pt-4">
        <span className="font-mono text-[11.5px] text-claims-600 tnum">{String(n).padStart(2, '0')}</span>
        <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-ink-900">{title}</h3>
      </div>
      <p className="mt-2 max-w-md text-pretty pl-[30px] text-[14px] leading-relaxed text-ink-500">{desc}</p>
      <div className="mt-6">{children}</div>
    </Reveal>
  );
}

function ClaimDoc({ buddy, claim }) {
  const { t, lang } = useI18n();
  const L = t.landing;
  const p = buddy.entry.profile;
  const meta = [
    [L.claimsPatient, `${patientName(buddy.entry, lang)} · ${breedName(buddy.entry, lang)} · ${p.weight} kg`],
    [L.claimsOwner, `${loc(p.owner, lang)} · ${p.owner?.phone}`],
    [L.claimsVisit, todayIso()],
    [L.claimsDx, loc(p.visit.soap.a, lang)],
    [L.claimsCover, loc(p.insurance, lang)],
  ];
  return (
    <div className="relative pt-5">
      <Decorative className="absolute inset-x-0 top-0 z-10 flex justify-center px-3">
        <ClaimPill title={L.claimsMockReady} detail={formatWon(claim.total)} />
      </Decorative>
      <div className="border border-ink-900/15 bg-white px-5 pb-6 pt-10 shadow-[0_1px_0_rgba(11,18,32,0.03),0_40px_80px_-48px_rgba(74,49,162,0.45)] sm:px-7">
        <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink-900 pb-3">
          <p className="text-[17px] font-semibold tracking-[-0.015em] text-ink-900">{L.claimsDocTitle}</p>
          <Kicker className="text-claims-600">{L.claimsDraft}</Kicker>
        </div>
        <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-ink-900/10 py-4 text-[13px] leading-snug">
          {meta.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-ink-400">{k}</dt>
              <dd className="text-ink-700 tnum">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-ink-900/10">
              <th scope="col" className="py-2.5 text-left font-normal"><Kicker as="span" className="text-[10px] text-ink-400">{L.claimsDocCols.item}</Kicker></th>
              <th scope="col" className="py-2.5 pl-3 text-right font-normal"><Kicker as="span" className="text-[10px] text-ink-400">{L.claimsDocCols.qty}</Kicker></th>
              <th scope="col" className="py-2.5 pl-3 text-right font-normal"><Kicker as="span" className="text-[10px] text-ink-400">{L.claimsDocCols.amount}</Kicker></th>
            </tr>
          </thead>
          <tbody>
            {claim.items.map((it) => (
              <tr key={it.key} className="border-b border-ink-900/[0.06]">
                <td className="py-2 pr-2 text-ink-700">{it.name}</td>
                <td className="whitespace-nowrap py-2 pl-3 text-right text-ink-400 tnum">{it.qty}</td>
                <td className="whitespace-nowrap py-2 pl-3 text-right font-medium text-ink-900 tnum">{formatWon(it.price).replace('₩', '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 text-[13px]">
          <div className="flex justify-between"><dt className="text-ink-400">{L.claimsSubtotal}</dt><dd className="text-ink-700 tnum">{formatWon(claim.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-400">{L.claimsVat}</dt><dd className="text-ink-700 tnum">{formatWon(claim.vat)}</dd></div>
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t-2 border-ink-900 pt-3">
          <span className="text-[14px] font-semibold text-ink-900">{L.claimsTotal}</span>
          <span className="text-[24px] font-semibold tracking-[-0.025em] text-ink-900 tnum">{formatWon(claim.total)}</span>
        </div>
        <div className="mt-6">
          <Kicker className="text-[10px] text-ink-400">{L.claimsAttachLabel}</Kicker>
          <ul className="mt-2.5 border-t border-ink-900/10">
            {L.claimsAttachments.map((a) => (
              <li key={a} className="flex items-baseline justify-between gap-4 border-b border-ink-900/[0.06] py-2 text-[13px]">
                <span className="text-ink-700">{a}</span>
                <span className="font-mono text-[10.5px] text-claims-600">PDF</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ClaimLog() {
  const { t } = useI18n();
  const L = t.landing;
  const now = 3;
  return (
    <ol className="border-t border-ink-900/10">
      {L.claimsLog.map((e, i) => (
        <li key={e.text} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-ink-900/10 py-3.5">
          <span className="font-mono text-[12px] text-ink-400 tnum">{e.time || '—'}</span>
          <span className={cx('text-[14px]', i === now ? 'font-semibold text-claims-700' : i < now ? 'text-ink-700' : 'text-ink-300')}>{e.text}</span>
          {i === now ? <Kicker as="span" className="text-[10px] text-claims-600">{L.claimsNow}</Kicker> : <span />}
        </li>
      ))}
    </ol>
  );
}

export function ClaimsSection({ onWaitlist }) {
  const { t } = useI18n();
  const L = t.landing;
  const buddy = useBuddy();
  const claim = useClaim(buddy);
  return (
    <section id="claims" aria-labelledby="claims-title" className="scroll-mt-16 bg-[#FAF9FF] pb-24 pt-20 text-ink-900 sm:pb-32 sm:pt-28">
      <div className={WRAP}>
        <Masthead product="claims" status={L.claimsStatus} tagline={L.claimsTagline} id="claims-title" />

        <div className="pt-24 sm:pt-32">
          <SectionHead n="05" label={L.claimsKicker} title={L.claimsTitle} desc={L.claimsDesc}>
            <div className="mt-7">
              <Btn tone="violet" onClick={onWaitlist}>{L.claimsCta}</Btn>
            </div>
          </SectionHead>

          <div className="mt-16 grid grid-cols-1 gap-14 sm:mt-20 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-16">
            <ClaimBlock n={1} title={L.claimsSteps[0]} desc={L.claimsStepsDesc[0]} className="lg:col-span-5 lg:row-start-1">
              <Decorative className="border border-ink-900/15 bg-emr-bg">
                <EmrTitleBar />
                <div className="p-1.5">
                  <RxGrid lines={buddy.resolved} txItems={BUDDY_TX} weight={buddy.entry.profile.weight} readOnly columns="compact" />
                </div>
              </Decorative>
            </ClaimBlock>
            <ClaimBlock n={2} title={L.claimsSteps[1]} desc={L.claimsStepsDesc[1]} delay={100} className="lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1">
              <ClaimDoc buddy={buddy} claim={claim} />
            </ClaimBlock>
            <ClaimBlock n={3} title={L.claimsSteps[2]} desc={L.claimsStepsDesc[2]} delay={200} className="lg:col-span-5 lg:row-start-2">
              <ClaimLog />
            </ClaimBlock>
          </div>
          <p className="mt-12 text-[12.5px] text-ink-400">{L.claimsPreviewNote}</p>
        </div>
      </div>
    </section>
  );
}

// ── 06 · Live demo ───────────────────────────────────────────────

export function DemoBand() {
  const { t, lang } = useI18n();
  const L = t.landing;
  const patients = useMemo(() => getDemoPatients(), []);
  const C = L.demoListCols;
  const cols = 'grid grid-cols-[52px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[56px_minmax(0,0.9fr)_minmax(0,1.2fr)_44px_minmax(0,1.3fr)]';
  return (
    <section aria-labelledby="demo-title" className={cx(STAGE, 'relative py-24 text-white sm:py-32')}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 top-24 h-[520px] w-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(18,163,156,0.10),transparent)]" />
      </div>
      <div className={cx(WRAP, 'relative')}>
        <SectionHead dark n="06" label={L.demoBandKicker} title={L.demoBandTitle} desc={L.demoBandDesc} id="demo-title" />

        <div className="mt-14 grid grid-cols-1 gap-14 sm:mt-20 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-4">
            <ol className="border-t border-white/[0.14]">
              {L.demoBandPoints.map((p, i) => (
                <li key={p} className="flex gap-5 border-b border-white/[0.08] py-4">
                  <span className="w-5 shrink-0 pt-[3px] font-mono text-[11.5px] text-white/40 tnum">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[15px] text-white/80">{p}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col items-start gap-4">
              <Btn as="link" to="/demo" tone="white">{t.nav.launchDemo}</Btn>
              <p className="text-[12.5px] text-white/40">{L.demoBandNote}</p>
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7 lg:col-start-6">
            <div className="flex items-baseline justify-between border-t border-white/[0.14] pt-4">
              <Kicker className="text-white/45">{L.demoListTitle}</Kicker>
              <span className="font-mono text-[11px] text-white/45 tnum">{patients.length}</span>
            </div>
            <div role="table" aria-label={L.demoListTitle} className="mt-4">
              <div role="row" className={cx(cols, 'hidden border-b border-white/[0.14] pb-2.5 sm:grid')}>
                <Kicker as="span" role="columnheader" className="text-[10px] text-white/35">{C.time}</Kicker>
                <Kicker as="span" role="columnheader" className="text-[10px] text-white/35">{C.patient}</Kicker>
                <Kicker as="span" role="columnheader" className="text-[10px] text-white/35">{C.breed}</Kicker>
                <Kicker as="span" role="columnheader" className="text-right text-[10px] text-white/35">{C.weight}</Kicker>
                <Kicker as="span" role="columnheader" className="text-[10px] text-white/35">{C.case}</Kicker>
              </div>
              <div role="rowgroup">
                {patients.map((e) => (
                  // the whole row opens that patient's chart in the demo
                  <div key={e.id} role="row" className={cx(cols, 'relative items-baseline border-b border-white/[0.08] py-3.5 transition-colors hover:bg-white/[0.03]')}>
                    <span role="cell" className="font-mono text-[12.5px] text-white/45 tnum">{e.profile.visit.time}</span>
                    <span role="cell" className="min-w-0 truncate text-[15px] font-medium text-white">
                      <Link
                        to={`/demo?patient=${e.id}`}
                        aria-label={L.demoListOpen.replace('{name}', patientName(e, lang))}
                        className="underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-1 focus-visible:after:ring-inset focus-visible:after:ring-island-info/70"
                      >
                        {patientName(e, lang)}
                      </Link>
                      <span className="ml-2 text-[12.5px] font-normal text-white/40 sm:hidden">{breedName(e, lang)} · {e.profile.weight} kg</span>
                    </span>
                    <span role="cell" className="hidden min-w-0 truncate text-[14px] text-white/55 sm:block">{breedName(e, lang)}</span>
                    <span role="cell" className="hidden text-right font-mono text-[12.5px] text-white/45 tnum sm:block">{e.profile.weight}</span>
                    <span role="cell" className="col-start-2 mt-1 min-w-0 text-[13.5px] text-island-info sm:col-start-auto sm:mt-0 sm:truncate">{loc(e.focus, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── 07 · Get started ─────────────────────────────────────────────

function Destination({ title, desc, accent = false, ...props }) {
  const { as = 'link', ...rest } = props;
  const cls = 'group flex w-full items-center justify-between gap-6 border-b border-white/[0.12] py-6 text-left transition-colors hover:bg-white/[0.02] sm:py-7';
  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-[22px] font-semibold tracking-[-0.02em] text-white sm:text-[26px]">{title}</span>
        <span className="mt-1.5 block text-pretty text-[14px] leading-snug text-white/50">{desc}</span>
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'shrink-0 text-[22px] transition-transform duration-300 ease-out-expo group-hover:translate-x-1',
          accent ? 'text-island-info' : 'text-white/35 group-hover:text-white',
        )}
      >
        →
      </span>
    </>
  );
  if (as === 'button') return <button type="button" className={cls} {...rest}>{body}</button>;
  return <Link className={cls} {...rest}>{body}</Link>;
}

export function FinalCta({ onRequestAccess }) {
  const { t } = useI18n();
  const L = t.landing;
  const N = t.nav;
  return (
    <section aria-labelledby="cta-title" className={cx(STAGE, 'pb-24 text-white sm:pb-32')}>
      <div className={WRAP}>
        <div className="grid grid-cols-1 gap-12 border-t border-white/[0.14] pt-16 sm:pt-20 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-5">
            <SectionIndex n="07" label={L.ctaKicker} dark />
            <Display id="cta-title" className="mt-8 text-white">{L.ctaTitle}</Display>
            <p className="mt-6 max-w-md text-pretty text-[16px] leading-[1.65] text-white/55 sm:text-[17px]">{L.ctaDesc}</p>
          </Reveal>
          <Reveal delay={120} as="ul" className="border-t border-white/[0.12] lg:col-span-6 lg:col-start-7 lg:self-end">
            <li>
              <Destination as="button" onClick={onRequestAccess} title={N.requestAccess} desc={N.accessDesc} accent />
            </li>
            <li>
              <Destination to="/system" title={N.signIn} desc={N.signInDesc} />
            </li>
            <li>
              <Destination to="/demo" title={N.demo} desc={<BrandText tone="dark">{N.demoDesc}</BrandText>} />
            </li>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
