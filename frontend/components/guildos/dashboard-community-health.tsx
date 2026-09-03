export type HealthMetric = { label: string; value: string };

export function DashboardCommunityHealth({ metrics, status = 'Healthy', tone = 'healthy' }: { metrics: HealthMetric[]; status?: string; tone?: 'healthy' | 'warning' | 'neutral' }) {
  const toneClass =
    tone === 'warning'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
      : tone === 'neutral'
        ? 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Community Health</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A quick pulse on participation and operational status.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${toneClass}`}>{status}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}