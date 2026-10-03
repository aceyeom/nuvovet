import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Menu, X, PlayCircle, Send } from 'lucide-react';
import { NuvovetBrand, ProductGlyph, ProductLockup } from '../NuvovetLogo';
import { useI18n, LangToggle } from '../../i18n';

// ──────────────────────────────────────────────────────────────────
// Site navigation + footer.
// Every destination carries a one-line explanation so visitors always
// know what they are about to open: the live demo (no login), the clinic
// workspace (needs an access code) or the access request form.
// ──────────────────────────────────────────────────────────────────

function ProductLink({ product, href, label, badge }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900"
    >
      <ProductGlyph product={product} size={18} />
      <span>
        nuvovet <span className={product === 'dur' ? 'font-semibold text-dur-600' : 'font-semibold text-claims-600'}>{label}</span>
      </span>
      {badge && (
        <span className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide ${product === 'dur' ? 'bg-dur-50 text-dur-700' : 'bg-claims-50 text-claims-700'}`}>
          {badge}
        </span>
      )}
    </a>
  );
}

export function SiteNav({ onRequestAccess }) {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled || open ? 'border-b border-ink-200/70 bg-white/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link to="/" aria-label="nuvovet home" className="shrink-0" onClick={close}>
          <NuvovetBrand size={26} />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          <ProductLink product="dur" href="#dur" label="DUR" badge={t.nav.live} />
          <ProductLink product="claims" href="#claims" label="Claims" badge={t.nav.soon} />
          <span className="mx-2 h-5 w-px bg-ink-200" />
          <a href="#how" className="rounded-full px-3 py-2 text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900">
            {t.nav.how}
          </a>
          <Link to="/demo" className="rounded-full px-3 py-2 text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900">
            {t.nav.demo}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle className="hidden sm:inline-flex" />
          <Link
            to="/system"
            title={t.nav.signInDesc}
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900 md:inline-flex"
          >
            <Lock size={13} /> {t.nav.signIn}
          </Link>
          <Link
            to="/demo"
            className="hidden h-10 items-center gap-1.5 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-ink-800 sm:inline-flex"
          >
            {t.nav.tryDemo} <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.nav.close : t.nav.menu}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet menu — every item explains where it goes */}
      {open && (
        <div id="mobile-menu" className="animate-sheet-up border-t border-ink-200/70 bg-white lg:hidden">
          <div className="mx-auto max-w-7xl space-y-5 px-5 py-5 sm:px-8">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">{t.nav.products}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { product: 'dur', href: '#dur', desc: t.nav.durDesc, badge: t.nav.live },
                  { product: 'claims', href: '#claims', desc: t.nav.claimsDesc, badge: t.nav.soon },
                ].map((p) => (
                  <a key={p.product} href={p.href} onClick={close} className="flex items-start gap-3 rounded-2xl p-3 ring-1 ring-ink-200/80 transition-colors hover:bg-ink-50">
                    <ProductGlyph product={p.product} size={30} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <ProductLockup product={p.product} size="sm" showMark={false} />
                        <span className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold uppercase ${p.product === 'dur' ? 'bg-dur-50 text-dur-700' : 'bg-claims-50 text-claims-700'}`}>{p.badge}</span>
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-snug text-ink-500">{p.desc}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link to="/demo" onClick={close} className="flex items-start gap-3 rounded-2xl bg-ink-900 p-3 text-white">
                <PlayCircle size={20} className="mt-0.5 shrink-0 text-dur-300" />
                <span>
                  <span className="block text-[14px] font-semibold">{t.nav.demo}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-white/60">{t.nav.demoDesc}</span>
                </span>
              </Link>
              <Link to="/system" onClick={close} className="flex items-start gap-3 rounded-2xl p-3 ring-1 ring-ink-200/80 hover:bg-ink-50">
                <Lock size={18} className="mt-0.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block text-[14px] font-semibold text-ink-900">{t.nav.signIn}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">{t.nav.signInDesc}</span>
                </span>
              </Link>
              <button type="button" onClick={() => { close(); onRequestAccess?.(); }} className="flex items-start gap-3 rounded-2xl p-3 text-left ring-1 ring-ink-200/80 hover:bg-ink-50">
                <Send size={18} className="mt-0.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block text-[14px] font-semibold text-ink-900">{t.nav.requestAccess}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">{t.nav.accessDesc}</span>
                </span>
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-4">
              <a href="#how" onClick={close} className="text-[13.5px] font-medium text-ink-600">{t.nav.how}</a>
              <LangToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ onRequestAccess }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-ink-200/70 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <NuvovetBrand size={28} />
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ink-500">{t.landing.footerDisclaimer}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">{t.landing.footerProducts}</p>
          <ul className="mt-3 space-y-2.5">
            <li><a href="#dur" className="inline-flex items-center gap-2 text-[13.5px] hover:opacity-80"><ProductGlyph product="dur" size={18} /><ProductLockup product="dur" size="sm" showMark={false} /></a></li>
            <li><a href="#claims" className="inline-flex items-center gap-2 text-[13.5px] hover:opacity-80"><ProductGlyph product="claims" size={18} /><ProductLockup product="claims" size="sm" showMark={false} /><span className="rounded-full bg-claims-50 px-1.5 py-[1px] text-[10px] font-bold uppercase text-claims-700">{t.nav.soon}</span></a></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">{t.landing.footerStart}</p>
          <ul className="mt-3 space-y-2.5 text-[13.5px] text-ink-600">
            <li><Link to="/demo" className="hover:text-ink-900">{t.nav.demo}</Link></li>
            <li><Link to="/system" className="hover:text-ink-900">{t.nav.signIn}</Link></li>
            <li><button type="button" onClick={onRequestAccess} className="hover:text-ink-900">{t.nav.requestAccess}</button></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-[12px] text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {t.landing.footerRights}</span>
          <span>{t.appTagline}</span>
        </div>
      </div>
    </footer>
  );
}
