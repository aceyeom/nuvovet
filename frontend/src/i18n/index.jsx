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
export function LangToggle({ className = '' }) {
  const { lang, setLang } = useI18n();
  const opts = [
    { code: 'ko', label: '한', aria: '한국어' },
    { code: 'en', label: 'EN', aria: 'English' },
  ];
  return (
    <span
      role="group"
      aria-label="Language"
      className={`inline-flex items-center rounded-full bg-ink-100/80 p-0.5 ring-1 ring-inset ring-ink-200/70 ${className}`}
    >
      {opts.map((o) => (
        <button
          key={o.code}
          type="button"
          onClick={() => setLang(o.code)}
          aria-pressed={lang === o.code}
          aria-label={o.aria}
          className={`h-7 min-w-[34px] rounded-full px-2 text-[12px] font-semibold transition-all ${
            lang === o.code ? 'bg-white text-ink-900 shadow-sm ring-1 ring-ink-900/5' : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export default I18nContext;
