import mongoose, { Schema, model, type Model } from 'mongoose';

export type AdminAuditDocument = {
  _id: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  action: string;
  targetType: string;
  targetId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

type AdminAuditModelType = Model<AdminAuditDocument>;

const adminAuditSchema = new Schema<AdminAuditDocument>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    targetType: { type: String, default: '' },
    targetId: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

adminAuditSchema.index({ createdAt: -1 });

export const AdminAuditModel =
  (mongoose.models.AdminAudit as AdminAuditModelType) ?? model<AdminAuditDocument>('AdminAudit', adminAuditSchema);
