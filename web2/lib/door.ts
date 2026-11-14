'use client';
/**
 * The door, offline.
 *
 * Before and during an event the scanner keeps the attendee list on the device (from the API's
 * door endpoint): names, whether each person is in or out, and every pass as a salted hash. When
 * the connection drops, scans are checked against that list, shown at once, and queued. When the
 * connection comes back, the queue is sent in one go; the server applies the scans at the time
 * they were made, and the first scan of a pass wins.
 *
 * Everything lives in localStorage under one key per event, so a reload or a dead battery loses
 * nothing that was scanned.
 */
import { doorRoster, scanValue, syncScans, type DoorRoster, type DoorScanResult } from '@/lib/api/host';

/** `entryId` is the matching saved-list entry ('' when the pass was not on the list). */
export type QueuedScan = { id: string; value: string; mode: 'in' | 'out'; scannedAt: string; name: string; entryId: string };
type Saved = { roster: DoorRoster | null; queue: QueuedScan[] };

const key = (eventId: string) => `otr-door:${eventId}`;
export function readDoor(eventId: string): Saved {
  try { const v = JSON.parse(localStorage.getItem(key(eventId)) ?? 'null') as Saved | null; return { roster: v?.roster ?? null, queue: v?.queue ?? [] }; }
  catch { return { roster: null, queue: [] }; }
}
function writeDoor(eventId: string, saved: Saved) {
  try { localStorage.setItem(key(eventId), JSON.stringify(saved)); } catch { /* storage full or blocked: the queue stays in memory */ }
}

/** Fetch and keep the attendee list. Returns null when offline (the saved copy stays). */
export async function refreshRoster(eventId: string): Promise<DoorRoster | null> {
  try {
    const roster = await doorRoster(eventId);
    const saved = readDoor(eventId);
    // People scanned on this device but not yet synced stay marked as scanned.
    for (const q of saved.queue) {
      const hit = q.entryId ? roster.entries.find((e) => e.id === q.entryId) : undefined;
      if (hit) { if (q.mode === 'in') hit.in = true; else hit.out = true; }
    }
    writeDoor(eventId, { ...saved, roster });
    return roster;
  } catch { return null; }
}

/** The same clean-up the server gives a typed pass code. */
const normalizeCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
async function hash(salt: string, value: string) {
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export type OfflineResult =
  | { kind: 'ok'; name: string }
  | { kind: 'already'; name: string; message: string }
  /** Not on the saved list: queued anyway, and checked by the server once back online. */
  | { kind: 'unknown'; message: string }
  | { kind: 'no-list'; message: string };

/** Check a scan against the saved list, remember it, and queue it for syncing. */
export async function scanOffline(eventId: string, mode: 'in' | 'out', value: string): Promise<OfflineResult> {
  const saved = readDoor(eventId);
  const roster = saved.roster;
  const v = scanValue(value);
  const queue = (name: string, entryId: string) => {
    saved.queue.push({ id: crypto.randomUUID(), value: v, mode, scannedAt: new Date().toISOString(), name, entryId });
    writeDoor(eventId, saved);
  };
  if (!roster) { queue('', ''); return { kind: 'no-list', message: 'No attendee list on this device yet. Check their pass or ID before letting them in.' }; }
  const [t, c] = await Promise.all([hash(roster.salt, v), hash(roster.salt, normalizeCode(v))]);
  const entry = roster.entries.find((e) => e.t === t || (e.c && e.c === c));
  if (!entry) { queue('', ''); return { kind: 'unknown', message: 'Not on the list. Check their pass or ID before letting them in.' }; }
  if (mode === 'in' && entry.in) return { kind: 'already', name: entry.name, message: `${entry.name} is already checked in` };
  if (mode === 'out' && !entry.in) return { kind: 'already', name: entry.name, message: `${entry.name} has not been checked in` };
  if (mode === 'out' && entry.out) return { kind: 'already', name: entry.name, message: `${entry.name} is already checked out` };
  if (mode === 'in') entry.in = true; else entry.out = true;
  queue(entry.name, entry.id);
  return { kind: 'ok', name: entry.name };
}

export const pendingCount = (eventId: string) => readDoor(eventId).queue.length;

/**
 * Send the queue. Scans the server answered (whatever the answer) leave the queue; if the request
 * itself fails, everything stays for the next try. Returns null when still offline.
 */
export async function syncDoor(eventId: string): Promise<{ results: DoorScanResult[] } | null> {
  const saved = readDoor(eventId);
  if (!saved.queue.length) return { results: [] };
  const batch = saved.queue.slice(0, 500);
  try {
    const { results } = await syncScans(eventId, batch.map(({ id, value, mode, scannedAt }) => ({ id, value, mode, scannedAt })));
    const done = new Set(results.map((r) => r.id));
    const latest = readDoor(eventId); // scans made while the request was out stay queued
    writeDoor(eventId, { ...latest, queue: latest.queue.filter((q) => !done.has(q.id)) });
    return { results };
  } catch { return null; }
}

/** After an online scan, keep the saved list in step, so a later offline check knows this person is in (or out). */
export async function markScanned(eventId: string, mode: 'in' | 'out', value: string) {
  const saved = readDoor(eventId);
  if (!saved.roster) return;
  const v = scanValue(value);
  const [t, c] = await Promise.all([hash(saved.roster.salt, v), hash(saved.roster.salt, normalizeCode(v))]);
  const entry = saved.roster.entries.find((e) => e.t === t || (e.c && e.c === c));
  if (!entry) return;
  if (mode === 'in') entry.in = true; else entry.out = true;
  writeDoor(eventId, saved);
}

/* ── Leaving the device: nothing from the door stays behind ── */
const DOOR_PREFIX = 'otr-door:';
const doorKeys = () => { try { return Object.keys(localStorage).filter((k) => k.startsWith(DOOR_PREFIX)); } catch { return []; } };
/** Scans waiting to sync, across every event on this device. */
export const pendingEverywhere = () => doorKeys().reduce((n, k) => n + readDoor(k.slice(DOOR_PREFIX.length)).queue.length, 0);
/** Try to sync every event's queue; returns how many scans are still waiting (e.g. still offline). */
export async function syncEverywhere() {
  for (const k of doorKeys()) {
    const eventId = k.slice(DOOR_PREFIX.length);
    while (readDoor(eventId).queue.length) { const r = await syncDoor(eventId); if (!r) break; }
  }
  return pendingEverywhere();
}
/** Remove every saved attendee list and queue from this device (on log-out). */
/** The saved attendee list for an event, found by its address (for opening the door with no connection). */
export function doorBySlug(slug: string): DoorRoster | null {
  for (const k of doorKeys()) { const r = readDoor(k.slice(DOOR_PREFIX.length)).roster; if (r?.event.slug === slug) return r; }
  return null;
}

export function clearAllDoors() { for (const k of doorKeys()) { try { localStorage.removeItem(k); } catch { /* blocked */ } } }
