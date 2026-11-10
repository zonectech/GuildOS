'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft } from 'lucide-react';
import { emailPrefs, setEmailPrefs } from '@/lib/api/session';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { readAlertPrefs, saveAlertPrefs, type AlertPrefs } from '@/components/shell/live';
import { useToast } from '@/components/ui/toast';

function Switch({ on, onChange, title, body }: { on: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line p-4 text-left hover:bg-mist">
      <span><b className="block text-[15px]">{title}</b><small className="text-[13px] text-muted">{body}</small></span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-green' : 'bg-line'}`}><m.span layout transition={spring.snap} className={`absolute top-1 size-5 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} /></span>
    </button>
  );
}

/** Email and pop-up alert preferences (opened from the gear on Notifications). */
export default function NotificationSettings() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useSession();
  const [email, setEmail] = useState<boolean | null>(null);
  const [alerts, setAlerts] = useState<AlertPrefs | null>(null);
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/notifications/settings'); }, [loading, user, router]);
  useEffect(() => { if (user) { emailPrefs().then((p) => setEmail(p.newEventEmailEnabled)).catch(() => setEmail(true)); setAlerts(readAlertPrefs()); } }, [user]);
  const setAlert = (k: keyof AlertPrefs, v: boolean) => setAlerts((a) => { const next = { ...(a ?? readAlertPrefs()), [k]: v }; saveAlertPrefs(next); return next; });
  if (!user || email === null || !alerts) return <div className="mx-auto max-w-[640px] px-4 pt-10"><div className="shimmer h-[320px] rounded-[24px]" /></div>;
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:pt-10">
      <Link href="/notifications" className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />Notifications</Link>
      <h1 className="text-[34px] font-extrabold">Notification settings</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-extrabold">Email</h2>
        <Switch on={email} onChange={(v) => { setEmail(v); void setEmailPrefs(v).then(() => toast('Saved')).catch(() => { setEmail(!v); toast('Unable to save'); }); }} title="New events from my communities" body="An email when a community you're in publishes an event." />
        <p className="text-[13px] text-muted">Registration confirmations, reminders, venue changes and cancellations are always emailed, because you may need them at the door.</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-extrabold">Pop-up alerts on this device</h2>
        <Switch on={alerts.chats} onChange={(v) => setAlert('chats', v)} title="Chat replies" body="When a community replies and you're not already in that chat." />
        <Switch on={alerts.eventUpdates} onChange={(v) => setAlert('eventUpdates', v)} title="Event updates" body="Venue or time changes and cancellations for events you registered for." />
        <Switch on={alerts.stamps} onChange={(v) => setAlert('stamps', v)} title="Stamps and certificates" body="When a stamp lands on your passport or a certificate is ready." />
        <p className="text-[13px] text-muted">Everything still shows in your Inbox and Notifications; these only control the pop-ups.</p>
      </section>
    </div>
  );
}
