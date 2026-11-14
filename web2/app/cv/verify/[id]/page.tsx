import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, CircleAlert, Download } from 'lucide-react';
import { API_BASE_URL, enc, isNotFound } from '@/lib/api/client';
import { verifyCvDocument } from '@/lib/api/public';
import { fmtDate } from '@/lib/format';
import { BRAND } from '@/lib/brand';
import { Btn } from '@/components/ui/bits';
import { Stamp, SealText } from '@/components/brand/stamp';

type Props = { params: Promise<{ id: string }> };

/** The CV, or null if the API couldn't be reached. A CV that doesn't exist is a real 404. */
async function load(id: string) {
  try { return await verifyCvDocument(id); }
  catch (e) { if (isNotFound(e)) notFound(); return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cv = await load(id);
  return { title: cv ? `CV of ${cv.ownerName} · verified` : 'CV check' };
}

/**
 * Anyone holding a CV made on the previous site can check it here: the link printed on the CV
 * (/cv/verify/<id>) keeps working. It shows who it belongs to and what it was built from; the full CV
 * is the PDF.
 */
export default async function CvVerifyPage({ params }: Props) {
  const { id } = await params;
  const cv = await load(id);
  if (!cv) {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <CircleAlert size={36} className="text-muted" />
        <h1 className="text-[26px] font-extrabold">We couldn&apos;t check this CV right now</h1>
        <p className="text-[15px] text-muted">This says nothing about the CV itself. Try again in a moment.</p>
      </div>
    );
  }
  const when = cv.refreshedAt ?? cv.generatedAt;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 pt-10 pb-20 text-center">
      <Stamp label="CV check" ink="green" state="stamped" size={140} center={<SealText>AUTHENTIC</SealText>} />
      <div className="flex flex-col gap-2">
        <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-green-text"><BadgeCheck size={15} />Verified CV</span>
        <h1 className="text-[30px] font-extrabold">{cv.ownerName}</h1>
        <p className="text-[15px] text-muted">Built by {BRAND} from {cv.ownerName}&apos;s own records · {cv.refreshedAt ? 'updated' : 'made'} {fmtDate(when, null, { year: true })}</p>
      </div>
      <dl className="grid w-full grid-cols-3 gap-3">
        {[['Events attended', cv.eventCount], ['Certificates', cv.certificateCount], ['Leadership roles', cv.leadershipCount]].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-line bg-surface p-4"><dd className="font-display text-[26px] font-extrabold tabular-nums">{v}</dd><dt className="text-[13px] text-muted">{k}</dt></div>
        ))}
      </dl>
      <p className="max-w-md text-[13.5px] text-muted">If the CV you were given says something different from this page or from the PDF below, it was changed after it was made.</p>
      <Btn kind="secondary" href={`${API_BASE_URL}/api/cv/verify/${enc(cv.verificationId)}/pdf`}><Download size={16} />Download the verified CV (PDF)</Btn>
    </div>
  );
}
