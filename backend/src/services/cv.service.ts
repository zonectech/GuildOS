import { randomUUID } from 'node:crypto';
import { config } from '../config';
import { authStore } from '../store/auth-store';
import { getReputation } from './reputation.service';
import { listUserCertificates } from './event.service';
import { getUserLeadershipHistory } from './community.service';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { EventSpeakerModel } from '../models/event-speaker.model';
import { EventVolunteerModel } from '../models/event-volunteer.model';
import {
  CvDocumentModel,
  type CvContent,
  type CvCustomization,
  type CvExperienceItem,
  type CvLeadershipItem,
  type CvMode,
  type CvTemplate,
} from '../models/cv-document.model';
import { CvProjectModel } from '../models/cv-project.model';
import { CvGenerationLogModel } from '../models/cv-generation-log.model';
import { enhanceCvContent, PROMPT_VERSION } from './cv-ai.service';

const TEMPLATES: CvTemplate[] = ['PROFESSIONAL', 'MODERN', 'EXECUTIVE', 'ACADEMIC', 'TECHNICAL'];
const MODES: CvMode[] = ['INTERNSHIP', 'SCHOLARSHIP', 'LEADERSHIP', 'TECHNICAL'];

function roleLabel(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function periodLabel(start: Date | null, end: Date | null) {
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '');
  const s = fmt(start);
  const e = end ? fmt(end) : 'Present';
  return [s, e].filter(Boolean).join(' – ');
}

async function generateCvId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CV-${year}-`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await CvDocumentModel.countDocuments({ cvId: { $regex: `^${prefix}` } });
    const cvId = `${prefix}${String(count + 1 + attempt).padStart(6, '0')}`;
    const exists = await CvDocumentModel.exists({ cvId });
    if (!exists) return cvId;
  }
  return `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;
}

type GenerateInput = {
  template?: string;
  mode?: string;
  customization?: Partial<CvCustomization>;
  projects?: Array<{ name?: string; description?: string; url?: string; role?: string }>;
};

