import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Award, BadgeCheck, CalendarPlus, CheckCircle2, ClipboardList, MessageCircle, QrCode, ScanLine, Users, XCircle } from 'lucide-react';

import { GuildOSLogo } from '../../components/guildos/guildos-logo';
import { SUPPORT_EMAIL } from '../../components/guildos/landing-data';

export const metadata: Metadata = {
  title: 'GuildOS for clubs | Verified certificates for every member',
  description: 'Every member who shows up to your events leaves with a verified certificate for their CV, and you never make one by hand. Free for free events.',
};

const SETUP_MESSAGE = "Hi! I run a student club and I'd like to set up our next event on GuildOS.";

/** WhatsApp chat with the team when a number is configured; otherwise a pre-filled email. */
function setupHref() {
  const number = (process.env.NEXT_PUBLIC_SETUP_WHATSAPP ?? '').replace(/[^0-9]/g, '');
  if (number) return `https://wa.me/${number}?text=${encodeURIComponent(SETUP_MESSAGE)}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Set up our club on GuildOS')}&body=${encodeURIComponent(`${SETUP_MESSAGE}\n\nClub name:\nUniversity:\nNext event date:\nBest number to reach me:`)}`;
}

const STOP_DOING = [
  { before: 'A Google Form, then a WhatsApp list, then copying names around', after: 'One registration link. Everyone gets their own QR pass.' },
  { before: 'A paper sign-in sheet and guessing how many people came', after: 'Scan people in at the door. Real numbers, live.' },
  { before: 'Making certificates in Canva, fixing typos, chasing who is missing', after: 'Certificates go out on their own to everyone who stayed.' },
];

const STEPS = [
  { icon: CalendarPlus, title: 'Create the event', text: 'About 20 minutes. We can do it with you.' },
  { icon: Users, title: 'Members register', text: 'They sign up with your link and get a QR pass on their phone.' },
  { icon: ScanLine, title: 'Scan at the door', text: 'Any phone works as a scanner, even for helpers without an account.' },
  { icon: Award, title: 'Certificates go out', text: 'Everyone who stayed to the end gets a verified certificate.' },
];

const FAQ: [string, string][] = [
  ['Is it free?', 'Yes for free events. Paid tickets carry a small processing fee, and you see it before you charge anyone.'],
  ["Will my members sign up?", "They sign up because that's how they get their certificate. It takes about a minute, even at the door."],
  ['We already use WhatsApp.', "Keep it. GuildOS doesn't replace your group chat. It handles registration, the door and certificates."],
  ['Are the certificates real?', 'Each one has a QR code and a public check page, so anyone, including an employer, can confirm it is genuine.'],
  ['Online events?', 'Yes. Attendees check in to get the meeting link, and check out at the end to earn the certificate.'],
  ['What if something goes wrong on the day?', "We'll set up your first event with you and stay reachable while it runs."],
];

function SampleCertificate() {
  return (
    <div className="relative mx-auto w-full max-w-md rotate-[-1.5deg] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-indigo-900/10 dark:border-slate-700 dark:bg-slate-900">
      <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Sample</span>
      <div className="rounded-2xl border-2 border-indigo-100 p-5 text-center dark:border-indigo-500/20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-300">Certificate of Attendance</p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">This certifies that</p>
        <p className="mt-1 font-serif text-2xl font-semibold text-slate-900 dark:text-white">Tobi Adeyemi</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">attended and completed</p>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Intro to React Workshop</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">hosted by your club</p>
        <div className="mt-5 flex items-end justify-between gap-3 text-left">
          <div>
            <div className="h-px w-24 bg-slate-300 dark:bg-slate-600" />
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Club President</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3.5 w-3.5" /> Verified</p>
              <p className="text-[10px] text-slate-400">Scan to check</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <QrCode className="h-9 w-9 text-slate-700 dark:text-slate-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForClubsPage() {
  const href = setupHref();
  const external = href.startsWith('http');

  const SetupButton = ({ className = '' }: { className?: string }) => (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 ${className}`}
    >
      <MessageCircle className="h-4 w-4" /> Book a 20-minute setup
    </a>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <GuildOSLogo variant="nav" href="/" />
        <Link href="/login" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white">Sign in</Link>
      </header>

      {/* The promise */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">For student club leaders</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Every member who shows up leaves with a verified certificate.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            And you never make one by hand. GuildOS handles registration, the door and certificates for your events, so you can focus on the event itself.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <SetupButton />
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              Start on your own <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Free for free events. We&apos;ll set up your first one with you.</p>
        </div>
        <SampleCertificate />
      </section>

      {/* What you stop doing */}
      <section className="border-y border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What you stop doing</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STOP_DOING.map((row) => (
              <div key={row.before} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <p className="flex gap-2 text-sm text-slate-500 line-through decoration-slate-300 dark:text-slate-400 dark:decoration-slate-600">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /> {row.before}
                </p>
                <p className="mt-3 flex gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {row.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
                <step.icon className="h-5 w-5 text-indigo-500" />
              </div>
              <p className="mt-4 font-semibold">{step.title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why it matters */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-14 md:grid-cols-2">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-100">For your members</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> A certificate for every event they attend, on their profile and CV.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Employers can scan it and see it&apos;s real.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Credit for showing up, volunteering and leading.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">For you and your executives</p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <li className="flex gap-2"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /> Real attendance numbers to show sponsors, your faculty or student affairs.</li>
            <li className="flex gap-2"><Award className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /> Leadership certificates for your team when their term ends.</li>
            <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /> Your club&apos;s members and history stay in one place when you hand over.</li>
          </ul>
        </div>
      </section>

      {/* Questions */}
      <section className="border-t border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Questions leaders ask</h2>
          <dl className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-4">
                <dt className="font-semibold">{q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final ask */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Let&apos;s set up your next event together.</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">Twenty minutes, on your phone. Your members get their certificates the same day the event ends.</p>
        <div className="mt-6 flex justify-center">
          <SetupButton className="w-full sm:w-auto" />
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Prefer to explore first? <Link href="/signup" className="font-medium text-indigo-600 hover:underline dark:text-indigo-300">Create your account</Link>
        </p>
      </section>
    </div>
  );
}
