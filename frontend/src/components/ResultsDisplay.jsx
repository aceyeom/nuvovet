import React, { useState, useEffect, useId, useRef } from 'react';
import { SeverityBadge, severityKey, severityTone, severityWord, SEVERITY_TONE } from './SeverityBadge';
import { DrugTimeline } from './DrugTimeline';
import { ProductLockup, BrandText } from './NuvovetLogo';
import { OrganLoadIndicator } from './OrganLoadIndicator';
import { ConfidenceProvenance } from './ConfidenceProvenance';
import { ScanExportButton, reportId } from './ScanExportPDF';
import { useI18n } from '../i18n';

// ──────────────────────────────────────────────────────────────────
// nuvoDUR report
//
// Set like a lab report: a masthead, a verdict (overall severity as a
// large coloured word with the counts beside it), then the findings as
// ruled entries — each carries a short vertical rule in its severity
// hue. Patient data, organ load and confidence sit in a quiet left
// column on desktop and follow the findings on phones.
//
// Also rendered inside the /demo report sheet (`embedded`, with the
// island's patient-context findings in `contextFindings`).
// ──────────────────────────────────────────────────────────────────

const fmt = (s, vars = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const plural = (dict, key, n) => fmt((n === 1 && dict[`${key}1`]) || dict[key], { n });
const pairsOf = (n) => (n * (n - 1)) / 2;
const pad = (n) => String(n).padStart(2, '0');

/** Korean dates stay numeric (2026.10.03 14:32) so they set cleanly in mono. */
function formatStamp(iso, lang, withTime = true) {
  const d = new Date(iso);
  if (lang === 'ko') return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}${withTime ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : ''}`;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

/** "Canine" in English, "개" in Korean (the long Korean label repeats the Latin). */
const speciesName = (t, lang, sp) => (sp === 'cat' ? (lang === 'ko' ? t.species.catShort : t.species.cat) : (lang === 'ko' ? t.species.dogShort : t.species.dog));

// Patient-context findings (island) use lower-case severities
const CONTEXT_SEVERITY = { critical: 'Critical', moderate: 'Moderate', minor: 'Minor', unknown: 'Unknown' };
const CONTEXT_SCORE = { critical: 100, moderate: 50, unknown: 30, minor: 20 };

// ── Shared bits ─────────────────────────────────────────────────

function SeverityRule({ severity, className = '' }) {
  return <span aria-hidden="true" className={`absolute left-0 w-[3px] ${severityTone(severity).rule} ${className}`} />;
}

function SectionHead({ id, label, count, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-900 pb-2.5">
      <h3 id={id} className="kicker text-[11px] text-ink-900">
        {label}
        {count != null && <span className="ml-2 font-mono font-medium text-ink-400 tnum">{count}</span>}
      </h3>
      {aside}
    </div>
  );
}

function Kicker({ children, className = '' }) {
  return <p className={`kicker text-[10.5px] text-ink-500 ${className}`}>{children}</p>;
}

// ── Masthead ────────────────────────────────────────────────────

function Masthead({ results, patientInfo, species, embedded, onBack, titleRef }) {
  const titleSize = embedded ? 'text-[24px] sm:text-[28px]' : 'text-[28px] sm:text-[34px]';
  const { t, lang } = useI18n();
  const R = t.results;
  const F = t.fullSystem;
  const sp = patientInfo?.species || species;
  const speciesShort = sp === 'cat' ? t.species.catShort : t.species.dogShort;
  const sexLabel = {
    'Intact Male': F.sexIntactMale,
    'Intact Female': F.sexIntactFemale,
    'Neutered Male': F.sexNeuteredMale,
    'Spayed Female': F.sexSpayedFemale,
  }[patientInfo?.sex];
  const meta = [
    sp ? speciesName(t, lang, sp) : null,
    patientInfo?.breed,
    patientInfo?.weight ? `${patientInfo.weight} kg` : null,
    sexLabel,
    patientInfo?.age ? fmt(R.ageValue, { n: patientInfo.age }) : null,
  ].filter(Boolean);
  const stamp = formatStamp(results.timestamp, lang);

  return (
    <header>
      {!embedded && (
        <button
          type="button"
          onClick={onBack}
          className="no-print -ml-1.5 mb-4 inline-flex h-10 items-center gap-2 rounded-md px-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          <span aria-hidden="true">←</span> {R.backToMeds}
        </button>
      )}
      <div className="mb-4 hidden print-show">
        <ProductLockup product="dur" size="md" />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
        <div className="min-w-0">
          <p className="kicker text-[11px] text-ink-500">
            {R.durReport} <span className="mx-1.5 text-ink-300" aria-hidden="true">/</span>
            <span className="font-mono tracking-[0.06em]">{reportId(results)}</span>
          </p>
          <h2 ref={titleRef} tabIndex={-1} className={`mt-2 text-balance font-bold leading-[1.1] tracking-[-0.03em] text-ink-900 focus:outline-none ${titleSize}`}>
            {patientInfo?.name || fmt(R.anonPatient, { species: speciesShort })}
          </h2>
          {meta.length > 0 && <p className="mt-2 text-[14px] text-ink-500">{meta.join(' · ')}</p>}
        </div>
        <div className="shrink-0 sm:text-right">
          <Kicker>{R.generated}</Kicker>
          <p className="mt-1 font-mono text-[12.5px] text-ink-700 tnum">{stamp}</p>
        </div>
      </div>
    </header>
  );
}

// ── Verdict ─────────────────────────────────────────────────────

function Verdict({ results, contextFindings, refined }) {
  const { t } = useI18n();
  const R = t.results;
  const { interactions, drugFlags, confidenceScore, overallSeverity } = results;

  const ctx = (sev) => contextFindings.filter((f) => f.severity === sev).length;
  const counts = {
    Critical: interactions.filter((i) => severityKey(i.severity) === 'Critical').length + ctx('critical'),
    Moderate: interactions.filter((i) => severityKey(i.severity) === 'Moderate').length + ctx('moderate'),
    Minor: interactions.filter((i) => ['Minor', 'Unknown'].includes(severityKey(i.severity))).length + ctx('minor') + ctx('unknown'),
  };
  const isClear = interactions.length === 0 && contextFindings.length === 0;
  const key = isClear ? 'None' : severityKey(overallSeverity);
  const tone = SEVERITY_TONE[key];
  const n = drugFlags.length;

  const coverage = [
    plural(R.coverage, 'drugs', n),
    plural(R.coverage, 'pairs', pairsOf(n)),
    plural(R.coverage, 'interactions', interactions.length),
    contextFindings.length ? plural(R.coverage, 'context', contextFindings.length) : null,
  ].filter(Boolean);

  const confTone = confidenceScore >= 85 ? 'bg-emerald-500' : confidenceScore >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <section aria-labelledby="verdict-label" className="mt-7 border-y border-ink-200 py-6 sm:mt-8 lg:py-7">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-14">
        <div className="relative pl-5">
          <span aria-hidden="true" className={`absolute inset-y-1 left-0 w-[3px] ${tone.rule}`} />
          <p id="verdict-label" className="kicker text-[11px] text-ink-500">{R.overallSeverity}</p>
          <p className={`mt-2.5 text-[44px] font-bold leading-[0.95] tracking-[-0.045em] sm:text-[56px] ${tone.display}`}>
            {severityWord(t, key)}
          </p>
          <p className="mt-3 max-w-[52ch] text-pretty text-[15px] leading-relaxed text-ink-800">{R.verdict[tone.key]}</p>
          <p className="mt-2 text-[13px] text-ink-500">{coverage.join(' · ')}</p>
          {refined && <p className="kicker mt-3 text-[10.5px] text-dur-700">{R.refinedAlert}</p>}
        </div>

        <dl className="grid grid-cols-4 border-t border-ink-100 pt-5 lg:border-0 lg:pt-0">
          {['Critical', 'Moderate', 'Minor'].map((k) => (
            <div key={k} className="border-r border-ink-100 pr-3 last:border-0 sm:pr-6 lg:pl-6 lg:first:pl-0">
              <dt className={`kicker text-[10px] ${counts[k] ? SEVERITY_TONE[k].word : 'text-ink-400'}`}>{severityWord(t, k)}</dt>
              <dd className={`mt-1.5 text-[30px] font-semibold leading-none tracking-[-0.03em] tnum sm:text-[34px] ${counts[k] ? SEVERITY_TONE[k].display : 'text-ink-300'}`}>
                {counts[k]}
              </dd>
            </div>
          ))}
          <div className="pl-3 sm:pl-6">
            <dt className="kicker text-[10px] text-ink-400">{R.confidence}</dt>
            <dd className="mt-1.5 text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink-900 tnum sm:text-[34px]">
              {confidenceScore}
              <span className="text-[15px] font-medium text-ink-400">%</span>
            </dd>
            <span aria-hidden="true" className="relative mt-2.5 block h-[2px] w-full bg-ink-100">
              <span className={`absolute inset-y-0 left-0 ${confTone}`} style={{ width: `${confidenceScore}%` }} />
            </span>
          </div>
        </dl>
      </div>
    </section>
  );
}

// ── Patient ─────────────────────────────────────────────────────

function PatientPanel({ patientInfo, species }) {
  const { t, lang } = useI18n();
  const R = t.results;
  const F = t.fullSystem;
  if (!patientInfo) return null;
  const sp = patientInfo.species || species;
  const sexLabel = {
    'Intact Male': F.sexIntactMale,
    'Intact Female': F.sexIntactFemale,
    'Neutered Male': F.sexNeuteredMale,
    'Spayed Female': F.sexSpayedFemale,
  }[patientInfo.sex];
  const labName = (k) => t.emr?.labs?.names?.[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : k);

  const rows = [
    [R.patient, patientInfo.name],
    [R.species, sp ? speciesName(t, lang, sp) : null],
    [R.breed, patientInfo.breed],
    [R.weight, patientInfo.weight ? <><span className="font-mono tnum">{patientInfo.weight}</span> kg</> : null],
    [R.sex, sexLabel],
    [R.age, patientInfo.age ? fmt(R.ageValue, { n: patientInfo.age }) : null],
    [R.conditions, patientInfo.conditions?.length ? patientInfo.conditions.join(', ') : null],
    [R.allergies, patientInfo.allergies?.length ? patientInfo.allergies.join(', ') : null],
  ].filter(([, v]) => v);

  const labs = patientInfo.flaggedLabs || [];

  return (
    <section aria-labelledby="pt-head">
      <h3 id="pt-head" className="kicker border-b border-ink-900 pb-2.5 text-[11px] text-ink-900">{R.patientSummary}</h3>
      <dl className="divide-y divide-ink-100">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-2.5">
            <dt className="text-[12.5px] text-ink-500">{k}</dt>
            <dd className="text-[13.5px] font-medium text-ink-900">{v}</dd>
          </div>
        ))}
        {labs.length > 0 && (
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-2.5">
            <dt className="text-[12.5px] text-ink-500">{R.flaggedLabs}</dt>
            <dd className="space-y-1">
              {labs.map((lab) => {
                const tone = lab.status === 'high' ? 'text-red-700' : lab.status === 'low' ? 'text-amber-700' : 'text-ink-900';
                return (
                  <p key={lab.key} className="flex items-baseline justify-between gap-2 text-[13.5px]">
                    <span className="font-medium text-ink-900">{labName(lab.key)}</span>
                    <span className={`whitespace-nowrap font-mono text-[12.5px] tnum ${tone}`}>
                      {lab.value} {lab.unit}
                      {lab.status === 'high' ? ' ↑' : lab.status === 'low' ? ' ↓' : ''}
                    </span>
                  </p>
                );
              })}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

// ── Interaction entry ───────────────────────────────────────────

function InteractionItem({ interaction, index, acknowledged, noted, onAcknowledge, onNote, isFullSystem }) {
  const { t } = useI18n();
  const R = t.results;
  const key = severityKey(interaction.severity);
  const isMinor = key === 'Minor' || key === 'Unknown';
  const isCritical = key === 'Critical';
  const isModerate = key === 'Moderate';
  const [expanded, setExpanded] = useState(isMinor ? false : index === 0);
  const [showWhy, setShowWhy] = useState(false);
  const [showLiterature, setShowLiterature] = useState(false);
  const uid = useId();
  const done = acknowledged || noted;
  const refs = interaction.literature || [];

  return (
    <li className="print-break-inside-avoid relative border-b border-ink-200">
      <SeverityRule severity={interaction.severity} className={`top-4 ${expanded ? 'bottom-6' : 'bottom-4'} ${done ? 'opacity-35' : ''}`} />

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`${uid}-body`}
        className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 py-4 pl-5 pr-0.5 text-left"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SeverityBadge severity={interaction.severity} />
            {interaction.rule && <span className="font-mono text-[11px] text-ink-400">{interaction.rule}</span>}
            {done && <span className="kicker text-[10.5px] text-emerald-700">{acknowledged ? R.reviewed : R.noted}</span>}
          </span>
          <span className={`mt-1.5 block break-words text-[17px] font-semibold leading-snug tracking-[-0.015em] ${done ? 'text-ink-500' : 'text-ink-900'}`}>
            {interaction.drugA} <span className="font-normal text-ink-400">+</span> {interaction.drugB}
          </span>
          {(interaction.drugAClass || interaction.drugBClass) && (
            <span className="mt-0.5 block font-mono text-[11.5px] text-ink-500">
              {[interaction.drugAClass, interaction.drugBClass].filter(Boolean).join(' + ')}
            </span>
          )}
        </span>
        <span className="no-print kicker mt-0.5 whitespace-nowrap text-[10.5px] text-ink-400 transition-colors group-hover:text-ink-900">
          {expanded ? R.collapse : R.expand}
        </span>
      </button>

      {expanded && (
        <div id={`${uid}-body`} className="animate-fade-in pb-7 pl-5">
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            <div className="space-y-6">
              <div>
                <Kicker>{R.whatHappens}</Kicker>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-700">
                  {interaction.mechanism || <span className="text-ink-400">{R.mechanismUnavailable}</span>}
                </p>
              </div>

              {/* Why is this dangerous? — always open for Critical, a toggle for Moderate */}
              {(isCritical || (isModerate && interaction.literatureSummary)) && (
                <div>
                  {isCritical ? (
                    <Kicker className="!text-red-700">{R.whyDangerous}</Kicker>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowWhy((v) => !v)}
                      aria-expanded={showWhy}
                      aria-controls={`${uid}-why`}
                      className="-ml-1 inline-flex h-10 items-center rounded-md px-1 text-[13px] font-semibold text-amber-700 underline decoration-amber-300 underline-offset-[5px] transition-colors hover:text-amber-800"
                    >
                      {R.whyDangerous}
                    </button>
                  )}
                  {(isCritical || showWhy) && (
                    <div id={`${uid}-why`} className={isCritical ? 'mt-2' : 'mt-1 animate-fade-in'}>
                      {interaction.literatureSummary && (
                        <p className="text-[14px] leading-relaxed text-ink-700">{interaction.literatureSummary}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <Kicker>{R.recommendedAction}</Kicker>
                <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink-900">{interaction.recommendation}</p>
              </div>
              {isCritical && (
                <p className="relative pl-3.5 text-[13.5px] font-semibold leading-relaxed text-red-700">
                  <span aria-hidden="true" className="absolute inset-y-0.5 left-0 w-[2px] bg-red-500" />
                  {R.actionContraindicated}
                </p>
              )}
              {isCritical && interaction.alternativeSuggestion && (
                <div className="relative pl-3.5">
                  <span aria-hidden="true" className="absolute inset-y-0.5 left-0 w-[2px] bg-emerald-500" />
                  <Kicker className="!text-emerald-700">{R.alternativeSuggestion}</Kicker>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-800">{interaction.alternativeSuggestion}</p>
                </div>
              )}
            </div>
          </div>

          {interaction.drugAData && interaction.drugBData && (
            <div className="mt-7 border-t border-ink-100 pt-5">
              <DrugTimeline drugA={interaction.drugAData} drugB={interaction.drugBData} />
            </div>
          )}

          {/* Evidence */}
          <div className={`mt-5 border-t border-ink-100 pt-3 ${showLiterature ? '' : 'no-print'}`}>
            <button
              type="button"
              onClick={() => setShowLiterature((v) => !v)}
              aria-expanded={showLiterature}
              aria-controls={`${uid}-refs`}
              className="-ml-1 inline-flex h-10 items-center gap-2 rounded-md px-1 text-[13px] font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              {showLiterature ? R.hideEvidence : R.showEvidence}
              <span className="font-mono text-[11.5px] text-ink-400 tnum">{refs.length}</span>
            </button>
            {showLiterature && (
              <div id={`${uid}-refs`} className="mt-1 animate-fade-in">
                {!isCritical && !isModerate && interaction.literatureSummary && (
                  <p className="mb-3 text-[13.5px] leading-relaxed text-ink-700">{interaction.literatureSummary}</p>
                )}
                {refs.length > 0 ? (
                  <ol className="divide-y divide-ink-100 border-y border-ink-100">
                    {refs.map((ref, i) => (
                      <li key={i} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 py-2.5">
                        <span className="font-mono text-[11px] text-ink-400 tnum">{String(i + 1).padStart(2, '0')}</span>
                        <span>
                          <span className="block text-[13px] font-medium text-ink-800">{ref.title}</span>
                          <span className="mt-0.5 block font-mono text-[11.5px] text-ink-500">{ref.source}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  !interaction.literatureSummary && <p className="text-[13px] text-ink-400">{R.sourceNotAvailable}</p>
                )}
              </div>
            )}
          </div>

          {/* Acknowledgement — clinic workspace only */}
          {isFullSystem && (
            <div className="no-print mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
              <button
                type="button"
                onClick={onAcknowledge}
                aria-pressed={acknowledged}
                className={`h-10 rounded-md px-4 text-[13px] font-semibold transition-colors ${
                  acknowledged ? 'bg-ink-900 text-white hover:bg-ink-800' : 'text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:ring-ink-300'
                }`}
              >
                {R.reviewed}
              </button>
              <button
                type="button"
                onClick={onNote}
                aria-pressed={noted}
                className={`h-10 rounded-md px-4 text-[13px] font-semibold transition-colors ${
                  noted ? 'bg-ink-900 text-white hover:bg-ink-800' : 'text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:ring-ink-300'
                }`}
              >
                {R.noted}
              </button>
              <p className="w-full text-[12px] text-ink-400 sm:ml-auto sm:w-auto">{R.clinicalJudgment}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ── Patient-context finding (allergy, drug–disease, dose, species, organ) ──

function ContextItem({ finding: f }) {
  const { t, lang } = useI18n();
  const R = t.results;
  const sev = { label: CONTEXT_SEVERITY[f.severity] || 'Unknown' };
  return (
    <li className="print-break-inside-avoid relative border-b border-ink-200 py-4 pl-5">
      <SeverityRule severity={sev} className={`inset-y-4 ${f.reviewed ? 'opacity-35' : ''}`} />
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SeverityBadge severity={sev} />
        {f.kindLabel && <span className="kicker text-[10.5px] text-ink-400">{f.kindLabel}</span>}
        {f.reviewed && <span className="kicker text-[10.5px] text-emerald-700">{R.reviewed}</span>}
      </p>
      <p className={`mt-1.5 text-[16px] font-semibold leading-snug tracking-[-0.01em] ${f.reviewed ? 'text-ink-500' : 'text-ink-900'}`}>{f.title}</p>
      {f.drugsLabel && <p className={`mt-0.5 text-[12px] text-ink-500 ${lang === 'ko' ? '' : 'font-mono'}`}>{f.drugsLabel}</p>}
      {f.summary && <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-ink-700">{f.summary}</p>}
      {f.suggestion && (
        <p className="mt-2.5 max-w-[68ch] text-[14px] font-medium leading-relaxed text-ink-900">
          <span className="kicker mr-2 text-[10.5px] text-ink-500">{R.suggestedFix}</span>
          {f.suggestion}
        </p>
      )}
    </li>
  );
}

// ── Drug advisories (source, MDR1, NTI, species notes) ─────────────

const FLAG_TONE = {
  mdr1: 'text-red-700',
  nti: 'text-red-700',
  'species-warning': 'text-red-700',
  'off-label': 'text-amber-700',
  unknown: 'text-amber-700',
  foreign: 'text-ink-600',
};

function Advisories({ flaggedDrugs }) {
  const { t } = useI18n();
  const R = t.results;
  return (
    <section aria-labelledby="adv-head">
      <SectionHead id="adv-head" label={R.drugAdvisory} count={flaggedDrugs.length} />
      <ul>
        {flaggedDrugs.map((df) => (
          <li key={df.drugId || df.drugName} className="grid gap-x-8 gap-y-2 border-b border-ink-100 py-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div>
              <p className="text-[14.5px] font-semibold text-ink-900">{df.drugName}</p>
              {df.drugClass && <p className="mt-0.5 font-mono text-[11.5px] text-ink-500">{df.drugClass}</p>}
            </div>
            <div className="space-y-2">
              {df.flags.map((f, i) => (
                <p key={i} className="text-[13.5px] leading-relaxed text-ink-700">
                  <span className={`kicker mr-2 text-[10px] ${FLAG_TONE[f.type] || 'text-ink-500'}`}>{f.label}</span>
                  {f.description}
                </p>
              ))}
              {df.speciesNote && (
                <p className="text-[13.5px] leading-relaxed text-ink-700">
                  <span className="kicker mr-2 text-[10px] text-ink-500">{R.speciesNote}</span>
                  {df.speciesNote}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Main Results Display ────────────────────────────────────────

export function ResultsDisplay({ results, onBack, onNewAnalysis, patientInfo, isFullSystem = false, drugs = [], species = 'dog', onUpdatePatientRecord, embedded = false, contextFindings = [] }) {
  const { t, lang } = useI18n();
  const R = t.results;

  // Hooks run unconditionally (rules of hooks) — the empty-state return comes after.
  const [acknowledged, setAcknowledged] = useState({});
  const [noted, setNoted] = useState({});
  const [showScanBar, setShowScanBar] = useState(false);
  const titleRef = useRef(null);
  const interactionCount = results?.interactions?.length || 0;
  const reviewedCount = Array.from({ length: interactionCount }, (_, i) => acknowledged[i] || noted[i]).filter(Boolean).length;
  const allReviewed = interactionCount > 0 && reviewedCount >= interactionCount;

  useEffect(() => {
    if (allReviewed && !embedded) {
      const timer = setTimeout(() => setShowScanBar(true), 300);
      return () => clearTimeout(timer);
    }
    setShowScanBar(false);
    return undefined;
  }, [allReviewed, embedded]);

  // Clinic workspace: land keyboard / screen-reader focus on the report
  useEffect(() => {
    if (!embedded) titleRef.current?.focus({ preventScroll: true });
  }, [embedded]);

  if (!results) return null;

  const { interactions, drugFlags } = results;
  const ctxScore = contextFindings.reduce((m, f) => Math.max(m, CONTEXT_SCORE[f.severity] || 0), 0);
  const verdictResults = ctxScore > (results.overallSeverity?.score || 0)
    ? { ...results, overallSeverity: { label: CONTEXT_SEVERITY[contextFindings.find((f) => CONTEXT_SCORE[f.severity] === ctxScore)?.severity] || 'Unknown', score: ctxScore } }
    : results;
  const flaggedDrugs = drugFlags.filter((f) => f.flags.length > 0 || f.speciesNote);
  const dateStr = formatStamp(results.timestamp, lang, false);
  const mono = lang === 'ko' ? '' : 'font-mono'; // Geist Mono has no Hangul

  const sendEmail = () => {
    const name = patientInfo?.name || (lang === 'ko' ? '환자' : 'Patient');
    const subject = encodeURIComponent(`${lang === 'ko' ? 'nuvoDUR 보고서' : 'nuvoDUR report'} — ${name} (${reportId(results)})`);
    const body = encodeURIComponent(
      lang === 'ko'
        ? `nuvoDUR 분석 보고서 ${reportId(results)}\n\n환자: ${patientInfo?.name || '—'}\n날짜: ${dateStr}\n검사 약물 수: ${drugFlags.length}\n발견된 상호작용: ${interactions.length}\n\n상세 내용은 첨부한 PDF 보고서를 확인해 주세요.`
        : `nuvoDUR analysis report ${reportId(results)}\n\nPatient: ${patientInfo?.name || '—'}\nDate: ${dateStr}\nDrugs screened: ${drugFlags.length}\nInteractions found: ${interactions.length}\n\nPlease see the attached PDF report for details.`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Organ load + confidence: a left column on desktop, after the findings on phones
  const analytics = (
    <>
      <OrganLoadIndicator drugs={drugs} patientInfo={patientInfo} species={species} />
      <ConfidenceProvenance confidenceScore={results.confidenceScore} drugs={drugs} species={species} />
    </>
  );

  const btnSecondary = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[13.5px] font-semibold text-ink-900 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 hover:ring-ink-300';
  const btnPrimary = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-ink-800';

  return (
    <>
      <div className={`mx-auto max-w-[1280px] animate-fade-in px-4 sm:px-6 lg:px-8 ${embedded ? 'py-6 sm:py-8' : 'pb-16 pt-6 sm:pt-8'} ${showScanBar ? 'pb-28' : ''}`}>
        <Masthead results={results} patientInfo={patientInfo} species={species} embedded={embedded} onBack={onBack} titleRef={titleRef} />
        <Verdict results={verdictResults} contextFindings={contextFindings} refined={!!results.wasRefined} />

        <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[288px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:[grid-template-areas:'patient_main'_'aside_main'] xl:grid-cols-[312px_minmax(0,1fr)]">
          {/* Patient — first on every screen */}
          <div className="lg:[grid-area:patient]">
            <PatientPanel patientInfo={patientInfo} species={species} />
          </div>

          {/* Findings */}
          <div className="min-w-0 space-y-12 lg:[grid-area:main]">
            {contextFindings.length > 0 && (
              <section aria-labelledby="ctx-head">
                <SectionHead id="ctx-head" label={R.contextChecks} count={contextFindings.length} />
                <ul>{contextFindings.map((f) => <ContextItem key={f.id} finding={f} />)}</ul>
              </section>
            )}

            <section aria-labelledby="ix-head">
              <SectionHead
                id="ix-head"
                label={R.interactionReport}
                count={interactions.length}
                aside={isFullSystem && interactions.length > 0 && (
                  <span className={`text-[11.5px] tnum ${mono} ${allReviewed ? 'text-emerald-700' : 'text-ink-400'}`}>
                    {fmt(R.reviewProgress, { n: reviewedCount, total: interactions.length })}
                  </span>
                )}
              />
              {interactions.length > 0 ? (
                <ul>
                  {interactions.map((interaction, i) => (
                    <InteractionItem
                      key={`${interaction.drugA}-${interaction.drugB}-${interaction.rule}`}
                      interaction={interaction}
                      index={i}
                      acknowledged={!!acknowledged[i]}
                      noted={!!noted[i]}
                      onAcknowledge={() => setAcknowledged((prev) => ({ ...prev, [i]: !prev[i] }))}
                      onNote={() => setNoted((prev) => ({ ...prev, [i]: !prev[i] }))}
                      isFullSystem={isFullSystem}
                    />
                  ))}
                </ul>
              ) : (
                <div className="relative border-b border-ink-200 py-5 pl-5">
                  <SeverityRule severity="None" className="inset-y-5" />
                  <p className="kicker text-[10.5px] text-emerald-700">{severityWord(t, 'None')}</p>
                  <p className="mt-1.5 text-[16px] font-semibold text-ink-900">{R.noInteractions}</p>
                  <p className="mt-1 text-[14px] text-ink-500">{R.noContraindicationsDetail}</p>
                </div>
              )}
            </section>

            {flaggedDrugs.length > 0 && <Advisories flaggedDrugs={flaggedDrugs} />}

            {/* Phones: organ load + confidence follow the findings, before the actions */}
            <div className="space-y-10 lg:hidden">{analytics}</div>

            {/* Export & next steps */}
            <section aria-labelledby="act-head" className="no-print">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-900 pb-2.5">
                <h3 id="act-head" className="kicker text-[11px] text-ink-900">{R.scanComplete}</h3>
                <p className="font-mono text-[11px] text-ink-400 tnum">
                  {reportId(results)} · {dateStr}
                </p>
              </div>
              <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                <ScanExportButton
                  results={results}
                  patientInfo={patientInfo}
                  drugs={drugs}
                  species={species}
                  contextFindings={contextFindings}
                  variant="primary"
                />
                <button type="button" onClick={() => window.print()} className={btnSecondary}>{R.printPage}</button>
                <button type="button" onClick={sendEmail} className={btnSecondary}>{R.sendViaEmail}</button>
                {!embedded && onUpdatePatientRecord && (
                  <button type="button" onClick={onUpdatePatientRecord} className={btnSecondary}>{R.updatePatientRecord}</button>
                )}
              </div>
              {!embedded && (
                <div className="mt-8 flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={onBack} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-1 text-[13.5px] font-semibold text-ink-600 transition-colors hover:text-ink-900 sm:justify-start">
                    <span aria-hidden="true">←</span> {R.backToMeds}
                  </button>
                  <button type="button" onClick={onNewAnalysis} className={btnPrimary}>
                    {R.newAnalysis} <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </section>

            <p className="text-[12px] leading-relaxed text-ink-400">
              <BrandText>{R.disclaimer}</BrandText>
            </p>
          </div>

          {/* Organ load + confidence — beside the patient on desktop, after the findings on phones */}
          <aside className="hidden space-y-10 lg:block lg:[grid-area:aside]" aria-label={R.scanSummary}>
            {analytics}
          </aside>
        </div>
      </div>

      {/* Appears once every interaction has been reviewed (clinic workspace) */}
      {showScanBar && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 animate-slide-up-bar border-t border-ink-200 bg-white/95 backdrop-blur" role="status">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <p className="min-w-0">
              <span className="kicker text-[10.5px] text-emerald-700">{R.allReviewed}</span>
              <span className={`ml-3 hidden text-[11.5px] text-ink-400 tnum md:inline ${mono}`}>
                {plural(R.coverage, 'drugs', drugFlags.length)} · {plural(R.coverage, 'interactions', interactions.length)}
              </span>
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => window.print()} className={`${btnSecondary} hidden sm:inline-flex`}>{R.printPage}</button>
              <ScanExportButton results={results} patientInfo={patientInfo} drugs={drugs} species={species} contextFindings={contextFindings} variant="primary" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
