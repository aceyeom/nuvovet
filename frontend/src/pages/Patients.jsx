import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { WorkspaceHeader } from '../components/Layout/Header';
import { severityTone, severityWord } from '../components/SeverityBadge';
import { getDrugById } from '../data/drugDatabase';
import {
  getAllPatients,
  deletePatient,
  savePatient,
  sortPatients,
} from '../lib/patientStorage';

const fmt = (s, vars = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

const INPUT =
  'h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-[16px] text-ink-900 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-dur-600 focus:outline-none focus:ring-[3px] focus:ring-dur-500/15 sm:text-[14px]';

// Korean dates stay numeric (2026.10.03) so they set cleanly in mono.
function useDateFormat() {
  const { lang } = useI18n();
  return (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (lang === 'ko') return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };
}

/** Last DUR result as a coloured word. */
function ResultWord({ summary }) {
  const { t } = useI18n();
  if (!summary) return <span className="text-ink-300">—</span>;
  const tone = severityTone(summary);
  return <span className={`kicker text-[10.5px] ${tone.word}`}>{severityWord(t, summary)}</span>;
}

// ── Inline editable value ────────────────────────────────────────
function EditableRow({ label, value, onSave, numeric = false, suffix }) {
  const { t } = useI18n();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value ?? '');

  useEffect(() => { setLocalVal(value ?? ''); }, [value]);

  const commit = () => {
    setEditing(false);
    if (String(localVal) !== String(value ?? '')) onSave(localVal);
  };

  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-1.5 sm:grid-cols-[148px_minmax(0,1fr)]">
      <dt className="text-[13px] text-ink-500">
        {editing ? <label htmlFor={id}>{label}</label> : label}
      </dt>
      <dd>
        {editing ? (
          <input
            id={id}
            type="text"
            inputMode={numeric ? 'decimal' : undefined}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setLocalVal(value ?? ''); setEditing(false); }
            }}
            className={`${INPUT} h-10 ${numeric ? 'font-mono tnum' : ''}`}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`${label}: ${localVal || '—'} — ${t.fullSystem.patients.edit}`}
            className="group -ml-2 flex h-10 w-[calc(100%+8px)] items-center justify-between gap-3 rounded-md px-2 text-left transition-colors hover:bg-ink-50"
          >
            <span className={`truncate text-[14px] ${localVal ? 'font-medium text-ink-900' : 'text-ink-300'}`}>
              {localVal ? (
                <>
                  <span className={numeric ? 'font-mono tnum' : ''}>{localVal}</span>
                  {suffix && <span className="ml-1 text-[12.5px] font-normal text-ink-500">{suffix}</span>}
                </>
              ) : '—'}
            </span>
            <span className="kicker text-[10px] text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {t.fullSystem.patients.edit}
            </span>
          </button>
        )}
      </dd>
    </div>
  );
}

