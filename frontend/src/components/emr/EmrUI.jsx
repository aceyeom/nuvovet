import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { searchDrugs, createUnknownDrug } from '../../data/drugDatabase';
import { productLabel, lineMetrics, formatWon, TX_ITEMS } from '../../data/emrCatalog';
import { LAB_ORDER } from '../../data/breedProfiles';
import { patientPhotoUrl, patientPhotoCredit } from '../../data/patientPhotos';

// ──────────────────────────────────────────────────────────────────
// Simulated clinic EMR — modelled on the Windows desktop software Korean
// animal hospitals actually run: a title bar with window controls, a
// menu bar, an F-key toolbar, dense grids with grey column headers,
// label/value registration forms (동물번호 · 품종 "POODLE/푸들" …) and the
// TX/RX grid with the real column set (폴더명 · 이름(Tx/Rx) · 단위 · 투여량 ·
// 계산량 · 일수 · 횟수 · 경로 · 전체 · VAT · 금액).
//
// It is deliberately *not* nuvoDUR: nothing in here knows about DUR.
// The island and the row overlays are drawn on top by the caller.
// ──────────────────────────────────────────────────────────────────

export function patientName(entry, lang) {
  return lang === 'ko' ? entry.profile.nameKo || entry.profile.name : entry.profile.name;
}

export function breedName(entry, lang) {
  return lang === 'ko' ? entry.breedKo || entry.breed : entry.breed;
}

