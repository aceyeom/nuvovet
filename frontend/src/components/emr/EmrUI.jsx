import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Dog, Cat, Search, X, Plus, Printer, Save, Settings, Bell, Wifi,
  ChevronDown, AlertTriangle, Sparkles, Clock, ArrowUpRight, Minus,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { searchDrugs, createUnknownDrug } from '../../data/drugDatabase';
import { productLabel, lineMetrics, formatWon, TX_ITEMS } from '../../data/emrCatalog';
import { LAB_ORDER } from '../../data/breedProfiles';
import { NuvovetMark } from '../NuvovetLogo';

// ──────────────────────────────────────────────────────────────────
// Simulated clinic EMR — deliberately styled as a *separate* product
// (neutral greys + classic EMR blue, dense tables, Korean EMR fields)
// so the black nuvovet DUR island reads as a layer on top of it.
// ──────────────────────────────────────────────────────────────────

const TINTS = [
  'bg-amber-100 text-amber-700',
  'bg-orange-100 text-orange-700',
  'bg-stone-200 text-stone-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
];

const BREED_TINT = {
  golden_retriever: 0, sheltie: 1, french_bulldog: 2, dachshund: 3,
  domestic_sh: 4, persian: 5, siamese: 6,
};

const SEV_DOT = {
  critical: 'bg-island-critical',
  moderate: 'bg-island-moderate',
  minor: 'bg-island-minor',
  unknown: 'bg-slate-400',
  clear: 'bg-island-clear',
  reviewed: 'bg-white/70',
};

const SEV_ROW = {
  critical: 'bg-red-50/80 shadow-[inset_3px_0_0_#ef4444]',
  moderate: 'bg-amber-50/80 shadow-[inset_3px_0_0_#f59e0b]',
  minor: 'bg-yellow-50/80 shadow-[inset_3px_0_0_#eab308]',
  unknown: 'bg-slate-50 shadow-[inset_3px_0_0_#94a3b8]',
};

export function patientName(entry, lang) {
  return lang === 'ko' ? entry.profile.nameKo || entry.profile.name : entry.profile.name;
}

export function breedName(entry, lang) {
  return lang === 'ko' ? entry.breedKo || entry.breed : entry.breed;
}

export function ageLabel(age, lang) {
  const m = /(\d+)\s*y\s*(\d+)?\s*m?/i.exec(age || '');
  if (!m) return age || '';
  return lang === 'ko' ? `${m[1]}세 ${m[2] || 0}개월` : `${m[1]}y ${m[2] || 0}m`;
}

export function loc(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.en ?? value.ko ?? '';
}

// ── Atoms ────────────────────────────────────────────────────────

export function PatientAvatar({ entry, size = 36, className = '' }) {
  const Icon = entry.species === 'cat' ? Cat : Dog;
  const tint = TINTS[BREED_TINT[entry.id] ?? 0];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] ${tint} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={1.75} />
    </span>
  );
}

export function StatusChip({ status }) {
  const { t } = useI18n();
  const styles = {
    inConsult: 'bg-emr-blue text-white',
    waiting: 'bg-white text-emr-muted ring-1 ring-inset ring-emr-line',
    billing: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    done: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-[1px] text-[10.5px] font-semibold ${styles[status] || styles.waiting}`}>
      {t.emr.status[status] || status}
    </span>
  );
}

/** Mini black capsule echoing the DUR island — per-patient status in lists. */
export function DurDot({ tone, label }) {
  if (!tone) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-island-bg py-[2px] pl-1 pr-1.5 text-[9.5px] font-semibold text-white/80" title={label}>
      <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[tone] || SEV_DOT.clear}`} />
      DUR
    </span>
  );
}

