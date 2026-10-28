import Link from 'next/link';
import { UserAvatar } from '../user-avatar';
import type { EventHostPerson } from '../event-api';
export function EventJudges({judges=[]}:{judges?:EventHostPerson[]}){
 if(!judges.length)return null;
 return <section aria-label="Judges" className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Judges</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{judges.map(judge=>{const content=<><UserAvatar avatar={judge.avatar} name={judge.name} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{judge.name}</span><span className="block text-xs text-slate-500">Judge</span></span></>;const cls='flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800';return judge.username?<Link key={judge.id} href={'/u/'+encodeURIComponent(judge.username)} className={cls+' hover:border-slate-400'}>{content}</Link>:<div key={judge.id} className={cls}>{content}</div>;})}</div></section>;
}
