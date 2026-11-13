/** Where to go after signing in or onboarding: only ever a path on this site (never //host or /\host). */
export function safeNext(next: string | null | undefined, fallback = '/events') {
  if (!next || next[0] !== '/' || next[1] === '/' || next[1] === '\\') return fallback;
  return next;
}
