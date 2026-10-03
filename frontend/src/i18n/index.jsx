import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from './en';
import ko from './ko';

const translations = { en, ko };

const I18nContext = createContext({
  t: en,
  lang: 'ko',
  setLang: () => {},
  toggleLang: () => {},
});

// ── Provider ─────────────────────────────────────────────────────
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('nuvovet-lang');
        if (stored && translations[stored]) return stored;
      } catch { /* storage unavailable */ }
    }
    return 'ko'; // Default to Korean
  });

  const setLang = useCallback((l) => {
    if (translations[l]) {
      setLangState(l);
      try { localStorage.setItem('nuvovet-lang', l); } catch { /* storage unavailable */ }
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  }, [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
  }, [lang]);

  const t = translations[lang] || en;

  return (
    <I18nContext.Provider value={{ t, lang, setLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────
export function useI18n() {
  return useContext(I18nContext);
}

// ── Compact segmented toggle (한 / EN) ────────────────────────────
// tone="light" (default) for white bars, tone="dark" for near-black bars.
// Segments are 26px tall; an invisible ::after extends each hit area to
// 40px so the toggle stays comfortable to tap.
const LANG_TONES = {
  light: {
    track: 'bg-ink-100/70 ring-ink-200/80',
    on: 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(11,18,32,0.10)] ring-1 ring-ink-900/[0.06]',
    off: 'text-ink-500 hover:text-ink-900',
  },
  dark: {
    track: 'bg-white/[0.06] ring-white/10',
    on: 'bg-white text-ink-900',
    off: 'text-white/55 hover:text-white',
  },
};

export function LangToggle({ className = '', tone = 'light' }) {
  const { lang, setLang } = useI18n();
  const s = LANG_TONES[tone] || LANG_TONES.light;
  const opts = [
    { code: 'ko', label: '한', aria: '한국어', font: 'font-sans text-[12px]' },
    { code: 'en', label: 'EN', aria: 'English', font: 'font-mono text-[10.5px] tracking-[0.08em]' },
  ];
  return (
    <span
      role="group"
      aria-label="Language / 언어"
      className={`inline-flex shrink-0 items-center gap-px rounded-md p-[3px] ring-1 ring-inset ${s.track} ${className}`}
    >
      {opts.map((o) => {
        const on = lang === o.code;
        return (
          <button
            key={o.code}
            type="button"
            lang={o.code}
            onClick={() => setLang(o.code)}
            aria-pressed={on}
            aria-label={o.aria}
            className={`relative h-[26px] min-w-[34px] rounded-[4px] px-2 font-semibold leading-none transition-colors after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-[''] ${o.font} ${on ? s.on : s.off}`}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

export default I18nContext;
