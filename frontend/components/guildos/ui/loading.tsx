type SpinnerSize = 'sm' | 'md' | 'lg';

const BOX: Record<SpinnerSize, string> = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-14 w-14 rounded-2xl',
  lg: 'h-20 w-20 rounded-3xl',
};

/** Branded loader: the GuildOS "G" draws itself like handwriting, on repeat. */
export function LogoSpinner({ size = 'md' }: { size?: SpinnerSize }) {
  return (
    <span className={`grid place-items-center bg-indigo-600 shadow-sm ${BOX[size]}`} role="status" aria-label="Loading">
      <svg viewBox="0 0 48 48" className="h-3/5 w-3/5 text-white" fill="none" aria-hidden>
        <path
          d="M31 15 a13 13 0 1 0 2 18 v-7 h-7"
          pathLength={1}
          className="g-draw"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Inline loading block with the branded spinner and optional label. */
export function Loading({ label = 'Loading…', size = 'md', className = '' }: { label?: string; size?: SpinnerSize; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`.trim()}>
      <LogoSpinner size={size} />
      {label ? <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p> : null}
    </div>
  );
}

/** Full-viewport branded loader for page-level loading states. */
export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="guild-page grid min-h-screen place-items-center">
      <Loading label={label} size="lg" />
    </div>
  );
}
