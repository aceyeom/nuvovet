import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { BrandText } from '../NuvovetLogo';
import { HeroShowcase } from './HeroShowcase';
import { HeroBackdrop } from './HeroBackdrop';
import { DecryptText, usePrefersReducedMotion } from './motion';

// ──────────────────────────────────────────────────────────────────
// Landing hero — a dark sci-fi stage. The headline decrypts into
// place, the clinic EMR powers on below it and nuvoDUR docks on top.
// Every animation pauses while the hero is off-screen.
// ──────────────────────────────────────────────────────────────────

function splitMark(text, mark) {
  const i = mark ? text.indexOf(mark) : -1;
  if (i < 0) return [text, '', ''];
  return [text.slice(0, i), mark, text.slice(i + mark.length)];
}

export function Hero({ onRequestAccess }) {
  const { t, lang } = useI18n();
  const L = t.landing;
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef(null);
  const [active, setActive] = useState(true);

  // Pause all hero motion while off-screen or in a background tab
  useEffect(() => {
    const el = sectionRef.current;
    let visible = true;
    const sync = () => setActive(visible && !document.hidden);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0 });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  // Scroll progress through the hero (0 → 1) drives backdrop parallax
  useEffect(() => {
    if (reduced) return undefined;
    const el = sectionRef.current;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, el.offsetHeight)));
      el.style.setProperty('--hs', p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [reduced]);

  const [before, mark, after] = splitMark(L.heroTitleB, L.heroTitleMark);
  const ko = lang === 'ko';

  return (
    <section
      ref={sectionRef}
      id="hero"
      // -mt-16 pt-16: the stage runs up behind the transparent sticky nav
      className={`relative isolate -mt-16 overflow-hidden bg-[#03050A] pt-16 text-white ${active ? '' : 'hero-paused'}`}
    >
      <HeroBackdrop active={active} reduced={reduced} />

      <div className="relative mx-auto max-w-6xl px-5 pt-12 text-center sm:px-8 sm:pt-14 lg:pt-16">
        <p className="hero-in flex items-center justify-center gap-3 sm:gap-4" style={{ '--d': '0ms' }}>
          <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-transparent to-white/30 sm:w-16" />
          <span className="shrink-0 text-[13.5px] font-bold tracking-[-0.02em] text-white">
            nuvo<span className="text-island-info">DUR</span>
          </span>
          <span className="h-3 w-px shrink-0 bg-white/20" aria-hidden="true" />
          <span className="kicker min-w-0 truncate text-[10.5px] text-white/55">{L.heroKicker}</span>
          <span aria-hidden="true" className="h-px w-8 bg-gradient-to-l from-transparent to-white/30 sm:w-16" />
        </p>

        <h1
          aria-label={`${L.heroTitleA} ${L.heroTitleB}`}
          className={`mx-auto mt-6 max-w-5xl text-balance font-bold text-white ${
            ko
              ? 'text-[40px] leading-[1.16] tracking-[-0.04em] sm:text-[60px] lg:text-[72px]'
              : 'text-[44px] leading-[1.02] tracking-[-0.045em] sm:text-[64px] lg:text-[80px]'
          }`}
        >
          <span aria-hidden="true" className="block">
            <DecryptText text={L.heroTitleA} delay={200} />
          </span>
          <span aria-hidden="true" className="block">
            {before && <DecryptText text={before} delay={520} />}
            {mark && (
              <span className="hero-mark">
                <DecryptText text={mark} delay={ko ? 820 : 520} />
              </span>
            )}
            {after && <DecryptText text={after} delay={ko ? 900 : 760} />}
          </span>
        </h1>

        <p className="hero-in mx-auto mt-6 max-w-[44rem] text-pretty text-[16.5px] leading-relaxed text-white/60 sm:text-[18px]" style={{ '--d': '700ms' }}>
          <BrandText tone="dark">{L.heroSub}</BrandText>
        </p>

        <div className="hero-in mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ '--d': '900ms' }}>
          <Link
            to="/demo"
            className="cta-glow group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-7 text-[15px] font-semibold text-white sm:w-auto"
          >
            <span className="cta-halo" aria-hidden="true" />
            <span className="cta-fill" aria-hidden="true" />
            {L.heroCtaDemo}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <button
            type="button"
            onClick={onRequestAccess}
            className="inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-semibold text-white/75 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.06] hover:text-white sm:w-auto"
          >
            {L.heroCtaAccess}
          </button>
        </div>

        <ul className="hero-in mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-3" style={{ '--d': '1100ms' }}>
          {L.heroMeta.map((m, i) => (
            <li key={m} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden="true" className="hidden text-white/20 sm:inline">/</span>}
              <span className="kicker text-[10.5px] text-white/40">{m}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mx-auto mt-10 max-w-[1700px] px-3 pb-20 sm:mt-12 sm:px-6 sm:pb-28">
        <HeroShowcase active={active} />
      </div>

      {/* hand-off to the next section */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#03050A]" />
    </section>
  );
}
