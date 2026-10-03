import React from 'react';
import { useI18n } from '../i18n';

/**
 * Cumulative Organ Load
 *
 * Always expanded — renal and hepatic burden plus the per-drug
 * contribution table are visible without any interaction. This is one
 * of nuvoDUR's core differentiators, so it is set as data, not hidden
 * behind a toggle.
 *
 * getOrganLoads / getRenalRisk are shared with the DUR island
 * (components/dur/findings.js) so the island and the report agree.
 */

export function getOrganLoads(drugs, species) {
  let renalLoad = 0;
  let hepaticLoad = 0;
  const contributions = [];

  drugs.forEach((drug) => {
    const renal = drug.renalElimination ?? 0;
    const hepatic =
      drug.hepaticElimination != null
        ? drug.hepaticElimination
        : drug.pk?.primaryElimination === 'hepatic'
        ? Math.max(1 - renal, 0)
        : drug.pk?.primaryElimination === 'mixed'
        ? Math.max((1 - renal) * 0.5, 0)
        : 0;

    const prescribedDose = drug.dosePerKg ?? 0;
    const standardDose = drug.defaultDose?.[species] ?? null;
    let doseModifier = 1.0;
    let doseScalingApplied = false;

    if (prescribedDose > 0 && standardDose != null && standardDose > 0) {
      doseModifier = Math.min(Math.max(prescribedDose / standardDose, 0.5), 2.0);
      doseScalingApplied = true;
    }

    const scaledRenal = renal * doseModifier;
    const scaledHepatic = hepatic * doseModifier;

    renalLoad += scaledRenal;
    hepaticLoad += scaledHepatic;

    contributions.push({
      drugId: drug.id,
      drugName: drug.name,
      baseRenal: Math.round(renal * 100),
      baseHepatic: Math.round(hepatic * 100),
      doseModifier: Math.round(doseModifier * 100) / 100,
      scaledRenal: Math.round(scaledRenal * 100),
      scaledHepatic: Math.round(scaledHepatic * 100),
      doseScalingApplied,
    });
  });

  return {
    renal: Math.round(renalLoad * 100),
    hepatic: Math.round(hepaticLoad * 100),
    contributions,
  };
}

export function getRenalRisk(renalPct, elevatedCreatinine) {
  if (elevatedCreatinine && renalPct >= 40)
    return { level: 'critical', label: 'Critical', bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (renalPct >= 120)
    return { level: 'high', label: 'High', bar: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (renalPct >= 70)
    return { level: 'moderate', label: 'Moderate', bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { level: 'low', label: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-white border-slate-200' };
}

function getHepaticRisk(hepaticPct) {
  if (hepaticPct >= 180) return { level: 'high', label: 'High', bar: 'bg-amber-500', text: 'text-amber-700' };
  if (hepaticPct >= 100) return { level: 'moderate', label: 'Moderate', bar: 'bg-yellow-400', text: 'text-yellow-700' };
  return { level: 'low', label: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-700' };
}

// Track spans 0–200 %; the hairline tick marks 100 % of a single pathway.
function OrganMeter({ label, pct, risk, riskWord }) {
  const width = Math.min((pct / 200) * 100, 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-700">{label}</span>
        <span className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="font-mono text-[15px] font-semibold text-ink-900 tnum">{pct}%</span>
          <span className={`kicker min-w-[52px] text-right text-[10px] ${risk.text}`}>{riskWord}</span>
        </span>
      </div>
      <div className="relative mt-2 h-[2px] bg-ink-100" role="img" aria-label={`${label}: ${pct}% — ${riskWord}`}>
        <span className={`absolute inset-y-0 left-0 ${risk.bar} transition-[width] duration-700 ease-out`} style={{ width: `${width}%` }} />
        <span aria-hidden="true" className="absolute -top-[3px] left-1/2 h-[8px] w-px bg-ink-300" />
      </div>
    </div>
  );
}

export function OrganLoadIndicator({ drugs = [], patientInfo, species = 'dog' }) {
  const { t } = useI18n();
  const R = t.results;

  if (drugs.length === 0) return null;

  const { renal, hepatic, contributions } = getOrganLoads(drugs, species);

  const elevatedCreatinine = patientInfo?.flaggedLabs?.some(
    (lab) =>
      (lab.key?.toLowerCase().includes('creatinine') || lab.key?.toLowerCase().includes('bun')) &&
      lab.status === 'high',
  );

  const renalRisk = getRenalRisk(renal, elevatedCreatinine);
  const hepaticRisk = getHepaticRisk(hepatic);
  const isCritical = renalRisk.level === 'critical';
  const anyUnscaled = contributions.some((c) => !c.doseScalingApplied);

  return (
    <section aria-label={R.cumulativeOrganLoad}>
      <h3 className="kicker text-[11px] text-ink-500">{R.cumulativeOrganLoad}</h3>

      <div className="mt-4 space-y-4">
        <OrganMeter label={R.renalEliminationBurden} pct={renal} risk={renalRisk} riskWord={R.riskLevel[renalRisk.level] || renalRisk.label} />
        <OrganMeter label={R.hepaticEliminationBurden} pct={hepatic} risk={hepaticRisk} riskWord={R.riskLevel[hepaticRisk.level] || hepaticRisk.label} />
      </div>

      {isCritical && (
        <div className="relative mt-4 py-0.5 pl-3.5">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-red-500" />
          <p className="kicker text-[10.5px] text-red-700">{R.compromisedKidney}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
            {R.organLoadCriticalPrefix} <strong className="font-semibold text-red-700 tnum">{renal}%</strong> {R.organLoadCriticalBody}
          </p>
        </div>
      )}

      <table className="mt-5 w-full table-fixed border-collapse text-left">
        <caption className="kicker pb-2 text-left text-[10px] text-ink-400">{R.perDrugContribution}</caption>
        <thead>
          <tr className="border-y border-ink-200">
            <th scope="col" className="py-1.5 text-[11px] font-medium text-ink-500">{t.pk.drugColumn}</th>
            <th scope="col" className="w-[52px] py-1.5 text-right text-[11px] font-medium text-ink-500">{R.renalShort}</th>
            <th scope="col" className="w-[52px] py-1.5 text-right text-[11px] font-medium text-ink-500">{R.hepaticShort}</th>
            <th scope="col" className="w-[48px] py-1.5 text-right text-[11px] font-medium text-ink-500">{R.doseFactor}</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((c, i) => {
            const scaled = c.doseScalingApplied && c.doseModifier !== 1.0;
            return (
              <tr key={c.drugId || i} className="border-b border-ink-100">
                <td className="truncate py-2 pr-2 text-[13px] text-ink-800" title={c.drugName}>{c.drugName}</td>
                <td className="py-2 text-right font-mono text-[12.5px] text-ink-900 tnum">{c.scaledRenal}%</td>
                <td className="py-2 text-right font-mono text-[12.5px] text-ink-900 tnum">{c.scaledHepatic}%</td>
                <td className={`py-2 text-right font-mono text-[12px] tnum ${scaled ? (c.doseModifier > 1 ? 'text-amber-700' : 'text-ink-700') : 'text-ink-300'}`}>
                  {c.doseScalingApplied ? `×${c.doseModifier}` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-ink-400">
        {anyUnscaled && <p><span className="font-mono text-ink-500">—</span> {R.doseScalingNotApplied}</p>}
        <p>{R.organLoadFootnote}</p>
      </div>
    </section>
  );
}
