import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NuvovetWordmark, ProductName, ProductLockup, BrandText } from '../NuvovetLogo';
import { useI18n, LangToggle } from '../../i18n';

// ──────────────────────────────────────────────────────────────────
// Site navigation + footer.
//
// The bar sits on the dark hero stage: transparent at the very top, a
// dark glass bar once the page scrolls — so it reads the same over the
// dark and the light sections. Every destination explains itself in the
// mobile menu: the live demo (no login), the clinic workspace (needs an
// access code) and the access request form.
// ──────────────────────────────────────────────────────────────────

const cx = (...parts) => parts.filter(Boolean).join(' ');
const WRAP = 'mx-auto w-full max-w-7xl px-5 sm:px-8';
const LINK = 'inline-flex h-10 items-center rounded-full px-3 text-[13.5px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white';

/** Scroll to an in-page anchor after the menu has released the page. */
function goToHash(hash) {
  const el = document.getElementById(hash.slice(1));
  if (!el) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  try { window.history.replaceState(window.history.state, '', hash); } catch { /* ignore */ }
}

/** Two hairlines that cross into an X — no icon font, no SVG sprite. */
function MenuGlyph({ open }) {
  return (
    <span aria-hidden="true" className="relative block h-3 w-4">
      <span className={cx('absolute left-0 top-1/2 h-px w-4 bg-current transition-transform duration-300 ease-out-expo', open ? 'rotate-45' : '-translate-y-[3px]')} />
      <span className={cx('absolute left-0 top-1/2 h-px w-4 bg-current transition-transform duration-300 ease-out-expo', open ? '-rotate-45' : 'translate-y-[3px]')} />
    </span>
  );
}

function MenuRow({ title, desc, meta, metaClass, href, to, onClick, onNavigate }) {
  const cls = 'group flex min-h-[64px] w-full items-center gap-4 border-b border-white/[0.1] py-4 text-left';
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-semibold tracking-[-0.015em] text-white">{title}</span>
          {meta && <span className={cx('kicker shrink-0 text-[10px]', metaClass)}>{meta}</span>}
        </span>
        <span className="mt-1 block text-pretty text-[13.5px] leading-snug text-white/50">{desc}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-[15px] text-white/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white">→</span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls} onClick={(e) => { e.preventDefault(); onNavigate?.(href); }}>
        {body}
      </a>
    );
  }
  if (to) return <Link to={to} className={cls} onClick={() => onNavigate?.()}>{body}</Link>;
  return <button type="button" className={cls} onClick={onClick}>{body}</button>;
}

