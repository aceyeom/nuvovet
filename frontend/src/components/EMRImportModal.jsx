import React, { useState, useRef, useCallback, useEffect } from 'react';
import { extractPatientFromImageApi, searchDrugsApi } from '../lib/api';
import { useI18n } from '../i18n';

/**
 * EMR Screenshot Import
 *
 * Functional OCR import via POST /api/ocr/extract-patient (Claude vision).
 * Accepts PNG, JPG, WEBP via drag-drop or the file picker. After
 * extraction it calls onImport(data, drugObjects). The image is not
 * stored — it is processed and discarded immediately.
 */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function EMRImportModal({ onClose, onImport, species }) {
  const { t } = useI18n();
  const F = t.fullSystem;
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);
  const chooseRef = useRef(null);

  // Release the object URL when it changes or the modal closes
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Escape closes (unless a file is being read); focus the picker; trap Tab.
  // Runs once — live values come through refs so focus never jumps.
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    chooseRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !loadingRef.current) { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll('button:not([disabled])');
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  const processFile = useCallback(async (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(F.importErrType);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(F.importErrSize);
      return;
    }

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    dialogRef.current?.focus(); // the picker button unmounts while reading

    try {
      const data = await extractPatientFromImageApi(file);
      if (!data) {
        setError(F.importErrExtract);
        return;
      }

      // Resolve current_drugs to drug objects via backend search
      let drugObjects = [];
      if (data.current_drugs?.length) {
        const drugResults = await Promise.all(
          data.current_drugs.map(async (drugName) => {
            const results = await searchDrugsApi(drugName, species || null, 1);
            return results?.[0] ?? null;
          }),
        );
        drugObjects = drugResults.filter(Boolean);
      }

      onImport(data, drugObjects);
      onClose();
    } catch {
      setError(F.importErrExtract);
    } finally {
      setLoading(false);
    }
  }, [onImport, onClose, species, F]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile, loading]);

  const browse = () => { if (!loading) fileInputRef.current?.click(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label={F.importClose}
        disabled={loading}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/45 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emr-import-title"
        aria-describedby="emr-import-desc"
        tabIndex={-1}
        className="relative max-h-[92dvh] outline-none w-full max-w-[480px] animate-sheet-up overflow-y-auto rounded-t-2xl bg-white shadow-window sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 pb-4 pt-6">
          <div>
            <p className="kicker text-[10.5px] text-dur-700">{F.importKicker}</p>
            <h3 id="emr-import-title" className="mt-1.5 text-[19px] font-bold tracking-[-0.02em] text-ink-900">{F.importModalTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="-mr-2 -mt-1 h-10 rounded-md px-2.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:opacity-40"
          >
            {F.importClose}
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">
          <p id="emr-import-desc" className="text-[13.5px] leading-relaxed text-ink-500">{F.importHint}</p>

          {/* Drop zone — the whole area opens the picker; the button is the keyboard path */}
          <div
            onClick={browse}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`relative mt-4 flex min-h-[188px] flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed px-5 py-6 text-center transition-colors ${
              loading
                ? 'cursor-progress border-ink-200 bg-ink-50/60'
                : dragOver
                ? 'cursor-copy border-dur-500 bg-dur-50/60'
                : 'cursor-pointer border-ink-300 bg-white hover:border-ink-400 hover:bg-ink-50/50'
            }`}
          >
            {previewUrl && (
              <img src={previewUrl} alt="" className={`max-h-24 max-w-full rounded border border-ink-200 object-contain ${loading ? 'opacity-60' : ''}`} />
            )}

            {loading ? (
              <>
                <p className="kicker text-[10.5px] text-ink-700" role="status">{F.importReading}</p>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-ink-100">
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-load-sweep bg-dur-500" />
                </span>
              </>
            ) : (
              <>
                {!previewUrl && (
                  <p className="text-[14.5px] font-semibold text-ink-900">{dragOver ? F.importRelease : F.importDragDrop}</p>
                )}
                <button
                  ref={chooseRef}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); browse(); }}
                  className="h-10 rounded-md bg-ink-900 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-ink-800"
                >
                  {previewUrl ? F.importChange : F.importChoose}
                </button>
                <p className="font-mono text-[10.5px] text-ink-400">PNG · JPG · WEBP — 20 MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {error && (
            <p role="alert" className="relative mt-4 pl-3.5 text-[13px] leading-relaxed text-red-700">
              <span aria-hidden="true" className="absolute inset-y-0.5 left-0 w-[3px] bg-red-500" />
              {error}
            </p>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-ink-400">{F.importModalDesc}</p>
        </div>
      </div>
    </div>
  );
}
