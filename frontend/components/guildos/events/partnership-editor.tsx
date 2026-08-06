'use client';

import { useEffect, useState } from 'react';
import { Handshake, Plus, Trash2 } from 'lucide-react';

import {
  inviteEventPartnership,
  listEventPartnerships,
  removeEventPartnership,
  uploadEventMedia,
  resolveEventImageUrl,
  type EventInput,
  type EventPartner,
  type EventPartnership,
  type EventPartnershipStatus,
} from '../event-api';
import { Section, Field } from './event-form-ui';

const STATUS_TONE: Record<EventPartnershipStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400',
};

type Props = {
  eventId: string;
  partners: EventPartner[];
  ensureSaved: () => Promise<string>;
  onChange: (patch: Partial<EventInput>) => void;
  onError: (message: string) => void;
};

/**
 * Partnerships section of the event wizard:
 * - Co-host communities: invite by slug; accepted co-hosts gain management rights
 *   and appear on the event page + certificates.
 * - External partners: name/logo/website shown on the event page + certificates.
 */
export function PartnershipEditor({ eventId, partners, ensureSaved, onChange, onError }: Props) {
  const [partnerships, setPartnerships] = useState<EventPartnership[]>([]);
  const [inviteSlug, setInviteSlug] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(-1);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { partnerships: list } = await listEventPartnerships(eventId);
        if (!cancelled) setPartnerships(list);
      } catch {
        // Not fatal — the section still allows inviting after save.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleInvite() {
    const slug = inviteSlug.trim().toLowerCase().replace(/^.*\/communities\//, '');
    if (!slug) return;
    setInviteBusy(true);
    try {
      const id = await ensureSaved();
      await inviteEventPartnership(id, slug);
      const { partnerships: list } = await listEventPartnerships(id);
      setPartnerships(list);
      setInviteSlug('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to send partnership invite');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRemovePartnership(partnershipId: string) {
    try {
      const id = await ensureSaved();
      await removeEventPartnership(id, partnershipId);
      setPartnerships((prev) => prev.filter((p) => p._id !== partnershipId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to remove partnership');
    }
  }

  function updatePartner(index: number, patch: Partial<EventPartner>) {
    const next = partners.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange({ partners: next });
  }

  async function handlePartnerLogo(index: number, file: File | null) {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const data = new FormData();
      data.append('partnerLogo', file);
      const uploaded = await uploadEventMedia(data);
      updatePartner(index, { logo: uploaded.partnerLogo });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload partner logo');
    } finally {
      setUploadingIndex(-1);
    }
  }

  return (
    <Section title="Partnerships">
      <div className="space-y-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Handshake className="h-4 w-4 text-indigo-600" /> Co-host communities
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Invite another verified community to co-host. Once a senior leader accepts, their coordinators can help manage this
            event, and the community appears on the event page and certificates.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="ev-input flex-1"
              placeholder="Community slug (e.g. robotics-club)"
              value={inviteSlug}
              onChange={(e) => setInviteSlug(e.target.value)}
            />
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void handleInvite()}
              disabled={inviteBusy || !inviteSlug.trim()}
            >
              {inviteBusy ? 'Inviting…' : 'Invite'}
            </button>
          </div>
          {partnerships.length ? (
            <ul className="mt-3 space-y-2">
              {partnerships.map((p) => (
                <li key={p._id} className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5">
                  {p.community?.logo ? (
                    <img src={resolveEventImageUrl(p.community.logo)} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                      {(p.community?.name ?? '?').slice(0, 1)}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">{p.community?.name ?? 'Unknown community'}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{p.status}</span>
                  <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-rose-600" onClick={() => void handleRemovePartnership(p._id)} aria-label="Remove partnership">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Partner organizations</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            External partners (companies, NGOs, departments) shown on the event page. Their logo appears on attendee
            certificates — <strong>logo required</strong>; partners without one are not saved.
          </p>
          <div className="mt-3 space-y-3">
            {partners.map((partner, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Partner name">
                    <input className="ev-input" value={partner.name} onChange={(e) => updatePartner(index, { name: e.target.value })} />
                  </Field>
                  <Field label="Website (optional)">
                    <input className="ev-input" placeholder="https://…" value={partner.website} onChange={(e) => updatePartner(index, { website: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {partner.logo ? <img src={resolveEventImageUrl(partner.logo)} alt="" className="h-10 w-10 rounded-lg object-contain" /> : null}
                  <input type="file" accept="image/*" onChange={(e) => void handlePartnerLogo(index, e.target.files?.[0] ?? null)} />
                  {uploadingIndex === index ? <span className="text-xs text-slate-500 dark:text-slate-400">Uploading…</span> : null}
                  {partner.name && !partner.logo ? (
                    <span className="text-xs font-medium text-rose-600">Logo required</span>
                  ) : null}
                  <button
                    type="button"
                    className="ml-auto text-slate-400 dark:text-slate-500 hover:text-rose-600"
                    onClick={() => onChange({ partners: partners.filter((_, i) => i !== index) })}
                    aria-label="Remove partner"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {partners.length < 8 ? (
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
                onClick={() => onChange({ partners: [...partners, { name: '', logo: '', website: '' }] })}
              >
                <Plus className="h-4 w-4" /> Add partner
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
