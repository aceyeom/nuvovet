import React, { useState, useCallback, useEffect, useRef, useId } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ProductLockup, BrandText } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { EMRImportModal } from '../components/EMRImportModal';
import { WorkspaceHeader, FormularyStatus } from '../components/Layout/Header';
import { runFullDURAnalysis } from '../utils/durEngine';
import { searchDrugsApi, isBackendAvailable, getBreedsApi, getConditionsApi, getAllergiesApi } from '../lib/api';
import { searchPatients, savePatient, addVisitRecord, getPatientById } from '../lib/patientStorage';

const SYSTEM_PASSWORD = 'vetdur2025';

// The gate is remembered for the browser tab, so moving between the
// workspace and the patient list does not ask for the code again.
const AUTH_KEY = 'nuvovet-workspace-auth';
const readAuth = () => { try { return sessionStorage.getItem(AUTH_KEY) === '1'; } catch { return false; } };
const writeAuth = () => { try { sessionStorage.setItem(AUTH_KEY, '1'); } catch { /* storage unavailable */ } };

const fmt = (s, vars = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

// ── Shared field styles ───────────────────────────────────────────
const INPUT =
  'h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-[16px] text-ink-900 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-dur-600 focus:outline-none focus:ring-[3px] focus:ring-dur-500/15 sm:text-[14px]';
const IMPORTED = '!border-dur-400 bg-dur-50/50';
const LABEL = 'kicker block text-[10.5px] text-ink-500';

function FieldLabel({ htmlFor, children, aside }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className={LABEL}>{children}</label>
      {aside}
    </div>
  );
}

