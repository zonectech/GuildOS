import mongoose, { Schema, model, type Model } from 'mongoose';

export type MessageDocument = {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  /** Message this one replies to (same conversation), null = not a reply. */
  replyTo: mongoose.Types.ObjectId | null;
  /** Set when the sender edited the message; `history` keeps every prior version. */
  editedAt: Date | null;
  /** Previous contents, oldest first — the record is never destroyed by an edit. */
  history: { content: string; replacedAt: Date }[];
  /** Soft delete: hidden from users but the content stays in the database. */
  deletedAt: Date | null;
  /** "Delete for me": users who hid this message from their own view only. */
  hiddenFor: mongoose.Types.ObjectId[];
  createdAt: Date;
};

type MessageModelType = Model<MessageDocument>;

const messageSchema = new Schema<MessageDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    editedAt: { type: Date, default: null },
    history: {
      type: [{ _id: false, content: { type: String, default: '' }, replacedAt: { type: Date, default: () => new Date() } }],
      default: [],
    },
    deletedAt: { type: Date, default: null },
    hiddenFor: { type: [Schema.Types.ObjectId], default: [] },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const MessageModel =
  (mongoose.models.Message as MessageModelType) ?? model<MessageDocument>('Message', messageSchema);
