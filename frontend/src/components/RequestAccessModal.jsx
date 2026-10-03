import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { ProductLockup, BrandText } from './NuvovetLogo';

// Formspree endpoint — replace with your actual form ID
const FORMSPREE_URL = 'https://formspree.io/f/xpznqkew';

/**
 * Access / waitlist request.
 * product: 'dur' (clinic access) | 'claims' (waitlist) — sent with the form
 * so requests can be routed per product line.
 */
export function RequestAccessModal({ isOpen, onClose, product = 'dur' }) {
  const { t } = useI18n();
  const RA = t.requestAccess;
  const [form, setForm] = useState({ name: '', clinic: '', contact: '' });
  const [status, setStatus] = useState('idle');
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const returnFocusRef = useRef(null);
  const successRef = useRef(null);

  const isClaims = product === 'claims';

  function handleClose() {
    setForm({ name: '', clinic: '', contact: '' });
    setStatus('idle');
    onClose();
  }

  // Escape to close, focus trap, scroll lock, focus restore
  useEffect(() => {
    if (!isOpen) return undefined;
    returnFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => firstFieldRef.current?.focus());

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // The submit button unmounts on success — move focus to the confirmation
  useEffect(() => {
    if (status === 'success') successRef.current?.focus();
  }, [status]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: form.name,
          clinic_name: form.clinic,
          contact: form.contact,
          product: isClaims ? 'nuvoClaim (waitlist)' : 'nuvoDUR (access)',
          _subject: `${isClaims ? 'nuvoClaim waitlist' : 'nuvoDUR access request'} — ${form.clinic || form.name}`,
        }),
      });

      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const accent = isClaims ? 'text-claims-700' : 'text-dur-700';
  const focusRing = isClaims ? 'focus:border-claims-600 focus:ring-claims-500/15' : 'focus:border-dur-600 focus:ring-dur-500/15';
  const fieldClass = `h-12 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[16px] text-ink-900 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:outline-none focus:ring-[3px] sm:text-[14px] ${focusRing}`;
  const title = isClaims ? RA.waitlistTitle : RA.title;
  const desc = isClaims ? RA.waitlistDesc : RA.desc;

  const fields = [
    { id: 'ra-name', key: 'name', label: RA.name, placeholder: RA.namePlaceholder, autoComplete: 'name' },
    { id: 'ra-clinic', key: 'clinic', label: RA.clinic, placeholder: RA.clinicPlaceholder, autoComplete: 'organization' },
    { id: 'ra-contact', key: 'contact', label: RA.contact, placeholder: RA.contactPlaceholder, autoComplete: 'email' },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" tabIndex={-1} aria-label={t.close} className="absolute inset-0 cursor-default bg-ink-950/45 backdrop-blur-[2px]" onClick={handleClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ra-title"
        aria-describedby="ra-desc"
        className="relative max-h-[92dvh] w-full max-w-[440px] animate-sheet-up overflow-y-auto rounded-t-2xl bg-white shadow-window sm:rounded-2xl"
      >
        {/* Masthead */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 pb-5 pt-6 sm:px-7">
          <div>
            <ProductLockup product={isClaims ? 'claims' : 'dur'} size="md" />
            <p className={`kicker mt-2 text-[10.5px] ${accent}`}>{isClaims ? RA.kickerWaitlist : RA.kickerAccess}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="-mr-2 -mt-1.5 h-10 rounded-md px-2.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            {t.close}
          </button>
        </div>

        {status === 'success' ? (
          <div className="px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-6 sm:px-7 sm:pb-7" role="status" aria-live="polite">
            <div className="relative pl-4">
              <span aria-hidden="true" className={`absolute inset-y-0.5 left-0 w-[3px] ${isClaims ? 'bg-claims-500' : 'bg-dur-500'}`} />
              <p className={`kicker text-[10.5px] ${accent}`}>{RA.successKicker}</p>
              <h3 id="ra-title" className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-ink-900">{isClaims ? RA.waitlistSuccessTitle : RA.successTitle}</h3>
              <p id="ra-desc" className="mt-1.5 text-[14px] leading-relaxed text-ink-500"><BrandText>{isClaims ? RA.waitlistSuccessDesc : RA.successDesc}</BrandText></p>
            </div>
            <button
              ref={successRef}
              type="button"
              onClick={handleClose}
              className="mt-7 h-12 w-full rounded-lg bg-ink-900 text-[14.5px] font-semibold text-white transition-colors hover:bg-ink-800"
            >
              {t.close}
            </button>
          </div>
        ) : (
          <div className="px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-7">
            <h3 id="ra-title" className="text-balance text-[21px] font-bold leading-snug tracking-[-0.02em] text-ink-900"><BrandText>{title}</BrandText></h3>
            <p id="ra-desc" className="mt-1.5 text-[14px] leading-relaxed text-ink-500"><BrandText>{desc}</BrandText></p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate={false}>
              {fields.map((f, i) => (
                <div key={f.id}>
                  <label htmlFor={f.id} className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">{f.label}</label>
                  <input
                    ref={i === 0 ? firstFieldRef : undefined}
                    id={f.id}
                    type="text"
                    required
                    autoComplete={f.autoComplete}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={fieldClass}
                  />
                </div>
              ))}

              {status === 'error' && (
                <p role="alert" className="relative pl-3.5 text-[13px] leading-relaxed text-red-700">
                  <span aria-hidden="true" className="absolute inset-y-0.5 left-0 w-[3px] bg-red-500" />
                  {RA.submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                aria-busy={status === 'submitting'}
                className={`relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-lg text-[14.5px] font-semibold text-white transition-colors disabled:cursor-progress ${
                  isClaims ? 'bg-claims-600 hover:bg-claims-700' : 'bg-ink-900 hover:bg-ink-800'
                }`}
              >
                {status === 'submitting' ? RA.submitting : <>{isClaims ? RA.submitWaitlist : RA.submit} <span aria-hidden="true" className="ml-1.5">→</span></>}
                {status === 'submitting' && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
                    <span className="absolute inset-y-0 left-0 w-1/3 animate-load-sweep bg-white/70" />
                  </span>
                )}
              </button>
              <p className="text-center text-[12px] text-ink-400"><BrandText>{isClaims ? RA.privacyWaitlist : RA.privacy}</BrandText></p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
