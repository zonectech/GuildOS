export const config = {
  port: Number(process.env.PORT ?? 3001),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/guildos',
  // Comma-separated, so the current site and the new website can both call the API.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002').split(',').map((origin) => origin.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  // Every callback page Google may send people back to: the current site's and the new website's.
  // The first is the default. Each must also be listed in the Google Cloud console.
  googleRedirectUris: [process.env.GOOGLE_REDIRECT_URI, ...(process.env.GOOGLE_REDIRECT_URIS ?? '').split(',')]
    .map((uri) => uri?.trim() ?? '')
    .filter((uri, index, all) => uri && all.indexOf(uri) === index),
  // The website students use. Links to pages it has go here (see utils/site-link.ts).
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  // The current site, still used for admin, sponsors, premium, hackathon judging and other
  // pages the new website does not have. Defaults to FRONTEND_URL, so one site keeps working alone.
  legacyFrontendUrl: process.env.LEGACY_FRONTEND_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:3000',
  // The name and colour in emails and PDFs. Change with the brand; the website has its own copy in web/lib/brand.ts.
  brandName: process.env.BRAND_NAME ?? 'GuildOS',
  brandColor: process.env.BRAND_COLOR ?? '#4f46e5',
  emailFrom: process.env.EMAIL_FROM ?? 'GuildOS <no-reply@guildos.local>',
  smtpHost: process.env.SMTP_HOST,
  // Jobs/Opportunities are off unless OPPORTUNITIES_ENABLED=true (pair with NEXT_PUBLIC_OPPORTUNITIES_ENABLED on the frontend).
  opportunitiesEnabled: process.env.OPPORTUNITIES_ENABLED === 'true',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  accessTokenTtlMs: 1000 * 60 * 60 * 24 * 7,
  refreshTokenTtlMs: 1000 * 60 * 60 * 24 * 30,
  verificationTokenTtlMs: 1000 * 60 * 60 * 24,
  resetTokenTtlMs: 1000 * 60 * 30,
  cookieDomain: process.env.COOKIE_DOMAIN,
  // 'none' is required when the frontend and backend live on different sites
  // (e.g. *.vercel.app + *.azurewebsites.net); browsers then demand Secure too.
  cookieSameSite: (process.env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax') as 'none' | 'lax',
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  // Google Gemma (via the Gemini API's OpenAI-compatible endpoint). GEMINI_API_KEY = the "Gemma token".
  geminiApiKey: process.env.GEMINI_API_KEY,
  gemmaModel: process.env.GEMMA_MODEL ?? 'gemma-3-27b-it',
  // Which provider the AI features use. Defaults to whichever key is present (OpenAI wins ties).
  aiProvider: (process.env.AI_PROVIDER
    ?? (process.env.OPENAI_API_KEY ? 'openai' : process.env.GEMINI_API_KEY ? 'gemma' : 'openai')) as 'openai' | 'gemma',
  eventReminderIntervalMs: Number(process.env.EVENT_REMINDER_INTERVAL_MS ?? 1000 * 60 * 15),
  eventReminderWindowMs: Number(process.env.EVENT_REMINDER_WINDOW_MS ?? 1000 * 60 * 60 * 24),
  eventFinalizeIntervalMs: Number(process.env.EVENT_FINALIZE_INTERVAL_MS ?? 1000 * 60 * 30),
  // Long enough for a late-running event to finish checking out before attendance closes.
  // How long after an event ends its attendance is finalized automatically, if the organizer has not done it.
  // Organizers are told when the event ends (see notifyOrganizersToReviewAttendance).
  eventFinalizeGraceMs: Number(process.env.EVENT_FINALIZE_GRACE_MS ?? 1000 * 60 * 60 * 24),
  opportunitySyncIntervalMs: Number(process.env.OPPORTUNITY_SYNC_INTERVAL_MS ?? 1000 * 60 * 60 * 6),
  opportunitySyncEnabled: process.env.OPPORTUNITY_SYNC_ENABLED === 'true',
  adzunaAppId: process.env.ADZUNA_APP_ID,
  adzunaAppKey: process.env.ADZUNA_APP_KEY,
  adzunaCountry: process.env.ADZUNA_COUNTRY ?? 'gb',
  joobleApiKey: process.env.JOOBLE_API_KEY,
  joobleKeywords: process.env.JOOBLE_KEYWORDS ?? 'internship',
  joobleLocation: process.env.JOOBLE_LOCATION ?? '',
  opportunityRssFeeds: (process.env.OPPORTUNITY_RSS_FEEDS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
  rateLimitWindowMs: 1000 * 60,
  // Per address + path, per minute. A campus or hostel network shares one address, so this is a flood
  // guard only (the old value of 40 would lock a lecture hall out of the events list). Abuse-prone
  // endpoints have their own much stricter per-account limits in middleware/rate-limit.ts.
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 600,
  adminEmail: process.env.ADMIN_EMAIL,
  /** Where "Send feedback" messages are copied. Empty: they are only stored (see scripts/weekly-report.ts). */
  feedbackEmail: process.env.FEEDBACK_EMAIL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD,
  adminName: process.env.ADMIN_NAME ?? 'GuildOS Admin',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
  flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ?? '',
  flutterwaveSecretHash: process.env.FLUTTERWAVE_SECRET_HASH ?? '',
  // Flutterwave v4 (OAuth) — used when the v3 secret key is not set.
  flutterwaveClientId: process.env.FLUTTERWAVE_CLIENT_ID ?? '',
  flutterwaveClientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET ?? '',
  flutterwaveEncryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY ?? '',
  flutterwaveV4Env: (process.env.FLUTTERWAVE_V4_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
  // Web push (PWA device notifications)
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:no-reply@guildos.local',
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    // Public base URL of the bucket (r2.dev URL or a custom domain), e.g. https://pub-xxxx.r2.dev
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? '',
  },
};
