'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { contactCommunity } from '@/lib/api/inbox';
import { useSession } from '@/lib/session';
import { Btn } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

/** "Contact the host": a short message to the community's team, then straight to the chat. */
export function ContactButton({ communityId, communityName, eventId, eventTitle, label = 'Contact the host', kind = 'secondary', wide }: {
  communityId: string; communityName: string; eventId?: string; eventTitle?: string; label?: string; kind?: 'secondary' | 'primary'; wide?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(eventTitle ? `Hi! A question about ${eventTitle}: ` : '');
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try { const id = await contactCommunity(communityId, msg.trim(), eventId); setOpen(false); router.push(`/inbox?chat=${id}`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Not sent'); } finally { setBusy(false); }
  }
  return (
    <>
      <Btn kind={kind} wide={wide} onClick={() => (user ? setOpen(true) : router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`))}><MessageCircle size={16} />{label}</Btn>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Message ${communityName}`}>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <p className="text-[14px] text-muted">Goes to the community&apos;s leaders. Replies show up in your Inbox.</p>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} aria-label="Your message" className="min-h-[120px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text" />
          <Btn wide size="lg" onClick={() => void send()} disabled={busy || msg.trim().length < 2}>{busy ? 'Sending…' : 'Send'}</Btn>
        </div>
      </Sheet>
    </>
  );
}
