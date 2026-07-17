'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, CalendarCheck, ChevronRight, FileText, Trophy, Users, Zap } from 'lucide-react';
import { GuildOSLogo } from './guildos-logo';
import {
  communities, communityFeatures, footerLinks, heroStats,
  howItWorks, productPreview, studentFeatures, whyGuildOS,
} from './landing-data';

/* ─── tiny helpers ─────────────────────────────────────────── */

function Eyebrow({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-600">
      {text}
    </span>
  );
}

function SectionHead({ eyebrow, title, sub, center }: { eyebrow: string; title: string; sub: string; center?: boolean }) {
  return (
    <div className={`sr mx-auto mb-12 max-w-2xl space-y-3 ${center ? 'text-center' : ''}`}>
      <Eyebrow text={eyebrow} />
      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">{title}</h2>
      <p className="text-lg text-slate-500">{sub}</p>
    </div>
  );
}

/* ─── HERO ──────────────────────────────────────────────────── */
export function LandingHeroSection() {
  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-6 sm:pt-8 lg:pt-12">
      {/* Grid bg */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(99,102,241,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,.04)_1px,transparent_1px)] bg-[size:32px_32px]" aria-hidden />

      <div className="content-width relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <div className="sr sr-left max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">Trusted by Student Communities Across Africa</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Turn Campus{' '}
            <span className="gradient-text">Activities</span>
            {' '}Into a Professional Portfolio
          </h1>
          <p className="mt-5 text-lg text-slate-500 sm:text-xl">
            Track participation, earn verified certificates, and showcase your leadership journey — all in one trusted place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="button button-primary inline-flex items-center gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="button button-secondary inline-flex items-center gap-2">
              See How It Works <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          {/* Stats strip */}
          <div className="mt-10 flex flex-wrap gap-6">
            {heroStats.map(([value, label]) => (
              <div key={label}>
                <p className="stat-shimmer text-2xl font-extrabold">{value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mock */}
        <div className="sr sr-right hidden lg:block">
          <div className="relative">
            {/* Main card */}
            <div className="glass-card overflow-hidden rounded-3xl p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">GuildOS Dashboard</span>
                <span className="live-pill">Live</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Guild Score', value: '1,450', accent: true },
                  { label: 'Leadership Score', value: '920' },
                  { label: 'Events Attended', value: '18' },
                  { label: 'Match Rate', value: '96%', success: true },
                ].map((m) => (
                  <div key={m.label} className={`rounded-2xl p-4 ${m.accent ? 'bg-gradient-to-br from-indigo-500/15 to-purple-500/10' : m.success ? 'bg-gradient-to-br from-emerald-500/10 to-indigo-500/8' : 'bg-slate-50'}`}>
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-950">{m.value}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Reputation Growth</span><span>+32% this semester</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                </div>
              </div>
            </div>
            {/* Floating badge */}
            <div className="float-card absolute -left-8 -top-5 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
              <p className="text-xs text-slate-500">New certificate</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">AI Hackathon 2025 ✓</p>
            </div>
            <div className="float-card-slow absolute -bottom-4 -right-6 rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-lg">
              <p className="text-xs text-slate-500">Recruiter match</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">Google · 96% fit</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ──────────────────────────────────────────── */
export function LandingHowItWorksSection() {
  const icons = [Users, CalendarCheck, BadgeCheck, FileText, Trophy];
  return (
    <section id="how-it-works" className="section content-width">
      <SectionHead eyebrow="How It Works" title="From Campus to Career in 5 Steps" sub="A frictionless path from joining a community to a verified professional portfolio." center />
      <div className="stagger relative grid gap-4 sm:grid-cols-5">
        {/* Connector line */}
        <div className="absolute left-[10%] right-[10%] top-10 hidden h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-200 sm:block" aria-hidden />
        {howItWorks.map((step, i) => {
          const Icon = icons[i] ?? Zap;
          return (
            <div key={step} className="relative flex flex-col items-center gap-3 rounded-3xl border border-slate-100 bg-white p-5 text-center shadow-sm">
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-md">
                <Icon className="h-6 w-6 text-white" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-indigo-600 shadow">{i + 1}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{step}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── FOR STUDENTS ──────────────────────────────────────────── */
export function LandingStudentsSection() {
  return (
    <section id="students" className="section content-width">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div className="sr sr-left">
          <SectionHead eyebrow="For Students" title="Everything You Achieve, Organized" sub="A portfolio-first experience that keeps certificates, roles, and participation in one verifiable place." />
          <ul className="stagger mt-2 space-y-3">
            {studentFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold text-slate-900">{f}</p>
                  <p className="text-sm text-slate-500">Verified from real campus activity and QR check-ins.</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="sr sr-right glass-card overflow-hidden rounded-3xl p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Portfolio Page</span>
            <span className="live-pill">Updated</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['12', 'Certificates'], ['4', 'Leadership Roles'], ['18', 'Events'], ['1,450', 'Guild Score']].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4">
                <p className="text-2xl font-extrabold text-slate-950">{v}</p>
                <p className="text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">guildos.app/u/taye</p>
            <p className="mt-0.5 text-slate-500">Public, shareable, and verified</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FOR COMMUNITIES ───────────────────────────────────────── */
export function LandingCommunitiesSection() {
  return (
    <section id="communities" className="section content-width">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div className="sr sr-left order-2 lg:order-1 glass-card overflow-hidden rounded-3xl p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Dashboard Analytics</span>
            <span className="live-pill">Monthly</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['91%', 'Attendance'], ['96', 'Certificates'], ['312', 'Members']].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50/50 p-4 text-center">
                <p className="text-2xl font-extrabold text-slate-950">{v}</p>
                <p className="text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[82, 64, 90].map((w, i) => (
              <div key={i} className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="sr sr-right order-1 lg:order-2">
          <SectionHead eyebrow="For Communities" title="Manage Events Without the Chaos" sub="Everything a student leader needs to create events, verify attendance, and issue certificates with confidence." />
          <ul className="stagger mt-2 space-y-3">
            {communityFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-purple-500" />
                <p className="font-semibold text-slate-900">{f}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─── WHY GUILDOS ───────────────────────────────────────────── */
export function LandingWhyGuildOSSection() {
  return (
    <section className="section content-width">
      <SectionHead eyebrow="Why GuildOS" title="Built for Real Student Communities" sub="Trust, recognition, and growth in a platform that feels credible from day one." center />
      <div className="stagger grid gap-5 sm:grid-cols-3">
        {whyGuildOS.map((item, i) => {
          const colors = [
            'from-indigo-600 to-purple-600',
            'from-sky-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
          ];
          return (
            <article key={item.title} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colors[i]} text-xl font-black text-white shadow`}>
                {item.title.slice(0, 1)}
              </div>
              <h3 className="text-xl font-extrabold text-slate-950">{item.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-slate-500">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ─── PRODUCT PREVIEW ───────────────────────────────────────── */
export function LandingProductPreviewSection() {
  const gradients = [
    'from-indigo-600 to-purple-600',
    'from-sky-500 to-indigo-600',
    'from-purple-600 to-rose-500',
    'from-emerald-500 to-teal-600',
  ];
  return (
    <section id="preview" className="section content-width">
      <SectionHead eyebrow="Product Preview" title="See the Platform in Action" sub="Realistic glimpses of the dashboards, QR check-in, portfolio pages, and certificate previews." center />
      <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {productPreview.map(({ title, description }, i) => (
          <article key={title} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <div className={`h-28 bg-gradient-to-br ${gradients[i]} transition-transform duration-500 group-hover:scale-105`}>
              <div className="flex h-full items-center justify-center gap-1.5" aria-hidden>
                {[60, 40, 80, 55].map((h, j) => (
                  <div key={j} className="w-4 rounded-t-lg bg-white/30" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ─── COMMUNITY PILLS ───────────────────────────────────────── */
function CommunityCategoriesRow() {
  return (
    <div className="stagger mt-8 flex flex-wrap justify-center gap-3">
      {communities.map((c) => (
        <span key={c} className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
          {c}
        </span>
      ))}
    </div>
  );
}

/* ─── FINAL CTA ─────────────────────────────────────────────── */
export function LandingFinalCTASection() {
  return (
    <section id="contact" className="section content-width">
      <div className="sr relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 p-10 text-center text-white shadow-2xl sm:p-16">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative">
          <Eyebrow text="Get Started" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Don&apos;t Let Your Campus Achievements Get Lost
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Start building a verified record of your university journey — free for every student.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="button inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-indigo-700 shadow transition hover:-translate-y-0.5 hover:shadow-md">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#communities" className="button inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
              Create a Community
            </a>
          </div>
          <CommunityCategoriesRow />
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────────────────────── */
export function FooterSection() {
  return (
    <footer className="content-width border-t border-slate-200 pb-10 pt-12">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <GuildOSLogo variant="footer" showTagline={false} />
          <p className="mt-3 max-w-xs text-sm text-slate-500">Student reputation infrastructure for Africa&apos;s next generation of professionals.</p>
          <div className="mt-5 flex gap-4 text-xs font-semibold text-slate-400">
            {['LinkedIn', 'X', 'Instagram', 'GitHub'].map((s) => <a key={s} href="#" className="hover:text-indigo-600">{s}</a>)}
          </div>
        </div>
        {Object.values(footerLinks).map((section) => (
          <div key={section.title}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-900">{section.title}</p>
            {section.links.map((l) => (
              <a key={l.label} href={l.href} className="block py-1 text-sm text-slate-500 hover:text-indigo-600">{l.label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} GuildOS. All rights reserved.
      </div>
    </footer>
  );
}
