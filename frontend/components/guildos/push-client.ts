const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

/** Push notifications need a service worker, the Push API and the Notification API. */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? (await navigator.serviceWorker.register('/sw.js'));
}

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

/** Current push state for THIS device/browser. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Asks permission (if needed), subscribes this browser, and registers it with the backend. */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  const { enabled, publicKey } = await requestJson<{ enabled: boolean; publicKey: string }>(
    '/api/notifications/push/public-key',
  );
  if (!enabled || !publicKey) throw new Error('Push notifications are not configured on the server');
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';
  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  await requestJson('/api/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return 'on';
}

/** Unsubscribes this browser and removes it from the backend. */
export async function disablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await requestJson('/api/notifications/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return 'off';
}

/**
 * Silent re-sync: if the user already granted permission and a subscription
 * exists, make sure the backend still has it (e.g. after a DB restore or
 * logging in on a device that subscribed under another account).
 */
export async function syncPushSubscription() {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    await requestJson('/api/notifications/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch {
    /* best-effort */
  }
}
