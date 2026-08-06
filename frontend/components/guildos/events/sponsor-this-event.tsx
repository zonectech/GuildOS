'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { submitSponsorshipInquiry, SPONSOR_PERK_LABEL, type EventSummary } from '../event-api';

/** Public "become a sponsor" section: package cards + no-account inquiry form (honeypot-protected). */
export function SponsorThisEvent({ event }: { event: EventSummary }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('');
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
        packageName: selectedPackage,
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
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Sponsor this event</h2>
      {event.sponsorshipPitch ? <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{event.sponsorshipPitch}</p> : null}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{event.registrationCount} registered attendee{event.registrationCount === 1 ? '' : 's'} · attendance is verified on GuildOS</p>

      {event.sponsorshipPackages.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {event.sponsorshipPackages.map((pkg) => (
            <button
              key={pkg.name}
              type="button"
              onClick={() => {
                setSelectedPackage(pkg.name === selectedPackage ? '' : pkg.name);
                setShowForm(true);
              }}
              className={`rounded-2xl border p-4 text-left transition ${selectedPackage === pkg.name ? 'border-indigo-500 bg-white dark:bg-slate-900 ring-2 ring-indigo-200' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{pkg.name}</p>
              {pkg.price ? <p className="mt-0.5 text-sm font-medium text-indigo-600">{pkg.price}</p> : null}
              {pkg.perks?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {pkg.perks.map((key) => (
                    <li key={key} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                      {SPONSOR_PERK_LABEL[key] ?? key}
                    </li>
                  ))}
                </ul>
              ) : null}
              {pkg.benefits ? <p className="mt-2 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">{pkg.benefits}</p> : null}
            </button>
          ))}
        </div>
      ) : null}

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
          <textarea className="min-h-20 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Message to the organizers (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
          {selectedPackage ? <p className="text-xs text-slate-500 dark:text-slate-400">Selected package: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedPackage}</span></p> : null}
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !companyName.trim() || !contactName.trim() || !email.trim()}
            className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send inquiry'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Become a sponsor
        </button>
      )}
    </section>
  );
}
