import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { ProductLockup } from './components/NuvovetLogo';
import { usePageCanvas, CANVAS } from './lib/usePageCanvas';

// Route-level code splitting: the marketing page, the live EMR demo and the
// clinic workspace each load only what they need.
const Landing = lazy(() => import('./pages/Landing'));
const Demo = lazy(() => import('./pages/Demo'));
const FullSystem = lazy(() => import('./pages/FullSystem'));
const Patients = lazy(() => import('./pages/Patients'));

// Matches the canvas of the route that is loading (dark for the landing
// page and the demo), so nothing flashes white before the hero.
function RouteFallback() {
  const { pathname } = useLocation();
  const dark = pathname === '/' || pathname.startsWith('/demo');
  usePageCanvas(dark ? CANVAS.dark : CANVAS.light);
  return (
    <div className={`flex min-h-screen flex-col items-center justify-center gap-4 ${dark ? 'bg-[#05070D]' : 'bg-white'}`} role="status" aria-label="Loading">
      <ProductLockup product="dur" size="lg" tone={dark ? 'dark' : 'light'} />
      <span className={`relative h-px w-28 overflow-hidden ${dark ? 'bg-white/10' : 'bg-ink-900/10'}`}>
        <span className="absolute inset-y-0 left-0 w-1/3 animate-load-sweep bg-dur-500" />
      </span>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/system" element={<FullSystem />} />
            <Route path="/patients" element={<Patients />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  );
}
