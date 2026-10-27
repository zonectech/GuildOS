import mongoose, { Schema, model } from 'mongoose';
type MemberEmail = { userId: mongoose.Types.ObjectId; email: string; verifiedAt: Date | null; codeHash: string; expiresAt: Date; sentAt: Date; attempts: number };
const schema = new Schema<MemberEmail>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  verifiedAt: { type: Date, default: null }, codeHash: { type: String, default: '', select: false },
  expiresAt: { type: Date, required: true }, sentAt: { type: Date, required: true }, attempts: { type: Number, default: 0 },
}, { versionKey: false });
export const MemberEmailModel = (mongoose.models.MemberEmail as mongoose.Model<MemberEmail>) || model<MemberEmail>('MemberEmail', schema);