function Badge({ tone = 'gray', children, title }) {
  const tones = {
    gray: 'bg-emr-head text-emr-muted ring-emr-line',
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    blue: 'bg-emr-blueSoft text-emr-blue ring-blue-200',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded px-1.5 py-[2px] text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ── Shell ────────────────────────────────────────────────────────

/**
 * Window title bar. Leaves the centre free for the DUR island, the way an
 * iPhone status bar flows around the Dynamic Island.
 */
export function EmrTitleBar({ chrome = false, clock, className = '' }) {
  const { t } = useI18n();
  return (
    <div className={`relative flex h-11 shrink-0 items-center justify-between border-b border-[#cfd5de] bg-[#e7ebf0] px-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {chrome && (
          <span className="mr-1 hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
        )}
        <span className="flex h-6 shrink-0 items-center justify-center rounded-md bg-emr-blue px-1.5 text-[9.5px] font-black tracking-wide text-white">EMR</span>
        <span className="hidden truncate text-[12.5px] font-semibold text-emr-text md:inline">{t.emr.hospital}</span>
        <span className="hidden rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emr-muted ring-1 ring-inset ring-emr-line xl:inline">
          {t.emr.simulated}
        </span>
      </div>
      <div className="flex items-center gap-3 text-emr-muted">
        <span className="hidden items-center gap-1 text-[11.5px] tnum lg:flex"><Clock size={12} />{clock}</span>
        <Bell size={14} className="hidden sm:block" />
        <Settings size={14} className="hidden sm:block" />
        <span className="flex h-6 items-center gap-1.5 rounded-full bg-white/80 pl-0.5 pr-2 text-[11.5px] font-medium text-emr-text ring-1 ring-inset ring-emr-line">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white">{t.emr.userInitial}</span>
          <span className="hidden sm:inline">{t.emr.user}</span>
        </span>
      </div>
    </div>
  );
}

export function EmrMenuBar({ active = 1, right }) {
  const { t } = useI18n();
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-emr-line bg-white px-2">
      <nav className="no-scrollbar flex min-w-0 items-center overflow-x-auto">
        {t.emr.menu.map((m, i) => (
          <span
            key={m}
            className={`relative whitespace-nowrap px-3 py-2 text-[12.5px] font-medium ${i === active ? 'text-emr-blue' : 'text-emr-muted'}`}
          >
            {m}
            {i === active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-emr-blue" />}
          </span>
        ))}
      </nav>
      {right}
    </div>
  );
}

export function EmrStatusBar({ patientsToday }) {
  const { t } = useI18n();
  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-emr-line bg-[#f5f7fa] px-3 text-[11px] text-emr-muted">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex items-center gap-1"><Wifi size={11} className="text-emerald-600" />{t.emr.statusBar.connected}</span>
        <span className="hidden sm:inline">{t.emr.room}</span>
        <span className="hidden md:inline">{t.emr.statusBar.today.replace('{n}', patientsToday)}</span>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-island-bg py-[2px] pl-1.5 pr-2 text-[10.5px] font-semibold text-white">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-island-info opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-island-info" />
        </span>
        {t.emr.statusBar.durActive}
      </span>
    </div>
  );
}

// ── Waiting list ─────────────────────────────────────────────────

export function WaitingList({ patients, selectedId, onSelect, durTone = {}, dateLabel }) {
  const { t, lang } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-end justify-between border-b border-emr-line px-3 pb-2 pt-3">
        <div>
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-emr-text">
            {t.emr.waitingList}
            <span className="rounded bg-emr-blueSoft px-1.5 py-[1px] text-[11px] font-semibold text-emr-blue tnum">{patients.length}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emr-muted tnum">{dateLabel}</p>
        </div>
      </div>
      <ul className="emr-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
        {patients.map((entry) => {
          const selected = entry.id === selectedId;
          const v = entry.profile.visit;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect?.(entry.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                  selected ? 'bg-emr-blueSoft ring-1 ring-inset ring-blue-200' : 'hover:bg-emr-head'
                }`}
                aria-current={selected ? 'true' : undefined}
              >
                <PatientAvatar entry={entry} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-emr-text">{patientName(entry, lang)}</span>
                    <span className="truncate text-[11px] text-emr-muted">{breedName(entry, lang)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-emr-muted">{loc(v.complaint, lang)}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-emr-muted tnum">{v.time}</span>
                    <StatusChip status={v.status} />
                    <span className="ml-auto"><DurDot tone={durTone[entry.id]} /></span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Patient banner ───────────────────────────────────────────────

export function PatientBanner({ entry, patients, onSelectPatient, compact = false }) {
  const { t, lang } = useI18n();
  const p = entry.profile;
  const L = t.emr.banner;
  const v = p.visit;
  const reg = p.animalRegistrationNumber;

  const meta = [
    [L.owner, `${loc(p.owner, lang)} · ${p.owner?.phone || ''}`],
    [L.regNo, reg ? <span className="font-mono tnum">{reg}</span> : <span className="text-emr-muted">{L.unregistered}</span>],
    [L.dob, <span className="tnum">{p.dateOfBirth}</span>],
    [L.blood, p.bloodType || '—'],
    [L.vet, loc(p.attendingVet, lang) || '—'],
    [L.lastVisit, <span className="tnum">{p.lastVisitDate}</span>],
    [L.insurance, loc(p.insurance, lang) || '—'],
  ];

  return (
    <div className="border-b border-emr-line bg-white px-3 py-3 sm:px-4">
      <div className="flex items-start gap-3">
        <PatientAvatar entry={entry} size={compact ? 38 : 46} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {patients && onSelectPatient ? (
              <label className="relative inline-flex items-center lg:hidden">
                <span className="sr-only">{t.emr.waitingList}</span>
                <select
                  value={entry.id}
                  onChange={(e) => onSelectPatient(e.target.value)}
                  className="appearance-none rounded-md bg-transparent py-0.5 pr-6 text-[17px] font-bold tracking-tight text-emr-text focus:outline-none focus-visible:ring-2 focus-visible:ring-emr-blue"
                >
                  {patients.map((x) => (
                    <option key={x.id} value={x.id}>{patientName(x, lang)} · {breedName(x, lang)}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-1 text-emr-muted" />
              </label>
            ) : null}
            <h2 className={`${patients && onSelectPatient ? 'hidden lg:block' : ''} text-[17px] font-bold tracking-tight text-emr-text`}>
              {patientName(entry, lang)}
            </h2>
            <span className="rounded border border-emr-line bg-emr-head px-1.5 py-[1px] font-mono text-[11px] text-emr-muted tnum">
              {L.chartNo} {p.animalChartId}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-emr-muted">
            {t.emr.species[entry.species]} · {breedName(entry, lang)} · {t.emr.sex[p.sex] || p.sex} · {ageLabel(p.age, lang)} ·{' '}
            <span className="font-semibold text-emr-text tnum">{p.weight} kg</span>
            <span className="hidden sm:inline"> · BCS {p.bodyCondition}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.allergies.length ? (
              p.allergies.map((a) => (
                <Badge key={a} tone="red"><AlertTriangle size={11} />{L.allergy}: {a}</Badge>
              ))
            ) : (
              <Badge tone="gray">{L.nkda}</Badge>
            )}
            {p.conditions.map((c) => (
              <Badge key={c} tone={/mdr1/i.test(c) ? 'amber' : 'gray'}>{c}</Badge>
            ))}
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
          <span className="flex items-center gap-1.5">
            <StatusChip status={v.status} />
            <span className="text-[12px] font-semibold text-emr-text tnum">{v.time}</span>
          </span>
          <span className="text-[11.5px] text-emr-muted">{loc(v.type, lang)}</span>
        </div>
      </div>
      {!compact && (
        <p className="mt-2.5 truncate border-t border-dashed border-emr-line pt-2 text-[11.5px] text-emr-muted sm:hidden">
          {L.owner} <span className="font-medium text-emr-text">{loc(p.owner, lang)}</span> · {p.owner?.phone} · {L.chartNo} {p.animalChartId}
        </p>
      )}
      {!compact && (
        <dl className="mt-3 hidden grid-cols-2 gap-x-5 gap-y-1.5 border-t border-dashed border-emr-line pt-2.5 text-[11.5px] sm:grid sm:grid-cols-4 xl:grid-cols-7">
          {meta.map(([k, val]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10.5px] font-medium text-emr-muted">{k}</dt>
              <dd className="truncate font-medium text-emr-text">{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────

export function EmrTabs({ tabs, active, onChange }) {
  return (
    <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-emr-line bg-white px-2 sm:px-3" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange?.(tab.id)}
          className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold transition-colors ${
            active === tab.id ? 'text-emr-blue' : 'text-emr-muted hover:text-emr-text'
          }`}
        >
          {tab.label}
          {tab.badge != null && (
            <span className={`rounded px-1.5 text-[10.5px] tnum ${active === tab.id ? 'bg-emr-blueSoft text-emr-blue' : 'bg-emr-head text-emr-muted'}`}>{tab.badge}</span>
          )}
          {tab.dot && <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[tab.dot]}`} />}
          {active === tab.id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-emr-blue" />}
        </button>
      ))}
    </div>
  );
}

// ── Prescription search ──────────────────────────────────────────

export function RxSearch({ species, existingIds = [], onAdd, scenario, favorites = [], autoFocusKey }) {
  const { t, lang } = useI18n();
  const R = t.emr.rx;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    // include species-unapproved drugs so DUR can flag them
    return searchDrugs(q).slice(0, 8);
  }, [q]);

  useEffect(() => { setHi(0); }, [q]);

  const add = (drug) => {
    if (!drug) return;
    onAdd?.(drug);
    setQ('');
    setOpen(false);
  };

  const addCustom = () => {
    if (!q.trim()) return;
    add(createUnknownDrug(q.trim()));
  };

  const scenarioDrug = scenario && !existingIds.includes(scenario.drug?.id) ? scenario : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emr-muted" />
        <input
          ref={inputRef}
          value={q}
          data-tour="rx-search"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, Math.max(results.length - 1, 0))); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); results.length ? add(results[hi]) : addCustom(); }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={R.addPlaceholder}
          aria-label={R.addPlaceholder}
          className="h-10 w-full rounded-md border border-emr-line bg-white pl-9 pr-3 text-[16px] text-emr-text placeholder:text-[#9aa3b2] focus:border-emr-blue focus:ring-2 focus:ring-emr-blue/15 sm:text-[13px]"
        />
        {open && q.trim() && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-emr-line bg-white shadow-lift">
            {results.map((d, i) => {
              const exists = existingIds.includes(d.id);
              const unapproved = d.defaultDose?.[species] === null;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={exists}
                  onMouseDown={(e) => { e.preventDefault(); if (!exists) add(d); }}
                  onMouseEnter={() => setHi(i)}
                  className={`flex w-full items-center gap-3 border-b border-emr-line/70 px-3 py-2 text-left last:border-0 ${
                    exists ? 'cursor-default opacity-50' : i === hi ? 'bg-emr-blueSoft' : 'hover:bg-emr-head'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-emr-text">{productLabel(d, lang)}</span>
                    <span className="block truncate text-[11.5px] text-emr-muted">
                      {d.name}{d.nameKr && lang !== 'ko' ? ` · ${d.nameKr}` : ''} · {d.class}
                    </span>
                  </span>
                  {unapproved && <Badge tone="amber">{R.notForSpecies.replace('{species}', t.emr.species[species])}</Badge>}
                  {exists ? <span className="text-[11px] text-emr-muted">{R.alreadyAdded}</span> : <Plus size={14} className="text-emr-blue" />}
                </button>
              );
            })}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addCustom(); }}
              className="flex w-full items-center gap-2 bg-emr-head px-3 py-2 text-left text-[12px] text-emr-muted hover:text-emr-text"
            >
              <Plus size={13} /> {R.addCustom.replace('{q}', q.trim())}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {scenarioDrug && (
          <button
            type="button"
            data-tour="scenario"
            onClick={() => add(scenarioDrug.drug)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-dashed border-dur-400 bg-dur-50 px-2.5 py-1 text-[12px] font-semibold text-dur-700 transition-colors hover:bg-dur-100"
          >
            <Sparkles size={12} className="text-dur-500" />
            <span>{R.tryThis}:</span>
            <span className="font-medium">{loc(scenarioDrug.hint, lang)}</span>
          </button>
        )}
        {favorites.filter((d) => !existingIds.includes(d.id) && d.id !== scenarioDrug?.drug?.id).slice(0, 4).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => add(d)}
            className="inline-flex items-center gap-1 rounded-full border border-emr-line bg-white px-2.5 py-1 text-[12px] font-medium text-emr-muted transition-colors hover:border-emr-blue/40 hover:text-emr-blue"
          >
            <Plus size={11} />
            {lang === 'ko' && d.nameKr ? d.nameKr : d.name.replace(/\s*\(.*\)$/, '')}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Prescription table (TX/RX) ───────────────────────────────────

function NumCell({ value, onChange, step = 0.1, ariaLabel, invalid, readOnly }) {
  const [local, setLocal] = useState(value === '' || value == null ? '' : String(value));
  useEffect(() => { setLocal(value === '' || value == null ? '' : String(value)); }, [value]);
  if (readOnly) return <span className="tnum">{value === '' ? '—' : value}</span>;
  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      aria-label={ariaLabel}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseFloat(local);
        if (!Number.isFinite(n) || n <= 0) { setLocal(value === '' || value == null ? '' : String(value)); return; }
        onChange?.(+n.toFixed(4));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const n = (parseFloat(local) || 0) + (e.key === 'ArrowUp' ? step : -step);
          if (n > 0) onChange?.(+n.toFixed(4));
        }
      }}
      className={`h-7 w-[64px] rounded border bg-white px-1.5 text-right text-[16px] tnum text-emr-text focus:border-emr-blue focus:ring-2 focus:ring-emr-blue/15 sm:text-[12.5px] ${
        invalid ? 'border-red-300 bg-red-50' : 'border-emr-line'
      }`}
    />
  );
}

function TimesCell({ value, onChange, readOnly, ariaLabel }) {
  if (readOnly) return <span className="tnum">{value}</span>;
  return (
    <span className="inline-flex items-center rounded border border-emr-line bg-white">
      <button type="button" aria-label={`${ariaLabel} −`} onClick={() => onChange(Math.max(1, value - 1))} className="flex h-7 w-6 items-center justify-center text-emr-muted hover:text-emr-text"><Minus size={11} /></button>
      <span className="w-4 text-center text-[12.5px] tnum">{value}</span>
      <button type="button" aria-label={`${ariaLabel} +`} onClick={() => onChange(Math.min(4, value + 1))} className="flex h-7 w-6 items-center justify-center text-emr-muted hover:text-emr-text"><Plus size={11} /></button>
    </span>
  );
}

/**
 * @param lines       Rx lines (see makeRxLine)
 * @param txItems     treatment keys for today's visit (TX_ITEMS)
 * @param drugTone    { drugId: severity } from unreviewed DUR findings
 * @param focusIds    drug ids of the finding currently open in the island
 */
export function RxTable({ lines, txItems = [], weight, drugTone = {}, focusIds = [], focusTone, readOnly = false, onChange, onRemove, density = 'normal', layout = 'auto' }) {
  const { t, lang } = useI18n();
  const R = t.emr.rx;
  const tx = txItems.map((k) => ({ key: k, ...TX_ITEMS[k] })).filter((x) => x.price);
  const rxRows = lines.map((l) => ({ line: l, m: lineMetrics(l, weight) }));
  const subtotal = tx.reduce((s, x) => s + x.price, 0) + rxRows.reduce((s, r) => s + r.m.price, 0);
  const vat = Math.round(subtotal * 0.1);
  const pad = density === 'compact' ? 'py-1.5' : 'py-2';

  const rowTone = (line) => {
    if (focusIds.includes(line.drugId)) return SEV_ROW[focusTone] || SEV_ROW.critical;
    return '';
  };

  return (
    <div className="overflow-hidden rounded-md border border-emr-line bg-white">
      {/* Desktop / tablet table (layout: auto = by viewport, or forced) */}
      <div className={layout === 'table' ? 'overflow-x-auto' : layout === 'cards' ? 'hidden' : 'hidden overflow-x-auto md:block'}>
        <table className="w-full min-w-[760px] border-collapse text-[12.5px] text-emr-text">
          <thead>
            <tr className="bg-emr-head text-left text-[11px] font-semibold text-emr-muted">
              <th className="w-10 border-b border-emr-line px-2 py-2 text-center">DUR</th>
              <th className="w-[72px] border-b border-emr-line px-2 py-2">{R.colType}</th>
              <th className="border-b border-emr-line px-2 py-2">{R.colName}</th>
              <th className="w-[60px] border-b border-emr-line px-2 py-2">{R.colUnit}</th>
              <th className="w-[78px] border-b border-emr-line px-2 py-2 text-right">{R.colQty}</th>
              <th className="w-[84px] border-b border-emr-line px-2 py-2 text-right">{R.colCalc}</th>
              <th className="w-[64px] border-b border-emr-line px-2 py-2 text-right">{R.colDays}</th>
              <th className="w-[76px] border-b border-emr-line px-2 py-2 text-center">{R.colTimes}</th>
              <th className="w-[52px] border-b border-emr-line px-2 py-2">{R.colRoute}</th>
              <th className="w-[88px] border-b border-emr-line px-2 py-2 text-right">{R.colPrice}</th>
              {!readOnly && <th className="w-8 border-b border-emr-line" />}
            </tr>
          </thead>
          <tbody>
            {tx.map((x) => (
              <tr key={x.key} className="text-emr-muted">
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-center`}>
                  <span className="text-[10px] text-[#b4bcc8]">—</span>
                </td>
                <td className={`border-b border-emr-line/70 px-2 ${pad}`}>
                  <span className="rounded bg-emr-head px-1.5 py-[1px] text-[10.5px] font-semibold text-emr-muted ring-1 ring-inset ring-emr-line">{R.categories[x.category]}</span>
                </td>
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-emr-text`}>{loc(x, lang)}</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad}`}>EA</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-right tnum`}>1</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-right`}>—</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-right tnum`}>1</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-center tnum`}>1</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad}`}>—</td>
                <td className={`border-b border-emr-line/70 px-2 ${pad} text-right tnum text-emr-text`}>{formatWon(x.price)}</td>
                {!readOnly && <td className="border-b border-emr-line/70" />}
              </tr>
            ))}
            {rxRows.map(({ line, m }) => {
              const tone = drugTone[line.drugId];
              return (
                <tr key={line.lineId} className={`transition-colors duration-500 ${line.isNew ? 'animate-row-in' : ''} ${rowTone(line)}`} data-drug={line.drugId}>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-center`}>
                    {tone ? (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-island-bg" title={t.island.severity[tone]}>
                        <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[tone]}`} />
                      </span>
                    ) : (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    )}
                  </td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad}`}>
                    <span className="flex items-center gap-1">
                      <span className="rounded bg-emr-blueSoft px-1.5 py-[1px] text-[10.5px] font-semibold text-emr-blue ring-1 ring-inset ring-blue-200">{R.rxShort}</span>
                      {line.isNew ? (
                        <span className="text-[10px] font-bold text-emr-blue">{R.new}</span>
                      ) : line.chronic ? (
                        <span className="text-[10px] font-medium text-emr-muted">{R.chronic}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad}`}>
                    <span className="block font-semibold">{productLabel(line.drug, lang)}</span>
                    <span className="block text-[11px] text-emr-muted">{line.drug.activeSubstance} · {line.drug.class}</span>
                  </td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-emr-muted`}>{m.unit}</td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-right`}>
                    <NumCell value={line.qty} readOnly={readOnly} step={line.qty >= 1 ? 0.5 : 0.05} ariaLabel={`${R.colQty} ${line.drug.name}`} onChange={(n) => onChange?.(line.lineId, { qty: n })} />
                  </td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-right font-medium tnum`}>{m.calculated ? `${m.calculated} mg` : '—'}</td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-right`}>
                    <NumCell value={line.days} readOnly={readOnly} step={1} ariaLabel={`${R.colDays} ${line.drug.name}`} onChange={(n) => onChange?.(line.lineId, { days: Math.max(1, Math.round(n)) })} />
                  </td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-center`}>
                    <TimesCell value={line.times} readOnly={readOnly} ariaLabel={`${R.colTimes} ${line.drug.name}`} onChange={(n) => onChange?.(line.lineId, { times: n })} />
                  </td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} font-mono text-[11.5px] text-emr-muted`}>{line.route}</td>
                  <td className={`border-b border-emr-line/70 px-2 ${pad} text-right tnum`}>{formatWon(m.price)}</td>
                  {!readOnly && (
                    <td className={`border-b border-emr-line/70 px-1 ${pad} text-center`}>
                      <button type="button" onClick={() => onRemove?.(line.lineId)} aria-label={`${R.remove} ${line.drug.name}`} className="flex h-6 w-6 items-center justify-center rounded text-[#9aa3b2] hover:bg-red-50 hover:text-red-600">
                        <X size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 10 : 11} className="px-3 py-6 text-center text-[12.5px] text-emr-muted">{R.empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className={`divide-y divide-emr-line ${layout === 'cards' ? '' : layout === 'table' ? 'hidden' : 'md:hidden'}`}>
        {rxRows.map(({ line, m }) => {
          const tone = drugTone[line.drugId];
          return (
            <div key={line.lineId} className={`px-3 py-2.5 ${line.isNew ? 'animate-row-in' : ''} ${rowTone(line)}`}>
              <div className="flex items-start gap-2">
                <span className="mt-1">
                  {tone ? (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-island-bg"><span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[tone]}`} /></span>
                  ) : (
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-emr-text">{productLabel(line.drug, lang)}</p>
                  <p className="text-[11.5px] text-emr-muted">{line.drug.activeSubstance} · {line.drug.class}{line.isNew ? ` · ${R.new}` : line.chronic ? ` · ${R.chronic}` : ''}</p>
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => onRemove?.(line.lineId)} aria-label={`${R.remove} ${line.drug.name}`} className="flex h-8 w-8 items-center justify-center rounded text-[#9aa3b2] hover:bg-red-50 hover:text-red-600">
                    <X size={15} />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-6 text-[12px] text-emr-muted">
                <span className="flex items-center gap-1">{R.colQty} <NumCell value={line.qty} readOnly={readOnly} ariaLabel={`${R.colQty} ${line.drug.name}`} onChange={(n) => onChange?.(line.lineId, { qty: n })} /> {m.unit}</span>
                <span>= <b className="text-emr-text tnum">{m.calculated} mg</b></span>
                <span className="tnum">{line.days}{R.daysSuffix} × {line.times}{R.timesSuffix}</span>
                <span className="font-mono">{line.route}</span>
                <span className="ml-auto font-medium text-emr-text tnum">{formatWon(m.price)}</span>
              </div>
            </div>
          );
        })}
        {lines.length === 0 && <p className="px-3 py-6 text-center text-[12.5px] text-emr-muted">{R.empty}</p>}
      </div>

      {/* Billing footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emr-line bg-emr-head px-3 py-2 text-[12px]">
        <span className="text-emr-muted">{R.calcHint.replace('{w}', weight)}</span>
        <span className="flex items-center gap-3 tnum">
          <span className="text-emr-muted">{R.subtotal} {formatWon(subtotal)}</span>
          <span className="hidden text-emr-muted sm:inline">{R.vat} {formatWon(vat)}</span>
          <span className="font-bold text-emr-text">{R.total} {formatWon(subtotal + vat)}</span>
        </span>
      </div>
    </div>
  );
}

export function RxToolbar({ onPrint, onSave }) {
  const { t } = useI18n();
  const R = t.emr.rx;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onPrint} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emr-line bg-white px-2.5 text-[12px] font-medium text-emr-text hover:bg-emr-head">
        <Printer size={13} /> <span className="hidden sm:inline">{R.print}</span>
      </button>
      <button type="button" onClick={onSave} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-emr-blue px-3 text-[12px] font-semibold text-white hover:bg-blue-700">
        <Save size={13} /> {R.save}
      </button>
    </div>
  );
}

// ── SOAP / visit ─────────────────────────────────────────────────

function Sparkline({ values = [], className = '' }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 56},${18 - ((v - min) / span) * 14 - 2}`).join(' ');
  return (
    <svg viewBox="0 0 56 18" className={`h-[18px] w-14 ${className}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="56" cy={18 - ((values[values.length - 1] - min) / span) * 14 - 2} r="2" fill="currentColor" />
    </svg>
  );
}

export function VitalsStrip({ entry }) {
  const { t } = useI18n();
  const p = entry.profile;
  const S = t.emr.soap;
  const items = [
    [S.weight, `${p.weight} kg`, <Sparkline values={p.weightTrend} className="text-emr-blue" />],
    [S.temp, p.temperature],
    [S.hr, p.heartRate],
    [S.rr, p.respRate],
    ['BCS', p.bodyCondition],
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-emr-line bg-white sm:grid-cols-5">
      {items.map(([k, v, extra], i) => (
        <div key={k} className={`flex items-center justify-between gap-2 px-3 py-2 ${i > 0 ? 'border-t border-emr-line sm:border-l sm:border-t-0' : ''}`}>
          <div>
            <p className="text-[10.5px] font-medium text-emr-muted">{k}</p>
            <p className="text-[13px] font-semibold text-emr-text tnum">{v}</p>
          </div>
          {extra}
        </div>
      ))}
    </div>
  );
}

export function SoapPanel({ entry }) {
  const { t, lang } = useI18n();
  const S = t.emr.soap;
  const v = entry.profile.visit;
  const blocks = [
    ['S', S.s, v.soap.s, 'bg-sky-50 text-sky-700'],
    ['O', S.o, v.soap.o, 'bg-emerald-50 text-emerald-700'],
    ['A', S.a, v.soap.a, 'bg-amber-50 text-amber-700'],
    ['P', S.p, v.soap.p, 'bg-violet-50 text-violet-700'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-emr-line bg-white px-3 py-2 text-[12.5px]">
        <span className="text-emr-muted">{S.complaint}</span>
        <span className="font-semibold text-emr-text">{loc(v.complaint, lang)}</span>
        <span className="ml-auto text-emr-muted">{loc(v.type, lang)} · <span className="tnum">{v.time}</span></span>
      </div>
      <VitalsStrip entry={entry} />
      <div className="overflow-hidden rounded-md border border-emr-line bg-white">
        {blocks.map(([k, label, text, tone], i) => (
          <div key={k} className={`flex gap-3 px-3 py-3 ${i > 0 ? 'border-t border-emr-line' : ''}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[12px] font-black ${tone}`}>{k}</span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-emr-muted">{label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-emr-text">{loc(text, lang)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Labs ─────────────────────────────────────────────────────────

function RangeBar({ value, range }) {
  if (!range) return null;
  const [lo, hi] = range;
  const span = hi - lo || 1;
  const pad = span * 0.6;
  const min = lo - pad;
  const max = hi + pad;
  const pos = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const a = ((lo - min) / (max - min)) * 100;
  const b = ((hi - min) / (max - min)) * 100;
  const out = value > hi || value < lo;
  return (
    <span className="relative block h-1.5 w-24 rounded-full bg-emr-head ring-1 ring-inset ring-emr-line">
      <span className="absolute inset-y-0 rounded-full bg-emerald-200/80" style={{ left: `${a}%`, width: `${b - a}%` }} />
      <span className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${out ? 'bg-red-500' : 'bg-emr-text'}`} style={{ left: `${pos}%` }} />
    </span>
  );
}

export function LabsPanel({ entry }) {
  const { t } = useI18n();
  const L = t.emr.labs;
  const labs = entry.profile.labResults;
  const keys = LAB_ORDER.filter((k) => labs[k]);
  return (
    <div className="overflow-hidden rounded-md border border-emr-line bg-white">
      <div className="flex items-center justify-between border-b border-emr-line bg-emr-head px-3 py-2 text-[11.5px] text-emr-muted">
        <span className="font-semibold text-emr-text">{L.panel}</span>
        <span className="tnum">{L.drawn}</span>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] text-emr-muted">
            <th className="px-3 py-2 font-semibold">{L.test}</th>
            <th className="px-3 py-2 text-right font-semibold">{L.result}</th>
            <th className="hidden px-3 py-2 font-semibold sm:table-cell">{L.ref}</th>
            <th className="px-3 py-2 font-semibold">{L.flag}</th>
            <th className="hidden px-3 py-2 sm:table-cell" />
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const lab = labs[k];
            const v = parseFloat(lab.value);
            return (
              <tr key={k} className="border-t border-emr-line/70">
                <td className="px-3 py-2 text-emr-text">{L.names[k] || k}</td>
                <td className={`px-3 py-2 text-right font-semibold tnum ${lab.status === 'high' ? 'text-red-600' : lab.status === 'low' ? 'text-blue-600' : 'text-emr-text'}`}>
                  {lab.value} <span className="text-[11px] font-normal text-emr-muted">{lab.unit}</span>
                </td>
                <td className="hidden px-3 py-2 text-emr-muted tnum sm:table-cell">{lab.ref ? `${lab.ref[0]} – ${lab.ref[1]}` : '—'}</td>
                <td className="px-3 py-2">
                  {lab.status === 'high' ? (
                    <span className="rounded bg-red-50 px-1.5 py-[1px] text-[11px] font-bold text-red-600 ring-1 ring-inset ring-red-200">H</span>
                  ) : lab.status === 'low' ? (
                    <span className="rounded bg-blue-50 px-1.5 py-[1px] text-[11px] font-bold text-blue-600 ring-1 ring-inset ring-blue-200">L</span>
                  ) : (
                    <span className="text-[11px] text-emr-muted">{L.normal}</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell"><RangeBar value={v} range={lab.ref} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────

export function HistoryPanel({ entry }) {
  const { t, lang } = useI18n();
  const H = t.emr.history;
  const tags = {
    clear: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    moderate: 'bg-amber-50 text-amber-700 ring-amber-200',
    critical: 'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    <ol className="relative space-y-3 border-l border-emr-line pl-5">
      {entry.profile.visits.map((v) => (
        <li key={v.date} className="relative">
          <span className="absolute -left-[25px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-emr-blue ring-1 ring-emr-line" />
          <div className="rounded-md border border-emr-line bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-emr-text tnum">{v.date}</span>
              <span className="text-[12.5px] text-emr-text">{loc(v.reason, lang)}</span>
              <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[10.5px] font-semibold ring-1 ring-inset ${tags[v.dur] || tags.clear}`}>
                <NuvovetMark size={9} /> DUR · {H.durTags[v.dur] || v.dur}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-emr-muted">
              <span className="font-medium text-emr-text">{H.dx}</span> {loc(v.dx, lang)} · <span className="font-medium text-emr-text">{H.rx}</span> {v.rx}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ReportLink({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[12px] font-semibold text-dur-700 hover:text-dur-800">
      {label} <ArrowUpRight size={13} />
    </button>
  );
}
