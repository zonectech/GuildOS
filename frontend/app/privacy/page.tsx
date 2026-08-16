import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { SUPPORT_EMAIL } from '../../components/guildos/landing-data';

export const metadata = {
  title: 'Privacy Policy — GuildOS',
  description: 'How GuildOS collects, uses, and protects your information.',
};

const LAST_UPDATED = 'August 15, 2026';

const SECTIONS = [
  {
    title: '1. Information we collect',
    paragraphs: [
      'Account information: your name, email address, university, and profile details you choose to add (such as a username, avatar, or bio).',
      'Activity records: events you register for, attendance verified via QR check-in, certificates issued to you, community memberships, and leadership roles.',
      'Payment information: when you pay for tickets or premium features, payments are processed by our payment providers. We store transaction references and statuses, never your card details.',
      'Technical data: basic device and log information (such as IP address and browser type) used to keep the platform secure and reliable.',
    ],
  },
  {
    title: '2. How we use your information',
    paragraphs: [
      'To operate GuildOS: creating your verified portfolio, issuing certificates, managing event registrations, and powering community features.',
      'To build your public reputation pages — only the achievements and activity you earn are shown, and you control your public profile visibility in settings.',
      'To communicate with you: transactional emails such as verification links, event reminders, and certificate notifications.',
      'To keep the platform safe: detecting fraud, abuse, and fake attendance attempts.',
    ],
  },
  {
    title: '3. What we share',
    paragraphs: [
      'Public by design: your public profile, portfolio, and certificate verification pages are visible to anyone with the link — that is the point of verifiable reputation. You control optional fields.',
      'With communities: leaders of communities you join can see your membership details and attendance for their own events.',
      'With recruiters: only if you apply to an opportunity or make your profile discoverable.',
      'We never sell your personal data to third parties.',
    ],
  },
  {
    title: '4. Data retention & your rights',
    paragraphs: [
      'We keep your data for as long as your account is active. You may request a copy of your data or deletion of your account at any time by contacting us.',
      'Certificates you earned may remain verifiable after account deletion, in anonymized form, to protect the integrity of records already shared with third parties.',
    ],
  },
  {
    title: '5. Security',
    paragraphs: [
      'Passwords are stored hashed and salted. Access to production data is restricted. Certificate verification uses unique, tamper-evident identifiers.',
      'No system is perfectly secure — if we become aware of a breach affecting your data, we will notify you promptly.',
    ],
  },
  {
    title: '6. Changes to this policy',
    paragraphs: [
      'We may update this policy as GuildOS evolves. Material changes will be announced in-app or by email. Continued use of GuildOS after changes take effect means you accept the updated policy.',
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="bg-gradient-to-br from-indigo-700 to-sky-600 px-4 py-14 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to GuildOS
          </Link>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            <ShieldCheck className="h-4 w-4" /> Legal
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-indigo-100">Last updated: {LAST_UPDATED}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 pb-24">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          GuildOS helps students build verified records of their campus involvement. This policy explains what
          information we collect, how we use it, and the choices you have.
        </p>

        {SECTIONS.map(({ title, paragraphs }) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            <div className="mt-2 space-y-2">
              {paragraphs.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p}</p>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Contact us</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Questions about this policy or your data? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-indigo-600 hover:underline">{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
