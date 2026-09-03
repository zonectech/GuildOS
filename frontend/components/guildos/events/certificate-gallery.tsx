'use client';

import Link from 'next/link';
import { Award, BadgeCheck, Download } from 'lucide-react';
import type { CertificateSummary } from '../event-api';
import { Surface } from '../ui/page';

const CERT_TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

const CERT_TYPE_ACCENT: Record<string, string> = {
  ATTENDANCE: 'from-indigo-600 to-sky-500',
  COMPLETION: 'from-emerald-600 to-teal-500',
  LEADERSHIP: 'from-amber-500 to-orange-500',
  VOLUNTEER: 'from-rose-500 to-pink-500',
};

/** The viewer's earned certificates as a card gallery (view / verify / download). */
export function CertificateGallery({ certificates }: { certificates: CertificateSummary[] }) {
  if (!certificates.length) return null;
  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Award className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Your certificates</h2>
          <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{certificates.length}</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">Open a certificate to view, verify, or download it</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((c) => {
          const revoked = c.status === 'REVOKED';
          return (
            <Link
              key={c.serial}
              href={`/certificates/${c.serial}`}
              className={`group relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${revoked ? 'border-red-200 opacity-70' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'}`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${CERT_TYPE_ACCENT[c.type] ?? 'from-indigo-600 to-sky-500'}`} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${CERT_TYPE_ACCENT[c.type] ?? 'from-indigo-600 to-sky-500'}`}>
                    <Award className="h-5 w-5" />
                  </div>
                  {revoked ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Revoked</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{CERT_TYPE_LABEL[c.type] ?? 'Certificate'}</p>
                <h3 className="mt-0.5 line-clamp-2 font-semibold text-slate-950 dark:text-white">{c.eventTitle}</h3>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{c.communityName}</p>
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-3">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Issued {new Date(c.issuedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                    <Download className="h-3 w-3" /> View &amp; download
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Surface>
  );
}
