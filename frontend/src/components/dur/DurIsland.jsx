import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X, Sparkles, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { NuvovetMark } from '../NuvovetLogo';

// ──────────────────────────────────────────────────────────────────
// nuvovet DUR island
//
// A Dynamic-Island-style overlay that floats on top of any EMR.
// It stays a quiet pill while the regimen is safe, morphs to a glance
// when something is off, and expands into a card with the why and a
// one-tap fix. Size changes are measured and animated with a spring
// curve (see .dur-island in index.css); content crossfades with blur.
//
// Purely presentational — state lives in the caller (useDurMonitor for
// the live demo, a scripted timeline for the landing hero).
// ──────────────────────────────────────────────────────────────────

const SEV = {
  critical: { text: 'text-island-critical', dot: 'bg-island-critical', chip: 'bg-island-critical/15 text-island-critical', glow: 'rgba(255,107,94,0.22)' },
  moderate: { text: 'text-island-moderate', dot: 'bg-island-moderate', chip: 'bg-island-moderate/15 text-island-moderate', glow: 'rgba(255,179,64,0.20)' },
  minor: { text: 'text-island-minor', dot: 'bg-island-minor', chip: 'bg-island-minor/15 text-island-minor', glow: 'rgba(255,216,77,0.16)' },
  unknown: { text: 'text-slate-300', dot: 'bg-slate-400', chip: 'bg-white/10 text-slate-300', glow: 'rgba(148,163,184,0.16)' },
};

const WIDTH = { expanded: 436, list: 412, summary: 380 };
const COMPACT_H = { md: 40, sm: 36 };

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

// ── Small parts ──────────────────────────────────────────────────

