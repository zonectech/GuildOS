'use client';
import { ErrorState } from '@/components/ui/error-state';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft, BadgeCheck, CircleAlert, ExternalLink, FileText, MessageCircle } from 'lucide-react';
import { useLoginGate, useSession } from '@/lib/session';
import { reviewQueue, type CommunityVerificationRequest } from '@/lib/api/review';
import { page, rise } from '@/lib/motion';
import { Crest } from '@/components/brand/crest';
import { Btn, SkeletonCard } from '@/components/ui/bits';
import { DecisionSheet, type DecisionKind } from '@/components/review/decision-sheet';
import { ChatIcon, chatLabel } from '@/components/brand/chat-icon';
import { useToast } from '@/components/ui/toast';

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <><dt className="text-[13.5px] text-muted">{k}</dt><dd className="min-w-0 break-words text-[15px]">{children}</dd></>
);

/** One request with all its evidence, and the three decisions. Admin accounts only. */
export default function ReviewRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useSession();
  const [r, setR] = useState<CommunityVerificationRequest | null | undefined>(undefined);
  const [kind, setKind] = useState<DecisionKind | null>(null);

  const gate = useLoginGate(`/review/${id}`);
  // A failed load is not "already decided": that only follows from a list that loaded without it.
  const [failed, setFailed] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (user?.role === 'ADMIN') { setFailed(null); reviewQueue().then((l) => setR(l.find((x) => x.id === id) ?? null)).catch(setFailed); } }, [user, id, attempt]);
  if (!user) return gate;
  if (user.role !== 'ADMIN') return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[32px] font-extrabold">Reviewers only</h1></div>;
  if (failed && r === undefined) return <ErrorState error={failed} onRetry={() => setAttempt((n) => n + 1)} />;
  if (r === undefined) return <div className="mx-auto max-w-[900px] px-4 pt-10"><SkeletonCard /></div>;
  if (r === null) return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[28px] font-extrabold">Already decided</h1><p className="mt-2 text-muted">This request is no longer in the queue.</p><Btn className="mt-6" href="/review">Back to the queue</Btn></div>;

  const isImage = /\.(png|jpe?g|webp)$/i.test(r.letter);
  return (
    <m.div variants={page} initial="hidden" animate="show" className="mx-auto flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-28 sm:px-6 lg:pt-10">
      <Link href="/review" className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />Queue</Link>

      <m.section variants={rise} className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card">
        <div className="relative h-36 bg-mist">{r.cover ? <img src={r.cover} alt="" className="size-full object-cover" /> : <div className="size-full bg-[linear-gradient(135deg,var(--tint),var(--mist))]" />}</div>
        <div className="flex items-end gap-4 px-5 pb-4">
          <div className="-mt-12 shrink-0 rounded-full bg-surface p-1 shadow-card"><Crest name={r.name} logo={r.logo} size={96} tilt={0} /></div>
          <div className="min-w-0 pb-1"><h1 className="truncate text-[28px] font-extrabold">{r.name}</h1><p className="text-[14px] text-muted">{r.school} · {r.category}</p></div>
        </div>
        <p className="border-t border-line px-5 py-4 text-[15.5px]">{r.summary}</p>
        {r.description ? <p className="border-t border-line px-5 py-4 text-[14.5px] whitespace-pre-line text-muted">{r.description}</p> : null}
      </m.section>

      {r.infoRequest ? (
        <m.section variants={rise} className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[19px] font-extrabold"><MessageCircle size={18} />Question and answer</h2>
          <p className="text-[14.5px]"><b className="text-muted">You asked:</b> {r.infoRequest.message}</p>
          {r.infoRequest.response ? <p className="rounded-2xl bg-tint px-4 py-3 text-[14.5px]"><b>They answered:</b> {r.infoRequest.response}</p> : <p className="text-[14px] text-muted">No answer yet.</p>}
        </m.section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <m.section variants={rise} className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
          <h2 className="text-[19px] font-extrabold">Who is asking</h2>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
            <Row k="Name">{r.applicant?.fullName ?? 'Unknown'}</Row>
            <Row k="Account">{r.applicant?.email}</Row>
            <Row k="School email">{r.applicant?.schoolEmail ? <span className="inline-flex items-center gap-1.5">{r.applicant.schoolEmail}{r.applicant.schoolEmailVerified ? <BadgeCheck size={16} className="text-green-text" aria-label="verified" /> : <span className="text-[12.5px] font-bold text-coral-text">not verified</span>}</span> : <span className="text-muted">None</span>}</Row>
            <Row k="Profile school">{r.applicant?.university || <span className="text-muted">Not set</span>}</Row>
            <Row k="Their note">{r.note || <span className="text-muted">None</span>}</Row>
          </dl>
        </m.section>
        <m.section variants={rise} className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-5">
          <h2 className="text-[19px] font-extrabold">Evidence</h2>
          <p className="flex items-start gap-2 text-[13.5px] text-muted"><CircleAlert size={15} className="mt-0.5 shrink-0" />A school email shows identity, not authority. Check that they&apos;re allowed to run this community.</p>
          {r.letter ? (
            <a href={r.letter} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-2 rounded-2xl border border-line p-3 hover:bg-mist">
              {isImage ? <img src={r.letter} alt="Authorization letter" className="max-h-64 w-full rounded-xl object-contain" /> : null}
              <span className="flex items-center gap-2 text-[14.5px] font-semibold"><FileText size={17} className="text-green-text" />Open the authorization letter<ExternalLink size={14} className="text-muted" /></span>
            </a>
          ) : <p className="text-[14.5px]">{r.method === 'SCHOOL_EMAIL' ? 'School email only (no letter).' : 'No letter attached.'}</p>}
          {r.chatLinks.length ? <p className="text-[14px]"><span className="text-muted">Group chat: </span><a href={r.chatLinks[0].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-green-text hover:underline"><ChatIcon platform={r.chatLinks[0].platform} url={r.chatLinks[0].url} size={16} />{chatLabel(r.chatLinks[0].platform, r.chatLinks[0].url)}</a></p> : null}
        </m.section>
      </div>

      {/* Decisions stay in reach while scrolling. */}
      <div className="glass sticky bottom-[calc(92px+env(safe-area-inset-bottom))] z-10 flex flex-wrap gap-2 rounded-2xl border border-line p-3 shadow-lift lg:bottom-4">
        <Btn onClick={() => setKind('APPROVE')} className="flex-1">Approve</Btn>
        <Btn kind="gold" onClick={() => setKind('MORE_INFO')} className="flex-1">Request more info</Btn>
        <Btn kind="secondary" onClick={() => setKind('DECLINE')} className="flex-1">Decline</Btn>
      </div>

      <DecisionSheet request={r} kind={kind} onClose={() => setKind(null)}
        onDone={(k) => { toast(k === 'APPROVE' ? `${r.name} approved` : k === 'DECLINE' ? 'Declined' : 'Question sent to the applicant'); router.push('/review'); }} />
    </m.div>
  );
}
