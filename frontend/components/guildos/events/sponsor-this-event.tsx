'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { submitSponsorshipInquiry, type EventSummary } from '../event-api';

/** Public "become a sponsor" section: open-offer inquiry form, no account needed (honeypot-protected).
 *  No public price packages — every deal is negotiated to fit the sponsor's budget. */
export function SponsorThisEvent({ event }: { event: EventSummary }) {
  const [showForm, setShowForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setFormError('');
      await submitSponsorshipInquiry(event._id, {
        companyName,
        contactName,
        email,
        phone,
        website,
        message,
        hp: honeypot,
      });
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit inquiry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="sponsor" className="scroll-mt-24 rounded-3xl border border-indigo-200 dark:border-slate-800 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Sponsor this event</h2>
      {event.sponsorshipPitch ? <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{event.sponsorshipPitch}</p> : null}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{event.registrationCount} registered attendee{event.registrationCount === 1 ? '' : 's'} · attendance is verified on GuildOS</p>

      {/* What sponsors can get — informational only; every deal is negotiated to fit the sponsor's budget. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        {['Logo on the event page', 'Logo on attendee certificates', 'Thank-you announcement', 'Verified attendance report', 'Stage mention'].map((perk) => (
          <li key={perk} className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
            {perk}
          </li>
        ))}
      </ul>

      {sent ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Thanks! Your inquiry has been sent to the organizers — they will contact you at {email}.
        </div>
      ) : showForm ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          {/* Honeypot — invisible to humans, bots fill it and get silently dropped */}
          <input
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            name="company_fax"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Company name *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <input className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Contact person *" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <input type="email" className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <input className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Company website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <textarea className="min-h-20 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Your offer — what you'd like to sponsor and your budget *" value={message} onChange={(e) => setMessage(e.target.value)} />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !companyName.trim() || !contactName.trim() || !email.trim() || !message.trim()}
            className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send inquiry'}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Become a sponsor
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Every deal is negotiated — propose an offer that fits your budget.</p>
        </div>
      )}
    </section>
  );
}
