// This file used to hold the entire community domain (~1500 lines: roles/
// permissions, CRUD, membership, leadership history, endorsements, admin
// verification). It has been split into focused modules under ./community/
// for maintainability. This barrel re-exports everything so existing imports
// (`from './community.service'` or `from '../services/community.service'`)
// keep working unchanged.
export * from './community/community-shared';
export * from './community/community-core.service';
export * from './community/community-membership.service';
export * from './community/community-leadership.service';
export * from './community/community-endorsement.service';
export * from './community/community-admin.service';
