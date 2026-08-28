import mongoose, { Schema, model, type Model } from 'mongoose';

export type ConversationKind = 'RECRUITER' | 'PEER';

export type ConversationDocument = {
  _id: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  pairKey: string;
  kind: ConversationKind;
  lastMessage: string;
  lastMessageAt: Date | null;
  unread: Map<string, number>;
  /** Disappearing messages: hours a message lives before it is auto-soft-deleted (0 = off). */
  disappearAfterHours: number;
  createdAt: Date;
  updatedAt: Date;
};

type ConversationModelType = Model<ConversationDocument>;

const conversationSchema = new Schema<ConversationDocument>(
  {
    participants: { type: [Schema.Types.ObjectId], ref: 'User', required: true, index: true },
    pairKey: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['RECRUITER', 'PEER'], default: 'PEER' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: null },
    unread: { type: Map, of: Number, default: {} },
    disappearAfterHours: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/** Order-independent key for the participant pair. */
export function conversationPairKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

export const ConversationModel =
  (mongoose.models.Conversation as ConversationModelType) ?? model<ConversationDocument>('Conversation', conversationSchema);
