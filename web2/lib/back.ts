'use client';

// Opening an event from a list leaves a note (which list, and how far down it was), so the event
// page's back arrow can step back to that list at the same spot instead of loading Events afresh.
const KEY = 'otr-from-list';
const RESTORE = 'otr-restore-scroll';

export function rememberList() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ path: window.location.pathname + window.location.search, y: window.scrollY })); } catch { /* storage blocked */ }
}

export function cameFromList() {
  try { return Boolean(sessionStorage.getItem(KEY)); } catch { return false; }
}

/** Called by the back arrow just before stepping back: the list will scroll to where it was. */
export function returnToList() {
  try { const v = sessionStorage.getItem(KEY); if (v) sessionStorage.setItem(RESTORE, v); sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

/** Jump to a spot, through the smooth scroller when it is running so it does not pull the page back. */
export function jumpTo(y: number) {
  const lenis = (window as unknown as { __lenis?: { resize: () => void; scrollTo: (y: number, o: { immediate: boolean; force: boolean }) => void } }).__lenis;
  // Re-measure first: it may still think the page is as short as the event page we came from.
  if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: true, force: true }); }
  else window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
}

/** The list asks this once its cards are on screen. */
export function takeRestore(path: string): number | null {
  try {
    const v = sessionStorage.getItem(RESTORE);
    sessionStorage.removeItem(RESTORE);
    if (!v) return null;
    const r = JSON.parse(v) as { path: string; y: number };
    return r.path === path ? r.y : null;
  } catch { return null; }
}
