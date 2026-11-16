'use client';

const COLORS = ['#138759', '#D8A52F', '#5A85A0', '#C87E62', '#8874A8', '#6E9867', '#AA667F', '#578F8C', '#A6936D', '#747F94'];

/** A labelled pie with the exact values beside it, including categories that currently have zero responses. */
export function SubmissionPie({ title, values }: { title: string; values: { label: string; count: number }[] }) {
  const total = values.reduce((sum, value) => sum + value.count, 0);
  let angle = -Math.PI / 2;
  const parts = values.map((value, index) => {
    const start = angle;
    const sweep = total ? value.count / total * Math.PI * 2 : 0;
    angle += sweep;
    return { ...value, color: COLORS[index % COLORS.length], percent: total ? Math.round(value.count / total * 100) : 0,
      d: `M 80 80 L ${80 + 72 * Math.cos(start)} ${80 + 72 * Math.sin(start)} A 72 72 0 ${sweep > Math.PI ? 1 : 0} 1 ${80 + 72 * Math.cos(angle)} ${80 + 72 * Math.sin(angle)} Z` };
  });
  return <div className="flex min-w-0 flex-col items-center gap-3">
    <svg viewBox="0 0 160 160" width={160} height={160} role="img" aria-label={`${title}. ${total ? parts.map((part) => `${part.label}: ${part.count} (${part.percent}%)`).join('. ') : 'No responses yet.'}`} className="shrink-0">
      <title>{title}</title>
      {!total ? <><circle cx="80" cy="80" r="72" fill="var(--mist)" /><text x="80" y="85" textAnchor="middle" fontSize="14" fill="var(--muted)">No responses</text></>
        : parts.filter((part) => part.count > 0).map((part) => part.count === total ? <circle key={part.label} cx="80" cy="80" r="72" fill={part.color}><title>{part.label}: {part.count} ({part.percent}%)</title></circle>
          : <path key={part.label} d={part.d} fill={part.color} stroke="var(--surface)" strokeWidth="2"><title>{part.label}: {part.count} ({part.percent}%)</title></path>)}
    </svg>
    <ul className="flex w-full min-w-0 flex-col gap-2">{parts.map((part) => <li key={part.label} className="flex min-w-0 items-start gap-2 text-[13px]"><span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: part.color }} /><span className="min-w-0 flex-1 break-words">{part.label}</span><b className="shrink-0 tabular-nums">{part.count} · {part.percent}%</b></li>)}</ul>
  </div>;
}
