'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { imageUrl, managedCommunities, type Community } from '@/lib/api';
import { getAttendanceStamps, myCertificates, myRegistrations, myReputation, type AttendanceStamp, type CertificateItem, type MyRegistration, type Reputation } from '@/lib/account';
import { useSession } from '@/lib/session';
import { Avatar, Button, DateBadge } from '@/components/ui';
import { ScoreCard } from '@/components/score-card';
import { StampGrid } from '@/components/stamp';

const ACTIVE = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];

export default function MyProfilePage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [stamps, setStamps] = useState<AttendanceStamp[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login?next=/me'); return; }
    myReputation().then((r) => setReputation(r.reputation)).catch(() => undefined);
    myCertificates().then((r) => setCertificates(r.certificates)).catch(() => undefined);
    myRegistrations().then((r) => setRegistrations(r.registrations)).catch(() => undefined);
    managedCommunities().then((r) => setCommunities(r.communities)).catch(() => undefined);
    if (user.profile?.username) getAttendanceStamps(user.profile.username).then((r) => setStamps(r.stamps)).catch(() => undefined);
  }, [loading, user, router]);

  if (!user) return <div className="wrap page"><p className="empty">Loading…</p></div>;
  // Passes still in use: the event has not closed attendance yet.
  const upcoming = registrations.filter((r) => ACTIVE.includes(r.registration.status) && ['ANNOUNCED', 'PUBLISHED', 'POSTPONED', 'CHECK_IN', 'CHECK_OUT'].includes(r.event.status));
  // Events that did not count, so people can see why there is no stamp.
  const missed = registrations.filter((r) => ['PARTIAL_ATTENDANCE', 'NO_SHOW'].includes(r.registration.status)).slice(0, 8);

  return (
    <div className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={user.fullName} src={imageUrl(user.profile?.avatar)} size={72} />
          <div className="stack" style={{ gap: 2 }}><h1 style={{ fontSize: 32 }}>{user.fullName}</h1><span className="muted">{user.profile?.username ? `@${user.profile.username}` : user.email}</span></div>
        </div>
        <div className="row">
          {user.profile?.username ? <Button kind="s" small href={`/u/${user.profile.username}`}>View public profile</Button> : null}
          <Button kind="s" small href="/me/settings">Edit profile</Button>
        </div>
      </div>
      <div className="prof passes-first">
        <div className="stack" style={{ gap: 16 }}>
          {reputation ? <ScoreCard reputation={reputation} certificates={certificates.length} own /> : null}
          {communities.length ? <section className="stack" style={{ gap: 0 }}>
            <h3 style={{ marginBottom: 6 }}>Communities I run</h3>
            {communities.map((c) => (
              <Link key={c._id} href={`/communities/${c.slug}`} className="opt"><span className="stack" style={{ gap: 1, textAlign: 'left' }}><b className="row" style={{ gap: 5 }}>{c.name}{c.verificationStatus === 'VERIFIED' ? <BadgeCheck size={15} color="var(--green)" /> : null}</b><span className="small">{c.verificationStatus === 'PENDING' ? 'Being reviewed' : `${c.memberCount} members`}</span></span><ChevronRight size={18} /></Link>
            ))}
          </section> : null}
          <section className="stack" style={{ gap: 0 }}>
            <Link href="/events/saved" className="opt"><b>Saved events</b><ChevronRight size={18} /></Link>
            <Link href="/notifications" className="opt"><b>Notifications</b><ChevronRight size={18} /></Link>
            <Link href="/me/settings" className="opt"><b>Settings</b><ChevronRight size={18} /></Link>
          </section>
        </div>
        <div className="stack" style={{ gap: 18 }}>
          <section className="stack" style={{ gap: 10 }}>
            <h3>Next up</h3>
            {upcoming.length ? upcoming.map((r) => (
              <Link key={r.registration.id} href={`/events/${r.event.slug}`} className="passrow">
                <DateBadge value={r.event.startDate} />
                <span className="stack" style={{ gap: 1 }}><b>{r.event.title}</b><span className="small">{r.registration.status === 'CHECKED_IN' ? 'Scanned in. Scan out at the end.' : 'Tap for your pass'}</span></span>
                <span style={{ background: '#fff', padding: 4, borderRadius: 6, display: 'grid' }}><QRCodeSVG value={r.registration.qrToken} size={40} /></span>
              </Link>
            )) : <p className="small">No upcoming events. <Link className="lk" href="/events">Find one</Link>.</p>}
          </section>
          <section className="stack" style={{ gap: 10 }}>
            <h3>{stamps.some((s) => s.role !== 'ATTENDED') ? 'Attended & hosted' : 'Attended'} ({stamps.length})</h3>
            {stamps.length ? <StampGrid stamps={stamps} /> : <p className="small">Every event you scan in and out of gets a stamp here, with or without a certificate.</p>}
          </section>
          <section className="stack" style={{ gap: 0 }}>
            <h3 style={{ marginBottom: 6 }}>My certificates</h3>
            {certificates.length ? certificates.map((c) => (
              <Link key={c.serial} href={`/certificates/${c.serial}`} className="ctile"><BadgeCheck size={17} /><span className="stack" style={{ gap: 1 }}><b>{c.eventTitle}</b><span className="small">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}{c.status !== 'VERIFIED' ? ` · ${c.status.toLowerCase()}` : ''}</span></span></Link>
            )) : <p className="small">When an organizer offers a certificate, it appears here the moment you scan out.</p>}
          </section>
          {missed.length ? <section className="stack" style={{ gap: 0 }}>
            <h3 style={{ marginBottom: 6 }}>Not counted</h3>
            {missed.map((r) => <Link key={r.registration.id} href={`/events/${r.event.slug}`} className="line"><DateBadge value={r.event.startDate} /><span className="stack" style={{ gap: 1 }}><b>{r.event.title}</b><span className="small">{r.registration.status === 'NO_SHOW' ? 'Did not attend' : 'Not scanned out at the end'}</span></span></Link>)}
          </section> : null}
        </div>
      </div>
    </div>
  );
}
