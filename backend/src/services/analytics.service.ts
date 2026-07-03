import type { Model } from 'mongoose';
import { UserModel } from '../models/user.model';
import { CommunityModel } from '../models/community.model';
import { EventModel } from '../models/event.model';
import { MembershipModel } from '../models/membership.model';
import { CertificateModel } from '../models/certificate.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { OpportunityModel } from '../models/opportunity.model';

type MonthBucket = { year: number; monthNum: number; label: string; start: Date };

function lastMonths(count: number): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      monthNum: d.getMonth() + 1,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      start: d,
    });
  }
  return buckets;
}

async function monthlyCounts(
  model: Model<any>,
  dateField: string,
  months: MonthBucket[],
  extraMatch: Record<string, unknown> = {},
): Promise<number[]> {
  const start = months[0].start;
  const rows = await model.aggregate<{ _id: { y: number; m: number }; count: number }>([
    { $match: { [dateField]: { $gte: start, $type: 'date' }, ...extraMatch } },
    { $group: { _id: { y: { $year: `$${dateField}` }, m: { $month: `$${dateField}` } }, count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((r) => [`${r._id.y}-${r._id.m}`, r.count]));
  return months.map((mo) => map.get(`${mo.year}-${mo.monthNum}`) ?? 0);
}

export async function getPlatformAnalytics(monthCount = 8) {
  const months = lastMonths(monthCount);

  const [attendance, events, memberships, certificates] = await Promise.all([
    monthlyCounts(EventRegistrationModel, 'checkInAt', months),
    monthlyCounts(EventModel, 'createdAt', months),
    monthlyCounts(MembershipModel, 'joinedAt', months),
    monthlyCounts(CertificateModel, 'issuedAt', months),
  ]);

  const [users, communitiesTotal, eventsTotal, certificatesTotal, opportunitiesTotal, checkInsTotal] = await Promise.all([
    UserModel.countDocuments(),
    CommunityModel.countDocuments(),
    EventModel.countDocuments(),
    CertificateModel.countDocuments({ status: 'VERIFIED' }),
    OpportunityModel.countDocuments(),
    EventRegistrationModel.countDocuments({ checkInAt: { $ne: null } }),
  ]);

  return {
    labels: months.map((m) => m.label),
    series: {
      attendance,
      events,
      memberships,
      certificates,
    },
    totals: {
      users,
      communities: communitiesTotal,
      events: eventsTotal,
      certificates: certificatesTotal,
      opportunities: opportunitiesTotal,
      checkIns: checkInsTotal,
    },
  };
}