// ── Decimal number input ─────────────────────────────────────────
// Keeps the raw string while editing, coerces on blur.
function DecimalInput({ value, onChange, onBlur, placeholder, className, min, max, id, suffix, describedBy }) {
  const [localVal, setLocalVal] = useState(value !== 0 && value !== null && value !== undefined ? String(value) : '');

  useEffect(() => {
    setLocalVal(value !== 0 && value !== null && value !== undefined ? String(value) : '');
  }, [value]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-describedby={describedBy}
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
            let coerced = parsed;
            if (min !== undefined && coerced < min) coerced = min;
            if (max !== undefined && coerced > max) coerced = max;
            setLocalVal(String(coerced));
            onChange(coerced);
          }
          onBlur?.();
        }}
        placeholder={placeholder}
        className={`${className} font-mono tnum ${suffix ? 'pr-14' : ''}`}
      />
      {suffix && (
        <span aria-hidden="true" className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400 ${/^[\x20-\x7E]+$/.test(suffix) ? 'font-mono' : ''}`}>
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Allergies / conditions — a ruled list, not chips ─────────────
function TagInput({ id, label, items, onAdd, onRemove, placeholder, suggestions = [] }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [hi, setHi] = useState(0);
  const listId = `${id}-list`;

  const filtered = suggestions
    .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && !items.includes(s))
    .slice(0, 8);
  const open = showSug && value.trim() !== '' && filtered.length > 0;

  const handleAdd = (item) => {
    const trimmed = (item ?? value).trim();
    if (trimmed && !items.includes(trimmed)) onAdd(trimmed);
    setValue('');
    setShowSug(false);
    setHi(0);
  };

  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {items.length > 0 && (
        <ul className="mb-2 divide-y divide-ink-100 border-y border-ink-100">
          {items.map((item) => (
            <li key={item} className="flex items-center justify-between gap-3 py-1 pl-0.5">
              <span className="min-w-0 truncate text-[14px] font-medium text-ink-900">{item}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`${t.remove} — ${item}`}
                className="h-9 shrink-0 rounded-md px-2 text-[12.5px] font-medium text-ink-400 transition-colors hover:text-red-700"
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex gap-2">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${hi}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(e.target.value); setShowSug(true); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(open ? filtered[hi] : undefined); }
            else if (e.key === 'ArrowDown' && open) { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Escape') setShowSug(false);
          }}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={placeholder}
          className={INPUT}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleAdd()}
          className="h-11 shrink-0 rounded-md px-4 text-[13px] font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 hover:ring-ink-300"
        >
          {t.add}
        </button>
        {open && (
          <ul id={listId} role="listbox" aria-label={label} className="emr-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lift">
            {filtered.map((s, i) => (
              <li
                key={s}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === hi}
                onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}
                onMouseEnter={() => setHi(i)}
                className={`cursor-pointer px-3.5 py-2.5 text-[14px] text-ink-800 ${i === hi ? 'bg-ink-50' : ''}`}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Breed input with MDR1 marker ─────────────────────────────────
function BreedInput({ id, value, onChange, species, className = '' }) {
  const { t } = useI18n();
  const [input, setInput] = useState(value || '');
  const [showSug, setShowSug] = useState(false);
  const [breedList, setBreedList] = useState([]);
  const [hi, setHi] = useState(0);
  const listId = `${id}-list`;

  useEffect(() => { setInput(value || ''); }, [value]);
  useEffect(() => {
    getBreedsApi(species).then((breeds) => setBreedList(breeds)).catch(() => {});
  }, [species]);

  const filtered = breedList
    .filter((b) => b.breed.toLowerCase().includes(input.toLowerCase()) && b.breed !== input)
    .slice(0, 10);
  const open = showSug && filtered.length > 0;

  const handleSelect = (breed) => {
    setInput(breed);
    onChange(breed);
    setShowSug(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${hi}` : undefined}
        autoComplete="off"
        value={input}
        onChange={(e) => { setInput(e.target.value); onChange(e.target.value); setShowSug(true); setHi(0); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); handleSelect(filtered[hi].breed); }
          else if (e.key === 'Escape') setShowSug(false);
        }}
        onFocus={() => setShowSug(true)}
        onBlur={() => setTimeout(() => setShowSug(false), 150)}
        placeholder={species === 'cat' ? t.fullSystem.breedPlaceholderCat : t.fullSystem.breedPlaceholder}
        className={`${INPUT} ${className}`}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={t.fullSystem.breedLabel} className="emr-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lift">
          {filtered.map((b, i) => (
            <li
              key={b.breed}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(b.breed); }}
              onMouseEnter={() => setHi(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2.5 text-[14px] text-ink-800 ${i === hi ? 'bg-ink-50' : ''}`}
            >
              <span>{b.breed}</span>
              {b.mdr1 && <span className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-amber-700">MDR1</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Section header: 01 PATIENT ───────────────────────────────────
function StepHead({ n, id, title, hint }) {
  return (
    <div>
      <h2 id={id} className="flex items-baseline gap-3 border-b border-ink-900 pb-2.5">
        <span className="font-mono text-[11px] font-medium text-ink-400 tnum">{n}</span>
        <span className="kicker text-[11px] text-ink-900">{title}</span>
      </h2>
      {hint && <p className="mt-3 text-[13.5px] leading-relaxed text-ink-500">{hint}</p>}
    </div>
  );
}

// ── Segmented choice (species, sex) ───────────────────────────────
function Choice({ pressed, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`h-11 rounded-md border px-3 text-[14px] font-medium transition-colors ${
        pressed ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:text-ink-900'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// ── Password Gate ─────────────────────────────────────────────────
function PasswordGate({ onAuthenticate }) {
  const { t } = useI18n();
  const F = t.fullSystem;
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === SYSTEM_PASSWORD) {
      onAuthenticate();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      {/* Brand panel — what this workspace is (vs. the public demo) */}
      <aside className="relative overflow-hidden bg-ink-950 px-5 pb-9 pt-5 text-white sm:px-10 lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-clinical-grid-dark opacity-60 [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]" />
        <div className="relative flex items-center justify-between">
          <Link to="/" className="-ml-1.5 inline-flex h-10 items-center gap-2 rounded-md px-1.5 text-[13px] font-medium text-white/55 transition-colors hover:text-white">
            <span aria-hidden="true">←</span> nuvovet
          </Link>
          <LangToggle tone="dark" />
        </div>

        <div className="relative mt-10 lg:mt-0">
          <ProductLockup product="dur" size="xl" tone="dark" />
          <p className="kicker mt-6 text-[11px] text-dur-300">{F.gateKicker}</p>
          <h1 className="mt-3 max-w-[30rem] text-balance text-[26px] font-bold leading-[1.2] tracking-[-0.03em] sm:text-[32px]">
            <BrandText tone="dark">{F.gateTitle}</BrandText>
          </h1>
          <ol className="mt-8 hidden max-w-[30rem] border-t border-white/10 sm:block">
            {F.gatePoints.map((p, i) => (
              <li key={p} className="grid grid-cols-[32px_minmax(0,1fr)] border-b border-white/10 py-3.5 text-[14px] leading-relaxed text-white/70">
                <span className="font-mono text-[11px] leading-[22px] text-dur-300 tnum">{String(i + 1).padStart(2, '0')}</span>
                <span><BrandText tone="dark">{p}</BrandText></span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative mt-10 hidden max-w-[30rem] text-[12px] leading-relaxed text-white/35 lg:block">{F.gateDisclaimer}</p>
      </aside>

      {/* Sign-in */}
      <main className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 sm:py-14 lg:items-center">
        <div className="w-full max-w-[380px]">
          <h2 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900">{F.accessTitle}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500"><BrandText>{F.accessDesc}</BrandText></p>

          <form onSubmit={handleSubmit} className="mt-8" noValidate>
            <label htmlFor="access-code" className={LABEL}>{F.passwordPlaceholder}</label>
            <div className="relative mt-2">
              <input
                id="access-code"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(false); }}
                autoComplete="current-password"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={error || undefined}
                aria-describedby={error ? 'access-error' : undefined}
                className={`h-12 w-full rounded-md border bg-white pl-3.5 pr-[76px] font-mono text-[16px] tracking-[0.04em] text-ink-900 transition-colors focus:outline-none focus:ring-[3px] ${
                  error ? 'border-red-500 focus:border-red-600 focus:ring-red-500/15' : 'border-ink-200 hover:border-ink-300 focus:border-dur-600 focus:ring-dur-500/15'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-controls="access-code"
                className="absolute right-1 top-1/2 h-10 -translate-y-1/2 rounded px-3 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
              >
                {showPassword ? F.hideCode : F.showCode}
              </button>
            </div>
            {error && (
              <p id="access-error" role="alert" className="mt-2 text-[13px] text-red-700">{F.invalidPassword}</p>
            )}
            <button type="submit" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink-900 text-[14.5px] font-semibold text-white transition-colors hover:bg-ink-800">
              {F.enterSystem} <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="mt-12">
            <p className={LABEL}>{F.noCodeTitle}</p>
            <ul className="mt-3 border-t border-ink-200">
              <li>
                <button type="button" onClick={() => navigate('/demo')} className="group flex w-full items-center justify-between gap-4 border-b border-ink-200 py-3.5 text-left">
                  <span>
                    <span className="block text-[14.5px] font-semibold text-ink-900">{F.gateDemo}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-500"><BrandText>{F.gateDemoDesc}</BrandText></span>
                  </span>
                  <span aria-hidden="true" className="text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900">→</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setAccessOpen(true)} className="group flex w-full items-center justify-between gap-4 border-b border-ink-200 py-3.5 text-left">
                  <span>
                    <span className="block text-[14.5px] font-semibold text-ink-900">{F.requestCode}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-500">{F.requestCodeDesc}</span>
                  </span>
                  <span aria-hidden="true" className="text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900">→</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <RequestAccessModal isOpen={accessOpen} onClose={() => setAccessOpen(false)} product="dur" />
    </div>
  );
}

// ── Full System Main ──────────────────────────────────────────────
export default function FullSystem() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useI18n();
  const F = t.fullSystem;
  const uid = useId();
  const [authenticated, setAuthenticated] = useState(readAuth);

  // ── Patient state ─────────────────────────────────────────────
  const [patientId, setPatientId] = useState(null);
  const [patientName, setPatientName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [species, setSpecies] = useState(null); // null = not yet selected
  const [weight, setWeight] = useState('');
  const [sex, setSex] = useState('Unknown');
  const [breed, setBreed] = useState('');

  // Additional details (collapsed by default)
  const [ageYears, setAgeYears] = useState('');
  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [creatinine, setCreatinine] = useState('');
  const [alt, setAlt] = useState('');
  const [additionalOpen, setAdditionalOpen] = useState(false);

  // ── Drug state ────────────────────────────────────────────────
  const [drugs, setDrugs] = useState([]);

  // ── Patient lookup state ──────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatientList, setShowPatientList] = useState(false);
  const [saveProfileChecked, setSaveProfileChecked] = useState(false);

  // ── Condition/allergy suggestions from backend ────────────────
  const [conditionSuggestions, setConditionSuggestions] = useState([]);
  const [allergySuggestions, setAllergySuggestions] = useState([]);

  // ── UI state ──────────────────────────────────────────────────
  const [showEMRModal, setShowEMRModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [importBanner, setImportBanner] = useState(false);
  const [importedFields, setImportedFields] = useState(new Set());
  const [runVisible, setRunVisible] = useState(true);

  // ── Flow state ────────────────────────────────────────────────
  const [step, setStep] = useState('input');
  const [results, setResults] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const pollRef = useRef(null);
  const debounceRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const toastRef = useRef(null);
  const runRef = useRef(null);

  // ── Backend polling ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await isBackendAvailable();
      if (!cancelled) setIsConnected(ok);
    };
    check();
    pollRef.current = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, []);

  // ── Load condition/allergy suggestions from backend ──────────
  useEffect(() => {
    getConditionsApi().then(setConditionSuggestions).catch(() => {});
    getAllergiesApi().then(setAllergySuggestions).catch(() => {});
  }, []);

  // ── Patient search debounce ───────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!patientSearch.trim()) { setPatientSuggestions([]); return undefined; }
    searchDebounceRef.current = setTimeout(() => {
      setPatientSuggestions(searchPatients(patientSearch));
    }, 150);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [patientSearch]);

  // ── Auto-rerun on detail changes ─────────────────────────────
  useEffect(() => {
    if (step !== 'results' || drugs.length === 0) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const w = typeof weight === 'number' ? weight : parseFloat(weight) || 0;
    debounceRef.current = setTimeout(() => {
      const newResults = runFullDURAnalysis(drugs, species, w);
      newResults.wasRefined = true;
      setResults(newResults);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [breed, sex, ageYears, conditions, allergies, creatinine, alt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Each step starts at the top of the page ──────────────────
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [step]);

  // ── Phones: keep "Run" reachable once its section scrolls away ─
  useEffect(() => {
    const el = runRef.current;
    if (!authenticated || step !== 'input' || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setRunVisible(entry.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [authenticated, step]);

  useEffect(() => () => clearTimeout(toastRef.current), []);

  // ── Drug callbacks ────────────────────────────────────────────
  const handleAddDrug = useCallback((drug) => setDrugs((prev) => [...prev, drug]), []);
  const handleRemoveDrug = useCallback((drugId) => setDrugs((prev) => prev.filter((d) => d.id !== drugId)), []);
  const handleUpdateDrug = useCallback(
    (drugId, patch) => setDrugs((prev) => prev.map((d) => (d.id === drugId ? { ...d, ...patch } : d))),
    [],
  );

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const handleSelectPatient = (p) => {
    setPatientId(p.id);
    setPatientName(p.name || '');
    setOwnerPhone(p.owner_phone || '');
    setSpecies(p.species || 'dog');
    setWeight(p.weight_kg != null ? String(p.weight_kg) : '');
    setBreed(p.breed || '');
    setSex(p.sex || 'Unknown');
    setAgeYears(p.age_years != null ? String(p.age_years) : '');
    setConditions(p.conditions || []);
    setAllergies(p.allergies || []);
    setCreatinine(p.creatinine_mg_dL != null ? String(p.creatinine_mg_dL) : '');
    setAlt(p.alt_u_L != null ? String(p.alt_u_L) : '');
    setAdditionalOpen(Boolean(p.age_years != null || p.conditions?.length || p.allergies?.length || p.creatinine_mg_dL != null || p.alt_u_L != null));
    setPatientSearch(p.name || '');
    setShowPatientList(false);
  };

  // ── "Start visit" from the patient list ──────────────────────
  useEffect(() => {
    const id = location.state?.preloadPatientId;
    if (!authenticated || !id) return;
    const p = getPatientById(id);
    if (p) handleSelectPatient(p);
    navigate(location.pathname, { replace: true, state: null });
  }, [authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authenticated) {
    return <PasswordGate onAuthenticate={() => { writeAuth(); setAuthenticated(true); }} />;
  }

  // ── Derived ──────────────────────────────────────────────────
  const weightNum = typeof weight === 'number' ? weight : parseFloat(weight) || 0;
  const canRun = Boolean(species && weightNum > 0 && drugs.length > 0);
  const pairCount = (drugs.length * (drugs.length - 1)) / 2;
  const speciesShort = species === 'cat' ? t.species.catShort : t.species.dogShort;

  const handleSavePatient = () => {
    const profile = savePatient({
      id: patientId || undefined,
      name: patientName || fmt(t.results.anonPatient, { species: speciesShort }),
      owner_phone: ownerPhone || null,
      species: species || 'dog',
      breed: breed || null,
      weight_kg: weightNum || null,
      sex: sex !== 'Unknown' ? sex : null,
      age_years: ageYears ? parseFloat(ageYears) : null,
      allergies,
      conditions,
      creatinine_mg_dL: creatinine ? parseFloat(creatinine) : null,
      alt_u_L: alt ? parseFloat(alt) : null,
    });
    setPatientId(profile.id);
    showToast(F.patientSaved);
  };

  const handleRunAnalysis = () => {
    if (!canRun) return;
    if (saveProfileChecked) handleSavePatient();
    setStep('analyzing');
  };

  const handleAnalysisComplete = () => {
    setResults(runFullDURAnalysis(drugs, species, weightNum));
    setStep('results');
  };

  const handleUpdatePatientRecord = () => {
    if (!patientId || !results) return;
    addVisitRecord(patientId, {
      date: new Date().toISOString(),
      drugs: drugs.map((d) => d.id),
      dur_summary: results?.overallSeverity?.label || 'Unknown',
    });
    handleSavePatient();
    showToast(F.visitRecorded);
  };

  const handleImportComplete = (data, drugObjects) => {
    const filled = new Set();
    if (data.patient_name) { setPatientName(data.patient_name); filled.add('name'); }
    if (data.owner_phone) { setOwnerPhone(data.owner_phone); filled.add('phone'); }
    if (data.species === 'dog' || data.species === 'cat') { setSpecies(data.species); filled.add('species'); }
    if (data.breed) { setBreed(data.breed); filled.add('breed'); }
    if (data.weight_kg != null) { setWeight(String(data.weight_kg)); filled.add('weight'); }
    if (data.sex) { setSex(data.sex); filled.add('sex'); }
    if (data.age_years != null) { setAgeYears(String(data.age_years)); filled.add('age'); }
    if (data.conditions?.length) { setConditions(data.conditions); filled.add('conditions'); }
    if (data.allergies?.length) { setAllergies(data.allergies); filled.add('allergies'); }
    if (data.creatinine_mg_dL != null) { setCreatinine(String(data.creatinine_mg_dL)); filled.add('creatinine'); }
    if (data.alt_u_L != null) { setAlt(String(data.alt_u_L)); filled.add('alt'); }
    if (drugObjects?.length) {
      setDrugs((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        return [...prev, ...drugObjects.filter((d) => !existingIds.has(d.id))];
      });
    }
    setImportedFields(filled);
    setImportBanner(true);
    setAdditionalOpen(true);
  };

  const handleReset = () => {
    setPatientId(null);
    setPatientName('');
    setOwnerPhone('');
    setSpecies(null);
    setWeight('');
    setSex('Unknown');
    setBreed('');
    setAgeYears('');
    setConditions([]);
    setAllergies([]);
    setCreatinine('');
    setAlt('');
    setAdditionalOpen(false);
    setDrugs([]);
    setResults(null);
    setStep('input');
    setPatientSearch('');
    setSaveProfileChecked(false);
    setImportBanner(false);
    setImportedFields(new Set());
    setToast(null);
  };

  const creatVal = parseFloat(creatinine);
  const patientInfo = {
    name: patientName,
    species,
    breed,
    weight: weightNum,
    sex: sex !== 'Unknown' ? sex : undefined,
    age: ageYears || undefined,
    conditions,
    allergies,
    flaggedLabs: [
      ...(creatinine && creatVal > 0 ? [{ key: 'creatinine', value: creatinine, unit: 'mg/dL', status: creatVal > 1.4 ? 'high' : 'normal' }] : []),
      ...(alt && parseFloat(alt) > 100 ? [{ key: 'alt', value: alt, unit: 'U/L', status: 'high' }] : []),
    ],
  };

  const SEX_OPTIONS = [
    { value: 'Intact Male', label: F.sexIntactMale },
    { value: 'Intact Female', label: F.sexIntactFemale },
    { value: 'Neutered Male', label: F.sexNeuteredMale },
    { value: 'Spayed Female', label: F.sexSpayedFemale },
  ];

  const hl = (field) => (importedFields.has(field) ? IMPORTED : '');
  const extrasCount = [ageYears, creatinine, alt].filter(Boolean).length + allergies.length + conditions.length;
  const ids = {
    search: `${uid}-search`, name: `${uid}-name`, phone: `${uid}-phone`, breed: `${uid}-breed`, weight: `${uid}-weight`,
    age: `${uid}-age`, allergies: `${uid}-allergies`, conditions: `${uid}-conditions`, creat: `${uid}-creat`, alt: `${uid}-alt`,
    extras: `${uid}-extras`, creatHint: `${uid}-creat-hint`, altHint: `${uid}-alt-hint`,
  };
  const today = new Date();
  const dateLabel = lang === 'ko'
    ? `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
    : today.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

  const readiness = [
    { label: F.speciesToggleLabel, value: species ? (species === 'cat' ? (lang === 'ko' ? t.species.catShort : t.species.cat) : (lang === 'ko' ? t.species.dogShort : t.species.dog)) : null },
    { label: F.fieldWeight, value: weightNum > 0 ? <span className="font-mono tnum">{weightNum} kg</span> : null },
    {
      label: F.sectionDrugs,
      value: drugs.length ? `${fmt(drugs.length === 1 ? F.drugs1 : F.drugsN, { n: drugs.length })} · ${fmt(pairCount === 1 ? F.pairs1 : F.pairsN, { n: pairCount })}` : null,
    },
  ];

  const runLabel = (
    <>
      {F.runDurCheck} <span aria-hidden="true">→</span>
    </>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-white">
      <WorkspaceHeader current="review" status={<FormularyStatus connected={isConnected} />} />

      {/* Toast */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
        {toast && (
          <p className="pointer-events-auto flex animate-fade-in items-baseline gap-3 rounded-lg bg-ink-900 px-4 py-3 text-[13.5px] font-medium text-white shadow-lift">
            <span className="kicker text-[10px] text-dur-300">{F.savedKicker}</span>
            {toast}
          </p>
        )}
      </div>

      {showEMRModal && (
        <EMRImportModal onClose={() => setShowEMRModal(false)} onImport={handleImportComplete} species={species} t={t} />
      )}

      {/* ANALYZING */}
      {step === 'analyzing' && (
        <AnalysisScreen onComplete={handleAnalysisComplete} drugCount={drugs.length} species={species} />
      )}

      {/* INPUT */}
      {step === 'input' && (
        <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-20">
          {/* Title */}
          <div className="flex flex-col gap-5 border-b border-ink-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="kicker text-[11px] text-ink-400">
                {F.newReviewKicker} <span className="mx-1.5 text-ink-300" aria-hidden="true">/</span>
                <span className="font-mono tracking-[0.04em]">{dateLabel}</span>
              </p>
              <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink-900 sm:text-[34px]">{F.pageTitle}</h1>
              <p className="mt-1.5 max-w-[56ch] text-[14.5px] text-ink-500"><BrandText>{F.pageSub}</BrandText></p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(drugs.length > 0 || patientName || species) && (
                <button type="button" onClick={handleReset} className="h-11 rounded-md px-3 text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900">
                  {t.reset}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowEMRModal(true)}
                className="h-11 rounded-md px-4 text-[13.5px] font-semibold text-ink-900 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 hover:ring-ink-300"
              >
                {F.importFromEMR}
              </button>
            </div>
          </div>

          {/* Import notice */}
          {importBanner && (
            <div role="status" className="relative mt-6 flex items-start justify-between gap-4 pl-4">
              <span aria-hidden="true" className="absolute inset-y-0.5 left-0 w-[3px] bg-dur-500" />
              <div>
                <p className="kicker text-[10.5px] text-dur-700">{F.importedKicker}</p>
                <p className="mt-1 text-[14px] font-semibold text-ink-900">{F.importBannerTitle}</p>
                <p className="mt-0.5 text-[13px] text-ink-500">{F.importBannerDesc}</p>
              </div>
              <button type="button" onClick={() => setImportBanner(false)} className="h-10 shrink-0 rounded-md px-2.5 text-[13px] font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-900">
                {t.close}
              </button>
            </div>
          )}

          <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16 xl:gap-20">
            {/* ── 01 PATIENT ───────────────────────────────────────── */}
            <section aria-labelledby="sec-patient">
              <StepHead n="01" id="sec-patient" title={F.sectionPatient} hint={F.sectionPatientHint} />

              <div className="mt-6 space-y-6">
                {/* Returning patient */}
                <div>
                  <FieldLabel htmlFor={ids.search}>{F.returningPatient}</FieldLabel>
                  <div className="relative">
                    <input
                      id={ids.search}
                      type="text"
                      role="combobox"
                      aria-expanded={showPatientList && !!patientSearch.trim()}
                      aria-controls={`${ids.search}-list`}
                      aria-autocomplete="list"
                      autoComplete="off"
                      value={patientSearch}
                      onChange={(e) => { setPatientSearch(e.target.value); setShowPatientList(true); }}
                      onFocus={() => setShowPatientList(true)}
                      onBlur={() => setTimeout(() => setShowPatientList(false), 200)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setShowPatientList(false); }}
                      placeholder={F.searchPatientPlaceholder}
                      className={INPUT}
                    />
                    {showPatientList && patientSearch.trim() && (
                      <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lift">
                        {patientSuggestions.length === 0 ? (
                          <p className="px-3.5 py-3 text-[13px] text-ink-500">
                            {F.noSavedPatients}
                            <Link to="/patients" className="ml-2 font-medium text-ink-900 underline decoration-ink-300 underline-offset-4">{F.patientsNav}</Link>
                          </p>
                        ) : (
                          <ul id={`${ids.search}-list`} role="listbox" aria-label={F.returningPatient}>
                            {patientSuggestions.slice(0, 6).map((p) => (
                              <li key={p.id} role="option" aria-selected={false}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); handleSelectPatient(p); }}
                                  className="flex w-full items-baseline justify-between gap-4 border-b border-ink-100 px-3.5 py-2.5 text-left last:border-0 hover:bg-ink-50"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-[14px] font-semibold text-ink-900">{p.name}</span>
                                    <span className="mt-0.5 block text-[12.5px] text-ink-500">
                                      {p.species === 'cat' ? t.species.catShort : t.species.dogShort}
                                      {p.breed ? ` · ${p.breed}` : ''}
                                      {p.weight_kg ? ` · ${p.weight_kg} kg` : ''}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-mono text-[11px] text-ink-400 tnum">
                                    {(p.visit_history?.[0]?.date || p.updated_at || '').split('T')[0]}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Name / owner phone */}
                <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor={ids.name}>{F.patientNameLabel}</FieldLabel>
                    <input id={ids.name} type="text" autoComplete="off" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder={F.patientNamePlaceholder} className={`${INPUT} ${hl('name')}`} />
                  </div>
                  <div>
                    <FieldLabel htmlFor={ids.phone}>{F.ownerPhoneLabel}</FieldLabel>
                    <input id={ids.phone} type="tel" inputMode="tel" autoComplete="off" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="010-0000-0000" className={`${INPUT} font-mono tnum ${hl('phone')}`} />
                  </div>
                </div>

                {/* Species */}
                <fieldset>
                  <legend className={`${LABEL} mb-2`}>{F.speciesToggleLabel}</legend>
                  <div className={`grid grid-cols-2 gap-2 rounded-md ${importedFields.has('species') ? 'ring-2 ring-dur-300 ring-offset-2' : ''}`}>
                    {['dog', 'cat'].map((sp) => (
                      <Choice key={sp} pressed={species === sp} onClick={() => setSpecies(sp)} className="h-12 text-[15px] font-semibold">
                        {sp === 'dog' ? t.species.dogShort : t.species.catShort}
                      </Choice>
                    ))}
                  </div>
                  {!species && <p className="mt-2 text-[12.5px] text-ink-400">{F.speciesFirstHint}</p>}
                </fieldset>

                {/* Revealed after species selection */}
                {species && (
                  <div className="animate-fade-in space-y-6">
                    <div className="grid gap-x-4 gap-y-6 sm:grid-cols-[minmax(0,1fr)_160px]">
                      <div>
                        <FieldLabel htmlFor={ids.breed}>{F.breedLabel}</FieldLabel>
                        <BreedInput id={ids.breed} value={breed} onChange={setBreed} species={species} className={hl('breed')} />
                      </div>
                      <div>
                        <FieldLabel htmlFor={ids.weight}>{F.fieldWeight}</FieldLabel>
                        <DecimalInput
                          id={ids.weight}
                          value={weight}
                          onChange={setWeight}
                          placeholder={F.weightPlaceholder}
                          min={0.01}
                          max={200}
                          suffix="kg"
                          className={`${INPUT} ${hl('weight')}`}
                        />
                      </div>
                    </div>

                    <fieldset>
                      <legend className={`${LABEL} mb-2`}>{F.sexLabel}</legend>
                      <div className={`grid grid-cols-2 gap-2 rounded-md sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 ${importedFields.has('sex') ? 'ring-2 ring-dur-300 ring-offset-2' : ''}`}>
                        {SEX_OPTIONS.map((opt) => (
                          <Choice key={opt.value} pressed={sex === opt.value} onClick={() => setSex(sex === opt.value ? 'Unknown' : opt.value)} className="text-[13.5px]">
                            {opt.label}
                          </Choice>
                        ))}
                      </div>
                    </fieldset>

                    {/* Additional details */}
                    <div className="border-t border-ink-200">
                      <button
                        type="button"
                        onClick={() => setAdditionalOpen((v) => !v)}
                        aria-expanded={additionalOpen}
                        aria-controls={ids.extras}
                        className="group flex min-h-[56px] w-full items-center justify-between gap-4 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-[14.5px] font-semibold text-ink-900">{F.addPatientDetails}</span>
                          <span className="mt-0.5 block text-[13px] text-ink-500">
                            {extrasCount > 0 && !additionalOpen ? fmt(F.extrasFilled, { n: extrasCount }) : F.addPatientDetailsHint}
                          </span>
                        </span>
                        <span className="kicker shrink-0 text-[10.5px] text-ink-400 transition-colors group-hover:text-ink-900">
                          {additionalOpen ? t.results.collapse : t.results.expand}
                        </span>
                      </button>

                      {additionalOpen && (
                        <div id={ids.extras} className="animate-fade-in space-y-6 pb-2 pt-3">
                          <div className="grid items-start gap-x-4 gap-y-6 sm:grid-cols-3">
                            <div>
                              <FieldLabel htmlFor={ids.age}>{F.fieldAge}</FieldLabel>
                              <DecimalInput id={ids.age} value={ageYears} onChange={setAgeYears} placeholder={F.agePlaceholder} min={0} max={30} suffix={F.ageUnit} className={`${INPUT} ${hl('age')}`} />
                            </div>
                            <div>
                              <FieldLabel htmlFor={ids.creat}>{F.creatinineLabel}</FieldLabel>
                              <DecimalInput id={ids.creat} value={creatinine} onChange={setCreatinine} placeholder="1.2" min={0} suffix={F.creatinineUnit} describedBy={ids.creatHint} className={`${INPUT} ${hl('creatinine')} ${creatVal > 1.4 ? '!border-red-500' : ''}`} />
                              <p id={ids.creatHint} className={`mt-1.5 text-[12px] leading-snug ${creatVal > 1.4 ? 'font-medium text-red-700' : 'text-ink-400'}`}>{F.creatinineIrisHint}</p>
                            </div>
                            <div>
                              <FieldLabel htmlFor={ids.alt}>{F.altLabel}</FieldLabel>
                              <DecimalInput id={ids.alt} value={alt} onChange={setAlt} placeholder="45" min={0} suffix={F.altUnit} describedBy={ids.altHint} className={`${INPUT} ${hl('alt')} ${parseFloat(alt) > 100 ? '!border-red-500' : ''}`} />
                              <p id={ids.altHint} className={`mt-1.5 text-[12px] leading-snug ${parseFloat(alt) > 100 ? 'font-medium text-red-700' : 'text-ink-400'}`}>{F.altHint}</p>
                            </div>
                          </div>

                          <TagInput
                            id={ids.allergies}
                            label={F.allergiesLabel}
                            items={allergies}
                            onAdd={(a) => setAllergies((prev) => [...prev, a])}
                            onRemove={(a) => setAllergies((prev) => prev.filter((x) => x !== a))}
                            placeholder={F.allergiesPlaceholder}
                            suggestions={allergySuggestions}
                          />
                          <TagInput
                            id={ids.conditions}
                            label={F.conditionsLabel}
                            items={conditions}
                            onAdd={(c) => setConditions((prev) => [...prev, c])}
                            onRemove={(c) => setConditions((prev) => prev.filter((x) => x !== c))}
                            placeholder={F.conditionsPlaceholder}
                            suggestions={conditionSuggestions}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-14">
              {/* ── 02 PRESCRIPTION ──────────────────────────────── */}
              <section aria-labelledby="sec-rx">
                <StepHead n="02" id="sec-rx" title={F.sectionDrugs} hint={F.sectionDrugsHint} />
                <div className="mt-6">
                  <DrugInput
                    drugs={drugs}
                    onAddDrug={handleAddDrug}
                    onRemoveDrug={handleRemoveDrug}
                    onUpdateDrug={handleUpdateDrug}
                    species={species || 'dog'}
                    weight={weightNum}
                    searchFn={searchDrugsApi}
                  />
                </div>
              </section>

              {/* ── 03 RUN ────────────────────────────────────────── */}
              <section aria-labelledby="sec-run" ref={runRef}>
                <StepHead n="03" id="sec-run" title={F.sectionRun} hint={<BrandText>{F.sectionRunHint}</BrandText>} />

                <dl className="mt-5 divide-y divide-ink-100 border-y border-ink-100">
                  {readiness.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-4 py-3">
                      <dt className="text-[13px] text-ink-500">{r.label}</dt>
                      <dd className={`text-right text-[14px] ${r.value ? 'font-semibold text-ink-900' : 'text-ink-400'}`}>
                        {r.value || F.required}
                      </dd>
                    </div>
                  ))}
                </dl>

                <label className="mt-5 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={saveProfileChecked}
                    onChange={(e) => setSaveProfileChecked(e.target.checked)}
                    className="mt-[3px] h-[18px] w-[18px] shrink-0 cursor-pointer accent-ink-900"
                  />
                  <span>
                    <span className="block text-[14px] font-medium text-ink-900">{F.saveProfileLabel}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-400">{F.saveProfileHint}</span>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={!canRun}
                  aria-describedby={!canRun ? `${uid}-run-hint` : undefined}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-md bg-ink-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400"
                >
                  {runLabel}
                </button>
                {!canRun && (
                  <p id={`${uid}-run-hint`} className="mt-3 text-[12.5px] text-ink-400">{F.runDurDisabledHint}</p>
                )}
              </section>
            </div>
          </div>

          {/* Phones: Run stays reachable while the form is long */}
          {canRun && !runVisible && (
            <div className="fixed inset-x-0 bottom-0 z-30 animate-slide-up-bar border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={handleRunAnalysis}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink-900 text-[15px] font-semibold text-white"
              >
                {F.runDurCheck}
                <span className="text-[13px] font-medium text-white/55 tnum">· {fmt(drugs.length === 1 ? F.drugs1 : F.drugsN, { n: drugs.length })}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </main>
      )}

      {/* RESULTS */}
      {step === 'results' && (
        <main>
          <ResultsDisplay
            results={results}
            onBack={() => setStep('input')}
            onNewAnalysis={() => {
              setDrugs([]);
              setResults(null);
              setStep('input');
            }}
            isFullSystem
            drugs={drugs}
            species={species}
            patientInfo={patientInfo}
            onUpdatePatientRecord={patientId ? handleUpdatePatientRecord : null}
          />
        </main>
      )}
    </div>
  );
}
