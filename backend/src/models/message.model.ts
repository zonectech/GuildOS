import mongoose, { Schema, model, type Model } from 'mongoose';

export type MessageDocument = {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
};

type MessageModelType = Model<MessageDocument>;

const messageSchema = new Schema<MessageDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const MessageModel =
  (mongoose.models.Message as MessageModelType) ?? model<MessageDocument>('Message', messageSchema);
