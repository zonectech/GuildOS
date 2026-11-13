import Link from 'next/link';
import { SUPPORT_EMAIL, type LegalSection } from '@/lib/legal';

type LegalPageProps = { current: 'terms' | 'privacy' | 'support'; title: string; updated?: string; sections?: readonly LegalSection[] };

const tabs = [['terms', 'Terms'], ['privacy', 'Privacy'], ['support', 'Support']] as const;

export function LegalPage({ current, title, updated, sections }: LegalPageProps) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <nav aria-label="Help pages" className="flex flex-wrap gap-2">
        {tabs.map(([path, label]) => <Link key={path} href={'/' + path} aria-current={current === path ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-[14px] font-semibold ${current === path ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-muted hover:text-ink'}`}>{label}</Link>)}
      </nav>
      <header className="flex flex-col gap-2"><h1 className="text-[34px] font-extrabold">{title}</h1>{updated ? <p className="text-[14px] text-muted">Last updated {updated}</p> : null}</header>
      {sections?.map((section) => <section key={section.title} className="flex flex-col gap-2 border-b border-line pb-5"><h2 className="text-[19px] font-extrabold">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="text-[15px] leading-7 text-muted">{paragraph}</p>)}</section>)}
      {current === 'support' ? <SupportFaq /> : null}
      <p className="text-[14px] text-muted">Questions? Email <a className="font-semibold text-green-text hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </article>
  );
}

function SupportFaq() {
  const faqs = [
    { q: 'I can’t log in to my account', a: 'Use “Forgot password” on the log in page to reset it. If your email was never verified, sign in and we will offer to send a new verification link.' },
    { q: 'I attended an event but didn’t get a certificate', a: 'Certificates go out when you scan out at or after the event’s end time, and only if the event offers one. If you left without scanning out, the organizer cannot issue one later. Contact them through the details on the event page.' },
    { q: 'How do I verify a certificate someone shared with me?', a: 'Every certificate has its own link and QR code. Opening it shows the live verification page. If the certificate was revoked, the page says so.' },
    { q: 'How do I start a community?', a: 'Open Communities and choose Create community. Our team reviews each new community once. After that you can run events with no more approval.' },
  ];
  return <div className="flex flex-col gap-5">{faqs.map((faq) => <section key={faq.q} className="flex flex-col gap-1.5 border-b border-line pb-4"><h2 className="text-[17px] font-extrabold">{faq.q}</h2><p className="text-[15px] leading-7 text-muted">{faq.a}</p></section>)}<p className="text-[14px] text-muted">To tell us what to fix or add, <Link className="font-semibold text-green-text hover:underline" href="/feedback?from=/support">send feedback</Link>.</p></div>;
}
