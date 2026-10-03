/**
 * nuvovet DUR — findings layer for the island UI.
 *
 * Turns the client-side DUR engine output (durEngine.js) plus the open
 * patient chart into a flat, ranked list of "findings" the island can
 * show, each with an optional one-tap resolution.
 *
 *   interaction  pairwise rule from the DUR engine
 *   disease      drug contraindicated by a charted condition (e.g. CKD, MDR1)
 *   allergy      drug matches a charted allergy
 *   mdr1         MDR1-sensitive drug in a herding breed with unknown status
 *   species      species hardstop / no approved dose for this species
 *   dose         prescribed mg/kg outside the species dose range
 *   organ        cumulative renal load with elevated creatinine / BUN
 *
 * Severity thresholds deliberately reuse the same helpers as the full
 * report (OrganLoadIndicator, drug contraindication rules) so the island
 * and the report never disagree.
 */

import { runFullDURAnalysis } from '../../utils/durEngine';
import { getDrugById } from '../../data/drugDatabase';
import { getOrganLoads, getRenalRisk } from '../OrganLoadIndicator';
import { checkHardstop } from '../../utils/speciesHardstops';

export const SEVERITY_RANK = { critical: 4, moderate: 3, minor: 2, unknown: 1 };

const KIND_RANK = { species: 7, allergy: 6, interaction: 5, disease: 4, mdr1: 3, dose: 2, organ: 1 };

const HERDING_BREEDS = /collie|sheltie|shetland|australian shepherd|old english sheepdog|german shepherd|long-?haired whippet|silken windhound|mcnab|wäller|white swiss/i;

// Patient-condition ↔ drug-contraindication matching. Drug terms come from
// drugDatabase.js; patient terms are free-text EMR conditions (EN / KO).
const CONDITION_CATEGORIES = [
  // 'Renal disease' style terms only — not anuria or renal-artery stenosis,
  // which a stable CKD patient does not have.
  { key: 'renal', drug: /renal disease|kidney disease|renal failure|renal impairment/i, patient: /renal|kidney|ckd|iris stage|신부전|신장/i },
  { key: 'hepatic', drug: /hepatic|liver/i, patient: /hepat|liver|간질환|간부전|간염/i },
  { key: 'diabetes', drug: /diabet/i, patient: /diabet|당뇨/i },
  { key: 'gi', drug: /ulcer/i, patient: /ulcer|궤양/i },
  { key: 'seizure', drug: /seizure|neurolog/i, patient: /seizure|epilep|발작|뇌전증|neurolog/i },
  { key: 'mdr1', drug: /mdr1/i, patient: /mdr1|abcb1/i },
  { key: 'cardiomyopathy', drug: /cardiomyopathy/i, patient: /cardiomyopathy|\bhcm\b|심근증/i },
  { key: 'coagulation', drug: /coagul|thrombocyt/i, patient: /coagul|thrombocyt|imha|혈소판/i },
  { key: 'neoplasia', drug: /neoplas/i, patient: /lymphoma|tumou?r|neoplas|cancer|carcinoma|종양/i },
  { key: 'hypokalemia', drug: /hypokal/i, patient: /hypokal|저칼륨/i },
];

const DISEASE_SEVERITY = { absolute: 'critical', relative: 'moderate', caution: 'minor' };

const lower = (v) => String(v || '').toLowerCase();

function engineSeverity(label) {
  const l = lower(label);
  if (l === 'critical' || l === 'moderate' || l === 'minor') return l;
  return 'unknown';
}

// ── Resolutions ─────────────────────────────────────────────────
// One primary action per finding. Every finding can also be acknowledged.

function replaceOrRemove(fromId, toId, has) {
  if (!fromId) return null;
  if (!toId || has(toId)) return { type: 'remove', fromId, toId: toId && has(toId) ? toId : null };
  return { type: 'replace', fromId, toId };
}

