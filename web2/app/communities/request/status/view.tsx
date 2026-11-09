'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { Check, FileText, MessageCircleQuestion, Plus } from 'lucide-react';
import { useSession } from '@/lib/session';
import { classic } from '@/lib/api/client';
import { answerReviewer, myRequests, uploadLetter, type CommunityVerificationRequest } from '@/lib/api/review';
import { usePoll } from '@/lib/poll';
import { page, rise } from '@/lib/motion';
import { StatusStepper, stagesFor } from '@/components/flow/status-stepper';
import { Crest } from '@/components/brand/crest';
import { Celebration } from '@/components/celebrate/celebration';
import { Btn, SkeletonCard } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

const SEEN = (id: string) => `otr-approved-seen-${id}`;
const seen = (id: string) => { try { return Boolean(localStorage.getItem(SEEN(id))); } catch { return true; } };

/** Where each of your community requests stands. You can leave and come back; requests are saved. */
export function RequestStatusView() {
  const router = useRouter();
  const sent = useSearchParams().get('sent');
  const toast = useToast();
  const { user, loading } = useSession();
  const [list, setList] = useState<CommunityVerificationRequest[] | null>(null);
  const [answering, setAnswering] = useState<CommunityVerificationRequest | null>(null);
  const [celebrate, setCelebrate] = useState<CommunityVerificationRequest | null>(null);

  const load = useCallback(async () => {
    if (!user) return false;
    const next = await myRequests(user.id);
    let changed = false;
    setList((prev) => { changed = JSON.stringify(prev?.map((r) => [r.id, r.status])) !== JSON.stringify(next.map((r) => [r.id, r.status])); return next; });
    // The big moment, once per approved community.
    const fresh = next.find((r) => r.status === 'APPROVED' && !seen(r.id));
    if (fresh) setCelebrate(fresh);
    return changed;
  }, [user]);

  useEffect(() => { if (!loading && !user) router.replace('/login?next=/communities/request/status'); }, [loading, user, router]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (sent) toast('Sent for review. We’ll let you know.'); }, [sent, toast]);
  // While something is under review, check now and then (paused when the tab is hidden).
  usePoll(load, 20_000, Boolean(list?.some((r) => r.status === 'IN_REVIEW' || r.status === 'UPDATED')));

  const closeCelebration = () => { if (celebrate) { try { localStorage.setItem(SEEN(celebrate.id), '1'); } catch { /* storage blocked */ } } setCelebrate(null); };
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-7 px-4 pt-6 pb-16 sm:px-6 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[40px] font-extrabold">Your community requests</h1><p className="mt-1 text-[15.5px] text-muted">A reviewer checks each request once. You&apos;ll get a notification when there&apos;s news.</p></div>
        <Btn kind="secondary" href="/communities/request"><Plus size={17} />New request</Btn>
      </header>

      {list === null ? <div className="grid gap-4"><SkeletonCard /></div> : !list.length ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-line px-6 py-14 text-center">
          <Crest name="Your community" size={110} tilt={-6} />
          <p className="max-w-sm text-[15.5px] text-muted">You haven&apos;t asked to start a community yet.</p>
          <Btn href="/communities/request">Start a community</Btn>
        </div>
      ) : (
        <m.div variants={page} initial="hidden" animate="show" className="flex flex-col gap-5">
          {list.map((r) => <RequestCard key={r.id} r={r} onAnswer={() => setAnswering(r)} />)}
        </m.div>
      )}

      <AnswerSheet request={answering} onClose={() => setAnswering(null)} onDone={async () => { setAnswering(null); toast('Sent back to the reviewer'); await load(); }} />

      <Celebration open={Boolean(celebrate)} onClose={closeCelebration}
        seal={celebrate ? <Crest name={celebrate.name} logo={celebrate.logo} size={190} tilt={0} /> : null}
        title={`${celebrate?.name ?? ''} is approved`}
        body={<>Your community is verified. You can run events, and every attendee&apos;s stamp carries your crest.</>}
        action={<Btn kind="gold" size="lg" onClick={closeCelebration}>Set up your community</Btn>} />
    </div>
  );
}

