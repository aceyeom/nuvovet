import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ──────────────────────────────────────────────────────────────────
// nuvoDUR island
//
// A Dynamic-Island-style overlay that floats on top of any EMR.
// It stays a quiet pill while the regimen is safe, morphs to a glance
// when something is off, and expands into a card with the why and a
// one-tap fix. Size changes are measured and animated with a spring
// curve (see .dur-island in index.css); content crossfades with blur.
//
// Type does the talking: severity is a coloured word, the brand is a
// word, structure comes from rules and spacing — no badges or glyphs.
//
// Purely presentational — state lives in the caller (useDurMonitor for
// the live demo, a scripted timeline for the landing hero).
// ──────────────────────────────────────────────────────────────────

const SEV = {
  critical: { text: 'text-island-critical', rgb: '255,107,94' },
  moderate: { text: 'text-island-moderate', rgb: '255,179,64' },
  minor: { text: 'text-island-minor', rgb: '255,216,77' },
  unknown: { text: 'text-slate-300', rgb: '148,163,184' },
};

const WIDTH = { expanded: 440, list: 416, summary: 384 };
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

/** The product name, set small inside the island. */
function Brand({ className = '' }) {
  return (
    <span className={`font-semibold tracking-[-0.02em] text-white/60 ${className}`}>
      nuvo<span className="text-island-info">DUR</span>
    </span>
  );
}

/** Severity as a word: CRITICAL / MODERATE … in the severity colour. */
function SevWord({ severity, children, className = '' }) {
  const s = SEV[severity] || SEV.unknown;
  return (
    <span className={`kicker text-[10.5px] ${s.text} ${className}`}>
      {children}
    </span>
  );
}

/** A sliding segment on a hairline track — the island is screening. */
function Scanner() {
  return (
    <span className="relative ml-1 h-[2px] w-9 shrink-0 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 w-1/3 animate-load-sweep rounded-full bg-island-info shadow-[0_0_8px_rgba(79,209,197,0.9)]" />
    </span>
  );
}

