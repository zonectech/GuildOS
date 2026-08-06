import type { ReactNode } from 'react';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

const BOX: Record<LogoSize, string> = {
  sm: 'h-8 w-8 rounded-lg text-sm',
  md: 'h-10 w-10 rounded-xl text-base',
  lg: 'h-12 w-12 rounded-xl text-lg',
  xl: 'h-16 w-16 rounded-2xl text-2xl',
};

/** The GuildOS brand mark (the indigo "G"). */
export function Logo({ size = 'sm', className = '' }: { size?: LogoSize; className?: string }) {
  return (
    <span className={`grid place-items-center bg-indigo-600 font-bold text-white ${BOX[size]} ${className}`.trim()}>G</span>
  );
}

export function LogoWithName({ subtitle, size = 'md' }: { subtitle?: ReactNode; size?: LogoSize }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo size={size} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">GuildOS</span>
        {subtitle ? <span className="block text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</span> : null}
      </span>
    </span>
  );
}
