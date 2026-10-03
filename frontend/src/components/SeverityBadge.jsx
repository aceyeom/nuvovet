import React from 'react';
import { useI18n } from '../i18n';

// ──────────────────────────────────────────────────────────────────
// Severity typography for the DUR report.
//
// Severity is a coloured word — never a pill, dot or glyph. Where a
// block needs a stronger cue it gets a short vertical rule (`rule`) or a
// thin meter (`meter`) in the same hue. Text tones are the -700 shades
// so 11–13px labels keep ≥ 4.5:1 contrast on white; `display` is for
// large type only.
// ──────────────────────────────────────────────────────────────────

export const SEVERITY_TONE = {
  Critical: { key: 'critical', word: 'text-red-700', display: 'text-red-600', rule: 'bg-red-500', hex: '#dc2626' },
  Moderate: { key: 'moderate', word: 'text-amber-700', display: 'text-amber-600', rule: 'bg-amber-500', hex: '#d97706' },
  Minor: { key: 'minor', word: 'text-yellow-700', display: 'text-yellow-700', rule: 'bg-yellow-400', hex: '#a16207' },
  None: { key: 'none', word: 'text-emerald-700', display: 'text-emerald-600', rule: 'bg-emerald-500', hex: '#047857' },
  Unknown: { key: 'unknown', word: 'text-ink-500', display: 'text-ink-600', rule: 'bg-ink-300', hex: '#5b6678' },
};

/** Normalise an engine severity ({label} | 'critical' | 'Critical' …) to a SEVERITY_TONE key. */
export function severityKey(severity) {
  const raw = String(severity?.label ?? severity ?? 'Unknown').toLowerCase();
  if (raw === 'critical') return 'Critical';
  if (raw === 'moderate') return 'Moderate';
  if (raw === 'minor') return 'Minor';
  if (raw === 'none' || raw === 'clear') return 'None';
  return 'Unknown';
}

export function severityTone(severity) {
  return SEVERITY_TONE[severityKey(severity)];
}

/** Short, translated severity word ("Critical" / "심각"). */
export function severityWord(t, severity) {
  const tone = severityTone(severity);
  return t.results.sev?.[tone.key] ?? tone.key;
}

/** Severity as a typographic micro-label. */
export function SeverityBadge({ severity, size = 'sm', className = '' }) {
  const { t } = useI18n();
  const tone = severityTone(severity);
  return (
    <span className={`kicker whitespace-nowrap ${size === 'lg' ? 'text-[12px]' : 'text-[11px]'} ${tone.word} ${className}`}>
      {severityWord(t, severity)}
    </span>
  );
}
