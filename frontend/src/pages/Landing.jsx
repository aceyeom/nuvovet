import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { SiteNav, SiteFooter } from '../components/landing/SiteChrome';
import { HeroShowcase } from '../components/landing/HeroShowcase';
import {
  TrustStats, ProductFamily, IslandStates, Engines, Coverage, ClaimsSection, DemoBand, FinalCta,
} from '../components/landing/Sections';

// ──────────────────────────────────────────────────────────────────
// Landing — nuvovet platform page.
//   Hero        headline + live capture of nuvovet DUR on a clinic EMR
//   Products    nuvovet DUR (teal, live) · nuvovet Claims (violet, soon)
//   DUR         how the island works · what every scan checks · coverage
//   Claims      preview + waitlist
//   Demo / CTA  where to go next (demo, sign-in, access request)
// ──────────────────────────────────────────────────────────────────

function Hero({ onRequestAccess }) {
  const { t, lang } = useI18n();
  const L = t.landing;
  return (
    <section className="relative isolate overflow-hidden">
      {/* Backdrop: clinical grid, soft brand light, grain */}
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f3f6f9] via-white to-white" />
        <div className="absolute inset-x-0 top-0 h-[780px] bg-clinical-grid opacity-70 mask-radial-fade" />
        <div className="absolute left-1/2 top-[-220px] h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(47,192,184,0.20),transparent)]" />
        <div className="absolute right-[-200px] top-[120px] h-[460px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(129,100,245,0.12),transparent)]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-4 pt-12 text-center sm:px-8 sm:pt-16">
        <a
          href="#how"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 text-[12.5px] font-medium text-ink-600 ring-1 ring-ink-200 backdrop-blur transition-colors hover:text-ink-900"
        >
          <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">{L.heroBadgeNew}</span>
          {L.heroBadgeText}
          <ArrowRight size={13} className="text-ink-400" />
        </a>

        <h1
          className={`mx-auto mt-7 max-w-5xl text-balance font-bold text-ink-900 ${
            lang === 'ko'
              ? 'text-[38px] leading-[1.18] tracking-[-0.045em] sm:text-[60px] lg:text-[70px]'
              : 'text-[42px] leading-[1.03] tracking-[-0.045em] sm:text-[62px] lg:text-[76px]'
          }`}
        >
          <span className="block">{L.heroTitleA}</span>
          <span className="block">
            {L.heroTitleB1}{' '}
            {lang === 'ko' ? (
              <span className="bg-gradient-to-r from-dur-500 to-dur-700 bg-clip-text text-transparent">{L.heroTitleB2}</span>
            ) : (
              <span className="font-serif text-[1.06em] font-normal italic tracking-[-0.02em] text-dur-600">{L.heroTitleB2}</span>
            )}
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-[16.5px] leading-relaxed text-ink-500 sm:text-[18px]">{L.heroSub}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/demo"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(11,18,32,0.55)] transition-colors hover:bg-ink-800 sm:w-auto"
          >
            {L.heroCtaDemo} <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={onRequestAccess}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-[15px] font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 sm:w-auto"
          >
            {L.heroCtaAccess}
          </button>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-400">{L.heroNote}</p>
      </div>

      <div className="mx-auto mt-10 max-w-[1168px] px-3 pb-20 sm:mt-12 sm:px-6 sm:pb-24">
        <HeroShowcase />
      </div>
    </section>
  );
}

export default function Landing() {
  const [access, setAccess] = useState({ open: false, product: 'dur' });
  const openAccess = (product = 'dur') => setAccess({ open: true, product });

  return (
    <div className="min-h-screen bg-white text-ink-900">
      <SiteNav onRequestAccess={() => openAccess('dur')} />
      <main>
        <Hero onRequestAccess={() => openAccess('dur')} />
        <TrustStats />
        <ProductFamily onWaitlist={() => openAccess('claims')} />
        <IslandStates />
        <Engines />
        <Coverage />
        <ClaimsSection onWaitlist={() => openAccess('claims')} />
        <DemoBand />
        <FinalCta onRequestAccess={() => openAccess('dur')} />
      </main>
      <SiteFooter onRequestAccess={() => openAccess('dur')} />
      <RequestAccessModal
        isOpen={access.open}
        product={access.product}
        onClose={() => setAccess((a) => ({ ...a, open: false }))}
      />
    </div>
  );
}