function interactionResolution(ix, ctx) {
  const a = ix.drugAData;
  const b = ix.drugBData;
  const { has, indexOf } = ctx;
  const later = indexOf(a.id) > indexOf(b.id) ? a : b;

  switch (ix.rule) {
    case 'Duplicate NSAID':
      return { type: 'remove', fromId: later.id };
    case 'NSAID + Corticosteroid GI Risk': {
      const nsaid = a.class === 'NSAID' ? a : b;
      return replaceOrRemove(nsaid.id, 'gabapentin', has);
    }
    case 'Serotonin Syndrome Risk': {
      const target = a.id === 'tramadol' ? a : b.id === 'tramadol' ? b : later;
      return replaceOrRemove(target.id, 'gabapentin', has);
    }
    case 'CYP3A4 Inhibition':
      // b is the substrate whose exposure rises
      return { type: 'dose', drugId: b.id, factor: 0.5 };
    case 'CYP2D6 Inhibition':
      return b.class === 'Analgesic' ? replaceOrRemove(b.id, 'gabapentin', has) : { type: 'ack' };
    case 'QT Prolongation Stacking': {
      const abx = a.class === 'Antibiotic' ? a : b.class === 'Antibiotic' ? b : null;
      return abx ? replaceOrRemove(abx.id, 'amoxicillin', has) : { type: 'ack' };
    }
    case 'Bleeding Risk Stacking':
      return has('omeprazole') ? { type: 'ack' } : { type: 'add', toId: 'omeprazole' };
    default:
      return { type: 'ack' };
  }
}

// ── Main entry ──────────────────────────────────────────────────

/**
 * @param {object}   args
 * @param {Array}    args.drugs    Drug objects (may carry dosePerKg)
 * @param {string}   args.species  'dog' | 'cat'
 * @param {object}   args.patient  { weight, breed, conditions[], allergies[], labResults{} }
 * @returns {{ results: object, findings: Array, advisories: number }}
 */
