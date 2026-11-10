import mongoose, { Schema, model } from 'mongoose';

/**
 * Messages between students and communities (never student-to-student), and community announcements.
 *
 * CommunityThread: one conversation between a student and a community's team (a shared inbox).
 * CommunityThreadMessage: a message in it; `fromTeam` marks replies by the community (with who sent it).
 * Announcement: a post from a community to its members, or to people registered for / who attended an event.
 * InboxState: per student, when they last looked at announcements, and which communities they blocked.
 */
const threadSchema = new Schema(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN', index: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: () => new Date(), index: true },
    lastFromTeam: { type: Boolean, default: false },
    unreadStudent: { type: Number, default: 0 },
    unreadTeam: { type: Number, default: 0 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** Who on the team replied last (for "Replied by"). */
    lastReplyBy: { userId: { type: Schema.Types.ObjectId, default: null }, name: { type: String, default: '' } },
    /** Team members with this chat open right now (heartbeats; stale after ~25 s). */
    viewers: { type: [{ _id: false, userId: Schema.Types.ObjectId, name: String, at: Date }], default: [] },
  },
  { timestamps: true, versionKey: false },
);
threadSchema.index({ communityId: 1, studentId: 1 }, { unique: true });

const threadMessageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'CommunityThread', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fromTeam: { type: Boolean, required: true },
    /** Team replies keep the sender's membership and title as they were when sent. */
    senderMembershipId: { type: Schema.Types.ObjectId, default: null },
    senderTitle: { type: String, default: '' },
    content: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

export const ANNOUNCEMENT_REACTIONS = ['👍', '❤️', '🔥', '🎉', '😂'] as const;
const announcementSchema = new Schema(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorMembershipId: { type: Schema.Types.ObjectId, default: null },
    authorTitle: { type: String, default: '' },
    text: { type: String, required: true, maxlength: 2000 },
    image: { type: String, default: '' },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    audience: {
      kind: { type: String, enum: ['ALL', 'REGISTERED', 'ATTENDED'], default: 'ALL' },
      eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    },
    /** For REGISTERED / ATTENDED audiences: exactly who it went to. ALL = current members (worked out on read). */
    recipientIds: { type: [Schema.Types.ObjectId], default: [], index: true },
    deliveredCount: { type: Number, default: 0 },
    reactions: { type: [{ _id: false, userId: Schema.Types.ObjectId, emoji: String }], default: [] },
    hiddenAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

const inboxStateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    announcementsSeenAt: { type: Date, default: () => new Date(0) },
    blockedCommunityIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { versionKey: false },
);

export const CommunityThreadModel: mongoose.Model<any> = mongoose.models.CommunityThread || model('CommunityThread', threadSchema);
export const CommunityThreadMessageModel: mongoose.Model<any> = mongoose.models.CommunityThreadMessage || model('CommunityThreadMessage', threadMessageSchema);
export const AnnouncementModel: mongoose.Model<any> = mongoose.models.Announcement || model('Announcement', announcementSchema);
export const InboxStateModel: mongoose.Model<any> = mongoose.models.InboxState || model('InboxState', inboxStateSchema);
