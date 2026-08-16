'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Bot, LifeBuoy, Mail, MessageCircleQuestion } from 'lucide-react';

import { SUPPORT_EMAIL } from '../../components/guildos/landing-data';

const CHANNELS = [
  {
    icon: BookOpen,
    title: 'Browse the documentation',
    body: 'Step-by-step guides for students and community leaders — events, certificates, communities, and reputation.',
    action: { label: 'Open the docs', href: '/docs' },
  },
  {
    icon: Bot,
    title: 'Ask GuildBot',
    body: 'The in-app assistant answers questions about GuildOS instantly. Log in and tap the assistant button at the bottom-right of any page.',
    action: { label: 'Log in to ask', href: '/login' },
  },
  {
    icon: Mail,
    title: 'Email the team',
    body: 'For account issues, payment questions, or anything the docs don\u2019t cover, reach the GuildOS team directly.',
    action: { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
  },
] as const;

const FAQS = [
  {
    q: 'I can\u2019t log in to my account',
    a: 'Use "Forgot password" on the login page to reset your password. If your email was never verified, request a new verification link from the same page.',
  },
  {
    q: 'My payment went through but nothing was unlocked',
    a: 'Open the page you paid from and use the "Check payment status" link — it re-verifies your payment with the provider and applies it instantly.',
  },
  {
    q: 'I attended an event but didn\u2019t get a certificate',
    a: 'Certificates are issued by the event organizers after the event is finalized. If it\u2019s been a while, contact the organizers via the contact details on the event page.',
  },
  {
    q: 'How do I verify a certificate someone shared with me?',
    a: 'Every GuildOS certificate has a unique link and QR code. Opening the link shows the live verification page — if it was revoked, the page says so.',
  },
] as const;

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="bg-gradient-to-br from-indigo-700 to-sky-600 px-4 py-14 text-white">
        <div className="mx-auto max-w-5xl">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-100 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to GuildOS
            </Link>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            <LifeBuoy className="h-4 w-4" /> Support
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">How can we help?</h1>
          <p className="mt-3 max-w-2xl text-sm text-indigo-100 sm:text-base">
            Pick the fastest channel for your question — most answers are already in the docs.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 pb-24">
        <section className="grid gap-4 sm:grid-cols-3">
          {CHANNELS.map(({ icon: Icon, title, body, action }) => (
            <div key={title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
              <a
                href={action.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline"
              >
                {action.label}
              </a>
            </div>
          ))}
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <MessageCircleQuestion className="h-5 w-5 text-indigo-600" /> Common questions
          </h2>
          <div className="mt-4 space-y-3">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:hidden dark:text-slate-100">
                  {q}
                </summary>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
