/**
 * The test environment: a throwaway local database and NO live credentials.
 *
 * backend/.env points at the database the live site uses. Anything that tries flows end to end
 * (sign up, publish, announce, finalize) must never run against it. These scripts start the same
 * backend against a private MongoDB that lives in backend/.testdb on this machine:
 *
 *   npm run dev:test            start the test database and the API on port 3001
 *   npm run demo:test           fill it with the demo data (run while dev:test is up)
 *   npm run demo:test -- remove empty the demo data again
 *
 * Delete backend/.testdb to start from nothing.
 */
export const TEST_DB_PORT = 27018;
export const TEST_DB_NAME = 'ontheroll_test';
export const TEST_DB_REPLICA_SET = 'testset';
export const TEST_DB_URI = `mongodb://127.0.0.1:${TEST_DB_PORT}/${TEST_DB_NAME}?replicaSet=${TEST_DB_REPLICA_SET}&directConnection=true`;

/** Every setting that could reach a real service. Blanked BEFORE the backend loads, so .env cannot fill them in. */
const LIVE_ONLY = [
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FEEDBACK_EMAIL',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL',
  'PAYSTACK_PUBLIC_KEY', 'PAYSTACK_SECRET_KEY',
  'FLUTTERWAVE_CLIENT_ID', 'FLUTTERWAVE_CLIENT_SECRET', 'FLUTTERWAVE_ENCRYPTION_KEY', 'FLUTTERWAVE_PUBLIC_KEY', 'FLUTTERWAVE_SECRET_HASH', 'FLUTTERWAVE_SECRET_KEY',
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'JOOBLE_API_KEY',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY',
  'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'COOKIE_DOMAIN',
];

export function applyTestEnv() {
  for (const key of LIVE_ONLY) process.env[key] = '';
  Object.assign(process.env, {
    MONGODB_URI: TEST_DB_URI,
    NODE_ENV: 'development',
    PORT: process.env.TEST_API_PORT ?? '3001',
    JWT_SECRET: 'test-only-secret-never-used-outside-this-machine',
    CORS_ORIGIN: 'http://localhost:3000,http://localhost:3002,http://localhost:3003',
    FRONTEND_URL: 'http://localhost:3003',
    LEGACY_FRONTEND_URL: 'http://localhost:3002',
    COOKIE_SAMESITE: 'lax',
    OPPORTUNITY_SYNC_ENABLED: 'false',
    BRAND_NAME: 'OnTheRoll',
  });
  // A local fake inbox (Mailpit) can be plugged in: TEST_SMTP_HOST=127.0.0.1 TEST_SMTP_PORT=1025.
  if (process.env.TEST_SMTP_HOST) {
    process.env.SMTP_HOST = process.env.TEST_SMTP_HOST;
    process.env.SMTP_PORT = process.env.TEST_SMTP_PORT ?? '1025';
    process.env.EMAIL_FROM = 'OnTheRoll test <no-reply@ontheroll.test>';
  }
}

/** A last check any test script can make before it writes: the address must be this machine. */
export function assertLocalDatabase(uri: string) {
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error('Refusing to continue: the database is not on this machine.');
}
