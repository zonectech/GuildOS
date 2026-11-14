'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BadgeCheck, Share2 } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { getAttendanceStamps, getPublicCertificates, getPublicProfile, reputationSummary, type AttendanceStamp, type CertificateItem, type FullUser, type Reputation } from '@/lib/account';
import { useSession } from '@/lib/session';
import { Avatar } from '@/components/ui';
import { ScoreCard } from '@/components/score-card';
import { StampGrid } from '@/components/stamp';

/** What anyone sees: attended events and verified certificates first, then school, skills and interests if added. */
export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: viewer } = useSession();
  const [user, setUser] = useState<FullUser | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [stamps, setStamps] = useState<AttendanceStamp[]>([]);
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPublicProfile(username).then((r) => {
      setUser(r.user);
      reputationSummary(r.user.id).then((s) => setReputation(s.reputation)).catch(() => undefined);
    }).catch((e: Error) => setError(e.message));
    getPublicCertificates(username).then((r) => setCertificates(r.certificates)).catch(() => setCertificates([]));
    getAttendanceStamps(username).then((r) => setStamps(r.stamps)).catch(() => setStamps([]));
  }, [username]);

  if (error) return <div className="wrap page"><p className="error">{error}</p></div>;
  if (!user) return <div className="wrap page"><p className="empty">Loading profile…</p></div>;
  const p = user.profile ?? {};
  const school = [p.university, p.department || p.faculty].filter(Boolean).join(' · ');
  const share = () => navigator.clipboard.writeText(window.location.href).then(() => setCopied(true)).catch(() => undefined);

  return (
    <div className="wrap page">
      <div className="prof">
        <aside className="stack" style={{ gap: 12 }}>
          <Avatar name={user.fullName} src={imageUrl(p.avatar)} size={112} />
          <h1 style={{ fontSize: 34 }}>{user.fullName}</h1>
          {school ? <p className="muted">{school}</p> : null}
          {p.bio ? <p className="prose">{p.bio}</p> : null}
          <div className="row">
            <button type="button" className="btn s sm" onClick={share}><Share2 size={15} />{copied ? 'Link copied' : 'Share profile'}</button>
            {viewer?.id === user.id ? <Link className="btn s sm" href="/me/settings">Edit</Link> : null}
          </div>
          {p.skills?.length ? <><h3>Skills</h3><div className="tags">{p.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div></> : null}
          {p.interests?.length ? <><h3>Interests</h3><div className="tags">{p.interests.map((s) => <span key={s} className="tag">{s}</span>)}</div></> : null}
          {(p.socialLinks ?? []).filter(Boolean).length ? <><h3>Links</h3>{(p.socialLinks ?? []).filter(Boolean).map((l) => <a key={l} className="lk" href={/^https?:/.test(l) ? l : `https://${l}`} target="_blank" rel="noopener noreferrer nofollow" style={{ wordBreak: 'break-all' }}>{l.replace(/^https?:\/\//, '')}</a>)}</> : null}
        </aside>
        <div className="stack" style={{ gap: 18 }}>
          {reputation ? <ScoreCard reputation={reputation} certificates={certificates.length} /> : null}
          <section className="stack" style={{ gap: 10 }}>
            <h2>{stamps.some((s) => s.role !== 'ATTENDED') ? 'Attended & hosted' : 'Attended'} ({stamps.length})</h2>
            {stamps.length ? <StampGrid stamps={stamps} /> : <p className="small">No attended events shown yet.</p>}
          </section>
          <section className="stack" style={{ gap: 0 }}>
            <h2 style={{ marginBottom: 8 }}>Certificates ({certificates.length})</h2>
            {certificates.length ? certificates.map((c) => (
              <Link key={c.serial} href={`/certificates/${c.serial}`} className="ctile"><BadgeCheck size={17} /><span className="stack" style={{ gap: 1 }}><b>{c.eventTitle}</b><span className="small">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })} · Tap to verify</span></span></Link>
            )) : <p className="small">No certificates shown yet.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
