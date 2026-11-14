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

/**
 * How long the server keeps a public answer. On the server, calls carry no login (the cookies belong
 * to the API's own address), so every answer is the public view and can be shared: the public pages
 * render with their data, and the browser then asks again only for what depends on who is signed in.
 */
const SERVER_REVALIDATE_S = 15;
const onServer = typeof window === 'undefined';

/**
 * In the browser, the same GET asked for twice within 2 seconds is one request: the shell and the
 * page often want the same thing as a page opens (unread counts, notifications, your stamps). Any
 * change (POST, PATCH, DELETE) clears this, so what you read after a change is always fresh.
 */
const SHARE_MS = 2000;
const shared = new Map<string, { at: number; answer: Promise<unknown> }>();

export function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (onServer) return request<T>(path, init);
  if (method !== 'GET') { shared.clear(); return request<T>(path, init); }
  const hit = shared.get(path);
  if (hit && Date.now() - hit.at < SHARE_MS) return hit.answer as Promise<T>;
  const answer = request<T>(path, init);
  shared.set(path, { at: Date.now(), answer });
  answer.catch(() => shared.delete(path));
  if (shared.size > 100) for (const [k, v] of shared) if (Date.now() - v.at >= SHARE_MS) shared.delete(k);
  return answer;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      ...(onServer ? { next: { revalidate: SERVER_REVALIDATE_S } } : { credentials: 'include' as const }),
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

/**
 * The sentence to show when a request failed: a connection problem and a server problem each get a
 * plain explanation; anything else is the server's own message (they are written for people).
 */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return OFFLINE_MESSAGE;
    if (e.status >= 500) return 'Something went wrong on our side. Try again in a moment.';
    return e.message;
  }
  return e instanceof Error && e.message ? e.message : 'Something went wrong. Try again.';
}
/** True when the server said the thing does not exist (a bad or old link). */
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;
