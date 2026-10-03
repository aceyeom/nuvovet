import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { NuvovetMark } from './components/NuvovetLogo';

// Route-level code splitting: the marketing page, the live EMR demo and the
// clinic workspace each load only what they need.
const Landing = lazy(() => import('./pages/Landing'));
const Demo = lazy(() => import('./pages/Demo'));
const FullSystem = lazy(() => import('./pages/FullSystem'));
const Patients = lazy(() => import('./pages/Patients'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white" role="status" aria-label="Loading">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-ink-950 text-white">
        <span className="absolute inset-0 animate-ping rounded-[18px] bg-dur-400/25" />
        <NuvovetMark size={26} />
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
