import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { SiteNav, SiteFooter } from '../components/landing/SiteChrome';
import { Hero } from '../components/landing/Hero';
import {
  TrustStats, ProductFamily, IslandStates, Engines, Coverage, ClaimsSection, DemoBand, FinalCta,
} from '../components/landing/Sections';

// ──────────────────────────────────────────────────────────────────
// Landing — nuvovet platform page.
//   Hero        headline + live capture of nuvoDUR on a clinic EMR
//   Products    nuvoDUR (teal, live) · nuvoClaim (violet, soon)
//   DUR         how the island works · what every scan checks · coverage
//   Claims      preview + waitlist
//   Demo / CTA  where to go next (demo, sign-in, access request)
// ──────────────────────────────────────────────────────────────────

export default function Landing() {
  const [access, setAccess] = useState({ open: false, product: 'dur' });
  const openAccess = (product = 'dur') => setAccess({ open: true, product });

  return (
    <div className="min-h-screen bg-[#05070D] text-ink-900">
      <SiteNav onRequestAccess={() => openAccess('dur')} />
      <main id="main">
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
