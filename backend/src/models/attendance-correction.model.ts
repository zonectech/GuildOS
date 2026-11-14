import mongoose, { Schema, model } from 'mongoose';

/**
 * Audit trail for every change to someone's attendance after the fact.
 * kind REPORT: an organizer's external attendance report (reportId set; before/after are per-day minutes).
 * kind MANUAL: an organizer fixed a missing check-out by hand (reason, and the original and new times).
 * Rows are never edited or deleted.
 */
const entry = { _id: false, day: String, minutes: { type: Number, default: null } };
const times = { _id: false, checkInAt: { type: Date, default: null }, checkOutAt: { type: Date, default: null } };
const schema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    registrationId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ['REPORT', 'MANUAL'], default: 'REPORT' },
    reportId: { type: Schema.Types.ObjectId, default: null },
    actorId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, default: '', maxlength: 300 },
    before: { type: [entry], default: [] },
    after: { type: [entry], default: [] },
    beforeTimes: { type: times, default: null },
    afterTimes: { type: times, default: null },
    previousStatus: String,
    status: String,
  },
  { timestamps: true, versionKey: false },
);
export const AttendanceCorrectionModel = mongoose.models.AttendanceCorrection || model('AttendanceCorrection', schema);
