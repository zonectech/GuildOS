import Link from 'next/link';
import { SUPPORT_EMAIL, type LegalSection } from '@/lib/legal';

/** One template for Terms, Privacy and Support, with tabs between them. */
export function LegalTabs({ current }: { current: 'terms' | 'privacy' | 'support' }) {
  return (
    <nav className="row" aria-label="Help pages">
      {([['terms', 'Terms'], ['privacy', 'Privacy'], ['support', 'Support']] as const).map(([key, label]) => (
        <Link key={key} href={`/${key}`} className="pill" aria-current={current === key ? 'page' : undefined} aria-pressed={current === key}>{label}</Link>
      ))}
    </nav>
  );
}

export function LegalPage({ current, title, updated, sections }: { current: 'terms' | 'privacy'; title: string; updated: string; sections: readonly LegalSection[] }) {
  return (
    <div className="wrap page" style={{ maxWidth: 760 }}>
      <LegalTabs current={current} />
      <h1>{title}</h1>
      <p className="muted">Last updated {updated}</p>
      {sections.map((s) => (
        <section key={s.title} className="stack" style={{ gap: 8 }}>
          <h3>{s.title}</h3>
          {s.paragraphs.map((p) => <p key={p} className="prose">{p}</p>)}
        </section>
      ))}
      <p className="muted">Questions? Email <a className="lk" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </div>
  );
}
