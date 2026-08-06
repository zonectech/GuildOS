export function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="h-6 w-44 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-3/5 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-4 w-28 animate-pulse rounded-full bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-950" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="h-5 w-36 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-950" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