// ── Patient detail ───────────────────────────────────────────────
function PatientDetail({ patient, onBack, onUpdate, onDelete, onStartVisit }) {
  const { t, lang } = useI18n();
  const F = t.fullSystem;
  const P = F.patients;
  const formatDate = useDateFormat();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (field, value) => onUpdate({ ...patient, [field]: value });
  const updateNum = (field, raw) => {
    const n = parseFloat(raw);
    onUpdate({ ...patient, [field]: isNaN(n) ? null : n });
  };

  const SEX_OPTIONS = [
    { value: 'Intact Male', label: F.sexIntactMale },
    { value: 'Intact Female', label: F.sexIntactFemale },
    { value: 'Neutered Male', label: F.sexNeuteredMale },
    { value: 'Spayed Female', label: F.sexSpayedFemale },
  ];
  const visits = patient.visit_history || [];
  const drugName = (id) => getDrugById(id)?.name || id;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <button type="button" onClick={onBack} className="-ml-1.5 inline-flex h-10 items-center gap-2 rounded-md px-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-900">
        <span aria-hidden="true">←</span> {F.patientsNav}
      </button>

      <div className="mt-3 flex flex-col gap-5 border-b border-ink-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="kicker text-[11px] text-ink-400">{P.kickerDetail}</p>
          <h1 className="mt-2 truncate text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink-900 sm:text-[34px]">{patient.name}</h1>
          <p className="mt-1.5 text-[14px] text-ink-500">
            {[
              patient.species === 'cat' ? (lang === 'ko' ? t.species.catShort : t.species.cat) : (lang === 'ko' ? t.species.dogShort : t.species.dog),
              patient.breed,
              patient.weight_kg ? `${patient.weight_kg} kg` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onStartVisit}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-ink-900 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-ink-800"
        >
          {P.startVisit} <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-16">
        {/* Profile */}
        <section aria-labelledby="pd-profile">
          <h2 id="pd-profile" className="kicker border-b border-ink-900 pb-2.5 text-[11px] text-ink-900">{P.profile}</h2>
          <p className="mt-3 text-[12.5px] text-ink-400">{P.editHint}</p>
          <dl className="mt-3 divide-y divide-ink-100 border-y border-ink-100">
            <EditableRow label={F.patientNameLabel} value={patient.name} onSave={(v) => update('name', v || patient.name)} />
            <EditableRow label={F.ownerPhoneLabel} value={patient.owner_phone} onSave={(v) => update('owner_phone', v || null)} numeric />
            <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2 sm:grid-cols-[148px_minmax(0,1fr)]">
              <dt className="text-[13px] text-ink-500">{F.speciesToggleLabel}</dt>
              <dd className="grid grid-cols-2 gap-2">
                {['dog', 'cat'].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => update('species', sp)}
                    aria-pressed={patient.species === sp}
                    className={`h-10 rounded-md border text-[13.5px] font-medium transition-colors ${
                      patient.species === sp ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700 hover:border-ink-300'
                    }`}
                  >
                    {sp === 'dog' ? t.species.dogShort : t.species.catShort}
                  </button>
                ))}
              </dd>
            </div>
            <EditableRow label={F.breedLabel} value={patient.breed} onSave={(v) => update('breed', v || null)} />
            <EditableRow label={F.fieldWeight} value={patient.weight_kg != null ? String(patient.weight_kg) : ''} onSave={(v) => updateNum('weight_kg', v)} numeric suffix="kg" />
            <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2 sm:grid-cols-[148px_minmax(0,1fr)]">
              <dt><label htmlFor="pd-sex" className="text-[13px] text-ink-500">{F.sexLabel}</label></dt>
              <dd>
                <select
                  id="pd-sex"
                  value={patient.sex || ''}
                  onChange={(e) => update('sex', e.target.value || null)}
                  className={`${INPUT} h-10 cursor-pointer`}
                >
                  <option value="">—</option>
                  {SEX_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </dd>
            </div>
            <EditableRow label={F.fieldAge} value={patient.age_years != null ? String(patient.age_years) : ''} onSave={(v) => updateNum('age_years', v)} numeric suffix={F.ageUnit} />
            <EditableRow label={F.creatinineLabel} value={patient.creatinine_mg_dL != null ? String(patient.creatinine_mg_dL) : ''} onSave={(v) => updateNum('creatinine_mg_dL', v)} numeric suffix="mg/dL" />
            <EditableRow label={F.altLabel} value={patient.alt_u_L != null ? String(patient.alt_u_L) : ''} onSave={(v) => updateNum('alt_u_L', v)} numeric suffix="U/L" />
          </dl>
          {(patient.allergies?.length > 0 || patient.conditions?.length > 0) && (
            <dl className="divide-y divide-ink-100 border-b border-ink-100">
              {patient.allergies?.length > 0 && (
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[148px_minmax(0,1fr)]">
                  <dt className="text-[13px] text-ink-500">{F.allergiesLabel}</dt>
                  <dd className="text-[14px] font-medium text-ink-900">{patient.allergies.join(', ')}</dd>
                </div>
              )}
              {patient.conditions?.length > 0 && (
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[148px_minmax(0,1fr)]">
                  <dt className="text-[13px] text-ink-500">{F.conditionsLabel}</dt>
                  <dd className="text-[14px] font-medium text-ink-900">{patient.conditions.join(', ')}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Visits */}
        <section aria-labelledby="pd-visits">
          <h2 id="pd-visits" className="kicker flex items-baseline gap-2 border-b border-ink-900 pb-2.5 text-[11px] text-ink-900">
            {P.visits}
            <span className="font-mono font-medium text-ink-400 tnum">{visits.length}</span>
          </h2>
          {visits.length === 0 ? (
            <p className="mt-4 text-[14px] text-ink-500">{P.noVisits}</p>
          ) : (
            <table className="mt-1 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-200">
                  <th scope="col" className="py-2 pr-4 text-[11.5px] font-medium text-ink-500">{P.colDate}</th>
                  <th scope="col" className="py-2 pr-4 text-[11.5px] font-medium text-ink-500">{P.colDrugs}</th>
                  <th scope="col" className="py-2 text-right text-[11.5px] font-medium text-ink-500">{P.colOutcome}</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit, i) => (
                  <tr key={`${visit.date}-${i}`} className="border-b border-ink-100 align-baseline">
                    <td className="whitespace-nowrap py-3 pr-4 font-mono text-[12.5px] text-ink-700 tnum">{formatDate(visit.date)}</td>
                    <td className="py-3 pr-4 text-[13.5px] text-ink-900">{visit.drugs?.length ? visit.drugs.map(drugName).join(', ') : '—'}</td>
                    <td className="py-3 text-right"><ResultWord summary={visit.dur_summary} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Delete */}
      <section className="mt-16 border-t border-ink-200 pt-5" aria-label={P.deleteProfile}>
        {confirmDelete ? (
          <div className="relative flex flex-col gap-3 pl-4 sm:flex-row sm:items-center sm:justify-between" role="alertdialog" aria-labelledby="pd-del-q">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-red-500" />
            <p id="pd-del-q" className="text-[14px] font-medium text-ink-900">{P.deleteConfirm}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 rounded-md px-4 text-[13.5px] font-medium text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50">
                {t.cancel}
              </button>
              <button type="button" onClick={() => onDelete(patient.id)} className="h-10 rounded-md bg-red-600 px-4 text-[13.5px] font-semibold text-white hover:bg-red-700" autoFocus>
                {P.delete}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="-ml-1.5 h-10 rounded-md px-1.5 text-[13.5px] font-medium text-red-700 transition-colors hover:text-red-800">
            {P.deleteProfile}
          </button>
        )}
      </section>
    </main>
  );
}

// ── Main Patients Page ────────────────────────────────────────────
export default function Patients() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const F = t.fullSystem;
  const P = F.patients;
  const formatDate = useDateFormat();

  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('last_visit');
  const [selectedId, setSelectedId] = useState(null);

  const reload = useCallback(() => setPatients(getAllPatients()), []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [selectedId]);

  const q = query.trim().toLowerCase();
  const filtered = patients.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.owner_phone ?? '').toLowerCase().includes(q));
  const sorted = sortPatients(filtered, sortBy);
  const selected = patients.find((p) => p.id === selectedId) || null;

  const handleDelete = (id) => {
    deletePatient(id);
    setSelectedId(null);
    reload();
  };
  const handleUpdate = (updated) => {
    savePatient(updated);
    reload();
  };
  const handleStartVisit = (patient) => navigate('/system', { state: { preloadPatientId: patient.id } });

  const lastVisit = (p) => p.visit_history?.[0];
  const signalment = (p) => [p.species === 'cat' ? t.species.catShort : t.species.dogShort, p.breed].filter(Boolean).join(' · ');

  return (
    <div className="min-h-[100dvh] bg-white">
      <WorkspaceHeader current="patients" />

      {selected ? (
        <PatientDetail
          patient={selected}
          onBack={() => { setSelectedId(null); reload(); }}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onStartVisit={() => handleStartVisit(selected)}
        />
      ) : (
        <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          {/* Title */}
          <div className="flex flex-col gap-5 border-b border-ink-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="kicker text-[11px] text-ink-400">
                {P.kicker} <span className="mx-1.5 text-ink-300" aria-hidden="true">/</span>
                <span className="font-mono tnum">{patients.length}</span>
              </p>
              <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink-900 sm:text-[34px]">{P.title}</h1>
              <p className="mt-1.5 text-[14.5px] text-ink-500">{P.sub}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/system')}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-ink-900 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-ink-800"
            >
              {P.newReview} <span aria-hidden="true">→</span>
            </button>
          </div>

          {patients.length === 0 ? (
            <div className="mx-auto max-w-md py-20 text-center">
              <p className="kicker text-[11px] text-ink-400">{P.kicker}</p>
              <p className="mt-3 text-[20px] font-bold tracking-[-0.02em] text-ink-900">{P.emptyTitle}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-500">{P.emptyDesc}</p>
              <button
                type="button"
                onClick={() => navigate('/system')}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-md px-4 text-[14px] font-semibold text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
              >
                {P.emptyCta} <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <>
              {/* Search + sort */}
              <div className="mt-7 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                <div>
                  <label htmlFor="pt-search" className="kicker mb-2 block text-[10.5px] text-ink-500">{P.searchLabel}</label>
                  <input
                    id="pt-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={P.searchPlaceholder}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="pt-sort" className="kicker mb-2 block text-[10.5px] text-ink-500">{P.sortLabel}</label>
                  <select id="pt-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${INPUT} cursor-pointer`}>
                    <option value="last_visit">{P.sortLastVisit}</option>
                    <option value="name">{P.sortName}</option>
                    <option value="species">{P.sortSpecies}</option>
                  </select>
                </div>
              </div>

              {sorted.length === 0 ? (
                <p className="mt-10 text-[14px] text-ink-500">{fmt(P.noMatch, { q: query.trim() })}</p>
              ) : (
                <>
                  {/* Desktop — a real table */}
                  <table className="mt-8 hidden w-full border-collapse text-left md:table">
                    <thead>
                      <tr className="border-b border-ink-900">
                        <th scope="col" className="kicker py-2.5 pr-4 text-[10.5px] font-semibold text-ink-900">{P.colPatient}</th>
                        <th scope="col" className="kicker py-2.5 pr-4 text-[10.5px] font-semibold text-ink-900">{P.colSignalment}</th>
                        <th scope="col" className="kicker py-2.5 pr-4 text-right text-[10.5px] font-semibold text-ink-900">{P.colWeight}</th>
                        <th scope="col" className="kicker py-2.5 pr-4 text-[10.5px] font-semibold text-ink-900">{P.colLastVisit}</th>
                        <th scope="col" className="kicker py-2.5 pr-4 text-[10.5px] font-semibold text-ink-900">{P.colResult}</th>
                        <th scope="col" className="w-20 py-2.5"><span className="sr-only">{P.open}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((p) => {
                        const lv = lastVisit(p);
                        return (
                          <tr key={p.id} onClick={() => setSelectedId(p.id)} className="group cursor-pointer border-b border-ink-100 transition-colors hover:bg-ink-50/70">
                            <td className="py-3.5 pr-4">
                              <span className="block text-[14.5px] font-semibold text-ink-900">{p.name}</span>
                              {p.owner_phone && <span className="mt-0.5 block font-mono text-[11.5px] text-ink-400 tnum">{p.owner_phone}</span>}
                            </td>
                            <td className="py-3.5 pr-4 text-[13.5px] text-ink-700">{signalment(p)}</td>
                            <td className="py-3.5 pr-4 text-right font-mono text-[13px] text-ink-900 tnum">{p.weight_kg ? `${p.weight_kg} kg` : '—'}</td>
                            <td className="py-3.5 pr-4 font-mono text-[12.5px] text-ink-600 tnum">{formatDate(lv?.date || p.updated_at)}</td>
                            <td className="py-3.5 pr-4"><ResultWord summary={lv?.dur_summary} /></td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
                                aria-label={`${P.open} — ${p.name}`}
                                className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink-500 transition-colors group-hover:text-ink-900"
                              >
                                {P.open} <span aria-hidden="true">→</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Phones — ruled list */}
                  <ul className="mt-6 border-t border-ink-900 md:hidden">
                    {sorted.map((p) => {
                      const lv = lastVisit(p);
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => setSelectedId(p.id)} className="flex w-full items-center justify-between gap-4 border-b border-ink-100 py-3.5 text-left">
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-semibold text-ink-900">{p.name}</span>
                              <span className="mt-0.5 block truncate text-[13px] text-ink-500">
                                {signalment(p)}
                                {p.weight_kg ? ` · ${p.weight_kg} kg` : ''}
                              </span>
                              <span className="mt-1.5 flex items-baseline gap-3">
                                <span className="font-mono text-[11.5px] text-ink-400 tnum">{formatDate(lv?.date || p.updated_at)}</span>
                                {lv && <ResultWord summary={lv.dur_summary} />}
                              </span>
                            </span>
                            <span aria-hidden="true" className="shrink-0 text-ink-400">→</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <p className="mt-6 text-[12px] text-ink-400">{P.storageNote}</p>
            </>
          )}
        </main>
      )}
    </div>
  );
}
