/**
 * Runs every live event/money suite in sequence against the local dev server + DB.
 * Usage: npm run test:live   (backend server must be running on :3001)
 * Suites are independent and clean up after themselves; a non-zero exit from any
 * suite fails the whole run so this can gate releases.
 */
import { spawnSync } from 'node:child_process';

const SUITES = [
  'live-test-event-lifecycle.ts',
  'live-test-multiday.ts',
  'live-test-sections.ts',
  'live-test-venue-change.ts',
  'live-test-partnerships.ts',
  'live-test-knowledge.ts',
  'live-test-ticketing-v2.ts',
  'live-test-reclaim.ts',
  'live-test-escrow.ts',
  'live-test-day-cancel.ts',
  'live-test-features.ts',
  'live-test-door-scanner.ts',
  'live-test-engagement.ts',
  'live-test-cv-credentials.ts',
];

let failed = 0;
for (const suite of SUITES) {
  console.log(`\n\x1b[36m━━ ${suite} ━━\x1b[0m`);
  let result = spawnSync('npx', ['tsx', '--env-file=.env', suite], { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    // Transient dev-server blips (tsx watch restarting mid-run) surface as one-off
    // "fetch failed" crashes — a single retry separates those from real failures.
    console.log(`\x1b[33m${suite} failed — retrying once in case of a transient connection blip…\x1b[0m`);
    result = spawnSync('npx', ['tsx', '--env-file=.env', suite], { stdio: 'inherit', shell: true });
  }
  if (result.status !== 0) {
    failed += 1;
    console.error(`\x1b[31m${suite} FAILED\x1b[0m`);
  }
}

console.log(failed ? `\n\x1b[31m${failed} suite(s) failed\x1b[0m` : '\n\x1b[32mAll live suites passed\x1b[0m');
process.exit(failed ? 1 : 0);
