/** Starts the private test database and then the API against it. See test-env.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { applyTestEnv, assertLocalDatabase, TEST_DB_NAME, TEST_DB_PORT, TEST_DB_REPLICA_SET, TEST_DB_URI } from './test-env';

async function main() {
  applyTestEnv();
  assertLocalDatabase(process.env.MONGODB_URI as string);
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  const dbPath = path.resolve(process.cwd(), '.testdb');
  fs.mkdirSync(dbPath, { recursive: true });
  // Kept on disk between runs, so a restart of the API does not lose the test data.
  // A one-member replica set, because issuing certificates uses transactions.
  const mongo = await MongoMemoryReplSet.create({
    replSet: { name: TEST_DB_REPLICA_SET, count: 1, dbName: TEST_DB_NAME, storageEngine: 'wiredTiger' },
    instanceOpts: [{ port: TEST_DB_PORT, dbPath, launchTimeout: 90_000 }],
  });
  console.log(`[test] Database ready at ${TEST_DB_URI} (files in backend/.testdb). Live credentials are blanked.`);
  const stop = () => void mongo.stop({ doCleanup: false }).finally(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await import('../src/server');
}

main().catch((err) => { console.error('[test] Could not start:', err instanceof Error ? err.message : err); process.exit(1); });
