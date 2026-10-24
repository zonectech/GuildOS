'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  // Start false on both server and client so hydration matches; the effect corrects it right after mount.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener('change', updateMatches);

    return () => mediaQuery.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}