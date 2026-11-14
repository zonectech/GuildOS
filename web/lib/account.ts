// Account, profile, score, certificates, notifications, sign-in extras and event extras.
import { API_BASE_URL, api, type EventStatus, type EventSummary, type Registration, type User } from './api';
import type { CertificateContent, CertificateNamePlacement, CertificateTheme, TicketQrBox } from './certificate/types';

const id = encodeURIComponent;

export type Profile = {
  username?: string; avatar?: string; bio?: string; university?: string; faculty?: string; department?: string; level?: string;
  location?: string; interests?: string[]; skills?: string[]; socialLinks?: string[]; phoneNumber?: string;
  profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED'; showEmail?: boolean; showPhoneNumber?: boolean; showLocation?: boolean; showSocialLinks?: boolean;
  showUniversity?: boolean; showLeadership?: boolean; showCertificates?: boolean; showTimeline?: boolean;
};
export type FullUser = Omit<User, 'profile'> & { profile: Profile };
export type Reputation = { guildScore: number; level: string; nextLevelAt: number | null; attendanceScore: number; leadershipScore: number; volunteerScore: number; speakerScore: number; organizerScore: number };
export type CertificateItem = { serial: string; eventTitle: string; communityName: string; type: string; status: string; issuedAt: string };
export type MyRegistration = {
  registration: { id: string; status: Registration['status']; qrToken: string; checkInAt: string | null; checkOutAt: string | null };
  event: { id: string; title: string; slug: string; startDate: string | null; venue: string; mode: string; status: EventStatus };
};
export type AppNotification = { id: string; type: string; title: string; body: string; link: string; read: boolean; createdAt: string };
export type VerifiedCertificate = {
  verified: boolean; status: 'VERIFIED' | 'REVOKED' | 'EXPIRED' | 'INVALID'; serial: string; attendeeName: string; eventTitle: string; communityName: string; university: string;
  type: string; mode: 'STANDARD' | 'CUSTOM'; templateImage: string; namePlacement: CertificateNamePlacement; qrBox: TicketQrBox | null;
  theme: CertificateTheme; content: CertificateContent; style: string; eventDate: string | null;
  attendanceEvidence: string; attendanceMinutes: number; daysAttended: number; totalDays: number; sectionName: string; verificationUrl: string;
  revokeReason: string; invalidationReason: string; expiresAt: string | null; issueDate: string;
  sponsors: { name: string; logo: string }[]; partners: { name: string; logo: string }[]; coHosts: { name: string; logo: string }[];
};

