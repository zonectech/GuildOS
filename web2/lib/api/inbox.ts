/**
 * Messages: students and communities (never student to student), community announcements, and
 * event updates. Real endpoints (/api/inbox); event updates are your event notifications.
 */
import { api, enc, mediaUrl } from './client';
import { notifications, type Notice } from './session';

export interface Unread { chats: number; announcements: number; team: number; total: number }
export const unread = () => api<Unread>('/api/inbox/unread');

type RawCommunity = { _id: string; name: string; slug: string; logo?: string; verificationStatus?: string } | null;
const toCommunity = (c: RawCommunity) => (c ? { id: c._id, name: c.name, slug: c.slug, logo: mediaUrl(c.logo), verified: c.verificationStatus === 'VERIFIED' } : null);

/** Conversation: one student and one community's team. */
export interface Conversation {
  /** Team side: who replied last, and who else has it open right now. */
  repliedBy: string; repliedByTitle: string; viewing: string[];
  id: string; status: 'OPEN' | 'RESOLVED'; lastMessage: string; lastMessageAt: string; lastFromTeam: boolean; unread: number;
  community: ReturnType<typeof toCommunity>; student: { name: string; avatar: string; department: string } | null;
}
type RawThread = { lastReplyBy?: { name?: string; title?: string } | null; viewers?: { name: string }[]; _id: string; status: Conversation['status']; lastMessage: string; lastMessageAt: string; lastFromTeam: boolean; unreadStudent: number; unreadTeam: number; community?: RawCommunity; student?: { fullName: string; profile?: { avatar?: string; department?: string } } | null };
const toConversation = (t: RawThread, side: 'STUDENT' | 'TEAM'): Conversation => ({
  id: t._id, repliedBy: t.lastReplyBy?.name ?? '', repliedByTitle: t.lastReplyBy?.title ?? '', viewing: (t.viewers ?? []).map((v) => v.name), status: t.status, lastMessage: t.lastMessage, lastMessageAt: t.lastMessageAt, lastFromTeam: t.lastFromTeam, unread: side === 'STUDENT' ? t.unreadStudent : t.unreadTeam,
  community: toCommunity(t.community ?? null), student: t.student ? { name: t.student.fullName, avatar: mediaUrl(t.student.profile?.avatar), department: t.student.profile?.department ?? '' } : null,
});
export const myChats = () => api<{ chats: RawThread[] }>('/api/inbox/chats').then((r) => r.chats.map((t) => toConversation(t, 'STUDENT')));
export const teamChats = (communityId: string, status: 'OPEN' | 'RESOLVED') => api<{ chats: RawThread[] }>(`/api/inbox/community/${enc(communityId)}/chats?status=${status}`).then((r) => r.chats.map((t) => toConversation(t, 'TEAM')));
/** "Contact the host": starts (or continues) your chat with a community. */
export const contactCommunity = (communityId: string, message: string, eventId?: string) =>
  api<{ chat: { _id: string } }>('/api/inbox/chats', { method: 'POST', body: JSON.stringify({ communityId, message, eventId }) }).then((r) => r.chat._id);

/** Message: `fromTeam` replies show the community; the team also sees which admin wrote it. */
/** Team messages are signed: name (unless the community chose Title only), pronouns, title as it was when sent, and former. */
export interface Message { id: string; fromTeam: boolean; content: string; createdAt: string; senderName: string; senderAvatar: string; senderPronouns: string; senderTitle: string; former: boolean; pending?: boolean }
export interface ChatDetail { viewing: string[]; id: string; status: Conversation['status']; viewer: 'STUDENT' | 'TEAM'; blocked: boolean; community: ReturnType<typeof toCommunity>; student: { name: string; avatar: string } | null; messages: Message[] }
export const openChat = (id: string) => api<{ viewers?: { name: string }[]; thread: { _id: string; status: Conversation['status'] }; viewer: ChatDetail['viewer']; blocked: boolean; community: RawCommunity; student: { fullName: string; profile?: { avatar?: string } } | null; messages: { _id: string; fromTeam: boolean; content: string; createdAt: string; senderName: string; senderAvatar: string; senderPronouns?: string; senderTitle?: string; former?: boolean }[] }>(`/api/inbox/chats/${enc(id)}`)
  .then((r): ChatDetail => ({
    viewing: (r.viewers ?? []).map((v) => v.name), id: r.thread._id, status: r.thread.status, viewer: r.viewer, blocked: r.blocked, community: toCommunity(r.community), student: r.student ? { name: r.student.fullName, avatar: mediaUrl(r.student.profile?.avatar) } : null,
    messages: r.messages.map((m) => ({ id: m._id, fromTeam: m.fromTeam, content: m.content, createdAt: m.createdAt, senderName: m.senderName, senderAvatar: mediaUrl(m.senderAvatar), senderPronouns: m.senderPronouns ?? '', senderTitle: m.senderTitle ?? '', former: Boolean(m.former) })),
  }));