export function SiteNav({ onRequestAccess }) {
  const { t } = useI18n();
  const N = t.nav;
  const L = t.landing;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const pendingHash = useRef(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // Open menu: lock the page, trap focus, Escape closes, desktop width closes
  useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const mq = window.matchMedia('(min-width: 1024px)');
    const onMq = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener?.('change', onMq);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = [...(headerRef.current?.querySelectorAll('a[href], button:not([disabled])') || [])]
        .filter((n) => n.getClientRects().length > 0);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => headerRef.current?.querySelector('#site-menu a, #site-menu button')?.focus({ preventScroll: true }));

    return () => {
      cancelAnimationFrame(raf);
      body.style.overflow = prevOverflow;
      mq.removeEventListener?.('change', onMq);
      window.removeEventListener('keydown', onKey);
      // follow an in-page link once the page can scroll again
      if (pendingHash.current) {
        const hash = pendingHash.current;
        pendingHash.current = null;
        requestAnimationFrame(() => goToHash(hash));
      }
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  const navigateTo = useCallback((hash) => {
    if (hash) pendingHash.current = hash;
    setOpen(false);
  }, []);

  return (
    <header
      ref={headerRef}
      className={cx(
        'sticky top-0 z-50 text-white transition-[background-color,border-color] duration-300',
        // no backdrop-filter while the menu is open: it would become the
        // containing block of the fixed menu sheet
        open
          ? 'border-b border-white/[0.08] bg-[#05070D]'
          : scrolled
            ? 'border-b border-white/[0.08] bg-[#05070D]/[0.94] backdrop-blur-xl backdrop-saturate-150'
            : 'border-b border-transparent bg-transparent',
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-ink-900"
      >
        {N.skip}
      </a>

      <div className={cx(WRAP, 'flex h-16 items-center gap-6')}>
        <Link to="/" aria-label={N.home} onClick={close} className="-mx-2 flex h-10 shrink-0 items-center rounded-md px-2">
          <NuvovetWordmark height={17} className="text-white" title="nuvovet" />
        </Link>

        <nav aria-label={N.primary} className="hidden items-center lg:flex">
          <a href="#dur" className={cx(LINK, 'font-semibold text-white/90')}>
            <ProductName product="dur" tone="dark" />
          </a>
          <a href="#claims" className={cx(LINK, 'gap-2 font-semibold text-white/90')}>
            <ProductName product="claims" tone="dark" />
            <span className="kicker text-[9.5px] font-medium text-white/35">{N.soon}</span>
          </a>
          <span aria-hidden="true" className="mx-2.5 h-4 w-px bg-white/15" />
          <a href="#how" className={LINK}>{N.how}</a>
          <Link to="/demo" className={LINK}>{N.demo}</Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LangToggle tone="dark" className="hidden sm:inline-flex" />
          <Link to="/system" title={N.signInDesc} className={cx(LINK, 'hidden md:inline-flex')}>
            {N.signIn}
          </Link>
          <button
            type="button"
            onClick={onRequestAccess}
            className="hidden h-10 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-ink-900 transition-colors hover:bg-white/90 sm:inline-flex"
          >
            {N.requestAccess}
          </button>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? N.close : N.menu}
            className="-mr-2 flex h-10 items-center gap-2.5 rounded-full px-3 text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <span className="kicker text-[11px]">{open ? N.closeShort : N.menu}</span>
            <MenuGlyph open={open} />
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 animate-fade-in overflow-y-auto overscroll-contain bg-[#05070D] lg:hidden">
          <nav aria-label={N.primary} className={cx(WRAP, 'pb-12')}>
            <p className="kicker pb-3 pt-7 text-[10.5px] text-white/35">{N.products}</p>
            <ul className="border-t border-white/[0.1]">
              <li>
                <MenuRow
                  href="#dur"
                  onNavigate={navigateTo}
                  title={<ProductLockup product="dur" size="md" tone="dark" className="!text-[18px]" />}
                  meta={L.durStatus}
                  metaClass="text-dur-300"
                  desc={N.durDesc}
                />
              </li>
              <li>
                <MenuRow
                  href="#claims"
                  onNavigate={navigateTo}
                  title={<ProductLockup product="claims" size="md" tone="dark" className="!text-[18px]" />}
                  meta={L.claimsStatus}
                  metaClass="text-claims-300"
                  desc={N.claimsDesc}
                />
              </li>
              <li>
                <MenuRow href="#how" onNavigate={navigateTo} title={N.how} desc={N.howDesc} />
              </li>
            </ul>

            <p className="kicker pb-3 pt-9 text-[10.5px] text-white/35">{N.start}</p>
            <ul className="border-t border-white/[0.1]">
              <li>
                <MenuRow to="/demo" onNavigate={close} title={N.demo} desc={<BrandText tone="dark">{N.demoDesc}</BrandText>} />
              </li>
              <li>
                <MenuRow to="/system" onNavigate={close} title={N.signIn} desc={N.signInDesc} />
              </li>
              <li>
                <MenuRow onClick={() => { close(); onRequestAccess?.(); }} title={N.requestAccess} desc={N.accessDesc} />
              </li>
            </ul>

            <div className="mt-9 flex items-center justify-between gap-4">
              <span className="kicker text-[10.5px] text-white/35">{N.language}</span>
              <LangToggle tone="dark" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

// ── Footer ───────────────────────────────────────────────────────

const FOOT_LINK = 'inline-flex min-h-[40px] items-center text-[14px] text-white/65 transition-colors hover:text-white';

export function SiteFooter({ onRequestAccess }) {
  const { t } = useI18n();
  const N = t.nav;
  const L = t.landing;
  return (
    <footer className="relative overflow-hidden bg-[#05070D] text-white">
      <div className={WRAP}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 border-t border-white/[0.1] pb-12 pt-14 lg:grid-cols-12 lg:gap-8 lg:pb-16">
          <div className="col-span-2 lg:col-span-5">
            <Link to="/" aria-label={N.home} className="-mx-1 inline-flex h-10 items-center rounded-md px-1">
              <NuvovetWordmark height={20} className="text-white" title="nuvovet" />
            </Link>
            <p className="mt-4 max-w-sm text-pretty text-[13.5px] leading-relaxed text-white/45">{L.footerDisclaimer}</p>
          </div>

          <nav aria-label={L.footerProducts} className="lg:col-span-3">
            <p className="kicker text-[10.5px] text-white/35">{L.footerProducts}</p>
            <ul className="mt-3">
              <li>
                <a href="#dur" className="group flex min-h-[48px] flex-col justify-center py-1.5">
                  <ProductLockup product="dur" size="sm" tone="dark" className="transition-opacity group-hover:opacity-80" />
                  <span className="kicker mt-1.5 text-[10px] text-dur-300">{L.durStatus}</span>
                </a>
              </li>
              <li>
                <a href="#claims" className="group flex min-h-[48px] flex-col justify-center py-1.5">
                  <ProductLockup product="claims" size="sm" tone="dark" className="transition-opacity group-hover:opacity-80" />
                  <span className="kicker mt-1.5 text-[10px] text-claims-300">{L.claimsStatus}</span>
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label={L.footerStart} className="lg:col-span-2">
            <p className="kicker text-[10.5px] text-white/35">{L.footerStart}</p>
            <ul className="mt-3">
              <li><Link to="/demo" className={FOOT_LINK}>{N.demo}</Link></li>
              <li><Link to="/system" className={FOOT_LINK}>{N.signIn}</Link></li>
              <li><button type="button" onClick={onRequestAccess} className={FOOT_LINK}>{N.requestAccess}</button></li>
            </ul>
          </nav>

          <div className="col-span-2 lg:col-span-2">
            <p className="kicker text-[10.5px] text-white/35">{L.footerLanguage}</p>
            <LangToggle tone="dark" className="mt-5" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-white/[0.1] py-6 text-[12.5px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {L.footerRights}</span>
          <span>{t.appTagline}</span>
        </div>
      </div>

      {/* The wordmark, set as large as the page allows */}
      <div aria-hidden="true" className={cx(WRAP, 'pointer-events-none -mb-[1.5%] select-none')}>
        <NuvovetWordmark height={120} className="h-auto w-full text-white/[0.045]" title="" />
      </div>
    </footer>
  );
}
