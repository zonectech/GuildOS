import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type CvTemplate = 'PROFESSIONAL' | 'MODERN' | 'EXECUTIVE' | 'ACADEMIC' | 'TECHNICAL';
export type CvMode = 'INTERNSHIP' | 'SCHOLARSHIP' | 'LEADERSHIP' | 'TECHNICAL';

export type CvLeadershipItem = {
  title: string;
  organization: string;
  startDate: Date | null;
  endDate: Date | null;
  current: boolean;
  verified: boolean;
  bullets: string[];
};

export type CvExperienceItem = {
  kind: 'VOLUNTEER' | 'SPEAKER' | 'ORGANIZER' | 'PROJECT';
  title: string;
  organization: string;
  period: string;
  url: string;
  bullets: string[];
};

export type CvCertificationItem = {
  title: string;
  issuer: string;
  date: Date | null;
  serial: string;
  verifyUrl: string;
  status: string;
};

export type CvContent = {
  header: { fullName: string; email: string; phone: string; location: string; publicProfileUrl: string };
  summary: string;
  education: { university: string; course: string; graduationYear: number | null; level: string; achievements: string[] };
  leadership: CvLeadershipItem[];
  experience: CvExperienceItem[];
  certifications: CvCertificationItem[];
  skills: string[];
  projects: Array<{ name: string; description: string; url: string; role: string }>;
  awards: string[];
  guildScore: { score: number; level: string } | null;
};

export type CvCustomization = {
  hideCertificates: boolean;
  hideGuildScore: boolean;
  sectionOrder: string[];
};

export type CvDocumentDocument = {
  userId: mongoose.Types.ObjectId;
  cvId: string;
  verificationId: string;
  template: CvTemplate;
  mode: CvMode;
  publicUrl: string;
  content: CvContent;
  customization: CvCustomization;
  source: { certificates: number; roles: number; events: number };
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const cvDocumentSchema = new Schema<CvDocumentDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cvId: { type: String, required: true, unique: true, index: true },
    verificationId: { type: String, required: true, unique: true, index: true },
    template: { type: String, enum: ['PROFESSIONAL', 'MODERN', 'EXECUTIVE', 'ACADEMIC', 'TECHNICAL'], default: 'PROFESSIONAL' },
    mode: { type: String, enum: ['INTERNSHIP', 'SCHOLARSHIP', 'LEADERSHIP', 'TECHNICAL'], default: 'INTERNSHIP' },
    publicUrl: { type: String, default: '' },
    content: { type: Schema.Types.Mixed, required: true },
    customization: {
      hideCertificates: { type: Boolean, default: false },
      hideGuildScore: { type: Boolean, default: false },
      sectionOrder: { type: [String], default: [] },
    },
    source: {
      certificates: { type: Number, default: 0 },
      roles: { type: Number, default: 0 },
      events: { type: Number, default: 0 },
    },
    aiGenerated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type CvDocumentModelType = Model<CvDocumentDocument>;
export type CvDocumentHydratedDocument = HydratedDocument<CvDocumentDocument>;

export const CvDocumentModel =
  (mongoose.models.CvDocument as CvDocumentModelType) ?? model<CvDocumentDocument>('CvDocument', cvDocumentSchema);
