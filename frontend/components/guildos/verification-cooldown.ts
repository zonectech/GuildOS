/** Use a relative server duration, never a server timestamp minus the user's clock. */
export function schoolCodeCooldownMs(seconds: unknown): number {
  const value = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 60;
  return Math.min(60, Math.max(0, Math.ceil(value))) * 1000;
}
export function schoolCodeSecondsLeft(deadline: number, monotonicNow: number): number {
  return Math.min(60, Math.max(0, Math.ceil((deadline - monotonicNow) / 1000)));
}
