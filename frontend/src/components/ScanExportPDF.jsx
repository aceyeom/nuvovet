import React from 'react';
import { useI18n } from '../i18n';

/**
 * Scan export (print / save as PDF)
 *
 * Builds a dedicated A4 document for the scan — patient, result,
 * interactions, patient-context findings, the prescription and a
 * signature block for the prescribing veterinarian. It is the paper
 * trail for the patient file and the MFDS retrospective trial dataset.
 *
 * The document opens in its own window so its layout is independent of
 * the screen UI; the browser's print dialog saves it as a PDF.
 */

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const fmt = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

/** Stable, human-readable ID for one analysis run (same on screen and on paper). */
export function reportId(results) {
  const ms = Date.parse(results?.timestamp) || 0;
  return `NV-${ms.toString(36).toUpperCase().slice(-7)}`;
}

const SEV = {
  critical: { hex: '#b91c1c', rule: '#dc2626' },
  moderate: { hex: '#b45309', rule: '#f59e0b' },
  minor: { hex: '#a16207', rule: '#eab308' },
  unknown: { hex: '#5b6678', rule: '#bac1cc' },
  none: { hex: '#047857', rule: '#10b981' },
};
const sevKey = (label) => {
  const l = String(label?.label ?? label ?? '').toLowerCase();
  return SEV[l] ? l : l === 'clear' ? 'none' : 'unknown';
};

