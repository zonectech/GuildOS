import mongoose, { Schema, model, type Model } from 'mongoose';
import type { SponsorshipPackage } from './event.model';

export type PlatformSettingsDocument = {
  key: string;
  sponsorshipFeePercent: number;
  feeBankName: string;
  feeAccountNumber: string;
  feeAccountName: string;
  sponsorshipPackageTemplates: SponsorshipPackage[];
  updatedAt: Date;
};

const platformSettingsSchema = new Schema<PlatformSettingsDocument>(
  {
    key: { type: String, required: true, unique: true },
    sponsorshipFeePercent: { type: Number, default: 10 },
    feeBankName: { type: String, default: '', trim: true },
    feeAccountNumber: { type: String, default: '', trim: true },
    feeAccountName: { type: String, default: '', trim: true },
    sponsorshipPackageTemplates: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          price: { type: String, default: '', trim: true },
          perks: { type: [String], default: [] },
          benefits: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
  },
);

export type PlatformSettingsModelType = Model<PlatformSettingsDocument>;

export const PlatformSettingsModel =
  (mongoose.models.PlatformSettings as PlatformSettingsModelType) ??
  model<PlatformSettingsDocument>('PlatformSettings', platformSettingsSchema);
