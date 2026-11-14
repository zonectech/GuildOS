import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * "Report an attendance issue": a student asks the organizers to look at their attendance for a past
 * event (e.g. "I was there but wasn't scanned out"). The organizer reviews it and, if right, corrects
 * the record from the event workspace (which keeps its own audit trail). Status: SENT → REVIEWED.
 */
const schema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registrationId: { type: Schema.Types.ObjectId, required: true },
    message: { type: String, required: true, maxlength: 600 },
    status: { type: String, enum: ['SENT', 'REVIEWED'], default: 'SENT', index: true },
    response: { type: String, default: '', maxlength: 600 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ eventId: 1, userId: 1, status: 1 });

export type AttendanceIssue = InferSchemaType<typeof schema>;
export const AttendanceIssueModel = mongoose.models.AttendanceIssue || model('AttendanceIssue', schema);
