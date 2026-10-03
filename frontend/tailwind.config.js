/** @type {import('tailwindcss').Config} */

// ── nuvovet brand tokens ──────────────────────────────────────────
// Master brand is monochrome (ink). Each product line owns one hue:
//   nuvoDUR    → teal   (clinical, "monitoring")
//   nuvoClaim  → violet (paperwork, insurance)
// Severity colours (red / amber / yellow / emerald) stay reserved for
// clinical meaning and never double as brand colours.

const ink = {
  950: '#060A12',
  900: '#0B1220',
  800: '#151E2E',
  700: '#253043',
  600: '#3C4759',
  500: '#5B6678',
  400: '#8A93A3',
  300: '#BAC1CC',
  200: '#DCE1E8',
  100: '#EDF0F4',
  50: '#F6F8FA',
};

const dur = {
  50: '#EEFBFA',
  100: '#D3F5F2',
  200: '#A8EAE5',
  300: '#6DD8D1',
  400: '#2FC0B8',
  500: '#12A39C',
  600: '#0B847F',
  700: '#0D6A67',
  800: '#105553',
  900: '#114646',
  950: '#032929',
};

const claims = {
  50: '#F5F3FF',
  100: '#ECE8FF',
  200: '#DAD2FF',
  300: '#BEB0FF',
  400: '#9F88FF',
  500: '#8164F5',
  600: '#6C4BE6',
  700: '#5A3BC8',
  800: '#4A31A2',
  900: '#3D2B80',
  950: '#241850',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink,
        dur,
        claims,
        // The simulated clinic EMR is a classic Windows desktop app — its own
        // grey/blue palette, so the dark nuvoDUR island reads as a layer on top.
        emr: {
          bg: '#E4E8ED',
          chrome: '#F3F4F6',
          panel: '#FFFFFF',
          line: '#C9D0D9',
          grid: '#E2E6EC',
          head: '#EEF1F5',
          label: '#F2F4F7',
          alt: '#F8FAFC',
          select: '#CCE4FF',
          blue: '#1F6FD1',
          blueDark: '#1859AA',
          blueSoft: '#E6F0FC',
          text: '#16191D',
          muted: '#5E6875',
          faint: '#8B95A3',
        },
        // Severity tones tuned for the dark DUR island surface
        island: {
          bg: '#0A0E16',
          raised: '#141A26',
          line: 'rgba(255,255,255,0.08)',
          critical: '#FF6B5E',
          moderate: '#FFB340',
          minor: '#FFD84D',
          clear: '#3DDC97',
          info: '#4FD1C5',
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', '"Segoe UI"', 'Roboto', '"Apple SD Gothic Neo"', '"Noto Sans KR"', '"Malgun Gothic"', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        hairline: '0 0 0 1px rgba(11,18,32,0.06)',
        card: '0 1px 2px rgba(11,18,32,0.04), 0 4px 16px -4px rgba(11,18,32,0.06)',
        lift: '0 2px 4px rgba(11,18,32,0.04), 0 12px 32px -8px rgba(11,18,32,0.12)',
        window: '0 0 0 1px rgba(11,18,32,0.08), 0 24px 48px -12px rgba(11,18,32,0.22), 0 60px 120px -40px rgba(11,18,32,0.25)',
        island: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 10px 30px -6px rgba(6,10,18,0.55), 0 24px 60px -20px rgba(6,10,18,0.45)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-back': 'cubic-bezier(0.34, 1.36, 0.64, 1)',
      },
      keyframes: {
        'island-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '70%': { transform: 'scale(2.4)', opacity: '0' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'island-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'row-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px)', backgroundColor: 'rgba(18,163,156,0.16)' },
          '60%': { opacity: '1', transform: 'translateY(0)', backgroundColor: 'rgba(18,163,156,0.12)' },
          '100%': { opacity: '1', transform: 'translateY(0)', backgroundColor: 'rgba(18,163,156,0)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '15%': { opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        'caret-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'progress-fill': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'click-ring': {
          '0%': { transform: 'translate(-50%, -50%) scale(0.4)', opacity: '0.6' },
          '100%': { transform: 'translate(-50%, -50%) scale(2.2)', opacity: '0' },
        },
        'load-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'island-pulse': 'island-pulse 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'island-shimmer': 'island-shimmer 1.4s ease-in-out infinite',
        'row-in': 'row-in 1.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scan-line': 'scan-line 1.2s ease-in-out infinite',
        'caret-blink': 'caret-blink 1s step-end infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'sheet-up': 'sheet-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'click-ring': 'click-ring 0.5s ease-out forwards',
        'load-sweep': 'load-sweep 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite',
      },
    },
  },
  plugins: [],
}
