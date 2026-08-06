import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { GraduationCap, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { cx } from './ui/cx';

type AppMode = 'student' | 'community' | 'admin';
type ModeSwitchTone = 'light' | 'dark';

type ModeSwitchProps = {
  active: AppMode;
  tone?: ModeSwitchTone;
  compact?: boolean;
  onNavigate?: () => void;
  showAdmin?: boolean;
};

const modes: Array<{ key: AppMode; label: string; href: string; icon: LucideIcon }> = [
  { key: 'student', label: 'Student', href: '/home', icon: GraduationCap },
  { key: 'community', label: 'Community', href: '/dashboard', icon: LayoutDashboard },
  { key: 'admin', label: 'Admin', href: '/dashboard/admin', icon: ShieldCheck },
];

export function ModeSwitch({ active, tone = 'light', compact = false, onNavigate, showAdmin = false }: ModeSwitchProps) {
  const visibleModes = showAdmin ? modes : modes.filter((mode) => mode.key !== 'admin');
  const dark = tone === 'dark';

  return (
    <nav
      aria-label="Workspace mode"
      className={cx(
        'grid gap-1 rounded-2xl border p-1',
        compact ? 'grid-cols-1' : showAdmin ? 'grid-cols-3' : 'grid-cols-2',
        dark ? 'border-white/10 bg-white/5' : 'border-slate-200 dark:border-slate-800 bg-white/90',
      )}
    >
      {visibleModes.map((mode) => {
        const Icon = mode.icon;
        const selected = active === mode.key;

        return (
          <Link
            key={mode.key}
            href={mode.href}
            onClick={onNavigate}
            aria-current={selected ? 'page' : undefined}
            className={cx(
              'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
              compact && 'justify-start',
              selected
                ? dark
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white'
                  : 'bg-slate-900 text-white shadow-sm'
                : dark
                  ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{compact && mode.key === 'community' ? 'Community Mode' : mode.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
