// The same backend the current site uses. Login rides on its httpOnly cookies, shared across both sites.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
/** Pages not rebuilt yet open on the current site. Production must configure its URL. */
export const CLASSIC_URL = (process.env.NEXT_PUBLIC_CLASSIC_URL?.trim() ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : '')).replace(/\/+$/, '');
export const classic = (path: string) => CLASSIC_URL
  ? new URL(path.startsWith('/') ? path : `/${path}`, CLASSIC_URL).toString()
  : `/classic-unavailable?path=${encodeURIComponent(path)}`;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Shown when a request never reached the server (offline, server down). `status` is 0 for these. */
export const OFFLINE_MESSAGE = 'We couldn’t reach OnTheRoll. Check your connection and try again.';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init?.headers ?? {}) },
    });
  } catch { throw new ApiError(OFFLINE_MESSAGE, 0); }
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(payload.error || 'Something went wrong. Try again.', response.status);
  return payload;
}

export const enc = encodeURIComponent;

/** Backend upload paths become absolute URLs; full URLs pass through. */
export function mediaUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/uploads/${path}`;
}
