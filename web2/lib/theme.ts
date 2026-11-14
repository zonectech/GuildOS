'use client';
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'otr-theme';

/** Runs in <head> before paint, so there is no flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => { try { setTheme((localStorage.getItem(KEY) as Theme) || 'system'); } catch { /* storage blocked */ } }, []);
  const apply = (next: Theme) => {
    setTheme(next);
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
    const dark = next === 'dark' || (next === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  };
  return { theme, setTheme: apply };
}
