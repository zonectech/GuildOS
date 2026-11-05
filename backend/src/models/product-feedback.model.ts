import mongoose, { Schema, model, type Model } from 'mongoose';

/** A message sent with "Send feedback" on the website: what to fix or add, from a student or organizer. */
export type ProductFeedbackDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  /** Reply address for someone not signed in; empty when they are (their account email is used). */
  email: string;
  message: string;
  /** The page they were on, so "this button does nothing" can be found. */
  page: string;
  createdAt: Date;
  updatedAt: Date;
};

const productFeedbackSchema = new Schema<ProductFeedbackDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, default: '', trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    page: { type: String, default: '', trim: true, maxlength: 300 },
  },
  { timestamps: true, versionKey: false },
);

productFeedbackSchema.index({ createdAt: -1 });

export type ProductFeedbackModelType = Model<ProductFeedbackDocument>;

export const ProductFeedbackModel =
  (mongoose.models.ProductFeedback as ProductFeedbackModelType) ?? model<ProductFeedbackDocument>('ProductFeedback', productFeedbackSchema);
