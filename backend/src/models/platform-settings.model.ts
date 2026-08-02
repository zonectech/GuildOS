import mongoose, { Schema, model, type Model } from 'mongoose';
import type { SponsorshipPackage } from './event.model';

export type PlatformSettingsDocument = {
  key: string;
  sponsorshipFeePercent: number;
  feeBankName: string;
  feeAccountNumber: string;
  feeAccountName: string;
  sponsorshipPackageTemplates: SponsorshipPackage[];
  premiumMonthlyPrice: number;
  premiumEventPrice: number;
  /** GuildOS commission on paid event tickets, percent of the ticket price (e.g. 10 = 10%). */
  ticketCommissionPercent: number;
  /** How organizer payouts are settled: MANUAL = admin bank transfer; AUTO = gateway Transfers API on request. */
  payoutMode: 'MANUAL' | 'AUTO';
  gatewayFeePercent: number;
  gatewayFeeFlatNgn: number;
  gatewayFeeCapNgn: number;
  gatewayFeeWaiverNgn: number;
  paymentGateway: 'PAYSTACK' | 'FLUTTERWAVE';
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
    premiumMonthlyPrice: { type: Number, default: 5000 },
    premiumEventPrice: { type: Number, default: 400 },
    ticketCommissionPercent: { type: Number, default: 10 },
    payoutMode: { type: String, enum: ['MANUAL', 'AUTO'], default: 'MANUAL' },
    gatewayFeePercent: { type: Number, default: 1.5 },
    gatewayFeeFlatNgn: { type: Number, default: 100 },
    gatewayFeeCapNgn: { type: Number, default: 2000 },
    gatewayFeeWaiverNgn: { type: Number, default: 2500 },
    paymentGateway: { type: String, enum: ['PAYSTACK', 'FLUTTERWAVE'], default: 'PAYSTACK' },
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
