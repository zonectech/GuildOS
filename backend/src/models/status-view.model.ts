import mongoose, {
  Schema,
  model,
  type Model,
} from 'mongoose';

export type StatusViewDocument = {
  statusId: mongoose.Types.ObjectId;
  viewerId: mongoose.Types.ObjectId;
  viewedAt: Date;
};

const statusViewSchema =
  new Schema<StatusViewDocument>(
    {
      statusId: {
        type: Schema.Types.ObjectId,
        ref: 'StatusStory',
        required: true,
        index: true,
      },

      viewerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },

      viewedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      versionKey: false,
    },
  );

statusViewSchema.index(
  {
    statusId: 1,
    viewerId: 1,
  },
  {
    unique: true,
  },
);

export type StatusViewModelType =
  Model<StatusViewDocument>;

export const StatusViewModel =
  (mongoose.models.StatusView as StatusViewModelType) ??
  model<StatusViewDocument>(
    'StatusView',
    statusViewSchema,
  );