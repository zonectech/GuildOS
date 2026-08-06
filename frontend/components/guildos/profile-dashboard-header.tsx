'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui/card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ProfileDashboardHeaderProps = {
  fullName: string;
  title?: string;
  username?: string;
  joinDate?: string;
  avatar?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED' | 'public' | 'private' | 'unlisted' | string;
  completion?: number;
  missingFields?: string[];
  stats?: Array<{ label: string; value: string | number }>;
  meterVariant?: 'default' | 'public';
};

function normalizeAvatarUrl(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  if (avatar.startsWith('/uploads/')) {
    return `${API_BASE_URL}${avatar}`;
  }
  if (avatar.startsWith('/')) {
    return `${API_BASE_URL}${avatar}`;
  }
  return `${API_BASE_URL}/uploads/${avatar}`;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function clampCompletion(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getVisibilityLabel(visibility?: string) {
  if (!visibility) return 'Hidden';
  if (visibility === 'PUBLIC' || visibility === 'public') return 'Public';
  if (visibility === 'PRIVATE' || visibility === 'private') return 'Private';
  if (visibility === 'UNLISTED' || visibility === 'unlisted') return 'Unlisted';
  return visibility;
}

function CircularMeter({ percent, variant = 'default' }: { percent: number; variant?: 'default' | 'public' }) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const radius = variant === 'public' ? 32 : 34;
  const strokeWidth = variant === 'public' ? 6 : 7;
  const size = variant === 'public' ? 78 : 84;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const isStrong = percent >= 80;
  const isMedium = percent >= 50;
  const ringClass = isStrong ? 'text-emerald-300' : isMedium ? 'text-amber-300' : 'text-rose-300';
  const trackColor = isStrong ? 'rgba(110, 231, 183, 0.2)' : isMedium ? 'rgba(252, 211, 77, 0.2)' : 'rgba(251, 113, 133, 0.2)';
  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference;

  useEffect(() => {
    setAnimatedPercent(0);
    const id = window.setTimeout(() => setAnimatedPercent(percent), 90);
    return () => window.clearTimeout(id);
  }, [percent]);

  return (
    <div className={`relative flex ${variant === 'public' ? 'h-[78px] w-[78px]' : 'h-[84px] w-[84px]'} items-center justify-center rounded-full bg-white/10 shadow-inner shadow-black/10 ring-1 ring-white/15`}>
      <svg height={size} width={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 transform">
        <circle stroke={trackColor} fill="transparent" strokeWidth={strokeWidth} r={normalizedRadius} cx={size / 2} cy={size / 2} />
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={size / 2}
          cy={size / 2}
          className={`${ringClass} transition-[stroke-dashoffset] duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`font-semibold text-white tabular-nums ${variant === 'public' ? 'text-base' : 'text-lg'}`}>{animatedPercent}%</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">
          {isStrong ? 'Great' : isMedium ? 'Good' : 'Start'}
        </span>
      </div>
    </div>
  );
}

export function ProfileDashboardHeader({
  fullName,
  title,
  username,
  joinDate,
  avatar,
  visibility,
  completion = 0,
  missingFields = [],
  stats = [],
  meterVariant = 'default',
}: ProfileDashboardHeaderProps) {
  const percent = clampCompletion(completion);
  const visibilityLabel = getVisibilityLabel(visibility);
  const isComplete = percent >= 100;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 p-0 shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-600 px-6 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-lg font-semibold text-white ring-1 ring-white/20">
                {avatar ? (
                  <img
                    src={normalizeAvatarUrl(avatar)}
                    alt={fullName}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                      const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span className={avatar ? 'hidden' : 'flex'}>{getInitials(fullName) || 'U'}</span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">{fullName}</h1>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/90 ring-1 ring-white/20">
                    {visibilityLabel}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ring-1 ${isComplete ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-200/30' : 'bg-white/15 text-white/90 ring-white/20'}`}>
                    {isComplete ? 'Complete' : `${percent}% complete`}
                  </span>
                </div>
                {title ? <p className="mt-1 text-white/90">{title}</p> : null}
                {username ? <p className="mt-1 text-sm text-white/75">@{username}</p> : null}
                {joinDate ? <p className="mt-1 text-sm text-white/75">Joined {new Date(joinDate).toLocaleDateString('en-NG')}</p> : null}
              </div>
            </div>

            <div className="flex w-full max-w-md items-center gap-4 rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm sm:p-5">
              <CircularMeter percent={percent} variant={meterVariant} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm text-white/80">
                  <span className="font-medium">Completion status</span>
                  <span className="font-semibold text-white tabular-nums">{percent}%</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-white/80">
                  {isComplete ? 'Your profile is fully completed.' : 'Keep filling out missing details to improve your profile.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Suggestions for missing fields</h2>
          <ul className="mt-4 space-y-3">
            {missingFields.length ? (
              missingFields.map((field) => (
                <li key={field} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">+</span>
                  <span>{field}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500 dark:text-slate-400">Your profile looks complete.</li>
            )}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Quick statistics</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}