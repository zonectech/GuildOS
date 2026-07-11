'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';

import {
  convertSponsorshipInquiry,
  getSponsorshipFeeSettings,
  listSponsorshipInquiries,
  setSponsorshipInquiryStatus,
  uploadEventMedia,
  SPONSOR_PERKS,
  type EventInput,
  type SponsorshipFeeSettings,
  type SponsorshipInquiry,
  type SponsorshipInquiryStatus,
  type SponsorshipPackage,
} from '../event-api';
import { Section, Field, Toggle } from './event-form-ui';

const STATUS_TONE: Record<SponsorshipInquiryStatus, string> = {
  NEW: 'bg-indigo-50 text-indigo-700',
  CONTACTED: 'bg-amber-50 text-amber-700',
  WON: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

function externalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString()}`;
}

type Props = {
  eventId: string;
  eventSlug?: string;
  certificateMode?: 'STANDARD' | 'CUSTOM';
  open: boolean;
  pitch: string;
  packages: SponsorshipPackage[];
  onChange: (patch: Partial<EventInput>) => void;
  onError: (message: string) => void;
};

export function SponsorshipEditor({ eventId, eventSlug = '', certificateMode = 'STANDARD', open, pitch, packages, onChange, onError }: Props) {
  const [inquiries, setInquiries] = useState<SponsorshipInquiry[]>([]);
  const [inquiriesLoaded, setInquiriesLoaded] = useState(false);
  const [feeSettings, setFeeSettings] = useState<SponsorshipFeeSettings | null>(null);
  const [convertingId, setConvertingId] = useState('');
  const [convertPackage, setConvertPackage] = useState('');
  const [convertAmount, setConvertAmount] = useState('');
  const [convertLogo, setConvertLogo] = useState<File | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settingsRes = await getSponsorshipFeeSettings();
        if (!cancelled) setFeeSettings(settingsRes.settings);
      } catch {
        /* not logged in or backend unavailable — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void (async () => {
      try {
        const inquiriesRes = await listSponsorshipInquiries(eventId);
        if (!cancelled) {
          setInquiries(inquiriesRes.inquiries);
          setInquiriesLoaded(true);
        }
      } catch {
        /* inquiries unavailable until saved — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function handleToggleOpen(value: boolean) {
    // Pre-fill from the platform's tiered templates the first time sponsorship is enabled,
    // so packages start standardized (organizer can still edit prices and perks).
    if (value && packages.length === 0 && feeSettings?.packageTemplates?.length) {
      onChange({ sponsorshipOpen: value, sponsorshipPackages: feeSettings.packageTemplates.map((t) => ({ ...t, perks: [...t.perks] })) });
      return;
    }
    onChange({ sponsorshipOpen: value });
  }

  function updatePackage(index: number, patch: Partial<SponsorshipPackage>) {
    const next = packages.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange({ sponsorshipPackages: next });
  }

  function addPackage() {
    if (packages.length >= 6) return;
    onChange({ sponsorshipPackages: [...packages, { name: '', price: '', perks: [], benefits: '' }] });
  }

  function togglePerk(index: number, key: string) {
    const current = packages[index]?.perks ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    updatePackage(index, { perks: next });
  }

  function removePackage(index: number) {
    onChange({ sponsorshipPackages: packages.filter((_, i) => i !== index) });
  }

  async function handleStatusChange(inquiryId: string, status: SponsorshipInquiryStatus) {
    try {
      const response = await setSponsorshipInquiryStatus(eventId, inquiryId, status);
      setInquiries((current) => current.map((q) => (q._id === inquiryId ? response.inquiry : q)));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to update inquiry');
    }
  }

  function startConvert(inquiry: SponsorshipInquiry) {
    setConvertingId(inquiry._id);
    setConvertPackage(inquiry.packageName && packages.some((p) => p.name === inquiry.packageName) ? inquiry.packageName : '');
    setConvertAmount('');
    setConvertLogo(null);
  }

  async function handleConvert(inquiryId: string) {
    try {
      setConvertBusy(true);
      let logo = '';
      if (convertLogo) {
        const payload = new FormData();
        payload.append('sponsorLogo', convertLogo);
        const uploaded = await uploadEventMedia(payload);
        logo = uploaded.sponsorLogo;
      }
      const response = await convertSponsorshipInquiry(eventId, inquiryId, {
        packageWon: convertPackage,
        dealAmount: Number(convertAmount) || 0,
        logo,
      });
      setInquiries((current) => current.map((q) => (q._id === inquiryId ? response.inquiry : q)));
      setFeeSettings(response.feeSettings);
      setConvertingId('');
      setConvertLogo(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to convert inquiry');
    } finally {
      setConvertBusy(false);
    }
  }

  return (
    <Section title="Sponsorship">
      <Toggle label="Open this event for sponsorship" checked={open} onChange={handleToggleOpen} />
      {open ? (
        <>
          <Field label="Pitch to sponsors">
            <textarea
              className="ev-input min-h-24"
              value={pitch}
              onChange={(e) => onChange({ sponsorshipPitch: e.target.value })}
              placeholder="Why should a brand sponsor this event? Audience, reach, past attendance…"
            />
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Packages ({packages.length}/6)</span>
              <button
                type="button"
                onClick={addPackage}
                disabled={packages.length >= 6}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add package
              </button>
            </div>
            {packages.length ? (
              packages.map((pkg, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Package name">
                      <input className="ev-input" value={pkg.name} onChange={(e) => updatePackage(index, { name: e.target.value })} placeholder="e.g. Gold Sponsor" />
                    </Field>
                    <Field label="Price / value (you decide)">
                      <input className="ev-input" value={pkg.price} onChange={(e) => updatePackage(index, { price: e.target.value })} placeholder="e.g. ₦150,000 or In-kind" />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <span className="mb-1 block text-sm font-medium text-slate-700">What the sponsor gets</span>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {SPONSOR_PERKS.map((perk) => (
                        <label key={perk.key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-700 transition hover:border-indigo-200">
                          <input
                            type="checkbox"
                            checked={(pkg.perks ?? []).includes(perk.key)}
                            onChange={() => togglePerk(index, perk.key)}
                          />
                          <span>
                            {perk.label}
                            {perk.platformDelivered ? <span className="ml-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">GuildOS</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    {certificateMode === 'CUSTOM' && (pkg.perks ?? []).includes('LOGO_CERTIFICATES') ? (
                      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                        This event uses a custom certificate template — GuildOS can only add sponsor logos automatically on standard certificates.
                        Include the sponsor’s logo in your uploaded template design, or switch to the standard certificate.
                      </p>
                    ) : null}
                  </div>
                  <Field label="Extra benefits (optional)">
                    <textarea className="ev-input min-h-16" value={pkg.benefits} onChange={(e) => updatePackage(index, { benefits: e.target.value })} placeholder="Anything else this package includes…" />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removePackage(index)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No packages yet. Add tiers like Gold / Silver / Bronze so brands know what they get.</p>
            )}
          </div>

          {eventId && inquiriesLoaded ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">Inquiries ({inquiries.length})</p>
              {inquiries.length ? (
                <div className="mt-3 space-y-3">
                  {inquiries.map((q) => (
                    <div key={q._id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{q.companyName}</p>
                          <p className="text-xs text-slate-500">
                            {q.contactName} · <a href={`mailto:${q.email}`} className="text-indigo-600 hover:underline">{q.email}</a>
                            {q.phone ? ` · ${q.phone}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {q.packageName ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">{q.packageName}</span> : null}
                          {q.status === 'WON' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              <BadgeCheck className="h-3 w-3" /> Sponsor
                            </span>
                          ) : (
                            <>
                              <select
                                value={q.status}
                                onChange={(e) => void handleStatusChange(q._id, e.target.value as SponsorshipInquiryStatus)}
                                className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[q.status]}`}
                              >
                                {(['NEW', 'CONTACTED', 'CLOSED'] as SponsorshipInquiryStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => startConvert(q)}
                                className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Convert to sponsor
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {q.message ? <p className="mt-2 whitespace-pre-line text-xs text-slate-600">{q.message}</p> : null}

                      {convertingId === q._id && q.status !== 'WON' ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                          <p className="text-xs font-semibold text-slate-700">Close this deal</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select
                              value={convertPackage}
                              onChange={(e) => setConvertPackage(e.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            >
                              <option value="">Package won (optional)</option>
                              {packages.filter((p) => p.name).map((p) => (
                                <option key={p.name} value={p.name}>{p.name}{p.price ? ` — ${p.price}` : ''}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              value={convertAmount}
                              onChange={(e) => setConvertAmount(e.target.value)}
                              placeholder="Deal amount (₦)"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                          </div>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-slate-600">Sponsor logo (optional — shown on the event page{'\u00A0'}and certificates)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setConvertLogo(e.target.files?.[0] ?? null)}
                              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                            />
                          </label>
                          {feeSettings && Number(convertAmount) > 0 ? (
                            <p className="text-[11px] text-slate-600">
                              Platform fee ({feeSettings.sponsorshipFeePercent}%):{' '}
                              <span className="font-semibold text-slate-900">{formatNaira(Math.round((Number(convertAmount) * feeSettings.sponsorshipFeePercent) / 100))}</span>
                            </p>
                          ) : null}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleConvert(q._id)}
                              disabled={convertBusy}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {convertBusy ? 'Converting…' : 'Confirm — mark WON'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConvertingId('')}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {q.status === 'WON' ? (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                          <p className="font-semibold text-emerald-800">
                            Deal won{q.packageWon ? ` · ${q.packageWon}` : ''}{q.dealAmount > 0 ? ` · ${formatNaira(q.dealAmount)}` : ''}
                          </p>
                          {q.dealAmount > 0 && feeSettings ? (
                            <div className="mt-1.5 space-y-0.5 text-slate-700">
                              <p>
                                Platform fee ({feeSettings.sponsorshipFeePercent}%):{' '}
                                <span className="font-semibold">{formatNaira(Math.round((q.dealAmount * feeSettings.sponsorshipFeePercent) / 100))}</span>
                                {' '}—{' '}
                                {q.feeStatus === 'PAID' ? (
                                  <span className="font-semibold text-emerald-700">Paid ✓</span>
                                ) : (
                                  <span className="font-semibold text-amber-700">Payment pending</span>
                                )}
                              </p>
                              {q.feeStatus !== 'PAID' ? (
                                feeSettings.feeAccountNumber ? (
                                  <p>
                                    Pay to: <span className="font-semibold">{feeSettings.feeBankName}</span> ·{' '}
                                    <span className="font-mono font-semibold">{feeSettings.feeAccountNumber}</span>
                                    {feeSettings.feeAccountName ? <> · {feeSettings.feeAccountName}</> : null}
                                  </p>
                                ) : (
                                  <p className="text-slate-500">Payment details will be shared by the GuildOS team.</p>
                                )
                              ) : null}
                            </div>
                          ) : null}
                          {eventSlug ? (
                            <a
                              href={`/events/${encodeURIComponent(eventSlug)}/sponsor-report`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline"
                            >
                              View shareable sponsor report →
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(q.createdAt).toLocaleString()}
                        {q.website ? <> · <a href={externalUrl(q.website)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{q.website}</a></> : null}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">No inquiries yet. Your event appears on the public sponsorship page once published.</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}
