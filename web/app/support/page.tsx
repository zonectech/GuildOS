import Link from 'next/link';
import { LegalTabs } from '@/components/legal-page';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = { title: `Support | ${BRAND_NAME}` };

// Answers match how the first version works: free events, certificates at check-out.
const FAQS = [
  { q: 'I can’t log in to my account', a: 'Use “Forgot password” on the log in page to reset it. If your email was never verified, sign in and we will offer to send a new verification link.' },
  { q: 'I attended an event but didn’t get a certificate', a: 'Certificates go out when you scan out at or after the event’s end time, and only if the event offers one. If you left without scanning out, the organizer cannot issue one later. Contact them through the details on the event page.' },
  { q: 'How do I verify a certificate someone shared with me?', a: 'Every certificate has its own link and QR code. Opening it shows the live verification page. If the certificate was revoked, the page says so.' },
  { q: 'How do I start a community?', a: 'Open Communities and choose Create community. Our team reviews each new community once. After that you can run events with no more approval.' },
] as const;

export default function SupportPage() {
  return (
    <div className="wrap page" style={{ maxWidth: 760 }}>
      <LegalTabs current="support" />
      <h1>Support</h1>
      <p className="muted">Most answers are below. For anything else, email the team at <a className="lk" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. To tell us what to fix or add, <Link className="lk" href="/feedback?from=/support">send feedback</Link>.</p>
      {FAQS.map((f) => (
        <section key={f.q} className="stack" style={{ gap: 6, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
          <h3>{f.q}</h3>
          <p className="prose">{f.a}</p>
        </section>
      ))}
      <p className="small">You can also read our <Link className="lk" href="/terms">Terms</Link> and <Link className="lk" href="/privacy">Privacy policy</Link>.</p>
    </div>
  );
}
