export type WorkspaceMetric = { label: string; value: string; note: string };

/** A single summary row keeps operational totals readable without a wall of cards. */
export function WorkspaceMetrics({ items }: { items: WorkspaceMetric[] }) {
  return <dl className="grid grid-cols-2 divide-x divide-slate-200 border-y border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-4">
    {items.map(item => <div key={item.label} className="min-w-0 px-4 py-5 sm:px-6">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</dt>
      <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">{item.value}</dd>
      <dd className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.note}</dd>
    </div>)}
  </dl>;
}
