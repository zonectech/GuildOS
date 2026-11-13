/** Starts the private test database and then the API against it. See test-env.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { applyTestEnv, assertLocalDatabase, TEST_DB_NAME, TEST_DB_PORT, TEST_DB_URI } from './test-env';

async function main() {
  applyTestEnv();
  assertLocalDatabase(process.env.MONGODB_URI as string);
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.resolve(process.cwd(), '.testdb');
  fs.mkdirSync(dbPath, { recursive: true });
  // Kept on disk between runs, so a restart of the API does not lose the test data.
  const mongo = await MongoMemoryServer.create({ instance: { port: TEST_DB_PORT, dbName: TEST_DB_NAME, dbPath, storageEngine: 'wiredTiger', launchTimeout: 90_000 } });
  console.log(`[test] Database ready at ${TEST_DB_URI} (files in backend/.testdb). Live credentials are blanked.`);
  const stop = () => void mongo.stop({ doCleanup: false }).finally(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await import('../src/server');
}

main().catch((err) => { console.error('[test] Could not start:', err instanceof Error ? err.message : err); process.exit(1); });
