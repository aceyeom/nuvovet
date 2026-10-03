import { useLayoutEffect } from 'react';

/**
 * Paints the page canvas behind the app for as long as a route is mounted:
 * the html/body background (what shows on iOS over-scroll and behind the
 * mobile toolbars, via --page-canvas in index.css) and the browser's
 * theme-color. Restores the previous values on unmount so routes can
 * disagree. index.html sets the first value before the app loads.
 */
export function usePageCanvas(color) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevCanvas = root.style.getPropertyValue('--page-canvas');
    const prevMeta = meta?.getAttribute('content');
    root.style.setProperty('--page-canvas', color);
    meta?.setAttribute('content', color);
    return () => {
      if (prevCanvas) root.style.setProperty('--page-canvas', prevCanvas);
      else root.style.removeProperty('--page-canvas');
      if (meta && prevMeta != null) meta.setAttribute('content', prevMeta);
    };
  }, [color]);
}

/** Canvas colours per route family. */
export const CANVAS = { dark: '#05070D', light: '#ffffff' };
