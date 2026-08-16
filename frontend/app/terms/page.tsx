import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';

import { SUPPORT_EMAIL } from '../../components/guildos/landing-data';

export const metadata = {
  title: 'Terms of Service — GuildOS',
  description: 'The terms that govern your use of GuildOS.',
};

const LAST_UPDATED = 'August 15, 2026';

const SECTIONS = [
  {
    title: '1. Your account',
    paragraphs: [
      'You must provide accurate information when creating an account and keep your login credentials secure. You are responsible for activity on your account.',
      'GuildOS is built for students, community leaders, and recruiters. One person, one account — duplicate or impersonation accounts may be removed.',
    ],
  },
  {
    title: '2. Verified records & certificates',
    paragraphs: [
      'Certificates and attendance records on GuildOS are issued by communities, not by GuildOS itself. GuildOS provides the verification infrastructure.',
      'Attempting to forge attendance (for example, sharing QR check-in codes with people who are not present) is a violation of these terms and may result in revoked records or account suspension.',
      'Issuing communities may revoke a certificate they issued. Verification pages always reflect the current status.',
    ],
  },
  {
    title: '3. Communities & events',
    paragraphs: [
      'Community leaders are responsible for the accuracy of the events they publish, the tickets they sell, and the certificates they issue.',
      'Paid tickets and sponsorships are processed through our payment providers. Refunds follow the event\u2019s stated refund policy and applicable law.',
    ],
  },
  {
    title: '4. Acceptable use',
    paragraphs: [
      'Do not use GuildOS to post unlawful, harassing, or misleading content, spam other members, scrape data, or interfere with the platform\u2019s operation.',
      'We may moderate, restrict, or remove content and accounts that violate these terms or harm the community.',
    ],
  },
  {
    title: '5. Intellectual property',
    paragraphs: [
      'You retain ownership of the content you post. By posting, you grant GuildOS a licence to host and display it as needed to operate the service.',
      'The GuildOS name, logo, and software are the property of GuildOS and may not be used without permission.',
    ],
  },
  {
    title: '6. Disclaimers & liability',
    paragraphs: [
      'GuildOS is provided "as is". We work hard to keep it reliable but do not guarantee uninterrupted availability.',
      'To the fullest extent permitted by law, GuildOS is not liable for indirect or consequential damages arising from your use of the platform.',
    ],
  },
  {
    title: '7. Termination',
    paragraphs: [
      'You may delete your account at any time from settings. We may suspend or terminate accounts that violate these terms.',
      'Sections that by their nature should survive termination (such as liability limits) will survive.',
    ],
  },
  {
    title: '8. Changes to these terms',
    paragraphs: [
      'We may update these terms as GuildOS evolves. Material changes will be announced in-app or by email. Continued use after changes take effect means you accept the updated terms.',
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="bg-gradient-to-br from-indigo-700 to-sky-600 px-4 py-14 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-100 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to GuildOS
          </Link>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            <Scale className="h-4 w-4" /> Legal
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-indigo-100">Last updated: {LAST_UPDATED}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 pb-24">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          These terms govern your use of GuildOS. By creating an account or using the platform, you agree to them.
          Please also read our{' '}
          <Link href="/privacy" className="font-semibold text-indigo-600 hover:underline">Privacy Policy</Link>.
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
            Questions about these terms? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-indigo-600 hover:underline">{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
