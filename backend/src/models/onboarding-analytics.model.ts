import mongoose, { Schema, model, type Model } from 'mongoose';

export type OnboardingAnalyticsEventName =
  | 'onboarding_student_toggle_changed'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_completion_failed';

export type OnboardingAnalyticsDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  eventName: OnboardingAnalyticsEventName;
  isStudent: boolean;
  university: string;
  courseOfStudy: string;
  stepIndex: number | null;
  stepTitle: string;
  hasLocation: boolean | null;
  interestsCount: number | null;
  createdAt: Date;
};

type OnboardingAnalyticsModelType = Model<OnboardingAnalyticsDocument>;

const onboardingAnalyticsSchema = new Schema<OnboardingAnalyticsDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    eventName: {
      type: String,
      enum: [
        'onboarding_student_toggle_changed',
        'onboarding_step_completed',
        'onboarding_completed',
        'onboarding_completion_failed',
      ],
      required: true,
      index: true,
    },
    isStudent: { type: Boolean, required: true, index: true },
    university: { type: String, default: '' },
    courseOfStudy: { type: String, default: '' },
    stepIndex: { type: Number, default: null },
    stepTitle: { type: String, default: '' },
    hasLocation: { type: Boolean, default: null },
    interestsCount: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    versionKey: false,
  },
);

onboardingAnalyticsSchema.index({ eventName: 1, createdAt: -1 });
onboardingAnalyticsSchema.index({ isStudent: 1, eventName: 1, createdAt: -1 });

export const OnboardingAnalyticsModel =
  (mongoose.models.OnboardingAnalytics as OnboardingAnalyticsModelType) ??
  model<OnboardingAnalyticsDocument>('OnboardingAnalytics', onboardingAnalyticsSchema);
