'use client';

/**
 * Silent feed impression tracking. Each PostCard registers its root element;
 * a singleton IntersectionObserver marks a post "seen" once it's ≥50% visible,
 * dedupes per browser session, and ships ids to the backend in small batches.
 * Counts are collected now but not displayed anywhere public yet — they feed
 * sponsor "announcement reach" and, later, ranking.
 */

import { API_BASE } from '../feed-api';

const SESSION_KEY = 'guildos-seen-posts';
const FLUSH_MS = 5000;
const BATCH_MAX = 25;

let observer: IntersectionObserver | null = null;
const pending = new Set<string>();
const elements = new WeakMap<Element, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function seenThisSession(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  try {
    const seen = seenThisSession();
    ids.forEach((id) => seen.add(id));
    // Cap the session ledger so it never grows unbounded on long scrolls.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    /* private mode etc. — dedupe degrades to per-page */
  }
}

function flush() {
  flushTimer = null;
  if (!pending.size) return;
  const postIds = [...pending].slice(0, BATCH_MAX);
  postIds.forEach((id) => pending.delete(id));
  markSeen(postIds);
  void fetch(`${API_BASE}/api/feed/impressions`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postIds }),
  }).catch(() => undefined);
  if (pending.size) flushTimer = setTimeout(flush, FLUSH_MS);
}

function queue(id: string) {
  if (seenThisSession().has(id) || pending.has(id)) return;
  pending.add(id);
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

/** Observe a post's root element; safe to call repeatedly. Returns an unobserve cleanup. */
export function observePostImpression(element: Element | null, postId: string) {
  if (!element || typeof IntersectionObserver === 'undefined') return () => undefined;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Count when 30%+ of the post is visible, or ≥240px of a tall post
          // (image posts can exceed the viewport and never reach a % threshold).
          const enough = entry.intersectionRatio >= 0.3 || entry.intersectionRect.height >= 240;
          if (!entry.isIntersecting || !enough) continue;
          const id = elements.get(entry.target);
          if (id) {
            queue(id);
            observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: [0, 0.15, 0.3, 0.6] },
    );
  }
  elements.set(element, postId);
  observer.observe(element);
  return () => observer?.unobserve(element);
}
