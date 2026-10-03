import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createUnknownDrug, searchDrugs } from '../data/drugDatabase';
import { checkHardstop } from '../utils/speciesHardstops';
import { useI18n } from '../i18n';

export { checkHardstop };

const fmt = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

// Drug provenance as a word. Off-label and unverified drugs lower the
// confidence of the scan, so they read in amber.
function sourceWord(source, t) {
  if (source === 'human_offlabel') return { label: t.drugInput.offLabel, tone: 'text-amber-700' };
  if (source === 'foreign') return { label: t.drugInput.foreignDrug, tone: 'text-ink-700' };
  if (source === 'unknown') return { label: t.drugInput.sourceUnknown, tone: 'text-amber-700' };
  return { label: t.drugInput.koreanApproved, tone: 'text-ink-400' };
}

const trimNum = (n) => String(parseFloat(Number(n).toFixed(2)));

// ── Dose input (type=text + inputMode=decimal; coerces on blur) ──
function DoseInput({ value, onChange, label, id }) {
  const [localVal, setLocalVal] = useState(value !== '' && value != null ? String(value) : '');

  useEffect(() => {
    setLocalVal(value !== '' && value != null ? String(value) : '');
  }, [value]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        value={localVal}
        onChange={(e) => {
          setLocalVal(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          const parsed = parseFloat(localVal);
          if (localVal === '' || isNaN(parsed)) {
            setLocalVal('');
            onChange('');
          } else {
            setLocalVal(String(parsed));
            onChange(parsed);
          }
        }}
        placeholder="—"
        className="h-10 w-full rounded-md border border-ink-200 bg-white pl-3 pr-[52px] text-right font-mono text-[16px] text-ink-900 tnum transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-dur-600 focus:outline-none focus:ring-[3px] focus:ring-dur-500/15 sm:text-[13px]"
      />
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-ink-400">
        mg/kg
      </span>
    </div>
  );
}

// ── One line of the prescription ───────────────────────────────
function PrescriptionRow({ drug, index, species, weight, onRemove, onUpdateDose }) {
  const { t, lang } = useI18n();
  const hardstop = checkHardstop(drug, species);
  const src = sourceWord(drug.source, t);
  const dose = parseFloat(drug.dosePerKg);
  const total = dose > 0 && weight > 0 ? `${trimNum(dose * weight)} mg` : null;
  const doseId = `dose-${drug.id}`;
  const secondaryName = lang === 'ko' ? drug.nameKr : null;

  return (
    <li className={`relative grid grid-cols-[22px_minmax(0,1fr)_auto] gap-x-3 gap-y-2.5 border-t border-ink-100 py-3.5 sm:grid-cols-[22px_minmax(0,1fr)_132px_76px_auto] sm:items-center ${hardstop ? 'pl-3' : ''}`}>
      {hardstop && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] bg-red-500" />}

      <span className="pt-[3px] font-mono text-[11px] text-ink-400 tnum sm:pt-0">{String(index + 1).padStart(2, '0')}</span>

      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink-900">{drug.name}</span>
          {secondaryName && <span className="text-[13px] text-ink-500">{secondaryName}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          {drug.class && <span className="font-mono text-[11.5px] text-ink-500">{drug.class}</span>}
          <span className={`kicker text-[10px] ${src.tone}`}>{src.label}</span>
        </p>
        {hardstop && (
          <p className="mt-2 text-[13px] leading-relaxed text-red-800">
            <span className="kicker mr-2 text-[10.5px] text-red-700">{t.drugInput.speciesContraindication}</span>
            {hardstop}
          </p>
        )}
      </div>

      {/* Dose — second line on phones, its own column from sm */}
      <div className="order-last col-span-3 col-start-1 flex items-center gap-3 pl-[34px] sm:order-none sm:col-span-1 sm:col-start-auto sm:block sm:pl-0">
        <label htmlFor={doseId} className="kicker shrink-0 text-[10px] text-ink-400 sm:sr-only">{t.drugInput.colDose}</label>
        <div className="w-[132px] shrink-0 sm:w-auto">
          <DoseInput id={doseId} value={drug.dosePerKg || ''} onChange={(val) => onUpdateDose(drug.id, { dosePerKg: val })} label={`${t.drugInput.dosePerKg} — ${drug.name}`} />
        </div>
        <span className={`font-mono text-[12.5px] tnum sm:hidden ${total ? 'text-ink-700' : 'text-ink-300'}`}>{total ? `= ${total}` : ''}</span>
      </div>

      <span className={`hidden text-right font-mono text-[13px] tnum sm:block ${total ? 'text-ink-900' : 'text-ink-300'}`}>{total || '—'}</span>

      <button
        type="button"
        onClick={() => onRemove(drug.id)}
        aria-label={`${t.remove} — ${drug.name}`}
        className="-mr-2 h-10 self-start rounded-md px-2 text-[13px] font-medium text-ink-400 transition-colors hover:bg-ink-50 hover:text-red-700 sm:self-center"
      >
        {t.remove}
      </button>
    </li>
  );
}

// ── Main DrugInput Component ───────────────────────────────────
export function DrugInput({ drugs, onAddDrug, onRemoveDrug, onUpdateDrug, species = 'dog', weight = 0, searchFn }) {
  const { t, lang } = useI18n();
  const uid = useId();
  const listId = `${uid}-list`;
  const inputId = `${uid}-input`;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hi, setHi] = useState(0);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedIds = new Set(drugs.map((d) => d.id));

  // Debounced search — backend first, curated local formulary as fallback (300 ms)
  const handleQueryChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        let res = searchFn ? await searchFn(val, species, 20).catch(() => null) : null;
        if (!res) res = searchDrugs(val, species);
        setResults(res);
        setHi(0);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [searchFn, species]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleAddDrug = (drug) => {
    if (selectedIds.has(drug.id)) return;
    onAddDrug(drug);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleAddUnknown = () => {
    if (!query.trim()) return;
    const unknown = createUnknownDrug(query.trim());
    if (!selectedIds.has(unknown.id)) onAddDrug(unknown);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // Options = search results + "add as unverified" at the end
  const options = [
    ...results.map((drug) => ({ type: 'drug', drug, id: `${uid}-opt-${drug.id}` })),
    ...(query.trim() ? [{ type: 'unknown', id: `${uid}-opt-unknown` }] : []),
  ];
  const open = showDropdown && options.length > 0;
  const activeOpt = open ? options[Math.min(hi, options.length - 1)] : null;

  useEffect(() => {
    if (!activeOpt) return;
    const el = document.getElementById(activeOpt.id);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOpt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (opt) => {
    if (!opt) return;
    if (opt.type === 'unknown') handleAddUnknown();
    else if (!selectedIds.has(opt.drug.id)) handleAddDrug(opt.drug);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showDropdown && options.length) setShowDropdown(true);
      setHi((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        choose(activeOpt);
      }
    } else if (e.key === 'Escape') {
      if (showDropdown) {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  const unknownLabel = fmt(t.drugInput.addUnknownDrug, { name: query.trim() });

  return (
    <div>
      {/* Search */}
      <label htmlFor={inputId} className="kicker block text-[11px] text-ink-500">{t.drugInput.addMedication}</label>
      <div className="relative mt-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeOpt ? activeOpt.id : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={onKeyDown}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
          placeholder={t.drugInput.searchPlaceholder}
          className={`h-12 w-full rounded-lg border border-ink-200 bg-white pl-3.5 ${loading ? 'pr-24' : 'pr-3.5'} text-[16px] text-ink-900 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-dur-600 focus:outline-none focus:ring-[3px] focus:ring-dur-500/15 sm:text-[14px]`}
        />
        {loading && (
          <>
            <span className="kicker pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-400">{t.drugInput.searching}</span>
            <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-px overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1/3 animate-load-sweep bg-dur-500" />
            </span>
          </>
        )}

        <p className="sr-only" role="status" aria-live="polite">
          {showDropdown && !loading ? (results.length ? fmt(t.drugInput.resultsCount, { n: results.length }) : t.drugInput.noMatchFound) : ''}
        </p>

        {/* Results */}
        {showDropdown && !loading && query.trim() && (
          <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lift">
            {results.length === 0 && (
              <p className="px-4 pb-1 pt-3 text-[13px] text-ink-500">{t.drugInput.noMatchFound}</p>
            )}
            <ul ref={listRef} id={listId} role="listbox" aria-label={t.drugInput.addMedication} className="emr-scroll max-h-[min(320px,50vh)] overflow-y-auto">
              {options.map((opt, i) => {
                const active = activeOpt?.id === opt.id;
                if (opt.type === 'unknown') {
                  return (
                    <li
                      key={opt.id}
                      id={opt.id}
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => { e.preventDefault(); handleAddUnknown(); }}
                      onMouseEnter={() => setHi(i)}
                      className={`cursor-pointer border-t border-ink-100 px-4 py-3 text-[13px] font-medium transition-colors ${active ? 'bg-ink-50 text-ink-900' : 'text-ink-600'}`}
                    >
                      {unknownLabel} <span aria-hidden="true" className="text-ink-400">→</span>
                    </li>
                  );
                }
                const { drug } = opt;
                const isSelected = selectedIds.has(drug.id);
                const hardstop = checkHardstop(drug, species);
                const src = sourceWord(drug.source, t);
                return (
                  <li
                    key={opt.id}
                    id={opt.id}
                    role="option"
                    aria-selected={active}
                    aria-disabled={isSelected || undefined}
                    onMouseDown={(e) => { e.preventDefault(); if (!isSelected) handleAddDrug(drug); }}
                    onMouseEnter={() => setHi(i)}
                    className={`relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-ink-100 px-4 py-3 first:border-t-0 transition-colors ${
                      isSelected ? 'cursor-default opacity-50' : active ? 'bg-ink-50' : ''
                    }`}
                  >
                    {hardstop && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] bg-red-500" />}
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[14px] font-semibold text-ink-900">{drug.name}</span>
                        {drug.nameKr && lang === 'ko' && <span className="text-[12.5px] text-ink-500">{drug.nameKr}</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                        {drug.class && <span className="font-mono text-[11px] text-ink-500">{drug.class}</span>}
                        {hardstop && <span className="kicker text-[10px] text-red-700">{t.drugInput.speciesContraindication}</span>}
                      </p>
                    </div>
                    <span className={`kicker text-[10px] ${isSelected ? 'text-ink-500' : src.tone}`}>
                      {isSelected ? t.drugInput.selected : src.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Prescription */}
      {drugs.length > 0 ? (
        <div className="mt-6">
          <div className="hidden grid-cols-[22px_minmax(0,1fr)_132px_76px_auto] gap-x-3 pb-2 sm:grid" aria-hidden="true">
            <span />
            <span className="kicker text-[10px] text-ink-400">{t.drugInput.colDrug}</span>
            <span className="kicker text-right text-[10px] text-ink-400">{t.drugInput.colDose}</span>
            <span className="kicker text-right text-[10px] text-ink-400">{t.drugInput.colTotal}</span>
            <span className="w-[52px]" />
          </div>
          <ul className="border-b border-ink-100" aria-label={t.drugInput.colDrug}>
            {drugs.map((drug, i) => (
              <PrescriptionRow
                key={drug.id}
                drug={drug}
                index={i}
                species={species}
                weight={weight}
                onRemove={onRemoveDrug}
                onUpdateDose={(id, patch) => onUpdateDrug(id, patch)}
              />
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
            {drugs.length === 1 ? `${t.fullSystem.addMoreDrugs}. ` : ''}
            {t.drugInput.doseOptional}
            {weight > 0 && <span className="tnum"> {fmt(t.drugInput.totalFor, { w: trimNum(weight) })}</span>}
          </p>
        </div>
      ) : (
        !query && (
          <div className="mt-6 border-y border-dashed border-ink-200 py-6 text-center">
            <p className="text-[14px] font-medium text-ink-600">{t.fullSystem.noMedications}</p>
            <p className="mt-1 text-[13px] text-ink-400">{t.drugInput.emptyHint}</p>
          </div>
        )
      )}
    </div>
  );
}
