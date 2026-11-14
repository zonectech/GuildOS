'use client';
import { ErrorState } from '@/components/ui/error-state';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { BadgeCheck, ChevronRight, FileText, Mail } from 'lucide-react';
import { useLoginGate, useSession } from '@/lib/session';
import { reviewQueue, type CommunityVerificationRequest, type RequestStatus } from '@/lib/api/review';
import { spring } from '@/lib/motion';
import { Crest } from '@/components/brand/crest';
import { SkeletonCard } from '@/components/ui/bits';
import { SwipeRow } from '@/components/ui/swipe-row';
import { DecisionSheet, type DecisionKind } from '@/components/review/decision-sheet';
import { useToast } from '@/components/ui/toast';

const CHIP: Record<RequestStatus, [string, string]> = {
  IN_REVIEW: ['New', 'bg-tint text-green-text'], UPDATED: ['Updated', 'bg-[color-mix(in_srgb,var(--gold)_30%,var(--surface))] text-ink'],
  MORE_INFO: ['Waiting on applicant', 'bg-mist text-muted'], APPROVED: ['Approved', 'bg-tint text-green-text'], DECLINED: ['Declined', 'bg-mist text-muted'],
};
const TABS: [string, (r: CommunityVerificationRequest) => boolean][] = [
  ['To review', (r) => r.status === 'IN_REVIEW' || r.status === 'UPDATED'], ['Waiting on applicant', (r) => r.status === 'MORE_INFO'], ['All', () => true],
];
const ago = (v: string) => { const h = Math.round((Date.now() - new Date(v).getTime()) / 3_600_000); return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

/** The platform reviewers' queue: communities waiting for a decision. Admin accounts only. */
export default function ReviewQueuePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useSession();
  const [list, setList] = useState<CommunityVerificationRequest[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(0);
  const [pending, setPending] = useState<{ r: CommunityVerificationRequest; kind: DecisionKind } | null>(null);
  const load = useCallback(() => { setError(null); return reviewQueue().then(setList).catch(setError); }, []);

  const gate = useLoginGate('/review');
  useEffect(() => { if (user?.role === 'ADMIN') void load(); }, [user, load]);
  if (!user) return gate;
  if (user.role !== 'ADMIN') return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[32px] font-extrabold">Reviewers only</h1><p className="mt-2 text-muted">This page is for platform reviewers.</p></div>;

  const shown = (list ?? []).filter(TABS[tab][1]);
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 lg:pt-10">
      <header><h1 className="text-[40px] font-extrabold">Community requests</h1><p className="mt-1 text-[15.5px] text-muted">Check who is asking and that they&apos;re allowed to run the community. Every decision is kept in the admin log.</p></header>
      <nav className="no-bar flex gap-6 overflow-x-auto border-b border-line" aria-label="Filter">
        {TABS.map(([label, f], i) => (
          <button key={label} type="button" onClick={() => setTab(i)} aria-pressed={tab === i} className={`relative whitespace-nowrap pb-3 text-[15px] font-semibold ${tab === i ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {label} <span className="tabular-nums text-muted">{(list ?? []).filter(f).length}</span>
            {tab === i ? <m.span layoutId="review-tab" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ink" transition={spring.snap} /> : null}
          </button>
        ))}
      </nav>
      {error ? <ErrorState compact error={error} onRetry={() => void load()} /> : null}
      {list === null ? (error ? null : <SkeletonCard />) : !shown.length ? <p className="py-16 text-center text-[15.5px] text-muted">Nothing here. All caught up.</p> : (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {shown.map((r, i) => (
              <m.li key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...spring.soft, delay: i * 0.04 } }} exit={{ opacity: 0, x: -40 }}>
                <SwipeRow onApprove={() => setPending({ r, kind: 'APPROVE' })} onDecline={() => setPending({ r, kind: 'DECLINE' })}>
                  <Link href={`/review/${r.id}`} className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-card hover:bg-mist">
                    <Crest name={r.name} logo={r.logo} size={58} tilt={-6} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[16px]">{r.name}</b>
                      <small className="block truncate text-[13px] text-muted">{r.school} · {r.applicant?.fullName ?? 'Applicant'} · {ago(r.submittedAt)}</small>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${CHIP[r.status][1]}`}>{CHIP[r.status][0]}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[11.5px] font-bold text-muted">
                          {r.method === 'SCHOOL_EMAIL' ? <><Mail size={11} />School email</> : <><FileText size={11} />Letter</>}
                          {r.applicant?.schoolEmailVerified ? <BadgeCheck size={12} className="text-green-text" /> : null}
                        </span>
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" />
                  </Link>
                </SwipeRow>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <p className="text-center text-[12.5px] text-muted sm:hidden">On a phone: swipe right to approve, left to decline.</p>
      <DecisionSheet request={pending?.r ?? null} kind={pending?.kind ?? null} onClose={() => setPending(null)}
        onDone={(k) => { toast(k === 'APPROVE' ? 'Approved' : k === 'DECLINE' ? 'Declined' : 'Question sent'); setPending(null); void load(); }} />
    </div>
  );
}
