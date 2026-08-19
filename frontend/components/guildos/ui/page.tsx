import type { ReactNode } from 'react';
import { cx } from './cx';

type PageShellProps = {
  children: ReactNode;
  nav?: ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  contentClassName?: string;
};

const maxWidthClasses: Record<NonNullable<PageShellProps['maxWidth']>, string> = {
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-[1600px]',
  full: 'max-w-none',
};

export function PageShell({ children, nav, maxWidth = 'lg', className, contentClassName }: PageShellProps) {
  return (
    <div className={cx('guild-page min-h-screen antialiased', className)}>
      {nav}
      <main className={cx('mx-auto w-full space-y-6 px-4 pb-24 pt-8 sm:pb-28', maxWidthClasses[maxWidth], contentClassName)}>
        {children}
      </main>
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, action, children, className }: PageHeaderProps) {
  return (
    <header className={cx('guild-surface flex flex-col gap-4 rounded-3xl border p-5 shadow-sm sm:p-6 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">{description}</p> : null}
      </div>
      {action || children ? <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">{action ?? children}</div> : null}
    </header>
  );
}

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export function Surface({ children, className, interactive = false }: SurfaceProps) {
  return (
    <section
      className={cx(
        'guild-surface rounded-3xl border shadow-sm',
        interactive && 'transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md',
        className,
      )}
    >
      {children}
    </section>
  );
}

type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('guild-surface rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center', className)}>
      {icon ? <div className="mx-auto grid h-10 w-10 place-items-center text-slate-300">{icon}</div> : null}
      {title ? <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2> : null}
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

