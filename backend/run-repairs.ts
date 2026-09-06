import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { repairAllCommunityEventCounts, repairAllEventRegistrationCounters } from './src/services/event/event-shared';
import { repairAllCommunityMemberCounts } from './src/services/community/community-membership.service';
(async () => {
  await connectDatabase();
  console.log('events:', await repairAllCommunityEventCounts());
  console.log('members:', await repairAllCommunityMemberCounts());
  console.log('regCounters:', await repairAllEventRegistrationCounters());
  // idempotence
  console.log('re-run members:', await repairAllCommunityMemberCounts());
  console.log('re-run regCounters:', await repairAllEventRegistrationCounters());
  await mongoose.disconnect();
})();
