import React, { useState, useId } from 'react';
import { useI18n } from '../i18n';

/**
 * Confidence Provenance
 *
 * Turns an opaque confidence percentage into an explainable, per-drug
 * breakdown built from drug source, species data completeness and
 * literature availability. A vet who understands *why* the confidence
 * is 74 % trusts the system more than one who just sees 74 %.
 */

// ── Per-drug confidence calculation ─────────────────────────────
function getDrugConfidence(drug, species) {
  const reasons = [];
  let score;

  switch (drug.source) {
    case 'kr_vet':
      score = 94;
      reasons.push('koreanDbVerified');
      break;
    case 'human_offlabel':
      score = 68;
      reasons.push('humanOffLabelPkExtrapolated');
      break;
    case 'foreign':
      score = 76;
      reasons.push('foreignFormularyData');
      break;
    default:
      score = 42;
      reasons.push('limitedVeterinaryLiterature');
  }

  // Deduct for missing species-specific data
  if (species === 'cat' && !drug.speciesNotes?.cat) {
    score -= 14;
    reasons.push('catPkDataIncomplete');
  }

  // Deduct for incomplete PK parameters
  if (!drug.pk?.halfLife) {
    score -= 10;
    reasons.push('pkParametersIncomplete');
  }

  // Deduct for NTI drugs (more uncertainty)
  if (drug.narrowTherapeuticIndex) {
    score -= 4;
    reasons.push('narrowTherapeuticIndex');
  }

  // Deduct for unknown active substance
  if (!drug.activeSubstance || drug.activeSubstance === 'Unknown') {
    score -= 22;
    reasons.push('activeIngredientUnconfirmed');
  }

  return { score: Math.max(score, 15), reasons };
}

function scoreTone(score) {
  if (score >= 85) return { text: 'text-emerald-700', bar: 'bg-emerald-500', key: 'confidenceHigh' };
  if (score >= 60) return { text: 'text-amber-700', bar: 'bg-amber-500', key: 'confidenceModerate' };
  return { text: 'text-red-700', bar: 'bg-red-500', key: 'confidenceLow' };
}

/** Thin horizontal meter — 2px track, hue carries the meaning. */
function Meter({ pct, bar, className = '' }) {
  return (
    <span aria-hidden="true" className={`relative block h-[2px] bg-ink-100 ${className}`}>
      <span className={`absolute inset-y-0 left-0 ${bar} transition-[width] duration-700 ease-out`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

export function ConfidenceProvenance({ confidenceScore, drugs = [], species = 'dog' }) {
  const { t } = useI18n();
  const R = t.results;
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const overall = scoreTone(confidenceScore);
  const perDrug = drugs.map((drug) => ({ drug, ...getDrugConfidence(drug, species) }));

  return (
    <section aria-label={R.analysisConfidence}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="kicker text-[11px] text-ink-500">{R.analysisConfidence}</h3>
        <p className={`kicker text-[10.5px] ${overall.text}`}>{R[overall.key]}</p>
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink-900 tnum">{confidenceScore}</span>
        <span className="text-[15px] font-medium text-ink-400">%</span>
      </p>
      <Meter pct={confidenceScore} bar={overall.bar} className="mt-3" />

      {drugs.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="no-print -ml-1 mt-2 inline-flex h-10 items-center rounded-md px-1 text-[13px] font-medium text-ink-600 underline decoration-ink-300 underline-offset-[5px] transition-colors hover:text-ink-900 hover:decoration-ink-600"
        >
          {expanded ? R.hideBreakdown : R.whyThisScore}
        </button>
      )}

      {expanded && (
        <div id={panelId} className="mt-1 animate-fade-in">
          {perDrug.length === 0 ? (
            <p className="text-[13px] text-ink-400">{R.noDrugDataAvailable}</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">{R.perDrugDataQuality}</caption>
              <thead>
                <tr className="border-b border-ink-200">
                  <th scope="col" className="kicker pb-2 text-[10px] font-semibold text-ink-400">{R.confidenceTable.drug}</th>
                  <th scope="col" className="kicker w-[64px] pb-2 text-right text-[10px] font-semibold text-ink-400">{R.confidenceTable.score}</th>
                </tr>
              </thead>
              <tbody>
                {perDrug.map(({ drug, score, reasons }) => {
                  const tone = scoreTone(score);
                  return (
                    <tr key={drug.id || drug.name} className="border-b border-ink-100 align-top last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="truncate text-[13px] font-semibold text-ink-900">{drug.name}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-ink-500">
                          {reasons.map((r) => R.confidenceReasons[r] || r).join(' · ')}
                        </p>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`font-mono text-[13px] font-semibold tnum ${tone.text}`}>{score}%</span>
                        <Meter pct={score} bar={tone.bar} className="ml-auto mt-1.5 w-12" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-ink-400">{R.confidenceFootnote}</p>
        </div>
      )}
    </section>
  );
}