function RequestCard({ r, onAnswer }: { r: CommunityVerificationRequest; onAnswer: () => void }) {
  return (
    <m.article variants={rise} className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card">
      <div className="flex items-center gap-4 border-b border-line p-5">
        <Crest name={r.name} logo={r.logo} size={64} tilt={-6} />
        <div className="min-w-0"><b className="block truncate font-display text-[20px]">{r.name}</b><small className="text-[13.5px] text-muted">{r.school} · {r.category} · {r.method === 'SCHOOL_EMAIL' ? 'School email' : 'Authorization letter'}</small></div>
      </div>
      <div className="p-5"><StatusStepper stages={stagesFor(r.status, r.submittedAt, r.decidedAt)} /></div>

      {r.status === 'MORE_INFO' ? (
        <div className="flex flex-col gap-3 border-t border-line bg-[color-mix(in_srgb,var(--gold)_12%,var(--surface))] p-5">
          <b className="flex items-center gap-2 text-[15px]"><MessageCircleQuestion size={18} />The reviewer needs a bit more</b>
          <blockquote className="rounded-2xl border border-line bg-surface px-4 py-3 text-[15px]">{r.infoRequest?.message}</blockquote>
          <Btn onClick={onAnswer} className="self-start">Update your request</Btn>
        </div>
      ) : r.status === 'UPDATED' ? (
        <p className="border-t border-line px-5 py-4 text-[14.5px] text-muted">You answered the reviewer&apos;s question. It&apos;s back in the queue.</p>
      ) : r.status === 'IN_REVIEW' ? (
        <p className="border-t border-line px-5 py-4 text-[14.5px] text-muted">A reviewer will look at it soon. Nothing to do for now.</p>
      ) : r.status === 'DECLINED' ? (
        <div className="flex flex-col gap-2 border-t border-line p-5">
          <b className="text-[15px]">Not approved</b>
          {r.decisionNote ? <blockquote className="rounded-2xl bg-mist px-4 py-3 text-[15px]">{r.decisionNote}</blockquote> : null}
          <p className="text-[14px] text-muted">You can send a new request once you have what the reviewer asked for.</p>
        </div>
      ) : <SetupChecklist r={r} />}
    </m.article>
  );
}

/** After approval: what makes a community ready. Done items tick themselves off. */
function SetupChecklist({ r }: { r: CommunityVerificationRequest }) {
  const items = [
    { label: 'Add a logo', done: Boolean(r.logo), href: `/communities/${r.slug}/manage?tab=settings` },
    { label: 'Add a cover', done: Boolean(r.cover), href: `/communities/${r.slug}/manage?tab=settings` },
    { label: 'Write a bio', done: r.description.trim().length > 40, href: `/communities/${r.slug}/manage?tab=settings` },
    { label: 'Set community rules', done: false, href: `/communities/${r.slug}/manage?tab=settings` },
    { label: 'Invite admins', done: false, href: `/communities/${r.slug}/manage?tab=members` },
    { label: 'Create your first event', done: false, href: `/events/new?community=${r.slug}` },
  ];
  const done = items.filter((i) => i.done).length;
  return (
    <div className="flex flex-col gap-3 border-t border-line p-5">
      <div className="flex items-center justify-between"><b className="text-[15px]">Set up your community</b><span className="text-[13px] font-semibold text-muted tabular-nums">{done} of {items.length} done</span></div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((i, n) => (
          <li key={i.label}>
            <a href={i.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-mist">
              <m.span initial={false} animate={{ scale: i.done ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.3, delay: n * 0.05 }}
                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${i.done ? 'border-green bg-green text-white' : 'border-line'}`}>{i.done ? <Check size={13} strokeWidth={3.5} /> : null}</m.span>
              <span className={`text-[14.5px] ${i.done ? 'text-muted line-through' : 'font-semibold'}`}>{i.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <a href={`/communities/${r.slug}`} className="self-start text-[14px] font-semibold text-green-text hover:underline">Open your community page</a>
    </div>
  );
}

/** Answer the reviewer: a note (required), an updated summary, and optionally a new letter. */
function AnswerSheet({ request, onClose, onDone }: { request: CommunityVerificationRequest | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState('');
  const [letter, setLetter] = useState<{ name: string; path: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setNote(''); setSummary(request?.summary ?? ''); setLetter(null); setError(''); }, [request]);
  const send = async () => {
    if (!request) return;
    setBusy(true); setError('');
    try { await answerReviewer(request.id, { note: note.trim(), summary: summary.trim() !== request.summary ? summary.trim() : undefined, letter: letter?.path }); await onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to send'); }
    finally { setBusy(false); }
  };
  const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text';
  return (
    <Sheet open={Boolean(request)} onClose={onClose} title="Update your request">
      <div className="flex flex-col gap-4 px-5 pb-6">
        {request?.infoRequest ? <blockquote className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]"><b className="mb-1 block text-[12.5px] uppercase tracking-wide text-muted">Reviewer asked</b>{request.infoRequest.message}</blockquote> : null}
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">What you changed or added</span>
          <textarea className={`${field} min-h-[100px]`} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I uploaded a letter signed by our faculty adviser." /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">What your community does</span>
          <textarea className={`${field} min-h-[80px]`} maxLength={160} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line p-3 hover:bg-mist">
          <FileText size={20} className="text-green-text" />
          <span className="text-[14.5px] font-semibold">{letter ? letter.name : 'Add a new letter (optional)'}</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLetter(f).then((r) => setLetter({ name: f.name, path: r.letter })).catch((err: Error) => setError(err.message)); e.target.value = ''; }} />
        </label>
        {error ? <p role="alert" className="text-[14px] font-semibold text-coral-text">{error}</p> : null}
        <Btn wide size="lg" onClick={() => void send()} disabled={busy || note.trim().length < 10}>{busy ? 'Sending…' : 'Send to the reviewer'}</Btn>
      </div>
    </Sheet>
  );
}

