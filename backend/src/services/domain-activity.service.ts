import { authStore } from '../store/auth-store';
import { buildCanonicalProfileSnapshot } from './profile-propagation.service';

export type DomainRecordType = 'CERTIFICATE' | 'EVENT' | 'COMMUNITY' | 'LEADERSHIP';

export type DomainActivityRecord = {
  id: string;
  userId: string;
  type: DomainRecordType;
  title: string;
  description: string;
  occurredAt: string;
  profileSnapshot: {
    fullName: string;
    username: string;
    avatar: string;
    university: string;
    faculty: string;
    department: string;
    level: string;
    interests: string[];
  };
};

export async function buildDomainActivityRecord(
  userId: string,
  type: DomainRecordType,
  title: string,
  description: string,
  occurredAt = new Date().toISOString(),
): Promise<DomainActivityRecord | null> {
  const user = await authStore.getUserById(userId);
  if (!user) return null;

  const snapshot = await buildCanonicalProfileSnapshot(userId);
  if (!snapshot) return null;

  return {
    id: `${type.toLowerCase()}-${userId}-${Date.now()}`,
    userId,
    type,
    title,
    description,
    occurredAt,
    profileSnapshot: {
      fullName: snapshot.fullName,
      username: snapshot.username,
      avatar: snapshot.avatar,
      university: snapshot.university,
      faculty: snapshot.faculty,
      department: snapshot.department,
      level: snapshot.level,
      interests: snapshot.interests,
    },
  };
}

export async function refreshDomainActivitiesForUser(userId: string) {
  const snapshot = await buildCanonicalProfileSnapshot(userId);
  if (!snapshot) return null;

  return {
    certificates: [] as DomainActivityRecord[],
    events: [] as DomainActivityRecord[],
    communities: [] as DomainActivityRecord[],
    leadership: [] as DomainActivityRecord[],
    profileSnapshot: snapshot,
  };
}
