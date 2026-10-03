import React from 'react';
import { Link } from 'react-router-dom';
import { ProductLockup } from '../NuvovetLogo';
import { useI18n, LangToggle } from '../../i18n';

// ──────────────────────────────────────────────────────────────────
// Clinic workspace header — shared by /system and /patients.
//
//   nuvoDUR | CLINIC WORKSPACE        Review   Patients     [status] 한|EN
//
// The active section is marked with a 2px rule under the word. The
// lockup returns to the nuvovet home page.
// ──────────────────────────────────────────────────────────────────

export function WorkspaceHeader({ current = 'review', status = null }) {
  const { t } = useI18n();
  const F = t.fullSystem;
  const nav = [
    { id: 'review', to: '/system', label: F.navReview },
    { id: 'patients', to: '/patients', label: F.patientsNav },
  ];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label={F.homeAria} className="-ml-1 flex h-10 shrink-0 items-center rounded-md px-1">
          <ProductLockup product="dur" size="sm" />
        </Link>
        <span aria-hidden="true" className="hidden h-4 w-px bg-ink-200 md:block" />
        <span className="kicker hidden whitespace-nowrap text-[10.5px] text-ink-400 md:block">{t.fullSystemLabel}</span>

        <nav aria-label={t.fullSystemLabel} className="ml-auto flex h-full items-stretch md:ml-8">
          {nav.map((n) => {
            const active = current === n.id;
            return (
              <Link
                key={n.id}
                to={n.to}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center whitespace-nowrap px-2.5 text-[13.5px] font-medium transition-colors sm:px-3 ${
                  active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {n.label}
                {active && <span aria-hidden="true" className="absolute inset-x-2.5 bottom-0 h-[2px] bg-ink-900 sm:inset-x-3" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-4 md:ml-auto">
          {status}
          <LangToggle />
        </div>
      </div>
    </header>
  );
}

/** Formulary connection, as words: FORMULARY  LIVE / BUILT-IN. */
export function FormularyStatus({ connected }) {
  const { t } = useI18n();
  const F = t.fullSystem;
  return (
    <span className="hidden items-baseline gap-2 lg:flex" title={connected ? undefined : F.offlineHint}>
      <span className="kicker text-[10px] text-ink-400">{F.formularyLabel}</span>
      <span className={`kicker text-[10px] ${connected ? 'text-dur-700' : 'text-ink-600'}`}>
        {connected ? F.formularyLive : F.formularyLocal}
      </span>
      {!connected && <span className="sr-only">{F.offlineHint}</span>}
    </span>
  );
}
