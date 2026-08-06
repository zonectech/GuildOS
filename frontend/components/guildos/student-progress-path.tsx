import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Award, CalendarDays, CheckCircle2, FileText, UserRoundCheck, Users } from 'lucide-react';
import { cx } from './ui/cx';

type StudentProgressPathProps = {
  profileCompletion: number;
  communitiesJoined: number;
  upcomingEvents: number;
  certificatesEarned: number;
  compact?: boolean;
  className?: string;
};

type Step = {
  label: string;
  detail: string;
  href: string;
  complete: boolean;
  icon: LucideIcon;
};

export function StudentProgressPath({
  profileCompletion,
  communitiesJoined,
  upcomingEvents,
  certificatesEarned,
  compact = false,
  className,
}: StudentProgressPathProps) {
  const steps: Step[] = [
    {
      label: 'Complete profile',
      detail: `${Math.min(profileCompletion, 100)}% complete`,
      href: '/account',
      complete: profileCompletion >= 100,
      icon: UserRoundCheck,
    },
    {
      label: 'Join communities',
      detail: communitiesJoined ? `${communitiesJoined} joined` : 'Find your first guild',
      href: '/communities',
      complete: communitiesJoined > 0,
      icon: Users,
    },
    {
      label: 'Attend events',
      detail: upcomingEvents ? `${upcomingEvents} upcoming` : 'Register for an event',
      href: '/events',
      complete: upcomingEvents > 0,
      icon: CalendarDays,
    },
    {
      label: 'Earn certificates',
      detail: certificatesEarned ? `${certificatesEarned} earned` : 'Complete verified events',
      href: '/events',
      complete: certificatesEarned > 0,
      icon: Award,
    },
    {
      label: 'Build your CV',
      detail: 'Turn activity into proof',
      href: '/cv',
      complete: certificatesEarned > 0 && profileCompletion >= 80,
      icon: FileText,
    },
  ];
  const completed = steps.filter((step) => step.complete).length;

  return (
    <section className={cx('overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/50 to-white shadow-sm', compact ? 'p-4' : 'p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Student path</p>
          <h2 className={cx('mt-1 font-semibold tracking-tight text-slate-950 dark:text-white', compact ? 'text-base' : 'text-lg')}>Your next best actions</h2>
          {!compact ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Follow the path from campus activity to portfolio-ready proof.</p> : null}
        </div>
        <span className="rounded-full bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-800">
          {completed}/{steps.length} done
        </span>
      </div>

      <div className={cx('mt-4 grid gap-2', !compact && 'sm:grid-cols-2')}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.label}
              href={step.href}
              className={cx(
                'group flex items-center gap-3 rounded-2xl border bg-white/85 px-3 py-3 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-sm',
                step.complete ? 'border-emerald-100' : 'border-slate-200 dark:border-slate-800',
              )}
            >
              <span
                className={cx(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                  step.complete ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600',
                )}
              >
                {step.complete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {index + 1}. {step.label}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{step.detail}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
