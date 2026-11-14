'use client';
import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { api, friendlyError } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/ui/toast';

/** "Resend link": sends the verification email again, then waits a minute before allowing another. */
export function ResendVerification({ email, className = '' }: { email: string; className?: string }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  async function send() {
    setState('sending');
    try { await api('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }); toast(`Sent. Check ${email} (and spam).`); setState('sent'); setTimeout(() => setState('idle'), 60_000); }
    catch (e) { toast(friendlyError(e)); setState('idle'); }
  }
  return (
    <button type="button" onClick={() => void send()} disabled={state !== 'idle'} className={`font-bold underline underline-offset-2 disabled:no-underline disabled:opacity-70 ${className}`}>
      {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Link sent' : 'Resend link'}
    </button>
  );
}

/**
 * For signed-in people who haven't confirmed their email. They can browse and register as usual;
 * certificates and starting a community wait until they verify.
 */
export function VerifyEmailBanner() {
  const { user } = useSession();
  if (!user || user.emailVerified !== false) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[color-mix(in_srgb,var(--gold)_32%,var(--surface))] px-4 py-2.5 text-center text-[14px] font-semibold text-ink">
      <MailWarning size={16} className="shrink-0" />
      <span>Verify your email to get certificates and start a community. We sent a link to <b>{user.email}</b>.</span>
      <ResendVerification email={user.email} />
    </div>
  );
}