function buildPrintHTML({ results, patientInfo, drugs = [], contextFindings = [], t, lang }) {
  const R = t.results;
  const P = R.pdf;
  const { interactions, drugFlags, confidenceScore, timestamp } = results;
  const locale = lang === 'ko' ? 'ko-KR' : 'en-GB';
  const dateStr = new Date(timestamp).toLocaleString(locale, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const n = drugFlags.length;
  const pairs = (n * (n - 1)) / 2;
  const sevWord = (k) => R.sev?.[k] ?? k;

  const count = (k) =>
    interactions.filter((i) => sevKey(i.severity) === k).length +
    contextFindings.filter((f) => sevKey(f.severity) === k).length;
  const counts = { critical: count('critical'), moderate: count('moderate'), minor: count('minor') + count('unknown') };

  // Overall: worst of engine result and patient-context findings
  const rank = { critical: 4, moderate: 3, unknown: 2, minor: 1, none: 0 };
  const overall = [sevKey(results.overallSeverity), ...contextFindings.map((f) => sevKey(f.severity))]
    .reduce((a, b) => (rank[b] > rank[a] ? b : a), 'none');

  const confKey = confidenceScore >= 85 ? 'confidenceHigh' : confidenceScore >= 60 ? 'confidenceModerate' : 'confidenceLow';
  const confHex = confidenceScore >= 85 ? '#047857' : confidenceScore >= 60 ? '#b45309' : '#b91c1c';

  const kv = (k, v) => (v ? `<tr><th>${esc(k)}</th><td>${v}</td></tr>` : '');
  const species = patientInfo?.species ? (patientInfo.species === 'dog' ? t.species.dog : t.species.cat) : '';

  const ixRows = interactions.map((ix) => {
    const k = sevKey(ix.severity);
    return `
      <tr style="--rule:${SEV[k].rule}">
        <td class="sev" style="color:${SEV[k].hex}">${esc(sevWord(k))}</td>
        <td><strong>${esc(ix.drugA)} + ${esc(ix.drugB)}</strong><div class="sub mono">${esc(ix.rule ?? '')}</div></td>
        <td>${esc(ix.recommendation ?? '')}</td>
      </tr>`;
  }).join('');

  const ctxRows = contextFindings.map((f) => {
    const k = sevKey(f.severity);
    return `
      <tr style="--rule:${SEV[k].rule}">
        <td class="sev" style="color:${SEV[k].hex}">${esc(sevWord(k))}</td>
        <td><strong>${esc(f.title)}</strong>${f.drugsLabel ? `<div class="sub">${esc(f.drugsLabel)}</div>` : ''}</td>
        <td>${esc(f.suggestion || f.summary || '')}</td>
      </tr>`;
  }).join('');

  const sourceWord = (s) => (s === 'human_offlabel' ? t.drugInput.offLabel : s === 'foreign' ? t.drugInput.foreignDrug : s === 'unknown' ? t.drugInput.sourceUnknown : t.drugInput.koreanApproved);
  const rxRows = drugFlags.map((df, i) => {
    const drug = drugs.find((d) => d.id === df.drugId);
    const dose = parseFloat(drug?.dosePerKg);
    return `
      <tr>
        <td class="mono num">${String(i + 1).padStart(2, '0')}</td>
        <td><strong>${esc(df.drugName)}</strong>${df.speciesNote ? `<div class="sub">${esc(df.speciesNote)}</div>` : ''}</td>
        <td class="mono">${esc(df.drugClass ?? '')}</td>
        <td>${esc(sourceWord(df.source))}</td>
        <td>${df.flags.length ? esc(df.flags.map((f) => f.label).join(' · ')) : '<span class="muted">—</span>'}</td>
        <td class="mono num">${dose > 0 ? `${esc(dose)} mg/kg` : '<span class="muted">—</span>'}</td>
      </tr>`;
  }).join('');

  const conditions = patientInfo?.conditions?.length ? esc(patientInfo.conditions.join(', ')) : '';
  const allergies = patientInfo?.allergies?.length ? esc(patientInfo.allergies.join(', ')) : '';
  const labs = patientInfo?.flaggedLabs?.length
    ? patientInfo.flaggedLabs.map((l) => `${esc(l.key)} ${esc(l.value)} ${esc(l.unit)}${l.status === 'high' ? ' ↑' : l.status === 'low' ? ' ↓' : ''}`).join(', ')
    : '';

  return `<!DOCTYPE html>
<html lang="${lang === 'ko' ? 'ko' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <title>${esc(P.docTitle)} — ${esc(patientInfo?.name || R.untitledPatient)} — ${esc(reportId(results))}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', Roboto, sans-serif;
      font-size: 11.5px; line-height: 1.55; color: #0b1220; background: #fff;
      padding: 36px 40px; max-width: 900px; margin: 0 auto;
      word-break: keep-all; overflow-wrap: break-word;
    }
    .mono { font-family: 'Geist Mono Variable', SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
    .kicker { font-size: 9.5px; font-weight: 700; letter-spacing: ${lang === 'ko' ? '0.02em' : '0.14em'}; text-transform: uppercase; color: #5b6678; }
    .muted { color: #8a93a3; }
    .sub { font-size: 10.5px; color: #5b6678; margin-top: 2px; font-weight: 400; }

    header { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid #0b1220; }
    .lockup { font-size: 24px; font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
    .lockup .dur { color: #0b847f; }
    .tagline { margin-top: 6px; font-size: 10.5px; color: #5b6678; }
    .meta { text-align: right; }
    .meta .id { font-size: 13px; font-weight: 600; margin-top: 2px; }
    .meta .date { font-size: 10.5px; color: #5b6678; margin-top: 2px; }

    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 18px 0; border-bottom: 1px solid #dce1e8; }
    table.kv { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.kv th { text-align: left; font-weight: 400; color: #5b6678; width: 38%; padding: 3px 12px 3px 0; vertical-align: top; }
    table.kv td { padding: 3px 0; font-weight: 600; vertical-align: top; }
    .verdict { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; margin-top: 8px; padding-left: 10px; border-left: 3px solid var(--rule); }
    .counts { margin-top: 10px; display: flex; gap: 18px; }
    .counts b { font-size: 15px; display: block; }

    section { padding-top: 18px; break-inside: auto; }
    h2 { margin-bottom: 8px; }
    table.list { width: 100%; border-collapse: collapse; }
    table.list thead th { text-align: left; font-size: 9.5px; font-weight: 600; color: #5b6678; padding: 6px 10px 6px 0; border-top: 1px solid #0b1220; border-bottom: 1px solid #dce1e8; }
    table.list td { padding: 8px 10px 8px 0; border-bottom: 1px solid #edf0f4; vertical-align: top; }
    table.list tr { break-inside: avoid; }
    table.list td.sev { font-size: 9.5px; font-weight: 700; letter-spacing: ${lang === 'ko' ? '0.02em' : '0.12em'}; text-transform: uppercase; white-space: nowrap; border-left: 3px solid var(--rule, transparent); padding-left: 8px; width: 92px; }
    table.list td.num { white-space: nowrap; }
    .clear { padding: 10px 0 2px 10px; border-left: 3px solid #10b981; }
    .clear strong { color: #047857; }

    footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #0b1220; display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; break-inside: avoid; }
    .sign .line { border-bottom: 1px solid #0b1220; height: 30px; }
    .sign .label { font-size: 9.5px; color: #5b6678; margin-top: 4px; }
    .sign .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; }
    .disclaimer { font-size: 10px; color: #5b6678; line-height: 1.6; }
    .disclaimer .brand { margin-top: 10px; color: #0b1220; font-weight: 700; }

    @media print {
      body { padding: 0; max-width: none; }
      @page { margin: 14mm 14mm 16mm; size: A4; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="lockup">nuvo<span class="dur">DUR</span></div>
      <div class="tagline">${esc(P.tagline)}</div>
    </div>
    <div class="meta">
      <div class="kicker">${esc(P.reportLabel)}</div>
      <div class="id mono">${esc(reportId(results))}</div>
      <div class="date">${esc(P.generated)} ${esc(dateStr)}</div>
    </div>
  </header>

  <div class="cols">
    <div>
      <div class="kicker">${esc(R.patient)}</div>
      <table class="kv">
        ${kv(P.name, esc(patientInfo?.name || R.untitledPatient))}
        ${kv(R.species, esc(species))}
        ${kv(R.breed, esc(patientInfo?.breed))}
        ${kv(R.weight, patientInfo?.weight ? `<span class="mono">${esc(patientInfo.weight)} kg</span>` : '')}
        ${kv(R.conditions, conditions)}
        ${kv(P.allergies, allergies)}
        ${kv(R.flaggedLabs, labs)}
      </table>
    </div>
    <div>
      <div class="kicker">${esc(R.overallSeverity)}</div>
      <div class="verdict" style="--rule:${SEV[overall].rule}; color:${SEV[overall].hex}">${esc(sevWord(overall))}</div>
      <div class="counts">
        <div><b class="mono">${n}</b><span class="kicker">${esc(R.stat.drugs)}</span></div>
        <div><b class="mono">${pairs}</b><span class="kicker">${esc(R.stat.pairs)}</span></div>
        <div><b class="mono" style="color:${counts.critical ? SEV.critical.hex : '#0b1220'}">${counts.critical}</b><span class="kicker">${esc(sevWord('critical'))}</span></div>
        <div><b class="mono" style="color:${counts.moderate ? SEV.moderate.hex : '#0b1220'}">${counts.moderate}</b><span class="kicker">${esc(sevWord('moderate'))}</span></div>
        <div><b class="mono">${counts.minor}</b><span class="kicker">${esc(sevWord('minor'))}</span></div>
      </div>
      <table class="kv" style="margin-top:12px">
        ${kv(R.confidence, `<span class="mono" style="color:${confHex}">${confidenceScore}%</span> — ${esc(R[confKey])}`)}
      </table>
    </div>
  </div>

  <section>
    <h2 class="kicker">${esc(R.interactionReport)}</h2>
    ${interactions.length ? `
    <table class="list">
      <thead><tr><th>${esc(R.severity)}</th><th>${esc(P.drugPair)}</th><th>${esc(R.recommendedAction)}</th></tr></thead>
      <tbody>${ixRows}</tbody>
    </table>` : `
    <div class="clear"><strong>${esc(R.noInteractions)}</strong><div class="sub">${esc(fmt(P.noInteractionsDetail, { n: pairs }))}</div></div>`}
  </section>

  ${contextFindings.length ? `
  <section>
    <h2 class="kicker">${esc(R.contextChecks)}</h2>
    <table class="list">
      <thead><tr><th>${esc(R.severity)}</th><th>${esc(P.finding)}</th><th>${esc(R.suggestedFix)}</th></tr></thead>
      <tbody>${ctxRows}</tbody>
    </table>
  </section>` : ''}

  <section>
    <h2 class="kicker">${esc(P.prescription)}</h2>
    <table class="list">
      <thead><tr><th>#</th><th>${esc(P.drug)}</th><th>${esc(P.class)}</th><th>${esc(P.source)}</th><th>${esc(P.flags)}</th><th>${esc(P.dose)}</th></tr></thead>
      <tbody>${rxRows}</tbody>
    </table>
  </section>

  <footer>
    <div class="sign">
      <div class="kicker">${esc(P.ackTitle)}</div>
      <div class="line"></div>
      <div class="label">${esc(P.signature)}</div>
      <div class="row">
        <div><div class="line"></div><div class="label">${esc(P.printName)}</div></div>
        <div><div class="line"></div><div class="label">${esc(P.license)}</div></div>
      </div>
    </div>
    <div class="disclaimer">
      ${esc(P.disclaimer)}
      <div class="brand">nuvo<span style="color:#0b847f">DUR</span> <span class="muted" style="font-weight:400">· vetdur.nuvovet.com · ${esc(P.regulatory)}</span></div>
    </div>
  </footer>
</body>
</html>`;
}

const VARIANTS = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800',
  secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:ring-ink-300',
};

export function ScanExportButton({ results, patientInfo, drugs, species, contextFindings = [], variant = 'secondary', className = '' }) {
  const { t, lang } = useI18n();

  const handleExport = () => {
    const html = buildPrintHTML({ results, patientInfo, drugs, species, contextFindings, t, lang });
    const printWin = window.open('', '_blank', 'width=900,height=760');
    if (!printWin) {
      // Pop-up blocked — fall back to printing the on-screen report
      window.print();
      return;
    }
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 400);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[13.5px] font-semibold transition-colors ${VARIANTS[variant] || VARIANTS.secondary} ${className}`}
    >
      {t.results.exportPDF}
    </button>
  );
}
