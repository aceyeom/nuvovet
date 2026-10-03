/**
 * Localised display strings for DUR findings (island + lists).
 * Pure functions — no React — so the hero animation, the live demo and
 * any future surface render identical copy.
 */

import { getDrugById } from '../../data/drugDatabase';

export function fmt(template = '', params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

/** Short drug label for compact UI: Korean name in ko, brand parenthetical stripped. */
export function drugLabel(drug, lang) {
  if (!drug) return '';
  if (lang === 'ko' && drug.nameKr) return drug.nameKr;
  return String(drug.name || '').replace(/\s*\(.*\)\s*$/, '');
}

// Korean vets read SID/BID/TID and PO as-is; only spell out the rest
const KO_REGIMEN_TERMS = { Monthly: '월 1회', Topical: '외용', Weekly: '주 1회' };

function trimNumber(n) {
  return Number.isFinite(n) ? String(+Number(n).toFixed(3)) : String(n);
}

/** Human label for a resolution action. Returns { verb, sentence } or null. */
export function describeResolution(resolution, { t, lang, species }) {
  if (!resolution || resolution.type === 'ack') return null;
  const L = t.island.resolution;
  const from = resolution.fromId ? drugLabel(getDrugById(resolution.fromId), lang) : '';
  const toDrug = resolution.toId ? getDrugById(resolution.toId) : null;
  const to = drugLabel(toDrug, lang);
  const toDose = toDrug?.defaultDose?.[species];
  const localTerm = (v) => (lang === 'ko' ? KO_REGIMEN_TERMS[v] || v : v);
  const toRegimen = toDrug && toDose != null
    ? `${trimNumber(toDose)} ${toDrug.unit} ${localTerm(toDrug.route)} ${localTerm(toDrug.freq)}`
    : '';

  switch (resolution.type) {
    case 'replace':
      return { verb: L.verbReplace, sentence: fmt(L.replace, { from, to, regimen: toRegimen }).replace(/\s+/g, ' ').trim(), short: `${from} → ${to}` };
    case 'remove':
      return {
        verb: L.verbRemove,
        sentence: resolution.toId ? fmt(L.removeCovered, { from, to }) : fmt(L.remove, { from }),
        short: fmt(L.remove, { from }),
      };
    case 'dose': {
      const drug = getDrugById(resolution.drugId);
      const name = drugLabel(drug, lang);
      if (resolution.value != null) {
        const sentence = fmt(L.doseTo, { drug: name, value: trimNumber(resolution.value), unit: drug?.unit || 'mg/kg' });
        return { verb: L.verbDose, sentence, short: sentence };
      }
      const sentence = fmt(L.doseFactor, { drug: name, pct: Math.round((1 - resolution.factor) * 100) });
      return { verb: L.verbDose, sentence, short: sentence };
    }
    case 'add':
      return { verb: L.verbAdd, sentence: fmt(L.add, { to }), short: `+ ${to}` };
    default:
      return null;
  }
}

/**
 * Display model for a finding.
 * @returns {{ id, severity, kind, title, drugs: string[], drugsLabel, summary, suggestion, verb, citation }}
 */
export function describeFinding(f, { t, lang, species, patientName }) {
  const I = t.island;
  const names = (f.drugs || []).map((d) => drugLabel(d, lang));
  const speciesWord = species === 'cat' ? I.speciesCat : I.speciesDog;
  const base = { a: names[0], b: names[1], drug: names[0], species: speciesWord, patient: patientName || I.thisPatient };

  let title = '';
  let summary = '';
  let action = '';

  if (f.kind === 'interaction') {
    const r = I.rules[f.rule] || {};
    title = r.title || f.rule;
    summary = r.summary ? fmt(r.summary, base) : f.mechanism;
    action = r.action ? fmt(r.action, base) : f.recommendation;
  } else {
    const k = I.kinds;
    switch (f.rule) {
      case 'hardstop':
        title = k.hardstop.title;
        summary = fmt(k.hardstop.summary, base);
        action = fmt(k.hardstop.action, base);
        break;
      case 'unapproved':
        title = fmt(k.unapproved.title, base);
        summary = fmt(k.unapproved.summary, base);
        action = fmt(k.unapproved.action, base);
        break;
      case 'allergy':
        title = k.allergy.title;
        summary = fmt(k.allergy.summary, { ...base, allergy: f.allergy });
        action = fmt(k.allergy.action, base);
        break;
      case 'mdr1':
        if (f.kind === 'mdr1') {
          // herding breed, MDR1 status not charted
          title = k.mdr1.title;
          summary = fmt(k.mdr1.summary, base);
          action = fmt(k.mdr1.action, base);
        } else {
          // drug–disease match against a charted MDR1 mutation
          title = k.mdr1Disease.title;
          summary = fmt(k.mdr1Disease.summary, base);
          action = fmt(k.mdr1Disease.action, base);
        }
        break;
      case 'doseHigh':
      case 'doseLow': {
        const kk = f.rule === 'doseHigh' ? k.doseHigh : k.doseLow;
        title = kk.title;
        summary = fmt(kk.summary, { ...base, qty: trimNumber(f.qty), min: trimNumber(f.range[0]), max: trimNumber(f.range[1]) });
        action = fmt(kk.action, base);
        break;
      }
      case 'renalLoad':
        title = fmt(k.renalLoad.title, { pct: f.renalPct });
        summary = fmt(k.renalLoad.summary, { ...base, drugs: names.join(', ') });
        action = fmt(k.renalLoad.action, { ...base, drugs: names.join(', ') });
        break;
      default:
        // drug–disease (renal, hepatic, cardiomyopathy, …)
        title = fmt(k.disease.title, base);
        summary = fmt(k.disease.summary, { ...base, condition: f.condition, contra: I.terms?.[f.contraindication] || f.contraindication });
        action = fmt(k.disease.action, base);
    }
  }

  const res = describeResolution(f.resolution, { t, lang, species });

  return {
    id: f.id,
    severity: f.severity,
    kind: f.kind,
    title,
    drugs: names,
    drugsLabel: names.join(' + '),
    summary,
    suggestion: res ? res.sentence : action,
    resolvedShort: res ? res.short : null,
    verb: res ? res.verb : null,
    hasResolution: Boolean(res),
    citation: f.citation || null,
  };
}
