import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type LoginAuditDocument = {
  userId: mongoose.Types.ObjectId;
  email: string;
  role: string;
  sessionId: string;
  loginAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type LoginAuditModelType = Model<LoginAuditDocument>;

type LoginAuditHydratedDocument = HydratedDocument<LoginAuditDocument>;

const loginAuditSchema = new Schema<LoginAuditDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, default: '', trim: true, lowercase: true, index: true },
    role: { type: String, default: 'STUDENT', trim: true, index: true },
    sessionId: { type: String, default: '', trim: true, index: true },
    loginAt: { type: Date, default: Date.now, index: true },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

loginAuditSchema.index({ userId: 1, loginAt: -1 });
loginAuditSchema.index({ isActive: 1, lastSeenAt: -1 });

export const LoginAuditModel =
  (mongoose.models.LoginAudit as LoginAuditModelType) ?? model<LoginAuditDocument>('LoginAudit', loginAuditSchema);

export type LoginAuditHydrated = LoginAuditHydratedDocument;
