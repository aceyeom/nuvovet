import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { ProductTag } from './NuvovetLogo';

// Formspree endpoint — replace with your actual form ID
const FORMSPREE_URL = 'https://formspree.io/f/xpznqkew';

/**
 * Access / waitlist request.
 * product: 'dur' (clinic access) | 'claims' (waitlist) — sent with the form
 * so requests can be routed per product line.
 */
export function RequestAccessModal({ isOpen, onClose, product = 'dur' }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', clinic: '', contact: '' });
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const isClaims = product === 'claims';

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
          product: isClaims ? 'nuvovet Claims (waitlist)' : 'nuvovet DUR (access)',
          _subject: `nuvovet ${isClaims ? 'Claims waitlist' : 'DUR access request'} — ${form.clinic || form.name}`,
        }),
      });

      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  function handleClose() {
    setForm({ name: '', clinic: '', contact: '' });
    setStatus('idle');
    onClose();
  }

  const fieldClass = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[16px] text-ink-900 placeholder:text-ink-300 transition-all focus:border-ink-300 focus:ring-4 focus:ring-ink-900/5 sm:text-sm';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t.requestAccess.title}>
      <button type="button" aria-label={t.close} className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md animate-sheet-up rounded-t-3xl bg-white p-6 shadow-window sm:rounded-3xl sm:p-7">
        <button type="button" onClick={handleClose} aria-label={t.close} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700">
          <X size={18} />
        </button>

        {status === 'success' ? (
          <div className="py-8 text-center">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isClaims ? 'bg-claims-50 text-claims-600' : 'bg-dur-50 text-dur-600'}`}>
              <CheckCircle size={24} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-ink-900">{t.requestAccess.successTitle}</h3>
            <p className="text-sm text-ink-500">{t.requestAccess.successDesc}</p>
            <button type="button" onClick={handleClose} className="mt-6 px-5 py-2 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">
              {t.close}
            </button>
          </div>
        ) : (
          <>
            <ProductTag product={product} status={isClaims ? t.nav.soon : undefined} />
            <h3 className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-ink-900">
              {isClaims ? t.landing.claimsCta : t.requestAccess.title}
            </h3>
            <p className="mb-6 mt-1 text-sm leading-relaxed text-ink-500">{isClaims ? t.landing.claimsTagline : t.requestAccess.desc}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="ra-name" className="mb-1.5 block text-xs font-semibold text-ink-600">{t.requestAccess.name}</label>
                <input id="ra-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.requestAccess.namePlaceholder} className={fieldClass} />
              </div>
              <div>
                <label htmlFor="ra-clinic" className="mb-1.5 block text-xs font-semibold text-ink-600">{t.requestAccess.clinic}</label>
                <input id="ra-clinic" type="text" required value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} placeholder={t.requestAccess.clinicPlaceholder} className={fieldClass} />
              </div>
              <div>
                <label htmlFor="ra-contact" className="mb-1.5 block text-xs font-semibold text-ink-600">{t.requestAccess.contact}</label>
                <input id="ra-contact" type="text" required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder={t.requestAccess.contactPlaceholder} className={fieldClass} />
              </div>

              {status === 'error' && (
                <p className="text-xs text-red-600">{t.requestAccess.submitError}</p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isClaims ? 'bg-claims-600 hover:bg-claims-700' : 'bg-ink-900 hover:bg-ink-800'}`}
              >
                {status === 'submitting' ? (
                  <><Loader2 size={15} className="animate-spin" /> {t.requestAccess.submitting}</>
                ) : (
                  t.requestAccess.submit
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
