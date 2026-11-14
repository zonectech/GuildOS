'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { sendFeedback } from '@/lib/api';
import { useSession } from '@/lib/session';
import { BRAND_NAME } from '@/lib/brand';

/** "Send feedback": what to fix or add. Works signed in or not; signed-in messages are linked to the account. */
function FeedbackForm() {
  const { user } = useSession();
  // The page they came from, so "this button does nothing" can be found.
  const from = useSearchParams().get('from') ?? '';
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await sendFeedback({ message: message.trim(), page: from, ...(user ? {} : { email: email.trim() }) }); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send your feedback'); }
    finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <h1>Thank you</h1>
        <p className="muted">We read every message. {user || email ? 'If we need more detail, we will get back to you.' : ''}</p>
        <div className="row"><Link className="btn s" href={from.startsWith('/') ? from : '/'}>Back to where you were</Link><button type="button" className="btn s" onClick={() => { setSent(false); setMessage(''); }}>Send another</button></div>
      </div>
    );
  }
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <h1>Send feedback</h1>
      <p className="muted">Something confusing, broken, or missing? Tell us. {BRAND_NAME} is new and your message decides what we fix next.</p>
      <label className="field"><span>What should we fix or add?</span>
        <textarea className="input area" style={{ minHeight: 150 }} maxLength={2000} required value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="For example: I could not find where to download my certificate." />
      </label>
      {!user ? (
        <label className="field"><span>Your email (optional, if you want a reply)</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="btn p" disabled={busy || message.trim().length < 3}>{busy ? 'Sending…' : 'Send feedback'}</button>
    </form>
  );
}

export default function FeedbackPage() {
  return <div className="wrap page" style={{ maxWidth: 620 }}><Suspense fallback={<p className="empty">Loading…</p>}><FeedbackForm /></Suspense></div>;
}