export function analyzeRegimen({ drugs, species, patient = {} }) {
  const weight = Number(patient.weight) || 10;
  const results = runFullDURAnalysis(drugs, species, weight);
  const findings = [];
  const ids = drugs.map((d) => d.id);
  const ctx = {
    has: (id) => ids.includes(id),
    indexOf: (id) => ids.indexOf(id),
  };

  // 1. Pairwise interactions from the engine
  for (const ix of results.interactions) {
    const pair = [ix.drugAData?.id, ix.drugBData?.id].sort().join('+');
    findings.push({
      id: `ix:${ix.rule}:${pair}`,
      kind: 'interaction',
      severity: engineSeverity(ix.severity?.label),
      rule: ix.rule,
      drugs: [ix.drugAData, ix.drugBData].filter(Boolean),
      mechanism: ix.mechanism,
      recommendation: ix.recommendation,
      alternative: ix.alternativeSuggestion,
      citation: ix.literature?.[0]?.source || null,
      resolution: ix.drugAData && ix.drugBData ? interactionResolution(ix, ctx) : { type: 'ack' },
    });
  }

  const conditions = (patient.conditions || []).map(String);
  const allergies = (patient.allergies || []).map(String);

  for (const drug of drugs) {
    // 2. Species hardstops (fatal for the species) and missing species dose
    const hardstop = checkHardstop(drug, species);
    if (hardstop) {
      findings.push({
        id: `species:hardstop:${drug.id}`,
        kind: 'species',
        severity: 'critical',
        rule: 'hardstop',
        drugs: [drug],
        mechanism: hardstop,
        resolution: { type: 'remove', fromId: drug.id },
      });
    } else if (drug.defaultDose && drug.defaultDose[species] === null) {
      findings.push({
        id: `species:unapproved:${drug.id}`,
        kind: 'species',
        severity: 'moderate',
        rule: 'unapproved',
        drugs: [drug],
        mechanism: drug.speciesNotes?.[species] || null,
        resolution: { type: 'remove', fromId: drug.id },
      });
    }

    // 3. Allergy conflicts — charted allergy vs drug name / class / contraindications
    for (const allergy of allergies) {
      const key = lower(allergy).replace(/\s*\(.*\)$/, '').replace(/s$/, '').trim();
      if (key.length < 3) continue;
      const haystack = [
        drug.name, drug.activeSubstance, drug.class,
        ...(drug.contraindicationTerms || []),
      ].map(lower).join(' | ');
      if (haystack.includes(key)) {
        findings.push({
          id: `allergy:${key}:${drug.id}`,
          kind: 'allergy',
          severity: 'critical',
          rule: 'allergy',
          drugs: [drug],
          allergy,
          resolution: { type: 'remove', fromId: drug.id },
        });
      }
    }

    // 4. Drug–disease contraindications from the drug's own rules
    for (const rule of drug.contraindications || []) {
      if (/allergy/i.test(rule.condition)) continue; // handled above
      const cat = CONDITION_CATEGORIES.find((c) => c.drug.test(rule.condition));
      if (!cat) continue;
      const hit = conditions.find((c) => cat.patient.test(c));
      if (!hit) continue;
      const severity = DISEASE_SEVERITY[rule.severity] || 'minor';
      const resolution = cat.key === 'mdr1' && drug.class === 'Antiparasitic'
        ? replaceOrRemove(drug.id, 'selamectin', ctx.has)
        : severity === 'critical'
        ? { type: 'remove', fromId: drug.id }
        : { type: 'ack' };
      findings.push({
        id: `disease:${cat.key}:${drug.id}`,
        kind: 'disease',
        severity,
        rule: cat.key,
        drugs: [drug],
        condition: hit,
        contraindication: rule.condition,
        resolution,
      });
    }

    // 5. MDR1-sensitive drug in a herding breed whose status is not charted
    if (
      drug.mdr1Sensitive && species === 'dog' && HERDING_BREEDS.test(patient.breed || '') &&
      !conditions.some((c) => /mdr1|abcb1/i.test(c))
    ) {
      findings.push({
        id: `mdr1:${drug.id}`,
        kind: 'mdr1',
        severity: 'moderate',
        rule: 'mdr1',
        drugs: [drug],
        resolution: drug.class === 'Antiparasitic' ? replaceOrRemove(drug.id, 'selamectin', ctx.has) : { type: 'ack' },
      });
    }

    // 6. Dose range — prescribed mg/kg vs species range
    const range = drug.doseRange?.[species];
    const qty = Number(drug.dosePerKg);
    if (range && qty > 0 && /mg\/kg/i.test(drug.unit || '')) {
      const [min, max] = range;
      const pointRange = min === max;
      const hi = pointRange ? max * 1.25 : max * 1.001;
      const lo = pointRange ? min * 0.75 : min * 0.999;
      if (qty > hi) {
        findings.push({
          id: `dose:high:${drug.id}`,
          kind: 'dose',
          severity: qty > max * 2 ? 'critical' : 'moderate',
          rule: 'doseHigh',
          drugs: [drug],
          qty,
          range,
          resolution: { type: 'dose', drugId: drug.id, value: max },
        });
      } else if (qty < lo) {
        findings.push({
          id: `dose:low:${drug.id}`,
          kind: 'dose',
          severity: 'minor',
          rule: 'doseLow',
          drugs: [drug],
          qty,
          range,
          resolution: { type: 'dose', drugId: drug.id, value: min },
        });
      }
    }
  }

  // 7. Cumulative renal load — same thresholds as the report's organ panel
  if (drugs.length > 0) {
    const labs = patient.labResults || {};
    const elevated = Object.entries(labs).some(
      ([k, lab]) => /creatinine|bun|sdma/i.test(k) && lab?.status === 'high',
    );
    const { renal, contributions } = getOrganLoads(drugs, species);
    const risk = getRenalRisk(renal, elevated);
    // Only surface when kidney values are already up — a high load in a
    // patient with normal creatinine stays a report detail, not an alert.
    if (risk.level === 'critical') {
      const top = [...contributions].sort((x, y) => y.scaledRenal - x.scaledRenal).filter((c) => c.scaledRenal >= 30);
      findings.push({
        id: 'organ:renal',
        kind: 'organ',
        severity: 'critical',
        rule: 'renalLoad',
        drugs: top.map((c) => drugs.find((d) => d.id === c.drugId)).filter(Boolean),
        renalPct: renal,
        elevated,
        resolution: { type: 'ack' },
      });
    }
  }

  findings.sort(
    (x, y) =>
      (SEVERITY_RANK[y.severity] || 0) - (SEVERITY_RANK[x.severity] || 0) ||
      (KIND_RANK[y.kind] || 0) - (KIND_RANK[x.kind] || 0),
  );

  const advisories = results.drugFlags.reduce(
    (n, f) => n + f.flags.filter((fl) => ['nti', 'off-label', 'foreign', 'unknown'].includes(fl.type)).length,
    0,
  );

  return { results, findings, advisories };
}

export function topSeverity(findings) {
  let best = null;
  for (const f of findings) {
    if (!best || (SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[best] || 0)) best = f.severity;
  }
  return best;
}

export function resolveTargetDrug(resolution) {
  if (!resolution?.toId) return null;
  return getDrugById(resolution.toId) || null;
}
