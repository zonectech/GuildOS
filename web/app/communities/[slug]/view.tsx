'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BadgeCheck, Check, Clock, Copy, MessageCircle, PenLine } from 'lucide-react';
import {
  MANAGER_ROLES, answerJoinRequest, communityEvents, createInviteLink, getCommunity, imageUrl, joinCommunity, leaveCommunity,
  type CommunityContext, type EventSummary,
} from '@/lib/api';
import { bucketOf, sortEvents, whenLabel } from '@/lib/events';
import { useSession } from '@/lib/session';
import { GeneratedCover } from '@/components/cover';
import { Avatar, Button, CertLabel, DateBadge } from '@/components/ui';
import { renderMarkdown } from '@/components/markdown';

/** One event in the community's list; events it co-hosted with another community say so. */
function EventLine({ event, hostId }: { event: EventSummary; hostId: string }) {
  const coHosted = String(event.communityId) !== hostId;
  const ended = bucketOf(event) === 'ENDED';
  return (
    <Link href={`/events/${event.slug}`} className="line">
      <DateBadge value={event.startDate} tz={event.timezone} />
      <span className="stack" style={{ gap: 1 }}><b>{event.title}</b><span className="small">{whenLabel(event.startDate, event.timezone)}{ended && event.completedCount ? ` · ${event.completedCount} attended` : ended && event.registrationCount ? ` · ${event.registrationCount} registered` : ''}</span>{coHosted ? <span className="chip ok" style={{ alignSelf: 'flex-start' }}>Co-hosted{event.communityName ? ` with ${event.communityName}` : ''}</span> : null}{!ended ? <CertLabel offer={event.certificateOffer} /> : null}</span>
    </Link>
  );
}

