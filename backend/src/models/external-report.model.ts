import mongoose, { Schema, model } from 'mongoose';
import type { ReportRow } from '../utils/external-report';
type ExternalReport = { eventId: mongoose.Types.ObjectId; actorId: mongoose.Types.ObjectId; kind: 'REGISTRATION' | 'ATTENDANCE'; filename: string; hash: string; rows: ReportRow[]; appliedAt: Date | null; createdAt: Date };
const schema = new Schema<ExternalReport>({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['REGISTRATION', 'ATTENDANCE'], required: true },
  filename: { type: String, maxlength: 200, required: true }, hash: { type: String, required: true },
  rows: { type: [{ _id: false, row: Number, email: String, minutes: { type: Number, default: null }, day: String }], default: [] },
  appliedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
schema.index({ eventId: 1, kind: 1, hash: 1 }, { unique: true });
export const ExternalReportModel = (mongoose.models.ExternalReport as mongoose.Model<ExternalReport>) || model<ExternalReport>('ExternalReport', schema);