async function buildBaselineContent(userId: string, projects: GenerateInput['projects']) {
  const user = await authStore.getPublicUserById(userId);
  if (!user) throw new Error('User not found');

  const [reputation, certificates, leadershipHistory, organizedEvents, speakerRecords, volunteerRecords, eventsCompleted] = await Promise.all([
    getReputation(userId),
    listUserCertificates(userId),
    getUserLeadershipHistory(userId),
    EventModel.find({ createdBy: userId, deletedAt: null }).select('title').sort({ createdAt: -1 }).lean(),
    EventSpeakerModel.find({ userId }).lean(),
    EventVolunteerModel.find({ userId }).lean(),
    EventRegistrationModel.countDocuments({ userId, status: 'COMPLETED' }),
  ]);

  const profileUrl = `${config.frontendUrl}/u/${encodeURIComponent(user.profile.username || userId)}`;

  const leadership: CvLeadershipItem[] = leadershipHistory.map((entry) => {
    const org = entry.community?.name ?? 'Student Community';
    const title = roleLabel(entry.role);
    return {
      title,
      organization: org,
      startDate: entry.startDate ?? null,
      endDate: entry.endDate ?? null,
      current: entry.current,
      verified: entry.verificationStatus === 'VERIFIED',
      bullets: [
        `Served as ${title} of ${org}${entry.current ? ' (current)' : ''}.`,
        'Coordinated members, activities, and community operations.',
      ],
    };
  });

  const experience: CvExperienceItem[] = [];
  for (const ev of organizedEvents) {
    experience.push({
      kind: 'ORGANIZER',
      title: 'Event Organizer',
      organization: ev.title,
      period: '',
      url: '',
      bullets: [`Planned and ran "${ev.title}", managing logistics and participants.`],
    });
  }
  const speakerEventIds = speakerRecords.map((s) => s.eventId);
  const volunteerEventIds = volunteerRecords.map((v) => v.eventId);
  const linkedEvents = await EventModel.find({ _id: { $in: [...speakerEventIds, ...volunteerEventIds] } }).select('title').lean();
  const eventTitleById = new Map(linkedEvents.map((e) => [e._id.toString(), e.title]));

  for (const sp of speakerRecords) {
    const title = eventTitleById.get(sp.eventId.toString()) ?? 'Community Event';
    experience.push({
      kind: 'SPEAKER',
      title: `${roleLabel(sp.speakerType)} Speaker`,
      organization: title,
      period: '',
      url: '',
      bullets: [`Delivered a ${sp.speakerType.toLowerCase()} session at "${title}".`],
    });
  }
  for (const vol of volunteerRecords) {
    const title = eventTitleById.get(vol.eventId.toString()) ?? 'Community Event';
    experience.push({
      kind: 'VOLUNTEER',
      title: vol.role ? `Volunteer — ${vol.role}` : 'Event Volunteer',
      organization: title,
      period: '',
      url: '',
      bullets: [`Supported "${title}"${vol.role ? ` as ${vol.role}` : ''}, contributing to smooth delivery.`],
    });
  }
  for (const p of projects ?? []) {
    if (!p?.name?.trim()) continue;
    experience.push({
      kind: 'PROJECT',
      title: p.name.trim(),
      organization: p.role?.trim() || 'Personal Project',
      period: '',
      url: p.url?.trim() || '',
      bullets: [p.description?.trim() || 'Personal project.'],
    });
  }

  const certifications = certificates.map((c) => ({
    title: c.eventTitle,
    issuer: c.communityName,
    date: (c.issuedAt as Date) ?? null,
    serial: c.serial,
    verifyUrl: c.verificationUrl,
    status: c.status,
  }));

  // Skills — every entry traceable to a verified activity.
  const skillSet = new Set<string>();
  for (const i of user.profile.interests ?? []) if (i.trim()) skillSet.add(i.trim());
  if (leadership.length) ['Leadership', 'Community Management', 'Event Coordination'].forEach((s) => skillSet.add(s));
  if (speakerRecords.length) skillSet.add('Public Speaking');
  if (volunteerRecords.length) ['Teamwork', 'Volunteering'].forEach((s) => skillSet.add(s));
  if (organizedEvents.length) skillSet.add('Event Management');

  // Awards — from reputation level and badges.
  const awards: string[] = [];
  if (reputation.guildScore > 0) awards.push(`${reputation.level} Member`);
  for (const b of reputation.badges) awards.push(`${b.label}`);

  const content: CvContent = {
    header: {
      fullName: user.fullName,
      email: user.email,
      phone: user.profile.phoneNumber ?? '',
      location: user.profile.location ?? '',
      publicProfileUrl: profileUrl,
    },
    summary: '',
    education: {
      university: user.profile.university ?? '',
      course: user.profile.department || user.profile.faculty || '',
      graduationYear: user.profile.graduationYear ?? null,
      level: user.profile.level ?? '',
      achievements: [],
    },
    leadership,
    experience,
    certifications,
    skills: Array.from(skillSet),
    projects: (projects ?? [])
      .filter((p) => p?.name?.trim())
      .map((p) => ({ name: p!.name!.trim(), description: p?.description?.trim() ?? '', url: p?.url?.trim() ?? '', role: p?.role?.trim() ?? '' })),
    awards,
    guildScore: reputation.guildScore > 0 ? { score: reputation.guildScore, level: reputation.level } : null,
  };

  return {
    content,
    source: { certificates: certifications.length, roles: leadership.length, events: eventsCompleted },
  };
}

export async function generateCv(userId: string, input: GenerateInput) {
  const template = (TEMPLATES.includes(input.template as CvTemplate) ? input.template : 'PROFESSIONAL') as CvTemplate;
  const mode = (MODES.includes(input.mode as CvMode) ? input.mode : 'INTERNSHIP') as CvMode;

  const { content: baseline, source } = await buildBaselineContent(userId, input.projects);
  const { content, aiGenerated } = await enhanceCvContent(baseline, mode);

  // Projects persist across generations — next CV pre-fills them automatically.
  if (Array.isArray(input.projects)) {
    await saveCvProjects(userId, input.projects).catch(() => undefined);
  }

  const cvId = await generateCvId();
  const verificationId = `VER-${randomUUID().slice(0, 8).toUpperCase()}`;
  const publicUrl = `/cv/verify/${verificationId}`;

  const customization: CvCustomization = {
    hideCertificates: Boolean(input.customization?.hideCertificates),
    hideGuildScore: Boolean(input.customization?.hideGuildScore),
    sectionOrder: Array.isArray(input.customization?.sectionOrder) ? input.customization!.sectionOrder!.map(String) : [],
  };

  const doc = await CvDocumentModel.create({
    userId,
    cvId,
    verificationId,
    template,
    mode,
    publicUrl,
    content,
    customization,
    source,
    aiGenerated,
  });

  await CvGenerationLogModel.create({
    userId,
    cvId,
    promptVersion: PROMPT_VERSION,
    mode,
    template,
    sourceCertificates: source.certificates,
    sourceRoles: source.roles,
    sourceEvents: source.events,
    aiGenerated,
  });

  return {
    cvId: doc.cvId,
    verificationId: doc.verificationId,
    template: doc.template,
    mode: doc.mode,
    publicUrl: doc.publicUrl,
    aiGenerated,
    status: 'generated' as const,
  };
}