/** Breed the way the EMR stores it: "GOLDEN RETRIEVER/골든 리트리버". */
export function breedEmr(entry) {
  return `${(entry.breed || '').toUpperCase()}/${entry.breedKo || ''}`;
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

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ── Atoms ────────────────────────────────────────────────────────

/** Patient photo (real photograph) with a plain "no photo" fallback. */
export function PatientPhoto({ entry, size = 64, className = '', round = false }) {
  const [failed, setFailed] = useState(false);
  const src = patientPhotoUrl(entry.id, size);
  useEffect(() => { setFailed(false); }, [src]);
  const shape = round ? 'rounded-full' : 'rounded-[2px]';
  if (!src || failed) {
    return (
      <span
        className={cx('inline-flex shrink-0 items-center justify-center border border-emr-line bg-[#E9EDF2] font-semibold text-emr-faint', shape, className)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        aria-hidden="true"
      >
        {(entry.profile.name || '?').slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`${entry.profile.name} — ${entry.breed} (photo: ${patientPhotoCredit(entry.id)} / Unsplash)`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable="false"
      onError={() => setFailed(true)}
      className={cx('shrink-0 border border-emr-line bg-[#E9EDF2] object-cover', shape, className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Classic grey dialog button. */
export function EmrButton({ children, onClick, primary = false, className = '', disabled, title, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'inline-flex h-[26px] shrink-0 items-center justify-center whitespace-nowrap rounded-[3px] border px-2.5 text-[12px] transition-colors disabled:opacity-40',
        primary
          ? 'border-emr-blueDark bg-emr-blue font-semibold text-white hover:bg-emr-blueDark'
          : 'border-[#AEB6C1] bg-gradient-to-b from-white to-[#ECEFF3] text-emr-text hover:border-emr-blue hover:from-[#F2F8FE] hover:to-[#E1EEFB]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Group box header strip ("진료대기", "처방 검색" …). */
export function PanelHead({ title, right, className = '' }) {
  return (
    <div className={cx('flex h-[26px] shrink-0 items-center justify-between gap-2 border-b border-emr-line bg-gradient-to-b from-[#F8F9FB] to-[#E9EDF2] px-2.5', className)}>
      <span className="truncate text-[12px] font-bold text-[#27303B]">{title}</span>
      {right}
    </div>
  );
}

/** Small CSS-drawn combobox arrow. */
function ComboArrow() {
  return <span aria-hidden="true" className="ml-auto h-0 w-0 shrink-0 border-x-[3.5px] border-t-[4px] border-x-transparent border-t-emr-muted" />;
}

function FieldBox({ children, className = '', combo = false }) {
  return (
    <span className={cx('flex h-[22px] min-w-0 items-center gap-1.5 rounded-[2px] border border-[#B7BFCA] bg-white px-1.5 text-[12px] text-emr-text', className)}>
      <span className="min-w-0 truncate">{children}</span>
      {combo && <ComboArrow />}
    </span>
  );
}

// ── Window chrome ────────────────────────────────────────────────

function WindowControls() {
  return (
    <span className="flex h-full shrink-0 items-stretch" aria-hidden="true">
      <span className="flex w-[42px] items-center justify-center hover:bg-black/[0.06]"><span className="h-px w-[10px] bg-emr-text" /></span>
      <span className="flex w-[42px] items-center justify-center hover:bg-black/[0.06]"><span className="h-[9px] w-[9px] border border-emr-text" /></span>
      <span className="group relative flex w-[42px] items-center justify-center hover:bg-[#E81123]">
        <span className="absolute h-px w-[12px] rotate-45 bg-emr-text group-hover:bg-white" />
        <span className="absolute h-px w-[12px] -rotate-45 bg-emr-text group-hover:bg-white" />
      </span>
    </span>
  );
}

/**
 * Windows title bar. The centre is left empty on purpose — that is where
 * the nuvoDUR island docks, on top of the EMR window.
 */
export function EmrTitleBar({ docTitle, controls = true, className = '' }) {
  const { t } = useI18n();
  return (
    <div className={cx('relative flex h-[30px] shrink-0 select-none items-center border-b border-[#D5DAE1] bg-emr-chrome text-[12px] text-emr-text', className)}>
      <span className="flex min-w-0 items-center gap-1.5 pl-3">
        <span className="font-bold tracking-[-0.01em] text-emr-blue">{t.emr.appName}</span>
        <span className="text-emr-faint tnum">{t.emr.version}</span>
        <span className="mx-1 h-3 w-px bg-[#C8CFD8]" />
        <span className="hidden truncate text-emr-muted sm:inline">{t.emr.hospital}</span>
        {docTitle && <span className="hidden truncate text-emr-muted xl:inline">— {docTitle}</span>}
      </span>
      <span className="ml-auto" />
      {controls && <WindowControls />}
    </div>
  );
}

export function EmrMenuBar({ right }) {
  const { t } = useI18n();
  return (
    <div className="flex h-[23px] shrink-0 select-none items-center justify-between border-b border-[#E1E5EA] bg-white pl-1 pr-2 text-[12px] text-emr-text">
      <span className="no-scrollbar flex min-w-0 items-center overflow-x-auto" aria-hidden="true">
        {t.emr.menubar.map((m) => (
          <span key={m} className="whitespace-nowrap rounded-[2px] px-2 py-[2px] hover:bg-emr-select">{m}</span>
        ))}
      </span>
      {right}
    </div>
  );
}

/** F-key toolbar: big text buttons, the active module pressed in. */
export function EmrToolbar({ active = 'consult', right, compact = false }) {
  const { t } = useI18n();
  const items = compact ? t.emr.toolbar.slice(0, 5) : t.emr.toolbar;
  return (
    <div className="flex h-[44px] shrink-0 items-center gap-2 border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] px-1.5">
      <span className="no-scrollbar flex min-w-0 items-center gap-[2px] overflow-x-auto" aria-hidden="true">
        {items.map((it, i) =>
          it.sep ? (
            <span key={`sep-${i}`} className="mx-1 h-7 w-px shrink-0 bg-[#C9D0D9]" />
          ) : (
            <span
              key={it.id}
              className={cx(
                'flex h-[36px] min-w-[50px] shrink-0 select-none flex-col items-center justify-center rounded-[3px] border px-2 leading-none',
                it.id === active ? 'border-[#8DB7EA] bg-gradient-to-b from-[#E7F1FD] to-[#D3E5FA]' : 'border-transparent hover:border-[#C9D0D9] hover:bg-white',
              )}
            >
              <span className={cx('text-[12px]', it.id === active ? 'font-bold text-emr-blueDark' : 'font-medium text-emr-text')}>{it.label}</span>
              {it.key && <span className="mt-[3px] font-mono text-[9px] text-emr-faint">{it.key}</span>}
            </span>
          ),
        )}
      </span>
      {right && <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>}
    </div>
  );
}

export function EmrStatusBar({ clock, patientsToday }) {
  const { t } = useI18n();
  const S = t.emr.statusBar;
  const cell = 'flex h-full items-center border-r border-[#CDD3DB] px-2.5';
  return (
    <div className="flex h-[22px] shrink-0 select-none items-stretch border-t border-[#C3CAD3] bg-emr-chrome text-[11px] text-emr-muted">
      <span className={cell}>{S.ready}</span>
      <span className={cell}>{S.server}</span>
      <span className={cx(cell, 'hidden sm:flex')}>{t.emr.room}</span>
      <span className={cx(cell, 'hidden md:flex')}>{S.user}: {t.emr.user}</span>
      <span className={cx(cell, 'hidden lg:flex')}>{S.today.replace('{n}', patientsToday)}</span>
      <span className="ml-auto" />
      <span className="hidden h-full items-center border-l border-[#CDD3DB] px-2 font-mono text-[10px] sm:flex">NUM</span>
      <span className="flex h-full items-center border-l border-[#CDD3DB] px-2.5 tnum">{clock}</span>
    </div>
  );
}

// ── Waiting list (진료대기) ───────────────────────────────────────

const STATUS_TONE = {
  inConsult: 'font-bold text-emr-blue',
  waiting: 'text-emr-muted',
  billing: 'font-semibold text-[#C2410C]',
  done: 'text-[#15803D]',
};

export function WaitingList({ patients, selectedId, onSelect, dateLabel, showOwner = true }) {
  const { t, lang } = useI18n();
  const W = t.emr.waiting;
  const counts = patients.reduce((acc, e) => ({ ...acc, [e.profile.visit.status]: (acc[e.profile.visit.status] || 0) + 1 }), {});
  const cols = showOwner ? 'grid grid-cols-[40px_minmax(0,1fr)_56px_58px]' : 'grid grid-cols-[40px_minmax(0,1fr)_58px]';
  return (
    <div className="flex h-full min-h-0 flex-col border border-emr-line bg-white">
      <PanelHead title={`${W.title} (${patients.length})`} right={<span className="text-[11px] text-emr-muted tnum">{dateLabel}</span>} />
      <div className={cx(cols, 'h-[23px] shrink-0 border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]')} role="presentation">
        {(showOwner ? [W.cols.time, W.cols.patient, W.cols.owner, W.cols.status] : [W.cols.time, W.cols.patient, W.cols.status]).map((c) => (
          <span key={c} className="flex items-center justify-center border-r border-emr-line last:border-r-0">{c}</span>
        ))}
      </div>
      <ul className="emr-scroll min-h-0 flex-1 overflow-y-auto" aria-label={W.title}>
        {patients.map((entry, i) => {
          const selected = entry.id === selectedId;
          const v = entry.profile.visit;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect?.(entry.id)}
                aria-current={selected ? 'true' : undefined}
                className={cx(
                  cols,
                  'h-[25px] w-full border-b border-emr-grid text-left text-[12px]',
                  selected ? 'bg-emr-select' : i % 2 ? 'bg-emr-alt hover:bg-[#EAF3FE]' : 'bg-white hover:bg-[#EAF3FE]',
                )}
              >
                <span className="flex items-center justify-center text-emr-muted tnum">{v.time}</span>
                <span className="flex min-w-0 items-center gap-1 px-1.5">
                  <span className="truncate font-semibold text-emr-text">{patientName(entry, lang)}</span>
                  <span className="truncate text-[11px] text-emr-faint">{t.emr.speciesShort[entry.species]}</span>
                </span>
                {showOwner && <span className="flex items-center truncate px-1 text-emr-muted">{loc(entry.profile.owner, lang)}</span>}
                <span className={cx('flex items-center justify-center whitespace-nowrap text-[11.5px]', STATUS_TONE[v.status])}>{t.emr.status[v.status]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="shrink-0 border-t border-emr-line bg-emr-label px-2.5 py-[5px] text-[11px] leading-relaxed text-emr-muted">
        {W.summary
          .replace('{w}', counts.waiting || 0)
          .replace('{c}', counts.inConsult || 0)
          .replace('{b}', counts.billing || 0)
          .replace('{d}', counts.done || 0)}
      </div>
    </div>
  );
}

// ── Client panel (보호자 정보) ─────────────────────────────────────

export function OwnerPanel({ entry }) {
  const { t, lang } = useI18n();
  const O = t.emr.owner;
  const p = entry.profile;
  const points = Math.round(((Number(String(p.animalChartId).replace(/\D/g, '')) || 7) * 3797) % 24000 / 100) * 100;
  const rows = [
    [O.name, loc(p.owner, lang)],
    [O.phone, <span className="tnum">{p.owner?.phone}</span>],
    [O.address, O.addressValue],
    [O.visits, <span className="tnum">{(p.visits?.length || 0) + 1}{O.visitsSuffix}</span>],
    [O.receivable, <span className="tnum">₩0</span>],
    [O.points, <span className="tnum">{formatWon(points)}</span>],
    [O.insurance, loc(p.insurance, lang) || '—'],
  ];
  return (
    <div className="shrink-0 border border-emr-line bg-white">
      <PanelHead title={O.title} />
      <div className="grid grid-cols-[62px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <span className="flex h-[23px] items-center border-b border-r border-emr-grid bg-emr-label px-2 text-[11.5px] text-[#4B5563]">{k}</span>
            <span className="flex h-[23px] min-w-0 items-center border-b border-emr-grid px-2 text-[12px] text-emr-text"><span className="truncate">{v}</span></span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Patient registration form (동물 정보) ─────────────────────────

function InfoCell({ label, children, span = 1, tone, narrow = false }) {
  return (
    <div className={cx('flex min-w-0 border-b border-r border-emr-grid', span === 2 && 'col-span-2', span === 'full' && 'col-span-full')}>
      <span className={cx('flex shrink-0 items-center border-r border-emr-grid bg-emr-label text-[11.5px] text-[#4B5563]', narrow ? 'w-[58px] px-1.5' : 'w-[74px] px-2')}>{label}</span>
      <span className={cx('flex min-w-0 flex-1 items-center px-2 py-[3px] text-[12px]', tone === 'alert' ? 'font-semibold text-[#C81E1E]' : 'text-emr-text')}>
        <span className="min-w-0 truncate">{children}</span>
      </span>
    </div>
  );
}

/**
 * @param density 'wide' (4 pairs per row) | 'mid' (3) | 'narrow' (2)
 */
export function PatientInfo({ entry, patients, onSelectPatient, density = 'wide', photoSize = 84 }) {
  const { t, lang } = useI18n();
  const F = t.emr.info;
  const p = entry.profile;
  const cols = density === 'narrow' ? 'grid-cols-2' : density === 'mid' ? 'grid-cols-3' : 'grid-cols-4';

  const nameCell = patients && onSelectPatient ? (
    <label className="relative flex w-full min-w-0 items-center">
      <span className="sr-only">{F.select}</span>
      <select
        value={entry.id}
        onChange={(e) => onSelectPatient(e.target.value)}
        className="h-[20px] w-full min-w-0 appearance-none truncate rounded-[2px] border border-[#B7BFCA] bg-white pl-1 pr-5 text-[12px] font-semibold text-emr-text focus:border-emr-blue focus:outline-none"
      >
        {patients.map((x) => (
          <option key={x.id} value={x.id}>{x.profile.name} ({x.profile.nameKo})</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2"><ComboArrow /></span>
    </label>
  ) : (
    <span className="font-semibold">{p.name} ({p.nameKo})</span>
  );

  const fields = [
    [F.chartNo, <span className="font-mono tnum">{p.animalChartId}</span>],
    [F.name, nameCell],
    [F.species, t.emr.species[entry.species]],
    [F.breed, breedEmr(entry)],
    [F.sex, t.emr.sex[p.sex] || p.sex],
    [F.age, <span className="tnum">{p.age}</span>],
    [F.weight, <span className="font-semibold tnum">{p.weight} kg</span>],
    [F.dob, <span className="tnum">{p.dateOfBirth}</span>],
    [F.owner, <>{loc(p.owner, lang)} <span className="text-emr-muted tnum">{p.owner?.phone}</span></>],
    [F.vet, loc(p.attendingVet, lang) || '—'],
    [F.blood, p.bloodType || '—'],
    [F.regNo, p.animalRegistrationNumber ? <span className="font-mono tnum">{p.animalRegistrationNumber}</span> : <span className="text-emr-faint">{F.unregistered}</span>],
  ];
  const narrow = density === 'narrow';
  // narrow: [name][breed] full rows, then sex/age, weight/chart no., owner
  const layout = narrow
    ? [[1, 'full'], [3, 'full'], [4, 1], [5, 1], [6, 1], [0, 1], [8, 'full']]
    : fields.map((_, i) => [i, 1]);

  return (
    <div className="flex shrink-0 gap-2 border border-emr-line bg-white p-1.5">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <PatientPhoto entry={entry} size={photoSize} />
        <span className="text-[10.5px] text-emr-faint">{F.photo}</span>
      </div>
      <div className={cx('grid min-w-0 flex-1 self-start border-l border-t border-emr-grid', cols)}>
        {layout.map(([i, span]) => (
          <InfoCell key={fields[i][0]} label={fields[i][0]} span={span} narrow={narrow}>{fields[i][1]}</InfoCell>
        ))}
        <InfoCell label={F.allergy} span={narrow ? 'full' : 2} narrow={narrow} tone={p.allergies.length ? 'alert' : undefined}>
          {p.allergies.length ? p.allergies.join(', ') : <span className="font-normal text-emr-muted">{F.nkda}</span>}
        </InfoCell>
        <InfoCell label={F.conditions} span={narrow ? 'full' : 2} narrow={narrow}>
          {p.conditions.join(', ')}
        </InfoCell>
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────

export function EmrTabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={cx('no-scrollbar flex shrink-0 items-end gap-[2px] overflow-x-auto border-b border-emr-line px-1.5 pt-1.5', className)} role="tablist">
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(tab.id)}
            className={cx(
              'relative shrink-0 whitespace-nowrap rounded-t-[3px] border px-3.5 text-[12px]',
              on
                ? '-mb-px h-[27px] border-emr-line border-b-white bg-white font-bold text-emr-text before:absolute before:inset-x-[-1px] before:top-[-1px] before:h-[2px] before:rounded-t-[3px] before:bg-emr-blue'
                : 'h-[25px] border-[#CBD2DA] bg-[#DCE1E7] text-emr-muted hover:bg-[#E8ECF0] hover:text-emr-text',
            )}
          >
            {tab.label}
            {tab.count != null && <span className="ml-1 font-normal text-emr-muted tnum">({tab.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Visit strip (진료 정보 한 줄) ──────────────────────────────────

export function VisitStrip({ entry, dateLabel }) {
  const { t, lang } = useI18n();
  const V = t.emr.visit;
  const v = entry.profile.visit;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-emr-line bg-emr-label px-2 py-1.5 text-[11.5px] text-[#4B5563]">
      <span className="flex items-center gap-1.5">{V.date}<FieldBox className="w-[92px] tnum">{dateLabel}</FieldBox></span>
      <span className="flex items-center gap-1.5">{V.type}<FieldBox className="min-w-[64px]" combo>{loc(v.type, lang)}</FieldBox></span>
      <span className="hidden items-center gap-1.5 sm:flex">{V.time}<FieldBox className="w-[50px] tnum">{v.time}</FieldBox></span>
      <span className="hidden items-center gap-1.5 md:flex">{V.vet}<FieldBox className="min-w-[78px]" combo>{loc(entry.profile.attendingVet, lang)}</FieldBox></span>
      <span className="flex min-w-[200px] flex-1 items-center gap-1.5">{V.complaint}<FieldBox className="flex-1">{loc(v.complaint, lang)}</FieldBox></span>
    </div>
  );
}

// ── Prescription search (처방 검색) ───────────────────────────────

export function RxSearch({ species, existingIds = [], onAdd, favorites = [] }) {
  const { t, lang } = useI18n();
  const R = t.emr.rx;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    // include species-unapproved drugs so nuvoDUR can flag them
    return searchDrugs(q).slice(0, 8);
  }, [q]);

  useEffect(() => { setHi(0); }, [q]);

  const add = (drug) => {
    if (!drug) return;
    onAdd?.(drug);
    setQ('');
    setOpen(false);
  };
  const addCustom = () => { if (q.trim()) add(createUnknownDrug(q.trim())); };
  const favs = favorites.filter((d) => !existingIds.includes(d.id)).slice(0, 6);
  const resultCols = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_64px]';

  return (
    <div className="border border-emr-line bg-white">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-1.5">
        <label htmlFor="rx-search" className="shrink-0 text-[11.5px] font-semibold text-[#3B4450]">{R.search}</label>
        <div className="relative min-w-[220px] flex-1">
          <input
            id="rx-search"
            ref={inputRef}
            value={q}
            data-tour="rx-search"
            autoComplete="off"
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, Math.max(results.length - 1, 0))); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); results.length ? add(results[hi]) : addCustom(); }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={R.placeholder}
            className="h-[26px] w-full rounded-[2px] border border-[#AEB6C1] bg-white px-2 text-[13px] text-emr-text placeholder:text-emr-faint focus:border-emr-blue focus:shadow-[0_0_0_2px_rgba(31,111,209,0.15)] sm:h-[24px] sm:text-[12px]"
          />
          {open && q.trim() && (
            <div className="absolute left-0 right-0 top-full z-30 mt-px min-w-[340px] border border-[#8E99A8] bg-white shadow-[2px_3px_8px_rgba(0,0,0,0.18)]">
              <div className={cx(resultCols, 'h-[22px] border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]')}>
                {[R.cols.product, R.cols.generic, R.cols.cls, ''].map((c, i) => (
                  <span key={i} className="flex items-center border-r border-emr-line px-1.5 last:border-r-0">{c}</span>
                ))}
              </div>
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
                    className={cx(resultCols, 'h-[24px] w-full border-b border-emr-grid text-left text-[12px]', exists ? 'cursor-default text-emr-faint' : i === hi ? 'bg-emr-select' : 'hover:bg-[#EAF3FE]')}
                  >
                    <span className="truncate px-1.5 font-semibold">{productLabel(d, lang)}</span>
                    <span className="truncate px-1.5 text-emr-muted">{d.name.replace(/\s*\(.*\)$/, '')}</span>
                    <span className="truncate px-1.5 text-emr-muted">{d.class}</span>
                    <span className={cx('truncate px-1.5 text-[11px]', unapproved ? 'font-semibold text-[#B45309]' : 'text-emr-faint')}>
                      {exists ? R.alreadyAdded : unapproved ? R.noDose : ''}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addCustom(); }}
                className="flex h-[24px] w-full items-center bg-emr-label px-1.5 text-left text-[12px] text-emr-muted hover:text-emr-text"
              >
                {R.addCustom.replace('{q}', q.trim())}
              </button>
            </div>
          )}
        </div>
        <EmrButton onClick={() => { if (results.length) add(results[hi]); else inputRef.current?.focus(); }}>{R.searchBtn}</EmrButton>
      </div>
      {favs.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-emr-grid bg-emr-label px-2 py-[5px] text-[11.5px]">
          <span className="mr-1 text-[#4B5563]">{R.favorites}</span>
          {favs.map((d, i) => (
            <React.Fragment key={d.id}>
              {i > 0 && <span className="text-[#C3CAD3]" aria-hidden="true">|</span>}
              <button type="button" onClick={() => add(d)} className="rounded-[2px] px-1 text-emr-blue hover:bg-emr-select hover:underline">
                {lang === 'ko' && d.nameKr ? d.nameKr : d.name.replace(/\s*\(.*\)$/, '')}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TX/RX grid (처치/처방) ────────────────────────────────────────

/** Spreadsheet-style editable number cell. */
function NumCell({ value, onChange, step = 0.1, ariaLabel, readOnly, integer = false, min = 0 }) {
  const [local, setLocal] = useState(value === '' || value == null ? '' : String(value));
  useEffect(() => { setLocal(value === '' || value == null ? '' : String(value)); }, [value]);
  if (readOnly) return <span className="block px-1.5 text-right tnum">{value === '' ? '—' : value}</span>;
  const commit = (n) => onChange?.(integer ? Math.round(n) : +n.toFixed(4));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      aria-label={ariaLabel}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseFloat(local);
        if (!Number.isFinite(n) || n <= min) { setLocal(value === '' || value == null ? '' : String(value)); return; }
        commit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const n = (parseFloat(local) || 0) + (e.key === 'ArrowUp' ? step : -step);
          if (n > min) commit(n);
        }
      }}
      className="h-full w-full bg-transparent px-1.5 text-right text-[12px] tnum text-emr-text outline-none focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#1F6FD1]"
    />
  );
}

const ROUTE_FOLDER = { PO: 'oral', Top: 'topical', SC: 'injection', IM: 'injection', IV: 'injection', Eye: 'topical', Ear: 'topical' };

export const RX_COLUMNS = {
  full: ['no', 'folder', 'name', 'unit', 'qty', 'calc', 'days', 'times', 'route', 'total', 'vat', 'price', 'del'],
  mid: ['no', 'folder', 'name', 'unit', 'qty', 'calc', 'days', 'times', 'price', 'del'],
  compact: ['name', 'qty', 'calc', 'days', 'times', 'price'],
};
const COL_WIDTH = {
  no: '30px', folder: '62px', name: 'minmax(150px,1fr)', unit: '54px', qty: '66px', calc: '78px',
  days: '46px', times: '46px', route: '44px', total: '74px', vat: '38px', price: '80px', del: '46px',
};
const COMPACT_WIDTH = { name: 'minmax(0,1fr)', qty: '52px', calc: '62px', days: '36px', times: '36px', price: '64px' };
const NUMERIC = new Set(['qty', 'calc', 'days', 'times', 'total', 'price']);

/**
 * TX/RX grid.
 * @param lines      Rx lines (see makeRxLine)
 * @param txItems    treatment keys for today's visit (TX_ITEMS)
 * @param overlay    { drugId: severity } — rows nuvoDUR is flagging (drawn on top)
 * @param focusIds   drug ids of the finding currently open in the island
 * @param columns    'full' | 'compact'
 */
export function RxGrid({
  lines, txItems = [], weight, overlay = {}, focusIds = [], readOnly = false,
  onChange, onRemove, columns = 'full', selectedLineId, onSelectLine, footer = true, minWidth,
}) {
  const { t, lang } = useI18n();
  const R = t.emr.rx;
  const C = R.cols;
  const cols = RX_COLUMNS[columns] || RX_COLUMNS.full;
  const visibleCols = readOnly ? cols.filter((c) => c !== 'del') : cols;
  const widths = columns === 'compact' ? COMPACT_WIDTH : COL_WIDTH;
  const template = visibleCols.map((c) => widths[c]).join(' ');
  const tx = txItems.map((k) => ({ key: k, ...TX_ITEMS[k] })).filter((x) => x.price);
  const rxRows = lines.map((l) => ({ line: l, m: lineMetrics(l, weight) }));
  const subtotal = tx.reduce((s, x) => s + x.price, 0) + rxRows.reduce((s, r) => s + r.m.price, 0);
  const vat = Math.round(subtotal * 0.1);

  // ── nuvoDUR overlay: measured boxes over flagged rows ────────────
  const bodyRef = useRef(null);
  const [boxes, setBoxes] = useState([]);
  const overlayKey = JSON.stringify([overlay, focusIds, lines.map((l) => l.lineId)]);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const measure = () => {
      const out = [];
      body.querySelectorAll('[data-line-drug]').forEach((row) => {
        const id = row.getAttribute('data-line-drug');
        const sev = overlay[id];
        if (!sev) return;
        out.push({ id, sev, top: row.offsetTop, height: row.offsetHeight, focus: focusIds.includes(id) });
      });
      setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(body);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey]);

  const headLabel = { no: C.no, folder: C.folder, name: C.name, unit: C.unit, qty: C.qty, calc: C.calc, days: C.days, times: C.times, route: C.route, total: C.total, vat: C.vat, price: C.price, del: '' };

  const cell = (col, content, extra = '') => (
    <span
      key={col}
      role="cell"
      className={cx('flex h-full min-w-0 items-center border-r border-emr-grid last:border-r-0', NUMERIC.has(col) ? 'justify-end' : '', extra)}
    >
      {content}
    </span>
  );

  const txRow = (x, i) => (
    <div key={x.key} role="row" className={cx('grid h-[25px] border-b border-emr-grid text-[12px] text-emr-text', i % 2 ? 'bg-emr-alt' : 'bg-white')} style={{ gridTemplateColumns: template }}>
      {visibleCols.map((col) => {
        switch (col) {
          case 'no': return cell(col, <span className="w-full text-center text-emr-faint tnum">{i + 1}</span>);
          case 'folder': return cell(col, <span className="truncate px-1.5 text-emr-muted">{R.folders[x.category]}</span>);
          case 'name': return cell(col, <span className="truncate px-1.5">{loc(x, lang)}</span>);
          case 'unit': return cell(col, <span className="px-1.5 text-emr-muted">EA</span>);
          case 'qty': return cell(col, <span className="px-1.5 tnum">1</span>);
          case 'calc': return cell(col, <span className="px-1.5 text-emr-faint">—</span>);
          case 'days': return cell(col, <span className="px-1.5 tnum">1</span>);
          case 'times': return cell(col, <span className="px-1.5 tnum">1</span>);
          case 'route': return cell(col, <span className="px-1.5 text-emr-faint">—</span>);
          case 'total': return cell(col, <span className="px-1.5 tnum">1</span>);
          case 'vat': return cell(col, <span className="w-full text-center text-emr-muted">Y</span>);
          case 'price': return cell(col, <span className="px-1.5 tnum">{formatWon(x.price).replace('₩', '')}</span>);
          case 'del': return cell(col, null);
          default: return null;
        }
      })}
    </div>
  );

  const rxRow = ({ line, m }, i) => {
    const n = tx.length + i;
    const selected = selectedLineId === line.lineId;
    const name = line.drug.name.replace(/\s*\(.*\)$/, '');
    return (
      <div
        key={line.lineId}
        role="row"
        data-line-drug={line.drugId}
        aria-selected={selected || undefined}
        onClick={() => onSelectLine?.(line.lineId)}
        className={cx(
          'grid h-[25px] border-b border-emr-grid text-[12px] text-emr-text',
          selected ? 'bg-emr-select' : line.isNew ? 'bg-[#FFF8DB]' : n % 2 ? 'bg-emr-alt' : 'bg-white',
          line.isNew && 'animate-row-in',
        )}
        style={{ gridTemplateColumns: template }}
      >
        {visibleCols.map((col) => {
          switch (col) {
            case 'no': return cell(col, <span className="w-full text-center text-emr-faint tnum">{n + 1}</span>);
            case 'folder': return cell(col, <span className="truncate px-1.5 text-emr-muted">{R.folders[ROUTE_FOLDER[line.route] || 'oral']}</span>);
            case 'name':
              return cell(col, (
                <span className="flex min-w-0 items-center gap-1.5 px-1.5" title={`${line.drug.activeSubstance || name} · ${line.drug.class}`}>
                  <span className="truncate font-semibold">{productLabel(line.drug, lang)}</span>
                  {columns !== 'compact' && <span className="hidden truncate text-[11px] text-emr-faint xl:inline">{name}</span>}
                  {line.isNew && <span className="shrink-0 text-[10.5px] font-bold text-[#B45309]">{R.newMark}</span>}
                </span>
              ));
            case 'unit': return cell(col, <span className="px-1.5 text-emr-muted">{m.unit}</span>);
            case 'qty': return cell(col, <NumCell value={line.qty} readOnly={readOnly} step={line.qty >= 1 ? 0.5 : 0.05} ariaLabel={`${C.qty} ${name}`} onChange={(v) => onChange?.(line.lineId, { qty: v })} />);
            case 'calc': return cell(col, <span className="px-1.5 font-semibold tnum">{m.calculated ? `${m.calculated}` : '—'}<span className="ml-0.5 text-[10.5px] font-normal text-emr-faint">mg</span></span>);
            case 'days': return cell(col, <NumCell value={line.days} readOnly={readOnly} step={1} integer ariaLabel={`${C.days} ${name}`} onChange={(v) => onChange?.(line.lineId, { days: Math.max(1, v) })} />);
            case 'times': return cell(col, <NumCell value={line.times} readOnly={readOnly} step={1} integer ariaLabel={`${C.times} ${name}`} onChange={(v) => onChange?.(line.lineId, { times: Math.min(4, Math.max(1, v)) })} />);
            case 'route': return cell(col, <span className="px-1.5 font-mono text-[11px] text-emr-muted">{line.route}</span>);
            case 'total': return cell(col, <span className="px-1.5 text-emr-muted tnum">{m.total}</span>);
            case 'vat': return cell(col, <span className="w-full text-center text-emr-muted">Y</span>);
            case 'price': return cell(col, <span className="px-1.5 tnum">{formatWon(m.price).replace('₩', '')}</span>);
            case 'del':
              return cell(col, (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove?.(line.lineId); }}
                  aria-label={`${R.del} ${name}`}
                  className="mx-auto rounded-[2px] px-1 text-[11px] text-emr-faint hover:bg-[#FDE8E8] hover:text-[#C81E1E]"
                >
                  {R.del}
                </button>
              ));
            default: return null;
          }
        })}
      </div>
    );
  };

  return (
    <div className="border border-emr-line bg-white" role="table" aria-label={R.title}>
      <div className="emr-scroll overflow-x-auto">
        <div style={{ minWidth: minWidth ?? (columns === 'full' ? 820 : columns === 'mid' ? 620 : 0) }}>
          <div
            role="row"
            className="grid h-[24px] border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]"
            style={{ gridTemplateColumns: template }}
          >
            {visibleCols.map((col) => (
              <span key={col} role="columnheader" className="flex items-center justify-center truncate border-r border-emr-line px-1 last:border-r-0">
                {headLabel[col]}
              </span>
            ))}
          </div>
          <div ref={bodyRef} className="relative" role="rowgroup">
            {tx.map(txRow)}
            {rxRows.map(rxRow)}
            {lines.length === 0 && tx.length === 0 && (
              <div className="px-3 py-5 text-center text-[12px] text-emr-muted">{R.empty}</div>
            )}
            {/* empty grid lines below the data, like a fresh EMR form */}
            {Array.from({ length: Math.max(0, 2 - lines.length) }).map((_, i) => (
              <div key={`pad-${i}`} className="grid h-[25px] border-b border-emr-grid" style={{ gridTemplateColumns: template }} aria-hidden="true">
                {visibleCols.map((col) => <span key={col} className="border-r border-emr-grid last:border-r-0" />)}
              </div>
            ))}
            {/* nuvoDUR layer — drawn on top of the EMR grid, never inside it */}
            {boxes.map((b) => (
              <span
                key={b.id}
                aria-hidden="true"
                className="dur-row-overlay"
                data-sev={b.sev}
                data-focus={b.focus ? 'true' : 'false'}
                style={{ top: b.top - 1, height: b.height + 1 }}
              />
            ))}
          </div>
        </div>
      </div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-emr-line bg-emr-label px-2.5 py-[5px] text-[12px] tnum">
          <span className="mr-auto text-[11px] text-emr-muted">{R.calcHint.replace('{w}', weight)}</span>
          <span className="text-emr-muted">{R.subtotal} <b className="font-semibold text-emr-text">{formatWon(subtotal)}</b></span>
          <span className="hidden text-emr-muted sm:inline">{R.vat} <b className="font-semibold text-emr-text">{formatWon(vat)}</b></span>
          <span className="text-emr-muted">{R.total} <b className="text-[13px] font-bold text-emr-blueDark">{formatWon(subtotal + vat)}</b></span>
        </div>
      )}
    </div>
  );
}

// ── Rx memo (처방 메모 · 복약지도) ─────────────────────────────────

export function RxMemo({ entry }) {
  const { t, lang } = useI18n();
  const R = t.emr.rx;
  return (
    <div className="border border-emr-line bg-white">
      <PanelHead title={R.memo} />
      <div className="m-1.5 min-h-[58px] rounded-[2px] border border-[#B7BFCA] bg-white px-2 py-1.5 text-[12px] leading-relaxed text-emr-text">
        <p>{loc(entry.profile.visit.soap.p, lang)}</p>
        <p className="text-emr-muted">{R.memoDefault}</p>
      </div>
    </div>
  );
}

// ── Recent prescriptions (최근 처방 이력) ──────────────────────────

export function RxHistory({ entry }) {
  const { t, lang } = useI18n();
  const H = t.emr.history;
  const cols = 'grid grid-cols-[86px_minmax(0,1.2fr)_minmax(0,1fr)_112px]';
  return (
    <div className="border border-emr-line bg-white">
      <PanelHead title={t.emr.rx.recent} right={<span className="text-[11px] text-emr-muted">{H.count.replace('{n}', entry.profile.visits.length)}</span>} />
      <div className={cx(cols, 'h-[23px] border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]')}>
        {[H.date, H.rx, H.dx, H.vet].map((c) => (
          <span key={c} className="flex items-center justify-center border-r border-emr-line last:border-r-0">{c}</span>
        ))}
      </div>
      {entry.profile.visits.map((v, i) => (
        <div key={v.date} className={cx(cols, 'h-[25px] border-b border-emr-grid text-[12px] last:border-b-0', i % 2 ? 'bg-emr-alt' : 'bg-white')}>
          <span className="flex items-center justify-center border-r border-emr-grid text-emr-muted tnum">{v.date}</span>
          <span className="flex items-center truncate border-r border-emr-grid px-2 text-emr-text">{v.rx}</span>
          <span className="flex items-center truncate border-r border-emr-grid px-2 text-emr-muted">{loc(v.dx, lang)}</span>
          <span className="flex min-w-0 items-center px-2 text-emr-muted"><span className="truncate">{loc(entry.profile.attendingVet, lang)}</span></span>
        </div>
      ))}
    </div>
  );
}

// ── SOAP (진료기록) ───────────────────────────────────────────────

function FormRow({ label, children, sub }) {
  return (
    <div className="flex min-w-0 border-b border-emr-grid last:border-b-0">
      <span className="flex w-[96px] shrink-0 flex-col justify-center border-r border-emr-grid bg-emr-label px-2 py-1.5 text-[11.5px] text-[#4B5563]">
        <span className="font-bold text-emr-text">{label}</span>
        {sub && <span className="text-[10.5px]">{sub}</span>}
      </span>
      <span className="min-w-0 flex-1 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-emr-text">{children}</span>
    </div>
  );
}

export function VitalsRow({ entry }) {
  const { t } = useI18n();
  const S = t.emr.soap;
  const p = entry.profile;
  const trend = p.weightTrend?.length > 1 ? +(p.weight - p.weightTrend[0]).toFixed(1) : null;
  const items = [
    [S.weight, <>{p.weight} kg{trend != null && <span className="ml-1 text-[11px] font-normal text-emr-muted">({trend > 0 ? '+' : ''}{trend} kg / {S.trendSpan})</span>}</>],
    [S.temp, p.temperature],
    [S.hr, p.heartRate],
    [S.rr, p.respRate],
    ['BCS', p.bodyCondition],
  ];
  return (
    <div className="grid grid-cols-2 border-l border-t border-emr-grid bg-white sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="flex min-w-0 border-b border-r border-emr-grid">
          <span className="flex w-[52px] shrink-0 items-center border-r border-emr-grid bg-emr-label px-2 text-[11.5px] text-[#4B5563]">{k}</span>
          <span className="flex min-w-0 items-center truncate px-2 py-[3px] text-[12px] font-semibold text-emr-text tnum">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function SoapPanel({ entry, dateLabel }) {
  const { t, lang } = useI18n();
  const S = t.emr.soap;
  const v = entry.profile.visit;
  return (
    <div className="space-y-1.5">
      <VisitStrip entry={entry} dateLabel={dateLabel} />
      <div className="border border-emr-line bg-white">
        <PanelHead title={S.vitals} />
        <div className="p-1.5"><VitalsRow entry={entry} /></div>
      </div>
      <div className="border border-emr-line bg-white">
        <PanelHead title={S.title} />
        <div>
          <FormRow label="S" sub={S.s}>{loc(v.soap.s, lang)}</FormRow>
          <FormRow label="O" sub={S.o}>{loc(v.soap.o, lang)}</FormRow>
          <FormRow label="A" sub={S.a}>{loc(v.soap.a, lang)}</FormRow>
          <FormRow label="P" sub={S.p}>{loc(v.soap.p, lang)}</FormRow>
        </div>
      </div>
    </div>
  );
}

// ── Labs (검사결과) ───────────────────────────────────────────────

export function LabsPanel({ entry, dateLabel }) {
  const { t } = useI18n();
  const L = t.emr.labs;
  const labs = entry.profile.labResults;
  const keys = LAB_ORDER.filter((k) => labs[k]);
  const cols = 'grid grid-cols-[minmax(0,1.6fr)_80px_64px_minmax(0,1fr)_48px]';
  return (
    <div className="border border-emr-line bg-white">
      <PanelHead title={L.panel} right={<span className="text-[11px] text-emr-muted tnum">{L.drawn.replace('{d}', dateLabel)}</span>} />
      <div className={cx(cols, 'h-[23px] border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]')}>
        {[L.test, L.result, L.unit, L.ref, L.flag].map((c) => (
          <span key={c} className="flex items-center justify-center border-r border-emr-line last:border-r-0">{c}</span>
        ))}
      </div>
      {keys.map((k, i) => {
        const lab = labs[k];
        const tone = lab.status === 'high' ? 'text-[#C81E1E]' : lab.status === 'low' ? 'text-[#1D4ED8]' : 'text-emr-text';
        return (
          <div key={k} className={cx(cols, 'h-[25px] border-b border-emr-grid text-[12px]', i % 2 ? 'bg-emr-alt' : 'bg-white')}>
            <span className="flex items-center truncate border-r border-emr-grid px-2 text-emr-text">{L.names[k] || k}</span>
            <span className={cx('flex items-center justify-end border-r border-emr-grid px-2 font-semibold tnum', tone)}>{lab.value}</span>
            <span className="flex items-center border-r border-emr-grid px-2 text-[11px] text-emr-muted">{lab.unit}</span>
            <span className="flex items-center border-r border-emr-grid px-2 text-emr-muted tnum">{lab.ref ? `${lab.ref[0]} – ${lab.ref[1]}` : '—'}</span>
            <span className={cx('flex items-center justify-center font-bold', tone)}>{lab.status === 'high' ? 'H' : lab.status === 'low' ? 'L' : <span className="font-normal text-emr-faint">—</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── History (진료이력) ────────────────────────────────────────────

export function HistoryPanel({ entry }) {
  const { t, lang } = useI18n();
  const H = t.emr.history;
  const cols = 'grid grid-cols-[86px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_112px]';
  return (
    <div className="border border-emr-line bg-white">
      <PanelHead title={H.title} right={<span className="text-[11px] text-emr-muted">{H.count.replace('{n}', entry.profile.visits.length)}</span>} />
      <div className="emr-scroll overflow-x-auto">
        <div className="min-w-[620px]">
          <div className={cx(cols, 'h-[23px] border-b border-emr-line bg-gradient-to-b from-[#FBFCFD] to-[#ECEFF3] text-[11px] font-medium text-[#3B4450]')}>
            {[H.date, H.reason, H.dx, H.rx, H.vet].map((c) => (
              <span key={c} className="flex items-center justify-center border-r border-emr-line last:border-r-0">{c}</span>
            ))}
          </div>
          {entry.profile.visits.map((v, i) => (
            <div key={v.date} className={cx(cols, 'h-[25px] border-b border-emr-grid text-[12px]', i % 2 ? 'bg-emr-alt' : 'bg-white')}>
              <span className="flex items-center justify-center border-r border-emr-grid text-emr-muted tnum">{v.date}</span>
              <span className="flex items-center truncate border-r border-emr-grid px-2 text-emr-text">{loc(v.reason, lang)}</span>
              <span className="flex items-center truncate border-r border-emr-grid px-2 text-emr-text">{loc(v.dx, lang)}</span>
              <span className="flex items-center truncate border-r border-emr-grid px-2 text-emr-muted">{v.rx}</span>
              <span className="flex min-w-0 items-center px-2 text-emr-muted"><span className="truncate">{loc(entry.profile.attendingVet, lang)}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
