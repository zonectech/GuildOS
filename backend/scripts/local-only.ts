/**
 * Import this first in any script that creates test or demo data:
 *
 *   import './scripts/local-only';   (or './local-only' from inside scripts/)
 *
 * backend/.env points at the database the live site uses. A seed, demo or live-test script run
 * with it would write made-up people into production, so this stops the script before it connects,
 * unless the database is on this machine (the test database from `npm run dev:test`).
 *
 * To run one of these scripts against the test database:
 *   MONGODB_URI="mongodb://127.0.0.1:27018/ontheroll_test?replicaSet=testset&directConnection=true" npx tsx <script>
 * (Variables you set yourself win over .env.)
 */
import 'dotenv/config';

export const isLocalDatabase = (uri = process.env.MONGODB_URI ?? '') => /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

if (!isLocalDatabase()) {
  console.error('Refusing to run: this script creates test data, and MONGODB_URI is not a database on this machine.');
  console.error('Start the test database with "npm run dev:test" and point MONGODB_URI at it (see scripts/local-only.ts).');
  process.exit(1);
}
