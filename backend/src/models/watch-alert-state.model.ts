import mongoose, { Schema, model, type Model } from 'mongoose';

export type WatchAlertStatus = 'DISMISSED' | 'SNOOZED';

export type WatchAlertStateDocument = {
  alertKey: string;
  status: WatchAlertStatus;
  snoozedUntil: Date | null;
  actorId: mongoose.Types.ObjectId | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

const watchAlertStateSchema = new Schema<WatchAlertStateDocument>(
  {
    alertKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['DISMISSED', 'SNOOZED'], required: true },
    snoozedUntil: { type: Date, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

export type WatchAlertStateModelType = Model<WatchAlertStateDocument>;

export const WatchAlertStateModel =
  (mongoose.models.WatchAlertState as WatchAlertStateModelType) ??
  model<WatchAlertStateDocument>('WatchAlertState', watchAlertStateSchema);