export async function listMyCvs(userId: string) {
  const cvs = await CvDocumentModel.find({ userId }).sort({ createdAt: -1 }).lean();
  return cvs.map((cv) => ({
    cvId: cv.cvId,
    verificationId: cv.verificationId,
    template: cv.template,
    mode: cv.mode,
    publicUrl: cv.publicUrl,
    aiGenerated: cv.aiGenerated,
    createdAt: cv.createdAt,
  }));
}

export async function getCvForOwner(cvId: string, userId: string) {
  const cv = await CvDocumentModel.findOne({ cvId, userId }).lean();
  if (!cv) throw new Error('CV not found');
  return {
    cvId: cv.cvId,
    verificationId: cv.verificationId,
    template: cv.template,
    mode: cv.mode,
    publicUrl: cv.publicUrl,
    aiGenerated: cv.aiGenerated,
    customization: cv.customization,
    content: cv.content,
    createdAt: cv.createdAt,
  };
}

export async function deleteCv(cvId: string, userId: string) {
  const cv = await CvDocumentModel.findOne({ cvId, userId });
  if (!cv) throw new Error('CV not found');
  await cv.deleteOne();
  return { message: 'CV deleted' };
}

const CV_SECTION_KEYS = ['summary', 'education', 'leadership', 'experience', 'certifications', 'skills', 'projects', 'awards'] as const;

/** Owner-only customization update: hide flags + drag-to-reorder section order. */
export async function updateCvCustomization(
  cvId: string,
  userId: string,
  input: Partial<{ hideCertificates: boolean; hideGuildScore: boolean; sectionOrder: string[] }>,
) {
  const cv = await CvDocumentModel.findOne({ cvId, userId });
  if (!cv) throw new Error('CV not found');
  if (input.hideCertificates !== undefined) cv.customization.hideCertificates = Boolean(input.hideCertificates);
  if (input.hideGuildScore !== undefined) cv.customization.hideGuildScore = Boolean(input.hideGuildScore);
  if (input.sectionOrder !== undefined) {
    const order = Array.isArray(input.sectionOrder) ? input.sectionOrder.map(String) : [];
    // Only known section keys, no duplicates — the renderer appends anything missing.
    cv.customization.sectionOrder = order.filter((key, i) => (CV_SECTION_KEYS as readonly string[]).includes(key) && order.indexOf(key) === i);
  }
  cv.markModified('customization');
  await cv.save();
  return { customization: cv.customization };
}

/** The user's persistent projects (pre-fills the CV builder). */
export async function listCvProjects(userId: string) {
  const projects = await CvProjectModel.find({ userId }).sort({ position: 1, createdAt: 1 }).lean();
  return projects.map((p) => ({ name: p.name, description: p.description, url: p.url, role: p.role }));
}

/** Replace-all save of the projects collection (max 20, validated + truncated). */
export async function saveCvProjects(
  userId: string,
  projects: Array<{ name?: string; description?: string; url?: string; role?: string }>,
) {
  const clean = (Array.isArray(projects) ? projects : [])
    .map((p) => ({
      name: String(p?.name ?? '').trim().slice(0, 140),
      description: String(p?.description ?? '').trim().slice(0, 600),
      url: String(p?.url ?? '').trim().slice(0, 300),
      role: String(p?.role ?? '').trim().slice(0, 100),
    }))
    .filter((p) => p.name)
    .slice(0, 20);
  await CvProjectModel.deleteMany({ userId });
  if (clean.length) {
    await CvProjectModel.insertMany(clean.map((p, position) => ({ ...p, userId, position })));
  }
  return { projects: clean };
}

export async function verifyCv(verificationId: string) {
  const cv = await CvDocumentModel.findOne({ verificationId }).lean();
  if (!cv) throw new Error('CV not found');

  // Apply the owner's customization to the public verification view.
  const content: CvContent = { ...cv.content };
  if (cv.customization?.hideCertificates) content.certifications = [];
  if (cv.customization?.hideGuildScore) content.guildScore = null;

  return {
    verified: true,
    status: 'AUTHENTIC' as const,
    cvId: cv.cvId,
    verificationId: cv.verificationId,
    template: cv.template,
    mode: cv.mode,
    ownerName: content.header.fullName,
    profileUrl: content.header.publicProfileUrl,
    generatedAt: cv.createdAt,
    certificateCount: cv.source?.certificates ?? content.certifications.length,
    leadershipCount: cv.source?.roles ?? content.leadership.length,
    eventCount: cv.source?.events ?? 0,
    content,
  };
}
