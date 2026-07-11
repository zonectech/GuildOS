import mongoose, { Schema, model, type Model } from 'mongoose';

export type ConnectionStatus = 'PENDING' | 'ACCEPTED';

export type ConnectionDocument = {
  _id: mongoose.Types.ObjectId;
  requesterId: mongoose.Types.ObjectId;
  addresseeId: mongoose.Types.ObjectId;
  pairKey: string;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
};

type ConnectionModelType = Model<ConnectionDocument>;

const connectionSchema = new Schema<ConnectionDocument>(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    addresseeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Sorted "minId_maxId" so a pair is unique regardless of direction.
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED'], default: 'PENDING', index: true },
  },
  { timestamps: true },
);

export function connectionPairKey(a: string, b: string) {
  return [a, b].sort().join('_');
}

export const ConnectionModel =
  (mongoose.models.Connection as ConnectionModelType) ?? model<ConnectionDocument>('Connection', connectionSchema);
