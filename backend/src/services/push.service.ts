import webpush from 'web-push';
import { config } from '../config';
import { PushSubscriptionModel } from '../models/push-subscription.model';

let vapidReady = false;

/** True when VAPID keys are configured; without them push silently no-ops. */
export function isPushConfigured() {
  return Boolean(config.vapidPublicKey && config.vapidPrivateKey);
}

function ensureVapid() {
  if (vapidReady || !isPushConfigured()) return;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  vapidReady = true;
}

export function getVapidPublicKey() {
  return config.vapidPublicKey;
}

export type BrowserPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Upserts a browser subscription for this user (endpoint is globally unique). */
export async function savePushSubscription(userId: string, sub: BrowserPushSubscription, userAgent = '') {
  const endpoint = (sub?.endpoint ?? '').trim();
  const p256dh = (sub?.keys?.p256dh ?? '').trim();
  const auth = (sub?.keys?.auth ?? '').trim();
  if (!endpoint || !p256dh || !auth) throw new Error('Invalid push subscription');
  if (endpoint.length > 1000 || p256dh.length > 300 || auth.length > 100) throw new Error('Invalid push subscription');
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint },
    { $set: { userId, keys: { p256dh, auth }, userAgent: userAgent.slice(0, 300) } },
    { upsert: true },
  );
}

/** Removes one subscription (by endpoint) — only the owner may remove it. */
export async function removePushSubscription(userId: string, endpoint: string) {
  if (!endpoint) return;
  await PushSubscriptionModel.deleteOne({ userId, endpoint });
}

export type PushPayload = {
  title: string;
  body?: string;
  link?: string;
  tag?: string;
};

/**
 * Sends a push notification to every device the user has subscribed.
 * Best-effort: never throws; dead subscriptions (404/410) are pruned.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    if (!isPushConfigured() || !userId) return;
    ensureVapid();
    const subs = await PushSubscriptionModel.find({ userId }).lean();
    if (!subs.length) return;
    const body = JSON.stringify({
      title: (payload.title ?? '').slice(0, 140),
      body: (payload.body ?? '').slice(0, 240),
      link: payload.link ?? '',
      tag: payload.tag ?? '',
    });
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
            body,
            { TTL: 60 * 60 * 24 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await PushSubscriptionModel.deleteOne({ _id: sub._id }).catch(() => undefined);
          }
        }
      }),
    );
  } catch (error) {
    console.warn('[GuildOS] push send failed', error instanceof Error ? error.message : error);
  }
}

/** Fan-out helper for broadcasts. Sequential batches keep memory flat. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!isPushConfigured() || !userIds.length) return;
  const BATCH = 25;
  for (let i = 0; i < userIds.length; i += BATCH) {
    await Promise.allSettled(userIds.slice(i, i + BATCH).map((id) => sendPushToUser(id, payload)));
  }
}
