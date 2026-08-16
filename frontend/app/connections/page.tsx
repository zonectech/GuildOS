'use client';

import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../components/guildos/ui/loading';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, UserMinus, Check, X, Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { StudentNavRail } from '../../components/guildos/student-nav-rail';
import { startConversation } from '../../components/guildos/message-api';
import {
  getConnectionRequests,
  getConnections,
  getPeopleYouMayKnow,
  removeConnection,
  respondToConnection,
  sendConnectionRequest,
  resolvePersonAvatar,
  type ConnectionPerson,
  type PendingRequest,
  type SuggestedPerson,
} from '../../components/guildos/connection-api';

function Avatar({ person, size = 'h-11 w-11' }: { person: { fullName: string; avatar: string }; size?: string }) {
  const src = resolvePersonAvatar(person.avatar);
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:text-slate-400`}>{person.fullName.slice(0, 1)}</span>
  );
}

export default function ConnectionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionPerson[]>([]);
  const [count, setCount] = useState(0);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedPerson[]>([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      const [c, r, s] = await Promise.allSettled([getConnections(), getConnectionRequests(), getPeopleYouMayKnow()]);
      if (cancelled) return;
      if (c.status === 'fulfilled') {
        setConnections(c.value.connections);
        setCount(c.value.count);
      }
      if (r.status === 'fulfilled') setRequests(r.value.requests);
      if (s.status === 'fulfilled') setSuggestions(s.value.suggestions);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function respond(userId: string, accept: boolean) {
    try {
      setBusy(userId);
      await respondToConnection(userId, accept);
      const accepted = requests.find((q) => q.requester.id === userId);
      setRequests((list) => list.filter((q) => q.requester.id !== userId));
      if (accept && accepted) {
        setConnections((list) => [accepted.requester, ...list]);
        setCount((n) => n + 1);
      }
    } finally {
      setBusy('');
    }
  }

  async function connect(userId: string) {
    try {
      setBusy(userId);
      await sendConnectionRequest(userId);
      setSuggestions((list) => list.filter((p) => p.id !== userId));
    } finally {
      setBusy('');
    }
  }

  async function message(userId: string) {
    try {
      setBusy(userId);
      const { conversationId } = await startConversation(userId);
      router.push(`/messages?c=${conversationId}`);
    } finally {
      setBusy('');
    }
  }

  async function disconnect(person: ConnectionPerson) {
    if (!(await confirmDialog({ title: `Remove ${person.fullName}?`, message: 'They will be removed from your connections.', confirmLabel: 'Remove', tone: 'danger' }))) return;
    try {
      setBusy(person.id);
      await removeConnection(person.id);
      setConnections((list) => list.filter((p) => p.id !== person.id));
      setCount((n) => Math.max(0, n - 1));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav />
      <main className="mx-auto flex max-w-6xl items-start gap-6 px-4 py-8">
        <StudentNavRail active="/connections" />
        <div className="min-w-0 flex-1">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-950 dark:text-white"><Users className="h-6 w-6" /> Connections <span className="text-base font-normal text-slate-400 dark:text-slate-500">({count})</span></h1>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm"><LogoSpinner /></div>
        ) : (
          <div className="space-y-6">
            {requests.length ? (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Requests <span className="text-slate-400 dark:text-slate-500">({requests.length})</span></h2>
                <div className="mt-3 space-y-2">
                  {requests.map((q) => (
                    <div key={q.requester.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                      <Avatar person={q.requester} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${encodeURIComponent(q.requester.username)}`} className="truncate text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">{q.requester.fullName}</Link>
                        {q.requester.headline ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{q.requester.headline}</p> : null}
                      </div>
                      <button onClick={() => void respond(q.requester.id, true)} disabled={busy === q.requester.id} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"><Check className="h-4 w-4" /> Accept</button>
                      <button onClick={() => void respond(q.requester.id, false)} disabled={busy === q.requester.id} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 disabled:opacity-60"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {suggestions.length ? (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">People you may know</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {suggestions.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                      <Avatar person={p} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${encodeURIComponent(p.username)}`} className="truncate text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">{p.fullName}</Link>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.reason}</p>
                      </div>
                      <button onClick={() => void connect(p.id)} disabled={busy === p.id} className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"><UserPlus className="h-4 w-4" /> Connect</button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Your connections <span className="text-slate-400 dark:text-slate-500">({count})</span></h2>
              {connections.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {connections.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                      <Avatar person={p} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${encodeURIComponent(p.username)}`} className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">{p.fullName}</Link>
                        {p.headline ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.headline}</p> : null}
                      </div>
                      <button onClick={() => void message(p.id)} disabled={busy === p.id} className="shrink-0 rounded-full border border-slate-200 dark:border-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Message</button>
                      <button onClick={() => void disconnect(p)} disabled={busy === p.id} title="Disconnect" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"><UserMinus className="h-3.5 w-3.5" /> Disconnect</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">No connections yet. Connect with people you know from your communities and campus.</p>
              )}
            </section>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
