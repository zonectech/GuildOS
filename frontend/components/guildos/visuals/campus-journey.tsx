'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, MapPin, Sparkles, Users } from 'lucide-react';

import { CAST, Person, PeopleCluster } from './illustrated-people';

/**
 * "What GuildOS actually does" in four scenes: find a community → register → check in → get
 * certified. Built from UI-shaped pieces (not screenshots) so it stays crisp and themeable.
 * Auto-plays; pauses on hover/focus and for people who prefer reduced motion.
 */
const STEPS = [
  { label: 'Find your community', short: 'Find' },
  { label: 'Register for an event', short: 'Register' },
  { label: 'Check in with your QR', short: 'Check in' },
  { label: 'Get a verified certificate', short: 'Get certified' },
] as const;

const SCENE_MS = 3400;

// A fixed, QR-looking pattern (decorative, not a real code).
const QR_CELLS = [
  '111111101011111111',
  '100000101010000001',
  '101110100110111101',
  '101110101001011101',
  '101110100111011101',
  '100000101010000001',
  '111111101011111111',
  '000000001100000000',
  '110101110011011010',
  '011010001101100111',
  '101101110010110101',
  '000000001011001010',
  '111111100110101101',
  '100000101101100110',
  '101110100011011011',
  '101110101100110100',
  '100000100110011011',
  '111111101011101101',
];

function SceneFind() {
  const clubs = [
    { name: 'Campus Tech Club', meta: 'Tech · 412 members', tint: 'from-indigo-500 to-violet-500', joined: true },
    { name: 'Debate & Public Speaking', meta: 'Academic · 186 members', tint: 'from-amber-500 to-orange-500', joined: false },
    { name: 'Robotics Society', meta: 'Engineering · 97 members', tint: 'from-emerald-500 to-teal-500', joined: false },
  ];
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Communities at your university</p>
      {clubs.map((c, i) => (
        <div key={c.name} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900" style={{ animation: `rise .5s ease ${i * 0.12}s both` }}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.tint} text-sm font-bold text-white`}>{c.name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.meta}</p>
          </div>
          {c.joined ? (
            <span className="pp-ringpulse inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white"><Check className="h-3 w-3" /> Joined</span>
          ) : (
            <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Join</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SceneRegister() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" style={{ animation: 'rise .5s ease both' }}>
      <div className="relative h-24 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500">
        <span className="absolute left-3 top-3 grid place-items-center rounded-lg bg-white/95 px-2 py-0.5 text-center">
          <span className="text-[9px] font-bold uppercase text-rose-500">Oct</span>
          <span className="text-base font-bold leading-none text-slate-900">12</span>
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">FREE</span>
      </div>
      <div className="space-y-1.5 p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Workshop</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Build Day: Intro to AI</p>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><CalendarDays className="h-3 w-3" /> Sat · 10:00 AM</p>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><MapPin className="h-3 w-3" /> Main Auditorium</p>
        <div className="flex items-center justify-between pt-1.5">
          <PeopleCluster count={4} size={22} offset={2} />
          <span className="pp-pop inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
            <Check className="h-3 w-3" /> You&apos;re in!
          </span>
        </div>
      </div>
    </div>
  );
}

function SceneCheckIn() {
  return (
    <div className="flex flex-col items-center gap-3" style={{ animation: 'rise .5s ease both' }}>
      <div className="relative rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-white">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${QR_CELLS.length}, 1fr)` }} aria-hidden>
          {QR_CELLS.flatMap((row, r) => row.split('').map((c, i) => (
            <span key={`${r}-${i}`} className={`h-[7px] w-[7px] rounded-[1px] ${c === '1' ? 'bg-slate-900' : 'bg-transparent'}`} />
          )))}
        </div>
        <span className="pp-scan absolute inset-x-2 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,.7)]" />
      </div>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Your personal QR pass</p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30" style={{ animation: 'rise .5s ease .6s both' }}>
        <BadgeCheck className="h-4 w-4" /> Checked in · 9:58 AM
      </span>
    </div>
  );
}

function SceneCertified() {
  return (
    <div className="space-y-3" style={{ animation: 'rise .5s ease both' }}>
      <div className="relative rounded-2xl border-4 border-double border-amber-300/80 bg-[#fffdf7] p-4 text-center shadow-sm">
        <p className="font-serif text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Certificate of Attendance</p>
        <p className="mt-1 text-[10px] text-slate-500">presented to</p>
        <p className="mt-0.5 font-serif text-lg font-bold text-slate-900">Amaka Okonkwo</p>
        <p className="text-[10px] text-slate-500">for participating in Build Day: Intro to AI</p>
        <span className="pp-seal absolute -right-2 -top-2 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow">
          <BadgeCheck className="h-5 w-5" />
        </span>
        <p className="mt-2 font-mono text-[9px] text-slate-400">GLD-2026-000412 · scan to verify</p>
      </div>
      <div className="flex items-center justify-center gap-2" style={{ animation: 'rise .5s ease .5s both' }}>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white"><Sparkles className="h-3.5 w-3.5" /> +10 Guild Score</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">Added to your CV</span>
      </div>
    </div>
  );
}

const SCENES = [SceneFind, SceneRegister, SceneCheckIn, SceneCertified];

export function CampusJourney({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [step, paused, reducedMotion]);

  const Scene = SCENES[step];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Floating people — the community around you */}
      {!compact && (
        <>
          <span className="pp-bob absolute -left-6 top-10 z-10 hidden rounded-full shadow-lg ring-4 ring-white sm:block dark:ring-slate-950" style={{ animationDelay: '0s' }}>
            <Person look={CAST[0]} size={56} />
          </span>
          <span className="pp-bob absolute -right-4 top-1/3 z-10 hidden rounded-full shadow-lg ring-4 ring-white sm:block dark:ring-slate-950" style={{ animationDelay: '.8s' }}>
            <Person look={CAST[1]} size={48} />
          </span>
          <span className="pp-bob absolute -bottom-4 left-8 z-10 hidden rounded-full shadow-lg ring-4 ring-white sm:block dark:ring-slate-950" style={{ animationDelay: '1.6s' }}>
            <Person look={CAST[4]} size={44} />
          </span>
        </>
      )}

      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-100 via-violet-50 to-sky-100 p-5 shadow-2xl ring-1 ring-indigo-100 sm:p-7 dark:from-indigo-950/60 dark:via-slate-900 dark:to-sky-950/50 dark:ring-indigo-900/50">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/20" aria-hidden />
        <div className="relative mx-auto max-w-sm">
          {/* App chrome */}
          <div className="rounded-[1.5rem] bg-slate-50/90 p-4 shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-950/80 dark:ring-white/10">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"><Users className="h-3.5 w-3.5 text-indigo-500" /> GuildOS</span>
              <span className="text-[10px] font-semibold text-slate-400">Step {step + 1} of {STEPS.length}</span>
            </div>
            <div className={`${compact ? 'min-h-[230px]' : 'min-h-[270px]'} flex flex-col justify-center`} aria-live="polite">
              <Scene key={step} />
            </div>
          </div>

          {/* Steps — clickable */}
          <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="How GuildOS works">
            {STEPS.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  title={s.label}
                  className={`w-full rounded-xl px-1.5 py-2 text-center text-[10px] font-semibold leading-tight transition sm:text-[11px] ${
                    i === step
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white/70 text-slate-600 hover:bg-white dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  <span className="block text-[9px] opacity-70">{i + 1}</span>
                  {s.short}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