/** Shown to the founder while the one admin review is open. */
function ReviewStatus() {
  return (
    <section className="review">
      <span className="pendi"><Clock size={24} color="#9A5B00" /></span>
      <div className="stack" style={{ gap: 6 }}>
        <h3>This community is being reviewed</h3>
        <p className="muted">Our team checks every new community once. After that you can run events with no more approval. We will tell you by bell and email.</p>
        <ol className="tl">
          <li className="done"><i><Check size={13} strokeWidth={3} /></i>Request sent</li>
          <li className="now"><i />Admin review</li>
          <li><i />Verified, then create your first event</li>
        </ol>
      </div>
    </section>
  );
}

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [ctx, setCtx] = useState<CommunityContext | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState('');

  const load = useCallback(async () => {
    try {
      const context = await getCommunity(slug);
      setCtx(context);
      communityEvents(context.community._id).then((r) => setEvents(r.events)).catch(() => setEvents([]));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load community'); }
  }, [slug]);
  useEffect(() => { void load(); }, [load, user?.id]);

  if (error && !ctx) return <div className="wrap page"><p className="error">{error}</p><Link className="lk" href="/communities">All communities</Link></div>;
  if (!ctx) return <div className="wrap page"><p className="empty">Loading community…</p></div>;

  const { community, viewerMembership: membership, viewerJoinRequest: request } = ctx;
  const manager = Boolean(membership && MANAGER_ROLES.includes(membership.role));
  const ordered = sortEvents(events, '');
  const upcoming = ordered.filter((e) => ['LIVE', 'UPCOMING'].includes(bucketOf(e)));
  const past = ordered.filter((e) => bucketOf(e) === 'ENDED').slice(0, 6);
  const chats = [...(community.chatLinks ?? []), ...(community.whatsappLink && !(community.chatLinks ?? []).length ? [{ platform: 'WHATSAPP' as const, url: community.whatsappLink }] : [])];
  const pendingRequests = (ctx.joinRequests ?? []).filter((r) => r.status === 'PENDING');

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }
  const join = () => (user ? run(() => joinCommunity(community._id)) : router.push(`/login?next=${encodeURIComponent(`/communities/${slug}`)}`));
  async function makeInvite() {
    setError('');
    try { const r = await createInviteLink(community._id); setInvite(`${window.location.origin}${r.inviteLink}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to create invite link'); }
  }

  return (
    <div>
      <div className="chero">{community.coverImage ? <img src={imageUrl(community.coverImage)} alt="" /> : <GeneratedCover seed={community.name} type="COMMUNITY" plain />}</div>
      <div className="wrap ev" style={{ paddingTop: 0 }}>
        <div className="stack" style={{ gap: 14 }}>
          <span className="clogo"><Avatar name={community.name} src={imageUrl(community.logo)} size={88} /></span>
          <h1 className="row" style={{ gap: 10 }}>{community.name}{community.verificationStatus === 'VERIFIED' ? <BadgeCheck size={26} color="var(--green)" aria-label="Verified community" /> : null}</h1>
          {community.shortDescription ? <p className="lead" style={{ fontSize: 17 }}>{community.shortDescription}</p> : null}
          {manager && community.verificationStatus === 'PENDING' ? <ReviewStatus /> : null}
          {community.description ? <><h3>About</h3><div className="prose md">{renderMarkdown(community.description)}</div></> : null}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Upcoming events</h3>
            {manager && community.verificationStatus === 'VERIFIED' ? <Button small href={`/events/new?community=${community._id}`}>Create event</Button> : null}
          </div>
          {upcoming.length ? upcoming.map((e) => <EventLine key={e._id} event={e} hostId={community._id} />) : <p className="small">No upcoming events yet.</p>}
          {past.length ? <><h3>Past events</h3>{past.map((e) => <EventLine key={e._id} event={e} hostId={community._id} />)}</> : null}
        </div>
        <aside className="side" style={{ marginTop: 24 }}>
          {error ? <p className="error">{error}</p> : null}
          {membership ? (
            <><span className="chip ok" style={{ alignSelf: 'flex-start' }}>You are a {membership.role === 'MEMBER' ? 'member' : membership.role.replace(/_/g, ' ').toLowerCase()}</span>
              {membership.role !== 'FOUNDER' ? <Button kind="s" wide disabled={busy} onClick={() => run(() => leaveCommunity(community._id))}>Leave community</Button> : null}</>
          ) : request?.status === 'PENDING' ? <p className="note">You asked to join. A leader will approve your request.</p> : (
            <Button wide disabled={busy} onClick={join}>{community.visibility === 'PRIVATE' ? 'Ask to join' : 'Join community'}</Button>
          )}
          {chats.map((c) => <a key={c.url} className="btn s w" href={c.url} target="_blank" rel="noreferrer"><MessageCircle size={16} />{c.platform === 'WHATSAPP' ? 'WhatsApp' : c.platform.charAt(0) + c.platform.slice(1).toLowerCase()}</a>)}
          <div className="stats3"><div><b>{community.memberCount}</b><span>Members</span></div><div><b>{community.eventCount}</b><span>Events</span></div></div>
          {community.university ? <p className="small">{community.university}</p> : null}
          {manager ? (
            <div className="stack" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <b>Run this community</b>
              {membership?.role === 'FOUNDER' ? <Button kind="s" wide href={`/communities/new?edit=${community.slug}`}><PenLine size={16} />Edit community</Button> : null}
              {membership?.role === 'FOUNDER' ? (invite ? (
                <button type="button" className="btn s w" onClick={() => navigator.clipboard.writeText(invite).catch(() => undefined)}><Copy size={16} />Copy invite link</button>
              ) : <Button kind="s" wide onClick={makeInvite}>Create invite link</Button>) : null}
              {invite ? <p className="small" style={{ wordBreak: 'break-all' }}>{invite}</p> : null}
              <span className="small">Join requests ({pendingRequests.length})</span>
              {pendingRequests.map((r) => (
                <div key={r._id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{r.user?.fullName ?? 'Student'}</span>
                  <span className="row"><button type="button" className="btn p sm" disabled={busy} onClick={() => run(() => answerJoinRequest(community._id, r._id, true))}>Approve</button><button type="button" className="btn s sm" disabled={busy} onClick={() => run(() => answerJoinRequest(community._id, r._id, false))}>Decline</button></span>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
