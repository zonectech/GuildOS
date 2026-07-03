export type DashboardActivityItem = {
  id: string;
  label: string;
  detail: string;
  time: string;
};

export function DashboardActivityFeed({ activities }: { activities: DashboardActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">Recent Activity</h2>
      <div className="mt-4 space-y-4">
        {activities.length ? (
          activities.map((item) => (
            <article key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-slate-950">{item.label}</h3>
                  <span className="shrink-0 text-xs text-slate-400">{item.time}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No recent activity yet.</p>
        )}
      </div>
    </section>
  );
}