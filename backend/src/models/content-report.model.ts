import mongoose, { Schema, model, type Model } from 'mongoose';

export type ContentReportTargetType = 'POST' | 'COMMENT';
export type ContentReportStatus = 'PENDING' | 'ACTIONED' | 'DISMISSED';

export type ContentReportDocument = {
  _id: mongoose.Types.ObjectId;
  targetType: ContentReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reporterId: mongoose.Types.ObjectId;
  reason: string;
  status: ContentReportStatus;
  createdAt: Date;
  updatedAt: Date;
};

type ContentReportModelType = Model<ContentReportDocument>;

const contentReportSchema = new Schema<ContentReportDocument>(
  {
    targetType: { type: String, enum: ['POST', 'COMMENT'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'ACTIONED', 'DISMISSED'], default: 'PENDING', index: true },
  },
  { timestamps: true },
);

// One report per user per target.
contentReportSchema.index({ targetType: 1, targetId: 1, reporterId: 1 }, { unique: true });

export const ContentReportModel =
  (mongoose.models.ContentReport as ContentReportModelType) ?? model<ContentReportDocument>('ContentReport', contentReportSchema);
