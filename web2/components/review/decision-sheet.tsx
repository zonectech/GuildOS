'use client';
import { useEffect, useState } from 'react';
import type { CommunityVerificationRequest, ReviewDecision } from '@/lib/api/review';
import { decide } from '@/lib/api/review';
import { Btn } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';

export type DecisionKind = ReviewDecision['kind'];

const COPY: Record<DecisionKind, { title: string; label: string; hint: string; required: boolean; button: string; kind: 'primary' | 'secondary' | 'gold' }> = {
  APPROVE: { title: 'Approve this community', label: 'Note (optional)', hint: 'Kept with the decision in the admin log.', required: false, button: 'Approve', kind: 'primary' },
  MORE_INFO: { title: 'Ask for more information', label: 'What do you need?', hint: 'The applicant sees this exactly. Be specific, e.g. "Upload a letter signed by your faculty adviser."', required: true, button: 'Send question', kind: 'gold' },
  DECLINE: { title: 'Decline this request', label: 'Reason', hint: 'Required. The applicant sees it, so be clear and kind.', required: true, button: 'Decline', kind: 'secondary' },
};

/** Approve, ask for more, or decline: each confirmed in a sheet; asking and declining need a message. */
export function DecisionSheet({ request, kind, onClose, onDone }: { request: CommunityVerificationRequest | null; kind: DecisionKind | null; onClose: () => void; onDone: (kind: DecisionKind) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setText(''); setError(''); }, [request, kind]);
  const c = kind ? COPY[kind] : COPY.APPROVE;
  const ok = !c.required || text.trim().length >= 10;
  const send = async () => {
    if (!request || !kind) return;
    setBusy(true); setError('');
    try {
      await decide(request.id, kind === 'APPROVE' ? { kind, note: text.trim() } : kind === 'MORE_INFO' ? { kind, message: text.trim() } : { kind, reason: text.trim() });
      onDone(kind);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the decision'); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={Boolean(request && kind)} onClose={onClose} title={c.title}>
      <div className="flex flex-col gap-4 px-5 pb-6">
        <p className="text-[15px]"><b>{request?.name}</b> · {request?.school}</p>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">{c.label}</span>
          <textarea className="min-h-[110px] w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          <small className="text-[12.5px] text-muted">{c.hint}</small>
        </label>
        {error ? <p role="alert" className="text-[14px] font-semibold text-coral-text">{error}</p> : null}
        <Btn wide size="lg" kind={c.kind} onClick={() => void send()} disabled={busy || !ok}>{busy ? 'Saving…' : c.button}</Btn>
      </div>
    </Sheet>
  );
}
