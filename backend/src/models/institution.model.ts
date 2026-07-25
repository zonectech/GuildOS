import mongoose, { Schema, model, type Model } from 'mongoose';

export type InstitutionDocument = {
  name: string;
  normalizedName: string;
  aliases: string[];
  normalizedAliases: string[];
  emailDomains: string[];
  country: string;
  active: boolean;
  verifiedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const institutionSchema = new Schema<InstitutionDocument>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], default: [] },
    normalizedAliases: { type: [String], default: [], index: true },
    emailDomains: { type: [String], required: true, default: [], index: true },
    country: { type: String, default: '', uppercase: true, trim: true },
    active: { type: Boolean, default: true, index: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export type InstitutionModelType = Model<InstitutionDocument>;
export const InstitutionModel =
  (mongoose.models.Institution as InstitutionModelType) ?? model<InstitutionDocument>('Institution', institutionSchema);