function Spinner({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PulseDot({ color, speed = 'normal' }) {
  return (
    <span className="relative flex h-2.5 w-2.5 items-center justify-center">
      <span
        className={`absolute inline-flex h-full w-full rounded-full ${color} animate-island-pulse`}
        style={speed === 'fast' ? { animationDuration: '1.4s' } : undefined}
      />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

function Indicator({ tone }) {
  if (tone === 'checking') {
    return (
      <span className="flex h-[22px] w-[22px] items-center justify-center text-island-info">
        <Spinner />
      </span>
    );
  }
  if (tone === 'clear') {
    return (
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-island-clear/15 text-island-clear">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (tone === 'reviewed') {
    return (
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/10 text-white/80">
        <ShieldCheck size={13} strokeWidth={2.4} />
      </span>
    );
  }
  if (SEV[tone]) {
    return (
      <span className="flex h-[22px] w-[22px] items-center justify-center">
        <PulseDot color={SEV[tone].dot} speed={tone === 'critical' ? 'fast' : 'normal'} />
      </span>
    );
  }
  // idle / monitoring — the brand mark breathing in teal
  return (
    <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full bg-island-info/15 text-island-info">
      <NuvovetMark size={12} />
    </span>
  );
}

function SeverityChip({ severity, label }) {
  const s = SEV[severity] || SEV.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.06em] ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function IconBtn({ onClick, label, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

// ── Views ────────────────────────────────────────────────────────

function CompactView({ status, size, onToggle, interactive, expandedLabel }) {
  const h = COMPACT_H[size] || COMPACT_H.md;
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onToggle : undefined}
      aria-expanded={interactive ? false : undefined}
      aria-label={interactive ? expandedLabel : undefined}
      className={`relative flex items-center gap-2 whitespace-nowrap pl-[9px] pr-3.5 text-left ${interactive ? 'cursor-pointer' : ''}`}
      style={{ height: h }}
    >
      <Indicator tone={status.tone} />
      <span className={`${size === 'sm' ? 'text-[12.5px]' : 'text-[13px]'} font-semibold tracking-[-0.01em] ${SEV[status.tone]?.text || 'text-white'}`}>
        {status.title}
      </span>
      {status.detail && (
        <span className={`${size === 'sm' ? 'text-[12.5px]' : 'text-[13px]'} max-w-[230px] truncate text-white/60`}>{status.detail}</span>
      )}
      {status.extra > 0 && (
        <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-[1px] text-[11px] font-semibold text-white/80 tnum">+{status.extra}</span>
      )}
      {status.tone === 'checking' && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-y-0 -left-1/2 w-1/2 animate-island-shimmer bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
        </span>
      )}
    </Tag>
  );
}

function SummaryView({ summary, labels, onCollapse, onOpenReport }) {
  return (
    <div className="p-4" style={{ width: summary.width }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-island-clear/15 text-island-clear">
          <Check size={16} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-white">{summary.title}</p>
          <p className="mt-0.5 text-[12.5px] text-white/55">{summary.detail}</p>
        </div>
        <IconBtn onClick={onCollapse} label={labels.close}><X size={15} /></IconBtn>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {summary.checks.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-[11.5px] text-white/75 ring-1 ring-inset ring-white/10">
            <Check size={11} strokeWidth={3} className="text-island-clear" />
            {c}
          </span>
        ))}
      </div>
      {onOpenReport && (
        <button type="button" onClick={onOpenReport} className="mt-3.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-dur-300 hover:text-dur-200">
          {labels.report} <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

function ListView({ list, width, labels, onSelect, onCollapse, onOpenReport, footnote, heading }) {
  return (
    <div className="p-2" style={{ width }}>
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
        <span className="text-[12px] font-medium text-white/45">nuvovet DUR</span>
        <span className="text-[12px] font-semibold text-white/85">{heading}</span>
        <span className="ml-auto" />
        <IconBtn onClick={onCollapse} label={labels.close}><X size={15} /></IconBtn>
      </div>
      <ul className="max-h-[300px] space-y-0.5 overflow-y-auto">
        {list.map((row) => {
          const s = SEV[row.severity] || SEV.unknown;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect?.(row.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] ${row.reviewed ? 'opacity-55' : ''}`}
              >
                <span className="mt-[5px] flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                  {row.reviewed ? <Check size={11} strokeWidth={3} className="text-white/70" /> : <span className={`h-2 w-2 rounded-full ${s.dot}`} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`text-[10.5px] font-bold uppercase tracking-[0.06em] ${row.reviewed ? 'text-white/50' : s.text}`}>
                      {row.reviewed ? labels.reviewed : row.severityLabel}
                    </span>
                    <span className="truncate text-[13px] font-medium text-white">{row.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-white/50">{row.drugsLabel}</span>
                </span>
                <ChevronRight size={15} className="mt-1 shrink-0 text-white/30" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/10 px-2.5 pb-1 pt-2.5">
        <span className="truncate text-[11.5px] text-white/40">{footnote}</span>
        {onOpenReport && (
          <button type="button" onClick={onOpenReport} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-dur-300 hover:text-dur-200">
            {labels.report} <ArrowUpRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function ExpandedView({ focus, width, labels, onNav, onResolve, onAck, onCollapse, onOpenReport, highlightAction }) {
  const s = SEV[focus.severity] || SEV.unknown;
  return (
    <div className="relative p-4 pb-3.5" style={{ width }}>
      {/* severity glow */}
      <span
        className="pointer-events-none absolute -left-10 -top-16 h-44 w-56 rounded-full blur-2xl"
        style={{ background: `radial-gradient(closest-side, ${s.glow}, transparent)` }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <SeverityChip severity={focus.severity} label={focus.severityLabel} />
          <span className="truncate text-[11.5px] font-medium text-white/40">nuvovet DUR</span>
          <div className="ml-auto flex items-center">
            {focus.total > 1 && (
              <>
                <IconBtn onClick={() => onNav?.(-1)} label={labels.prev}><ChevronLeft size={15} /></IconBtn>
                <span className="px-0.5 text-[11.5px] font-medium text-white/50 tnum">{focus.index + 1}/{focus.total}</span>
                <IconBtn onClick={() => onNav?.(1)} label={labels.next}><ChevronRight size={15} /></IconBtn>
              </>
            )}
            <IconBtn onClick={onCollapse} label={labels.close}><X size={15} /></IconBtn>
          </div>
        </div>

        <h3 className="mt-2.5 text-[16.5px] font-semibold leading-snug tracking-[-0.015em] text-white">{focus.title}</h3>

        {focus.drugs.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {focus.drugs.map((d, i) => (
              <React.Fragment key={`${d}-${i}`}>
                {i > 0 && <span className="text-[12px] text-white/30">{focus.kind === 'interaction' ? '⇄' : '·'}</span>}
                <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[12.5px] font-medium text-white/90 ring-1 ring-inset ring-white/10">{d}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {focus.summary && <p className="mt-2.5 text-[13px] leading-[1.55] text-white/65">{focus.summary}</p>}

        {focus.suggestion && (
          <div className="mt-3 flex gap-2.5 rounded-xl bg-white/[0.055] px-3 py-2.5 ring-1 ring-inset ring-white/10">
            <Sparkles size={14} className="mt-[3px] shrink-0 text-island-info" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-island-info/90">{focus.hasResolution ? labels.suggested : labels.recommended}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-white">{focus.suggestion}</p>
            </div>
          </div>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          {focus.reviewed ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12.5px] font-semibold text-white/80">
              <Check size={13} strokeWidth={3} /> {labels.reviewed}
            </span>
          ) : (
            <>
              {focus.hasResolution && onResolve && (
                <button
                  type="button"
                  data-island-action="resolve"
                  onClick={() => onResolve(focus.id)}
                  className={`inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-ink-900 transition-transform hover:scale-[1.03] active:scale-[0.97] ${highlightAction === 'resolve' ? 'ring-4 ring-white/25' : ''}`}
                >
                  {focus.verb}
                </button>
              )}
              {onAck && (
                <button
                  type="button"
                  data-island-action="ack"
                  onClick={() => onAck(focus.id)}
                  className={`inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${focus.hasResolution ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-ink-900 hover:bg-white/90'}`}
                >
                  {labels.acknowledge}
                </button>
              )}
            </>
          )}
          {onOpenReport && (
            <button type="button" onClick={onOpenReport} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-white/55 hover:text-white">
              {labels.report} <ArrowUpRight size={13} />
            </button>
          )}
        </div>

        {focus.citation && <p className="mt-3 truncate font-mono text-[10.5px] text-white/30">{focus.citation}</p>}
      </div>
    </div>
  );
}

// ── Island ───────────────────────────────────────────────────────

/**
 * @param {'compact'|'summary'|'list'|'expanded'} view
 * @param {object}  status    compact pill model { tone, title, detail, extra }
 * @param {object}  focus     expanded card model (see describeFinding + severityLabel/index/total/reviewed)
 * @param {Array}   list      rows for the list view
 * @param {object}  summary   clear-state card model { title, detail, checks[] }
 * @param {object}  labels    t.island.ui
 */
export function DurIsland({
  view = 'compact',
  status,
  focus,
  list = [],
  listHeading,
  listFootnote,
  summary,
  labels,
  size = 'md',
  interactive = true,
  maxWidth,
  highlightAction,
  onToggle,
  onSelect,
  onNav,
  onResolve,
  onAck,
  onCollapse,
  onOpenReport,
  onHoverChange,
  className = '',
  style,
}) {
  const vw = useViewportWidth();
  const limit = Math.max(260, Math.min(maxWidth ?? Infinity, vw - 24));
  const contentRef = useRef(null);
  const [box, setBox] = useState({ w: 200, h: COMPACT_H[size] || 40 });

  const effectiveView = view === 'expanded' && !focus ? 'compact' : view === 'summary' && !summary ? 'compact' : view;
  const width =
    effectiveView === 'expanded' ? Math.min(WIDTH.expanded, limit)
    : effectiveView === 'list' ? Math.min(WIDTH.list, limit)
    : effectiveView === 'summary' ? Math.min(WIDTH.summary, limit)
    : null;

  const contentKey =
    effectiveView === 'compact' ? `c:${status?.tone}:${status?.title}:${status?.detail}`
    : effectiveView === 'expanded' ? `e:${focus?.id}:${focus?.reviewed ? 1 : 0}`
    : effectiveView;

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.min(Math.ceil(el.offsetWidth), limit);
      const h = Math.ceil(el.offsetHeight);
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [contentKey, limit, width]);

  // Escape collapses an open island
  useEffect(() => {
    if (effectiveView === 'compact' || !onCollapse) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCollapse(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectiveView, onCollapse]);

  // ── Crossfade: the outgoing content blurs out while the new one blurs in
  const snapshot = { view: effectiveView, status, focus, list, summary, listHeading, listFootnote, width, highlightAction };
  const prevRef = useRef({ key: contentKey, snap: snapshot });
  const exitTimer = useRef(null);
  const [exiting, setExiting] = useState(null);
  useLayoutEffect(() => {
    const prev = prevRef.current;
    if (prev.key !== contentKey) {
      setExiting(prev);
      clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(() => setExiting(null), 240);
    }
    prevRef.current = { key: contentKey, snap: snapshot };
  });
  useEffect(() => () => clearTimeout(exitTimer.current), []);

  // Keep keyboard focus inside the island when its content is swapped
  // (e.g. Escape collapses the card, or a fix is applied).
  const rootRef = useRef(null);
  const focusInside = useRef(false);
  useLayoutEffect(() => {
    if (!focusInside.current) return;
    const root = rootRef.current;
    if (root && !root.contains(document.activeElement)) {
      const el = contentRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
      el?.focus({ preventScroll: true });
    }
  }, [contentKey]);

  const renderView = (snap, live) => {
    switch (snap.view) {
      case 'summary':
        return <SummaryView summary={{ ...snap.summary, width: snap.width }} labels={labels} onCollapse={live ? onCollapse : undefined} onOpenReport={live ? onOpenReport : undefined} />;
      case 'list':
        return (
          <ListView
            list={snap.list}
            width={snap.width}
            labels={labels}
            heading={snap.listHeading}
            footnote={snap.listFootnote}
            onSelect={live ? onSelect : undefined}
            onCollapse={live ? onCollapse : undefined}
            onOpenReport={live ? onOpenReport : undefined}
          />
        );
      case 'expanded':
        return (
          <ExpandedView
            focus={snap.focus}
            width={snap.width}
            labels={labels}
            highlightAction={snap.highlightAction}
            onNav={live ? onNav : undefined}
            onResolve={onResolve}
            onAck={onAck}
            onCollapse={live ? onCollapse : undefined}
            onOpenReport={onOpenReport}
          />
        );
      default:
        return <CompactView status={snap.status} size={size} onToggle={onToggle} interactive={interactive && live} expandedLabel={labels?.open} />;
    }
  };

  const open = effectiveView !== 'compact';
  const radius = open ? 26 : box.h / 2;

  return (
    <div
      ref={rootRef}
      className={`dur-island relative overflow-hidden bg-island-bg text-white shadow-island ${className}`}
      style={{ width: box.w, height: box.h, borderRadius: radius, ...style }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onFocus={() => { focusInside.current = true; onHoverChange?.(true); }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          focusInside.current = false;
          onHoverChange?.(false);
        }
      }}
      role="region"
      aria-label="nuvovet DUR"
    >
      {/* top sheen */}
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {exiting && exiting.key !== contentKey && (
        <div
          key={`x:${exiting.key}`}
          aria-hidden="true"
          className="dur-island-content-exit pointer-events-none absolute left-0 top-0"
          style={{ width: exiting.snap.width ?? 'max-content', maxWidth: limit }}
        >
          {renderView(exiting.snap, false)}
        </div>
      )}
      <div
        ref={contentRef}
        key={contentKey}
        className="dur-island-content-enter absolute left-0 top-0"
        style={{ width: width ?? 'max-content', maxWidth: limit }}
      >
        {renderView(snapshot, true)}
      </div>
    </div>
  );
}
