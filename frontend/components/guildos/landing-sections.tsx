'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BadgeCheck, CalendarCheck, ChevronRight, FileText, Handshake, Mail, Ticket, Trophy, Users, Zap } from 'lucide-react';
import { GuildOSLogo } from './guildos-logo';
import { getGoogleAuthUrl } from './auth-api';
import {
  communities, communityFeatureDetails, footerLinks, heroStats,
  howItWorksSteps, productPreview, socialLinks, studentFeatureDetails, whyGuildOS,
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
      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">{title}</h2>
      <p className="text-lg text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function RoleCard({
  title,
  summary,
  href,
  imageSrc,
  imageAlt,
  cta,
}: {
  title: string;
  summary: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
  cta: string;
}) {
  return (
    <article className="group sr rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative mb-4 h-44 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/18 via-slate-900/0 to-white/0" aria-hidden />
      </div>
      <h3 className="mt-4 text-xl font-extrabold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{summary}</p>
      <a href={href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
        {cta}
        <ChevronRight className="h-4 w-4" />
      </a>
    </article>
  );
}

export function LandingRolesSection() {
  return (
    <section id="roles" className="section content-width">
      <SectionHead
        eyebrow="Who GuildOS Is For"
        title="Join one. Run one. Back one."
        sub="Students find their people, leaders run their communities, and partners reach students on every campus — all in one place."
        center
      />
      <div className="stagger grid gap-5 md:grid-cols-3">
        <RoleCard
          title="Run a community"
          summary="Events, QR check-ins, certificates and member records in one place — and proof of your impact to show your school and future partners."
          href="/dashboard/communities/create"
          cta="Start your community"
          imageSrc="/images/roles/community-leaders.svg"
          imageAlt="GuildOS dashboard preview for community leaders"
        />
        <RoleCard
          title="Join a community"
          summary="See every community on your campus, join the ones you care about, and turn what you do into certificates and a CV you can share."
          href="/communities"
          cta="Browse communities"
          imageSrc="/images/roles/members.svg"
          imageAlt="GuildOS student portfolio preview"
        />
        <RoleCard
          title="Reach students"
          summary="Sponsor events at campuses across the country and get a report of real, QR-verified attendance — not guesses."
          href="/sponsors"
          cta="Become a partner"
          imageSrc="/images/roles/partners.svg"
          imageAlt="GuildOS sponsorship and partner analytics preview"
        />
      </div>
    </section>
  );
}

/* ─── HERO ──────────────────────────────────────────────────── */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type PlatformStats = { communities: number; universities: number; events: number; checkIns: number; certificates: number };

/**
 * Real, live platform numbers — never estimates. A stat only appears once it's big enough
 * to mean something; until then the strip shows who GuildOS is for instead.
 */
const STAT_FLOORS: Array<{ key: keyof PlatformStats; min: number; label: string }> = [
  { key: 'checkIns', min: 100, label: 'Verified check-ins' },
  { key: 'certificates', min: 50, label: 'Certificates issued' },
  { key: 'communities', min: 10, label: 'Communities' },
  { key: 'universities', min: 3, label: 'Universities' },
  { key: 'events', min: 20, label: 'Events hosted' },
];

function HeroStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/api/public/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (alive && body?.stats) setStats(body.stats); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const live = stats ? STAT_FLOORS.filter((s) => stats[s.key] >= s.min).slice(0, 3) : [];
  const items: Array<[string, string]> = live.length >= 2
    ? live.map((s) => [stats![s.key].toLocaleString('en-NG'), s.label])
    : heroStats.map(([value, label]) => [value, label]);

  return (
    <div className="mt-10 flex flex-wrap gap-6">
      {items.map(([value, label]) => (
        <div key={label}>
          <p className="stat-shimmer text-2xl font-extrabold">{value}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      ))}
    </div>
  );
}
export function LandingHeroSection() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const toFriendlyGoogleError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('not configured')) {
      return 'Google sign-in is not configured yet. Please use email for now.';
    }
    if (normalized.includes('failed to fetch') || normalized.includes('network')) {
      return 'We could not reach the sign-in service. Check your connection and try again.';
    }
    return 'Google sign-in is temporarily unavailable. Please try again or continue with email.';
  };

  const handleGoogleSignIn = async () => {
    setGoogleError('');
    setGoogleLoading(true);
    try {
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start Google sign-in';
      setGoogleError(toFriendlyGoogleError(message));
      setGoogleLoading(false);
    }
  };

  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-6 sm:pt-8 lg:pt-12">
      {/* Grid bg */}
      <div className="pp-griddrift pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(99,102,241,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,.04)_1px,transparent_1px)] bg-[size:32px_32px]" aria-hidden />

      <div className="content-width relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Copy — belonging first, verified proof second */}
        <div className="sr sr-left max-w-xl">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-slate-800 dark:text-slate-100 sm:text-5xl lg:text-6xl">
            Find your people{' '}
            <span className="gradient-text font-extrabold">on campus.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-500 dark:text-slate-400 sm:text-xl">
            Every club, guild and tech community at your university in one place. Join them, show up to their events,
            and leave with proof — verified check-ins and certificates that build a CV recruiters can trust.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/communities" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
              <Users className="h-4 w-4" /> Browse communities
            </Link>
            <Link href="/events" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <CalendarCheck className="h-4 w-4" /> Explore events
            </Link>
          </div>
          <HeroStats />
        </div>

        {/* Auth card — LinkedIn-style sign in / join */}
        <div className="sr sr-right">
          <div className="glass-card mx-auto w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8">
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.5 3.5-5.5 3.5-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.7-2.6C16.9 1.9 14.7 1 12 1 6.9 1 2.8 5.1 2.8 10.2S6.9 19.4 12 19.4c6.1 0 10.2-4.3 10.2-10.3 0-.7-.1-1.2-.2-1.7H12z"/>
                  <path fill="#4285F4" d="M23 12.2c0-.7-.1-1.2-.2-1.7H12v3.2h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7C21.8 17.7 23 15.2 23 12.2z"/>
                  <path fill="#FBBC05" d="M5 14.1c-.4-1.1-.6-2.2-.6-3.4s.2-2.3.6-3.4L1.3 4.7C.4 6.4 0 8.2 0 10.2s.4 3.8 1.3 5.5L5 14.1z"/>
                  <path fill="#34A853" d="M12 23c2.7 0 4.9-.9 6.5-2.4l-3.5-2.7c-.9.6-2 .9-3 .9-3.6 0-6.6-2.4-7.7-5.7l-3.7 2.9C3 20 7.2 23 12 23z"/>
                </svg>
                <span>{googleLoading ? 'Connecting Google...' : 'Continue with Google'}</span>
              </button>
              <Link href="/signup" className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                <Mail className="h-4 w-4" />
                Continue with email
              </Link>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              or
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            <Link href="/signup" className="button button-primary flex w-full items-center justify-center gap-2">
              Join GuildOS <ArrowRight className="h-4 w-4" />
            </Link>

            {googleError ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs font-medium text-rose-700 dark:border-rose-800/70 dark:bg-rose-900/20 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>{googleError}</p>
              </div>
            ) : null}

            <p className="mt-5 text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              By clicking Continue to join or sign in, you agree to GuildOS&apos;s{' '}
              <Link href="/terms" className="font-medium text-indigo-600 hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-medium text-indigo-600 hover:underline">Privacy Policy</Link>.
            </p>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Already on GuildOS?{' '}
              <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS (interactive) ────────────────────────────── */
function EventMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 p-4" aria-hidden>
      {['Design Sprint', 'AI Workshop', 'Career Fair'].map((e, j) => (
        <div key={e} className="pp-drift flex items-center gap-2 rounded-lg bg-white/20 px-2.5 py-1.5 backdrop-blur-sm" style={{ animationDelay: `${j * 0.3}s` }}>
          <CalendarCheck className="h-3.5 w-3.5 text-white" />
          <span className="text-[9px] font-semibold text-white">{e}</span>
          <span className="ml-auto rounded-full bg-white/30 px-1.5 py-0.5 text-[7px] font-bold text-white">RSVP</span>
        </div>
      ))}
    </div>
  );
}

const howItWorksVisuals: Record<string, () => React.JSX.Element> = {
  community: DashboardMock,
  event: EventMock,
  qr: QRCheckInMock,
  certificate: CertificateMock,
  portfolio: PortfolioMock,
  leadership: LeadershipMock,
  cv: CVMock,
  members: MembersMock,
  reports: ReportsMock,
  tickets: TicketsMock,
  sponsors: SponsorsMock,
};

/* Reusable interactive feature section: click a title to open its detail
   and swap the matching animated visual on the other side. */
function InteractiveFeatureSection({
  id, eyebrow, title, sub, items, gradients, visualSide,
}: {
  id: string;
  eyebrow: string;
  title: string;
  sub: string;
  items: readonly { title: string; detail: string; visual: string }[];
  gradients: string[];
  visualSide: 'left' | 'right';
}) {
  const [active, setActive] = useState(0);
  const item = items[active];
  const Visual = howItWorksVisuals[item.visual] ?? DashboardMock;

  const content = (
    <div className={`sr ${visualSide === 'left' ? 'sr-right' : 'sr-left'}`}>
      <SectionHead eyebrow={eyebrow} title={title} sub={sub} />
      <div className="stagger mt-2 space-y-3">
        {items.map((s, i) => {
          const open = i === active;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setActive(i)}
              aria-expanded={open}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${open ? 'border-indigo-200 bg-white dark:bg-slate-900 shadow-md' : 'border-slate-100 bg-white/60 shadow-sm hover:border-indigo-100 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-indigo-800 dark:hover:bg-slate-800'}`}
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br ${gradients[i % gradients.length]} transition-opacity ${open ? '' : 'opacity-40'}`} />
                <p className="flex-1 font-semibold text-slate-900 dark:text-slate-100">{s.title}</p>
                <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${open ? 'rotate-90 text-indigo-500' : ''}`} />
              </div>
              <div className={`grid transition-all duration-300 ease-out ${open ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <p className="pl-[26px] text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.detail}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const panel = (
    <div className={`sr ${visualSide === 'left' ? 'sr-left' : 'sr-right'} lg:sticky lg:top-24 lg:self-start`}>
      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
        <div className={`relative h-64 overflow-hidden bg-gradient-to-br ${gradients[active % gradients.length]} transition-colors duration-500`}>
          <div key={active} className="h-full animate-[rise_.5s_ease]">
            <Visual />
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-lg font-extrabold text-slate-950 dark:text-white">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.detail}</p>
          <div className="mt-4 flex items-center gap-1.5">
            {items.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Show ${s.title}`}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section id={id} className="section content-width">
      <div className="grid items-start gap-10 lg:grid-cols-2">
        {visualSide === 'left' ? <>{panel}{content}</> : <>{content}{panel}</>}
      </div>
    </section>
  );
}

export function LandingHowItWorksSection() {
  const icons = [Users, CalendarCheck, BadgeCheck, FileText, Trophy];
  const gradients = [
    'from-indigo-600 to-purple-600',
    'from-sky-500 to-indigo-600',
    'from-violet-600 to-fuchsia-600',
    'from-purple-600 to-rose-500',
    'from-emerald-500 to-teal-600',
  ];
  const [active, setActive] = useState(0);
  const step = howItWorksSteps[active];
  const Visual = howItWorksVisuals[step.visual];

  return (
    <section id="how-it-works" className="section content-width">
      <SectionHead eyebrow="How It Works" title="How GuildOS works for everyone" sub="Click any step to see how leaders, members, and partners create value together." center />
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Accordion */}
        <div className="stagger space-y-3">
          {howItWorksSteps.map((s, i) => {
            const Icon = icons[i] ?? Zap;
            const open = i === active;
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => setActive(i)}
                aria-expanded={open}
                className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${open ? 'border-indigo-200 bg-white dark:bg-slate-900 shadow-md' : 'border-slate-100 bg-white/60 shadow-sm hover:border-indigo-100 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-indigo-800 dark:hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradients[i]} shadow transition-transform duration-300 ${open ? 'scale-105' : ''}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <span className="text-xs font-black text-indigo-400">{String(i + 1).padStart(2, '0')}</span>
                      {s.title}
                    </p>
                  </div>
                  <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${open ? 'rotate-90 text-indigo-500' : ''}`} />
                </div>
                <div className={`grid transition-all duration-300 ease-out ${open ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <p className="pl-14 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Matching visual panel */}
        <div className="sr sr-right lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
            <div className={`relative h-56 overflow-hidden bg-gradient-to-br ${gradients[active]} transition-colors duration-500`}>
              <div key={active} className="h-full animate-[rise_.5s_ease]">
                <Visual />
              </div>
              <span className="absolute left-4 top-4 rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                Step {active + 1}
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-extrabold text-slate-950 dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{step.detail}</p>
              <div className="mt-4 flex items-center gap-1.5">
                {howItWorksSteps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to step ${i + 1}`}
                    onClick={() => setActive(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FOR STUDENTS ──────────────────────────────────────────── */
export function LandingStudentsSection() {
  return (
    <InteractiveFeatureSection
      id="students"
      eyebrow="For Members"
      title="Build a profile that proves your contribution"
      sub="Keep certificates, roles, and verified participation in one credible portfolio you can share with confidence."
      items={studentFeatureDetails}
      gradients={[
        'from-indigo-600 to-purple-600',
        'from-sky-500 to-indigo-600',
        'from-violet-600 to-fuchsia-600',
        'from-purple-600 to-rose-500',
        'from-emerald-500 to-teal-600',
      ]}
      visualSide="right"
    />
  );
}

/* ─── FOR COMMUNITIES ───────────────────────────────────────── */
export function LandingCommunitiesSection() {
  return (
    <InteractiveFeatureSection
      id="communities"
      eyebrow="For Leaders"
      title="Lead, grow, and monetize your community"
      sub="Everything organizers need to run events, verify attendance, activate sponsors, and prove impact."
      items={communityFeatureDetails}
      gradients={[
        'from-sky-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600',
        'from-purple-600 to-rose-500',
        'from-indigo-600 to-purple-600',
        'from-violet-600 to-fuchsia-600',
      ]}
      visualSide="left"
    />
  );
}

/* ─── WHY GUILDOS ───────────────────────────────────────────── */
export function LandingWhyGuildOSSection() {
  return (
    <section className="section content-width">
      <SectionHead eyebrow="Why GuildOS" title="One platform for every role in your community" sub="GuildOS aligns leaders, members, and partners around trust, recognition, and measurable growth." center />
      <div className="stagger grid gap-5 sm:grid-cols-3">
        {whyGuildOS.map((item, i) => {
          const colors = [
            'from-indigo-600 to-purple-600',
            'from-sky-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
          ];
          return (
            <article key={item.title} className="flex flex-col gap-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className={`pp-bob flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colors[i]} text-xl font-black text-white shadow`} style={{ animationDelay: `${i * 0.4}s` }}>
                {item.title.slice(0, 1)}
              </div>
              <h3 className="text-xl font-extrabold text-slate-950 dark:text-white">{item.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ─── PRODUCT PREVIEW ───────────────────────────────────────── */
function DashboardMock() {
  return (
    <div className="flex h-full flex-col gap-2 p-4" aria-hidden>
      <div className="grid grid-cols-3 gap-2">
        {[['1.2k', 'Members'], ['48', 'Events'], ['92%', 'Check-in']].map(([n, l]) => (
          <div key={l} className="relative rounded-lg bg-white/20 px-2 py-1.5 text-center backdrop-blur-sm">
            {l === 'Check-in' && (
              <span className="absolute right-1 top-1 flex h-1.5 w-1.5">
                <span className="pp-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
            )}
            <div className="text-sm font-extrabold leading-none text-white">{n}</div>
            <div className="mt-0.5 text-[8px] font-medium text-white/70">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-1 items-end justify-center gap-1.5 rounded-lg bg-white/10 px-3 pb-2 pt-1">
        {[55, 75, 45, 90, 65, 80].map((h, j) => (
          <div key={j} className="pp-bar w-3 rounded-t bg-white/40" style={{ height: `${h}%`, animationDelay: `${j * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function QRCheckInMock() {
  return (
    <div className="flex h-full items-center justify-center gap-3 p-4" aria-hidden>
      <div className="relative grid grid-cols-4 gap-0.5 overflow-hidden rounded-lg bg-white dark:bg-slate-900 p-1.5 shadow-md">
        {[1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1].map((on, j) => (
          <div key={j} className={`h-2.5 w-2.5 rounded-[2px] ${on ? 'bg-slate-900' : 'bg-transparent'}`} />
        ))}
        <div className="pp-scan absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.8)]" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="pp-pop flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow">
          <BadgeCheck className="h-5 w-5 text-emerald-500" />
        </div>
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[8px] font-bold text-white">Verified</span>
      </div>
    </div>
  );
}

function PortfolioMock() {
  return (
    <div className="flex h-full flex-col gap-2 p-4" aria-hidden>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-white/80 ring-2 ring-white/50" />
        <div className="space-y-1">
          <div className="h-2 w-20 rounded bg-white/70" />
          <div className="h-1.5 w-14 rounded bg-white/40" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['Hackathon', 'Volunteer', 'Leadership', 'Speaker'].map((b, j) => (
          <span key={b} className="pp-drift rounded-full bg-white/25 px-2 py-0.5 text-[8px] font-semibold text-white" style={{ animationDelay: `${j * 0.35}s` }}>{b}</span>
        ))}
      </div>
      <div className="mt-auto space-y-1">
        <div className="pp-line h-1.5 w-full rounded bg-white/30" />
        <div className="pp-line h-1.5 w-4/5 rounded bg-white/30" style={{ animationDelay: '.4s' }} />
      </div>
    </div>
  );
}

function CertificateMock() {
  return (
    <div className="flex h-full items-center justify-center p-4" aria-hidden>
      <div className="relative w-full max-w-[150px] rounded-md border-2 border-white/50 bg-white/15 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto h-1.5 w-16 rounded bg-white/60" />
        <div className="mx-auto mt-2 h-2.5 w-24 rounded bg-white/80" />
        <div className="mx-auto mt-2 space-y-1">
          <div className="mx-auto h-1 w-28 rounded bg-white/30" />
          <div className="mx-auto h-1 w-20 rounded bg-white/30" />
        </div>
        <div className="pp-seal absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-md">
          <BadgeCheck className="h-5 w-5 text-emerald-500" />
        </div>
      </div>
    </div>
  );
}

function LeadershipMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 p-4" aria-hidden>
      {[['President', 'Tech Society'], ['Lead Organizer', 'AI Summit'], ['Mentor', 'First-Years']].map(([role, org], j) => (
        <div key={role} className="pp-drift flex items-center gap-2 rounded-lg bg-white/20 px-2.5 py-1.5 backdrop-blur-sm" style={{ animationDelay: `${j * 0.3}s` }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="leading-tight">
            <div className="text-[9px] font-bold text-white">{role}</div>
            <div className="text-[7px] text-white/70">{org}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CVMock() {
  return (
    <div className="flex h-full items-center justify-center p-4" aria-hidden>
      <div className="w-full max-w-[150px] rounded-md bg-white/90 p-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-indigo-400" />
          <div className="space-y-1">
            <div className="h-1.5 w-16 rounded bg-slate-300" />
            <div className="h-1 w-10 rounded bg-slate-200" />
          </div>
          <FileText className="ml-auto h-4 w-4 text-indigo-400" />
        </div>
        <div className="mt-2 space-y-1">
          {[100, 85, 92, 70].map((w, j) => (
            <div key={j} className="pp-line h-1 rounded bg-slate-200" style={{ width: `${w}%`, animationDelay: `${j * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MembersMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 p-4" aria-hidden>
      {['Amina', 'Chidi', 'Taye', 'Zainab'].map((n, j) => (
        <div key={n} className="pp-drift flex items-center gap-2 rounded-lg bg-white/20 px-2.5 py-1 backdrop-blur-sm" style={{ animationDelay: `${j * 0.25}s` }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[9px] font-black text-indigo-600">{n[0]}</div>
          <span className="text-[9px] font-semibold text-white">{n}</span>
          <span className="ml-auto rounded-full bg-emerald-400/80 px-1.5 py-0.5 text-[7px] font-bold text-white">Active</span>
        </div>
      ))}
    </div>
  );
}

function TicketsMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-4" aria-hidden>
      <div className="pp-drift flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-md">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
          <Ticket className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[9px] font-bold text-slate-900">Tech Summit Ticket</div>
          <div className="text-[7px] text-slate-500">Early Bird · ₦1,500</div>
        </div>
        <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-0.5 text-[7px] font-bold text-emerald-700">PAID</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white/20 px-3 py-2 backdrop-blur-sm">
        <span className="text-[8px] font-semibold text-white/80">Wallet balance</span>
        <span className="text-[10px] font-extrabold text-white">₦128,500</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white/20 px-3 py-2 backdrop-blur-sm">
        <span className="text-[8px] font-semibold text-white/80">Withdraw to bank</span>
        <span className="rounded-full bg-white/30 px-1.5 py-0.5 text-[7px] font-bold text-white">Available</span>
      </div>
    </div>
  );
}

function SponsorsMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 p-4" aria-hidden>
      {[['Gold Package', '₦150,000', 'Won'], ['Silver Package', '₦75,000', 'New'], ['Bronze Package', '₦30,000', 'Contacted']].map(([name, price, status], j) => (
        <div key={name} className="pp-drift flex items-center gap-2 rounded-lg bg-white/20 px-2.5 py-1.5 backdrop-blur-sm" style={{ animationDelay: `${j * 0.3}s` }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80">
            <Handshake className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="leading-tight">
            <div className="text-[9px] font-bold text-white">{name}</div>
            <div className="text-[7px] text-white/70">{price}</div>
          </div>
          <span className="ml-auto rounded-full bg-white/30 px-1.5 py-0.5 text-[7px] font-bold text-white">{status}</span>
        </div>
      ))}
    </div>
  );
}

function ReportsMock() {
  return (
    <div className="flex h-full flex-col gap-2 p-4" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-white/80">Event Report</span>
        <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[7px] font-bold text-white">Export</span>
      </div>
      <div className="flex flex-1 items-end justify-center gap-1.5 rounded-lg bg-white/10 px-3 pb-2 pt-1">
        {[40, 70, 55, 85, 60, 95, 75].map((h, j) => (
          <div key={j} className="pp-bar w-2.5 rounded-t bg-white/40" style={{ height: `${h}%`, animationDelay: `${j * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}

export function LandingProductPreviewSection() {
  const gradients = [
    'from-indigo-600 to-purple-600',
    'from-sky-500 to-indigo-600',
    'from-purple-600 to-rose-500',
    'from-emerald-500 to-teal-600',
  ];
  const [active, setActive] = useState(0);
  const item = productPreview[active];
  const Visual = howItWorksVisuals[item.visual] ?? DashboardMock;

  return (
    <section id="preview" className="section content-width">
      <SectionHead eyebrow="Product Preview" title="See GuildOS in action" sub="Pick a screen to preview — the panel updates to match." center />

      {/* Tabs */}
      <div className="stagger mb-8 flex flex-wrap justify-center gap-2 sm:gap-3">
        {productPreview.map(({ title }, i) => (
          <button
            key={title}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 ${i === active ? `border-transparent bg-gradient-to-r ${gradients[i]} text-white shadow-md` : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}`}
          >
            {title}
          </button>
        ))}
      </div>

      {/* Big matching preview */}
      <div className="sr sr-scale mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        <div className={`relative h-72 overflow-hidden bg-gradient-to-br ${gradients[active]} transition-colors duration-500 sm:h-80`}>
          <div key={active} className="mx-auto h-full max-w-md animate-[rise_.5s_ease] px-2 py-10">
            <Visual />
          </div>
          <span className="absolute left-5 top-5 rounded-full bg-white/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            {item.title}
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
          <div className="flex items-center gap-1.5">
            {productPreview.map(({ title }, i) => (
              <button
                key={title}
                type="button"
                aria-label={`Show ${title}`}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── COMMUNITY PILLS ───────────────────────────────────────── */
function CommunityCategoriesRow() {
  return (
    <div className="stagger mt-8 flex flex-wrap justify-center gap-3">
      {communities.map((c) => (
        <span key={c} className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20">
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
      <div className="sr pp-autosheen relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 p-10 text-center text-white shadow-2xl sm:p-16">
        <span className="pp-sheen" aria-hidden />
        <div className="pp-orb pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pp-orb pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" style={{ animationDelay: '2s' }} aria-hidden />
        <div className="relative">
          <Eyebrow text="Get Started" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Start with your role. Grow with your community.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Whether you lead a community, contribute as a member, or partner as a sponsor, GuildOS gives you a trusted system to create and prove impact.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="button inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 px-6 py-3 text-sm font-bold text-indigo-700 shadow transition hover:-translate-y-0.5 hover:shadow-md">
              Join as a member <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#communities" className="button inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
              Start your community
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
    <footer className="content-width border-t border-slate-200 dark:border-slate-800 pb-10 pt-12">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <GuildOSLogo variant="footer" showTagline={false} />
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">Student reputation infrastructure for Africa&apos;s next generation of professionals.</p>
          <div className="mt-5 flex gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
            {socialLinks.filter((s) => s.href).map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">{s.label}</a>
            ))}
          </div>
        </div>
        {Object.values(footerLinks).map((section) => (
          <div key={section.title}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">{section.title}</p>
            {section.links.map((l) => (
              <a key={l.label} href={l.href} className="block py-1 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600">{l.label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        © {new Date().getFullYear()} GuildOS. All rights reserved.
      </div>
    </footer>
  );
}
