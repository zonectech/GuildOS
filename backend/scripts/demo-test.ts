/** Runs the demo data script against the private test database (start it first with `npm run dev:test`). */
import { applyTestEnv, assertLocalDatabase } from './test-env';

applyTestEnv();
assertLocalDatabase(process.env.MONGODB_URI as string);
void import('./demo-data');
