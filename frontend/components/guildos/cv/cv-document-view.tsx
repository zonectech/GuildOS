'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { CvContent, CvTemplate } from '../cv-api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

const TEMPLATE_ACCENT: Record<CvTemplate, string> = {
  PROFESSIONAL: '#1e3a8a',
  MODERN: '#4f46e5',
  EXECUTIVE: '#0f172a',
  ACADEMIC: '#065f46',
  TECHNICAL: '#0e7490',
};

const TEMPLATE_ACCENT_LIGHT: Record<CvTemplate, string> = {
  PROFESSIONAL: '#3b82f6',
  MODERN: '#a855f7',
  EXECUTIVE: '#475569',
  ACADEMIC: '#10b981',
  TECHNICAL: '#06b6d4',
};

function fmtDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

function period(start: string | null, end: string | null, current: boolean) {
  const s = fmtDate(start);
  const e = current ? 'Present' : fmtDate(end);
  return [s, e].filter(Boolean).join(' – ');
}

type Props = {
  content: CvContent;
  template: CvTemplate;
  cvId: string;
  verificationId: string;
  hideCertificates?: boolean;
  hideGuildScore?: boolean;
};

export function CvDocumentView({ content, template, cvId, verificationId, hideCertificates, hideGuildScore }: Props) {
  const accent = TEMPLATE_ACCENT[template] ?? '#1e3a8a';
  const accentLight = TEMPLATE_ACCENT_LIGHT[template] ?? accent;
  const verifyUrl = `${SITE_URL}/cv/verify/${verificationId}`;
  const showCerts = !hideCertificates && content.certifications.length > 0;
  const showScore = !hideGuildScore && content.guildScore;

  return (
    <article className="cv-document mx-auto max-w-[820px] bg-white p-10 text-slate-800" style={{ ['--cv-accent' as string]: accent }}>
      {/* Header */}
      <header
        className="relative overflow-hidden rounded-2xl px-6 py-5 print:rounded-none print:bg-transparent print:px-0 print:py-3"
        style={{ background: `linear-gradient(135deg, ${accent}14, ${accentLight}0a)` }}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${accentLight})` }} aria-hidden />
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: accent }}>{content.header.fullName}</h1>
            {content.education.course || content.education.university ? (
              <p className="mt-1 text-sm text-slate-600">{[content.education.course, content.education.university].filter(Boolean).join(' · ')}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {[content.header.email, content.header.phone, content.header.location].filter(Boolean).join('  •  ')}
            </p>
            <a href={content.header.publicProfileUrl} className="text-xs font-medium" style={{ color: accent }}>{content.header.publicProfileUrl}</a>
          </div>
          <div className="shrink-0 text-center">
            <div className="rounded-lg bg-white p-1.5 shadow-sm print:shadow-none">
              <QRCodeSVG value={verifyUrl} size={84} level="M" />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Verify · {cvId}</p>
          </div>
        </div>
      </header>

      {/* Summary */}
      {content.summary ? (
        <Section title="Professional Summary" accent={accent}>
          <p className="text-sm leading-relaxed text-slate-700">{content.summary}</p>
        </Section>
      ) : null}

      {/* Education */}
      {content.education.university ? (
        <Section title="Education" accent={accent}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{content.education.university}</p>
            {content.education.graduationYear ? <p className="text-xs text-slate-500">Class of {content.education.graduationYear}</p> : null}
          </div>
          <p className="text-sm text-slate-600">{[content.education.course, content.education.level].filter(Boolean).join(' · ')}</p>
          {content.education.achievements.map((a, i) => <p key={i} className="text-sm text-slate-600">• {a}</p>)}
        </Section>
      ) : null}

      {/* Leadership */}
      {content.leadership.length ? (
        <Section title="Leadership Experience" accent={accent}>
          {content.leadership.map((l, i) => (
            <div key={i} className="mb-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {l.title} — {l.organization}
                  {l.verified ? <span className="ml-2 align-middle text-[10px] font-medium" style={{ color: accent }}>✓ Verified</span> : null}
                </p>
                <p className="shrink-0 text-xs text-slate-500">{period(l.startDate, l.endDate, l.current)}</p>
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {l.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}

      {/* Experience */}
      {content.experience.length ? (
        <Section title="Experience" accent={accent}>
          {content.experience.map((e, i) => (
            <div key={i} className="mb-3">
              <p className="text-sm font-semibold text-slate-900">
                {e.title}{e.organization ? ` — ${e.organization}` : ''}
                {e.url ? <a href={e.url} className="ml-2 text-xs" style={{ color: accent }}>link</a> : null}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {e.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}

      {/* Certifications */}
      {showCerts ? (
        <Section title="Certifications" accent={accent}>
          {content.certifications.map((c, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">{c.title}</span>{c.issuer ? ` — ${c.issuer}` : ''}
                <a href={c.verifyUrl} className="ml-2 text-xs" style={{ color: accent }}>verify</a>
              </p>
              <p className="shrink-0 text-xs text-slate-500">{fmtDate(c.date)}</p>
            </div>
          ))}
        </Section>
      ) : null}

      {/* Skills */}
      {content.skills.length ? (
        <Section title="Skills" accent={accent}>
          <div className="flex flex-wrap gap-1.5">
            {content.skills.map((s, i) => (
              <span key={i} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: accent, backgroundColor: `${accent}12` }}>{s}</span>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Projects */}
      {content.projects.length ? (
        <Section title="Projects" accent={accent}>
          {content.projects.map((p, i) => (
            <div key={i} className="mb-2">
              <p className="text-sm font-semibold text-slate-900">{p.name}{p.role ? ` — ${p.role}` : ''}{p.url ? <a href={p.url} className="ml-2 text-xs" style={{ color: accent }}>link</a> : null}</p>
              {p.description ? <p className="text-sm text-slate-700">{p.description}</p> : null}
            </div>
          ))}
        </Section>
      ) : null}

      {/* Awards & Guild Score */}
      {content.awards.length || showScore ? (
        <Section title="Awards & Recognition" accent={accent}>
          {showScore ? (
            <span className="mb-1 mr-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: accent, backgroundColor: `${accent}12` }}>
              Guild Score {content.guildScore!.score.toLocaleString()} · {content.guildScore!.level}
            </span>
          ) : null}
          {content.awards.length ? <p className="mt-1 text-sm text-slate-700">{content.awards.join(' · ')}</p> : null}
        </Section>
      ) : null}

      <footer className="mt-6 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        Verifiable on GuildOS · {verifyUrl} · Every statement is backed by a verified record.
      </footer>
    </article>
  );
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
        <span className="inline-block h-3.5 w-1 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}