/** Team side: I have this chat open (every few seconds); returns who else is looking. */
export const viewing = (chatId: string) => api<{ viewers: { name: string }[] }>(`/api/inbox/chats/${enc(chatId)}/viewing`, { method: 'POST' }).then((r) => r.viewers.map((v) => v.name));
export const sendMessage = (chatId: string, content: string) => api(`/api/inbox/chats/${enc(chatId)}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
export const setChatStatus = (chatId: string, status: Conversation['status']) => api(`/api/inbox/chats/${enc(chatId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const reportMessage = (id: string, reason: string) => api(`/api/inbox/messages/${enc(id)}/report`, { method: 'POST', body: JSON.stringify({ reason }) });

/** Announcement: WhatsApp-Channels-style posts from communities. */
export interface Announcement {
  id: string; text: string; image: string; createdAt: string; deliveredCount: number; audience: { kind: 'ALL' | 'REGISTERED' | 'ATTENDED' };
  reactions: { emoji: string; count: number; mine: boolean }[];
  community: { id: string; name: string; slug: string; logo: string; verified: boolean } | null;
  event: { id: string; title: string; slug: string; startDate: string | null; venue: string; cover: string; type: string } | null;
  /** Who posted it: name (hidden with Title only), pronouns, title as it was then, former. */
  sender: { name: string; pronouns: string; avatar: string; title: string; former: boolean } | null;
}
type RawAnn = Omit<Announcement, 'event'> & { event: { id: string; title: string; slug: string; startDate: string | null; venue: string; bannerImage?: string; type: string } | null };
const toAnn = (a: RawAnn): Announcement => ({ ...a, sender: a.sender ? { ...a.sender, avatar: mediaUrl(a.sender.avatar) } : null, image: mediaUrl(a.image), community: a.community ? { ...a.community, logo: mediaUrl(a.community.logo) } : null, event: a.event ? { ...a.event, cover: mediaUrl(a.event.bannerImage) } : null });
export const announcements = (before?: string) => api<{ announcements: RawAnn[]; seenAt: string; next: string | null }>(`/api/inbox/announcements${before ? `?before=${enc(before)}` : ''}`)
  .then((r) => ({ items: r.announcements.map(toAnn), seenAt: r.seenAt, next: r.next }));
export const markAnnouncementsSeen = () => api('/api/inbox/announcements/seen', { method: 'POST' });
export const reactTo = (id: string, emoji: string) => api<{ announcement: RawAnn }>(`/api/inbox/announcements/${enc(id)}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }).then((r) => toAnn(r.announcement));
export const reportAnnouncement = (id: string, reason: string) => api(`/api/inbox/announcements/${enc(id)}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
export const communityAnnouncements = (communityId: string) => api<{ announcements: RawAnn[] }>(`/api/inbox/community/${enc(communityId)}/announcements`).then((r) => r.announcements.map(toAnn));
export type Audience = { kind: 'ALL' } | { kind: 'REGISTERED' | 'ATTENDED'; eventId: string };
export const audienceCount = (communityId: string, a: Audience) => api<{ count: number }>(`/api/inbox/community/${enc(communityId)}/audience`, { method: 'POST', body: JSON.stringify(a) }).then((r) => r.count);
export const postAnnouncement = (communityId: string, input: { text: string; image?: string; eventId?: string; audience: Audience }) =>
  api<{ announcement: { id: string; deliveredCount: number } }>(`/api/inbox/community/${enc(communityId)}/announcements`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.announcement);

/** Blocking a community's messages and announcements (you can undo it). */
export const blockCommunity = (communityId: string) => api(`/api/inbox/blocks/${enc(communityId)}`, { method: 'POST' });
export const unblockCommunity = (communityId: string) => api(`/api/inbox/blocks/${enc(communityId)}`, { method: 'DELETE' });
export const blockedList = () => api<{ communities: { _id: string; name: string; slug: string; logo?: string }[] }>('/api/inbox/blocks').then((r) => r.communities.map((c) => ({ id: c._id, name: c.name, slug: c.slug, logo: mediaUrl(c.logo) })));

/** Event updates: venue changes, reminders and cancellations for events you registered for. */
export async function eventUpdates(): Promise<Notice[]> {
  const r = await notifications();
  // Venue/time changes, cancellations and organizer updates (also on the bell, with a pop-up).
  return r.items.filter((n) => n.category === 'EVENT_UPDATE');
}

/** Quick replies for the team inbox. */
export const QUICK_REPLIES = ['Yes, bring your laptop.', 'Registration is free; just tap Register on the event page.', 'Your certificate comes after we finalize attendance.', 'Thanks! We’ve fixed it.', 'See you there!'];