function TextBtn({ onClick, label, children, disabled, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // 28px to the eye, 40px to a finger
      className={`kicker kicker-tight relative h-7 min-w-[26px] rounded-md px-2 text-[10.5px] text-white/45 transition-colors after:absolute after:-inset-x-0.5 after:-inset-y-1.5 hover:bg-white/[0.07] hover:text-white disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}

function ReportLink({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="group relative inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/55 transition-colors after:absolute after:-inset-x-1.5 after:-inset-y-2 hover:text-white">
      {label}
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
    </button>
  );
}

// ── Views ────────────────────────────────────────────────────────

function CompactView({ status, size, onToggle, interactive, expandedLabel }) {
  const h = COMPACT_H[size] || COMPACT_H.md;
  const Tag = interactive ? 'button' : 'div';
  const alert = Boolean(SEV[status.tone]);
  const fs = size === 'sm' ? 'text-[12.5px]' : 'text-[13px]';
  const titleTone =
    status.tone === 'clear' ? 'text-island-clear'
    : status.tone === 'idle' ? 'text-white/70'
    : status.tone === 'reviewed' ? 'text-white/85'
    : 'text-white';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onToggle : undefined}
      aria-expanded={interactive ? false : undefined}
      aria-label={interactive ? expandedLabel : undefined}
      className={`relative flex items-center gap-2.5 whitespace-nowrap px-4 text-left ${interactive ? 'cursor-pointer' : ''}`}
      style={{ height: h }}
    >
      {alert ? <SevWord severity={status.tone}>{status.title}</SevWord> : <Brand className={fs} />}
      <span className="h-3.5 w-px shrink-0 bg-white/15" aria-hidden="true" />
      {alert ? (
        <span className={`${fs} max-w-[250px] truncate font-medium text-white`}>{status.detail}</span>
      ) : (
        <span className={`${fs} flex min-w-0 items-center gap-1.5`}>
          <span className={`font-semibold tracking-[-0.01em] ${titleTone}`}>{status.title}</span>
          {status.detail && <span className="max-w-[220px] truncate text-white/50">· {status.detail}</span>}
        </span>
      )}
      {status.extra > 0 && <span className="font-mono text-[11px] font-medium text-white/45 tnum">+{status.extra}</span>}
      {status.tone === 'checking' && <Scanner />}
    </Tag>
  );
}

function SummaryView({ summary, labels, onCollapse, onOpenReport }) {
  return (
    <div className="p-4 pb-3.5" style={{ width: summary.width }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <SevWord severity="clear" className="!text-island-clear">{labels.clearWord}</SevWord>
          <p className="mt-1.5 text-[16px] font-semibold tracking-[-0.015em] text-white">{summary.title}</p>
          <p className="mt-0.5 text-[12.5px] text-white/50">{summary.detail}</p>
        </div>
        {onCollapse && <TextBtn onClick={onCollapse} label={labels.close}>{labels.closeShort}</TextBtn>}
      </div>
      <dl className="mt-3.5 border-t border-white/10">
        {summary.checks.map((c) => (
          <div key={c} className="flex items-center justify-between border-b border-white/[0.07] py-[7px]">
            <dt className="text-[12.5px] text-white/70">{c}</dt>
            <dd className="kicker text-[10.5px] text-island-clear">{labels.pass}</dd>
          </div>
        ))}
      </dl>
      {onOpenReport && (
        <div className="mt-3">
          <ReportLink onClick={onOpenReport} label={labels.report} />
        </div>
      )}
    </div>
  );
}

function ListView({ list, width, labels, onSelect, onCollapse, onOpenReport, footnote, heading }) {
  return (
    <div className="px-2 pb-2 pt-2.5" style={{ width }}>
      <div className="flex items-center gap-2.5 px-2.5 pb-2">
        <Brand className="text-[12.5px]" />
        <span className="h-3 w-px bg-white/15" aria-hidden="true" />
        <span className="text-[12.5px] font-semibold text-white/85">{heading}</span>
        <span className="ml-auto" />
        {onCollapse && <TextBtn onClick={onCollapse} label={labels.close}>{labels.closeShort}</TextBtn>}
      </div>
      <ul className="max-h-[300px] overflow-y-auto border-t border-white/10">
        {list.map((row) => (
          <li key={row.id} className="border-b border-white/[0.07]">
            <button
              type="button"
              onClick={() => onSelect?.(row.id)}
              className={`group grid w-full grid-cols-[88px_1fr_auto] items-baseline gap-x-2 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${row.reviewed ? 'opacity-50' : ''}`}
            >
              <SevWord severity={row.reviewed ? 'unknown' : row.severity} className={row.reviewed ? '!text-white/45' : ''}>
                {row.reviewed ? labels.reviewed : row.severityLabel}
              </SevWord>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-white">{row.title}</span>
                <span className="mt-0.5 block truncate text-[12px] text-white/45">{row.drugsLabel}</span>
              </span>
              <span aria-hidden="true" className="text-[13px] text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60">→</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 px-2.5 pb-1 pt-2.5">
        <span className="truncate text-[11.5px] text-white/40">{footnote}</span>
        {onOpenReport && <ReportLink onClick={onOpenReport} label={labels.report} />}
      </div>
    </div>
  );
}

function ExpandedView({ focus, width, labels, onNav, onResolve, onAck, onCollapse, onOpenReport, highlightAction }) {
  const s = SEV[focus.severity] || SEV.unknown;
  return (
    <div className="relative p-4 pb-3.5" style={{ width }}>
      {/* severity light from the top-left corner */}
      <span
        className="pointer-events-none absolute -left-12 -top-20 h-48 w-64 rounded-full blur-2xl"
        style={{ background: `radial-gradient(closest-side, rgba(${s.rgb},0.22), transparent)` }}
      />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <SevWord severity={focus.severity}>{focus.severityLabel}</SevWord>
          {focus.kindLabel && (
            <>
              <span className="h-3 w-px bg-white/15" aria-hidden="true" />
              <span className="truncate text-[11.5px] font-medium text-white/45">{focus.kindLabel}</span>
            </>
          )}
          <div className="ml-auto flex items-center">
            {focus.total > 1 && (
              <>
                <TextBtn onClick={() => onNav?.(-1)} label={labels.prev} disabled={!onNav}>←</TextBtn>
                <span className="px-1 font-mono text-[11px] text-white/45 tnum">{focus.index + 1}/{focus.total}</span>
                <TextBtn onClick={() => onNav?.(1)} label={labels.next} disabled={!onNav}>→</TextBtn>
              </>
            )}
            {onCollapse && <TextBtn onClick={onCollapse} label={labels.close} className="ml-1">{labels.closeShort}</TextBtn>}
          </div>
        </div>

        <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-white">{focus.title}</h3>
        {focus.drugs.length > 0 && (
          <p className="mt-1 font-mono text-[12px] text-white/55">
            {focus.drugs.join(focus.kind === 'interaction' ? '  ×  ' : '  ·  ')}
          </p>
        )}

        {focus.summary && <p className="mt-2.5 text-[13px] leading-[1.6] text-white/65">{focus.summary}</p>}

        {focus.suggestion && (
          <div className="mt-3.5 border-l-2 border-island-info/70 pl-3">
            <p className="kicker text-[10px] text-island-info">
              {focus.hasResolution ? labels.suggested : labels.recommended}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-white">{focus.suggestion}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {focus.reviewed ? (
            <span className="kicker text-[11px] text-white/55">{labels.reviewed}</span>
          ) : (
            <>
              {focus.hasResolution && onResolve && (
                <button
                  type="button"
                  data-island-action="resolve"
                  onClick={() => onResolve(focus.id)}
                  className={`relative inline-flex h-8 items-center rounded-full bg-white px-4 text-[12.5px] font-semibold text-ink-900 transition-transform after:absolute after:-inset-y-1 after:inset-x-0 hover:scale-[1.03] active:scale-[0.97] ${highlightAction === 'resolve' ? 'scale-[0.97] ring-4 ring-white/25' : ''}`}
                >
                  {focus.verb}
                </button>
              )}
              {onAck && (
                <button
                  type="button"
                  data-island-action="ack"
                  onClick={() => onAck(focus.id)}
                  className={`relative inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold transition-colors after:absolute after:-inset-y-1 after:inset-x-0 ${focus.hasResolution ? 'text-white/75 ring-1 ring-inset ring-white/15 hover:bg-white/[0.07] hover:text-white' : 'bg-white text-ink-900 hover:bg-white/90'}`}
                >
                  {labels.acknowledge}
                </button>
              )}
            </>
          )}
          {onOpenReport && (
            <span className="ml-auto">
              <ReportLink onClick={onOpenReport} label={labels.report} />
            </span>
          )}
        </div>

        {focus.citation && <p className="mt-3.5 truncate border-t border-white/[0.08] pt-2.5 font-mono text-[10.5px] text-white/30">{focus.citation}</p>}
      </div>
    </div>
  );
}

// ── Island ───────────────────────────────────────────────────────

/**
 * @param {'compact'|'summary'|'list'|'expanded'} view
 * @param {object}  status    compact pill model { tone, title, detail, extra }
 * @param {object}  focus     expanded card model (describeFinding + severityLabel/kindLabel/index/total/reviewed)
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
  const alertTone = effectiveView === 'compact' ? status?.tone : effectiveView === 'expanded' ? focus?.severity : null;
  const ring = SEV[alertTone]?.rgb;

  return (
    <div className={`relative ${className}`} style={style} data-tone={alertTone || status?.tone || 'idle'}>
      {/* severity halo — outside the clipped surface */}
      <span
        aria-hidden="true"
        className={`dur-island pointer-events-none absolute left-0 top-0 ${ring && alertTone === 'critical' ? 'animate-halo' : ''}`}
        style={{
          width: box.w,
          height: box.h,
          borderRadius: radius,
          boxShadow: ring ? `0 0 0 1px rgba(${ring},0.55), 0 0 28px -4px rgba(${ring},0.55)` : '0 0 0 1px rgba(255,255,255,0)',
          opacity: ring ? 1 : 0,
        }}
      />
      <div
        ref={rootRef}
        className="dur-island relative overflow-hidden bg-island-bg text-white shadow-island"
        style={{ width: box.w, height: box.h, borderRadius: radius }}
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
        aria-label="nuvoDUR"
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
    </div>
  );
}