export const getFullProfile = () => api<{ user: FullUser }>('/api/profile');
export const saveProfile = (input: Partial<Profile> & { fullName?: string }) => api<{ user: FullUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(input) });
export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append('avatar', file);
  return api<{ user: FullUser }>('/api/profile/avatar', { method: 'PATCH', body: form });
}
export const savePrivacy = (input: Partial<Profile>) => api<{ user: FullUser }>('/api/profile/privacy', { method: 'PATCH', body: JSON.stringify(input) });
export const changePassword = (currentPassword: string, newPassword: string) =>
  api<{ message: string }>('/api/profile/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
export const deleteAccount = () => api<{ message: string }>('/api/profile', { method: 'DELETE' });
export const exportUrl = () => `${API_BASE_URL}/api/profile/export`;
export const completeOnboarding = () => api<{ user: User }>('/api/profile/onboarding/complete', { method: 'POST' });
export const getPublicProfile = (username: string) => api<{ user: FullUser }>(`/api/profile/${id(username)}`);
export type StampRole = 'ATTENDED' | 'HOSTED' | 'CO_HOSTED';
export type AttendanceStamp = {
  role: StampRole; attendedCount: number; evidence?: 'SCANNED' | 'REPORTED';
  eventId: string; eventTitle: string; eventSlug: string; eventType: string; startDate: string | null; timezone: string;
  communityName: string; communitySlug: string; checkInAt: string | null; checkOutAt: string | null; daysAttended: number; certificateSerial: string | null;
};
export const getAttendanceStamps = (username: string) => api<{ stamps: AttendanceStamp[] }>(`/api/profile/${id(username)}/attendance`);
export const getPublicCertificates = (username: string) => api<{ certificates: CertificateItem[] }>(`/api/profile/${id(username)}/certificates`);
export const myReputation = () => api<{ reputation: Reputation }>('/api/reputation/me');
export const reputationSummary = (userId: string) => api<{ reputation: Reputation }>(`/api/reputation/${id(userId)}/summary`);
export const myCertificates = () => api<{ certificates: CertificateItem[] }>('/api/certificates/mine');
export const verifyCertificate = (serial: string) => api<{ certificate: VerifiedCertificate }>(`/api/certificates/verify/${id(serial)}`);
export const certificatePdfUrl = (serial: string) => `${API_BASE_URL}/api/certificates/${id(serial)}/pdf`;
export const myRegistrations = () => api<{ registrations: MyRegistration[] }>('/api/users/me/registrations');
export const savedEvents = () => api<{ events: EventSummary[] }>('/api/events/bookmarks/mine');
export const toggleSaved = (eventId: string) => api<{ bookmarked: boolean }>(`/api/events/${id(eventId)}/bookmark`, { method: 'POST' });
export const listNotifications = (before?: string) => api<{ notifications: AppNotification[]; nextCursor: string | null }>(`/api/notifications${before ? `?before=${id(before)}` : ''}`);
export const unreadCount = () => api<{ count: number }>('/api/notifications/unread-count');
export const readAllNotifications = () => api('/api/notifications/read-all', { method: 'POST' });
export const readNotification = (notificationId: string) => api(`/api/notifications/${id(notificationId)}/read`, { method: 'POST' });
export const getNotificationPrefs = () => api<{ newEventEmailEnabled: boolean }>('/api/notifications/preferences');
export const saveNotificationPrefs = (newEventEmailEnabled: boolean) =>
  api<{ newEventEmailEnabled: boolean }>('/api/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ newEventEmailEnabled }) });
export const verifyEmail = (token: string) => api<{ user: User; message: string }>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
export const resendVerification = (email: string) => api<{ message: string }>('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
export const forgotPassword = (email: string) => api<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
export const resetPassword = (token: string, password: string) => api<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
// Google sends people back to this site's own callback page, not the current site's.
export const googleAuthUrl = () => api<{ authUrl: string }>(`/api/oauth/google?redirectUri=${id(`${window.location.origin}/oauth/google/callback`)}`);
export const completeGoogle = (code: string, state: string) => api<{ user: User; nextRoute: string }>(`/api/oauth/google/callback?code=${id(code)}&state=${id(state)}`);

export type EventDay = { date: string | null; theme: string; venue: string; startTime: string; endTime: string; capacity?: number };
export type EventSection = { key: string; name: string; description: string; capacity: number; venue: string; chatLink?: string };
export type EventPartnerOrg = { name: string; logo: string; website: string };
export type SpeakerType = 'WORKSHOP' | 'PANEL' | 'GUEST' | 'TRAINER';
export type Speaker = { _id: string; fullName: string; title: string; organization: string; bio: string; photo: string; speakerType: SpeakerType };
export type Partnership = { _id: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; community?: { name: string; slug: string; logo: string } | null };
export function uploadEventFile(field: 'speakerPhoto' | 'partnerLogo' | 'certificateTemplate' | 'signature' | 'certificateLogo', file: File) {
  const form = new FormData();
  form.append(field, file);
  return api<Record<string, string>>('/api/events/upload', { method: 'POST', body: form });
}
export const addSpeaker = (eventId: string, input: Omit<Speaker, '_id'>) => api<{ speaker: Speaker }>(`/api/events/${id(eventId)}/speakers`, { method: 'POST', body: JSON.stringify(input) });
export const removeSpeaker = (eventId: string, speakerId: string) => api(`/api/events/${id(eventId)}/speakers/${id(speakerId)}`, { method: 'DELETE' });
export const listPartnerships = (eventId: string) => api<{ partnerships: Partnership[] }>(`/api/events/${id(eventId)}/partnerships`);
export const invitePartner = (eventId: string, communitySlug: string) => api<{ partnership: Partnership }>(`/api/events/${id(eventId)}/partnerships`, { method: 'POST', body: JSON.stringify({ communitySlug }) });
export const removePartnership = (eventId: string, partnershipId: string) => api(`/api/events/${id(eventId)}/partnerships/${id(partnershipId)}`, { method: 'DELETE' });
