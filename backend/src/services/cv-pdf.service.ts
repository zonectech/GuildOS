import { CvDocumentModel, type CvContent } from '../models/cv-document.model';
import { buildSimpleTextPdf } from './pdf/simple-pdf';

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' });
}

function contentToLines(content: CvContent, verificationId: string) {
  const lines: string[] = [];
  lines.push(`Name: ${content.header.fullName}`);
  lines.push(`Email: ${content.header.email}`);
  lines.push(content.header.phone ? `Phone: ${content.header.phone}` : '');
  lines.push(content.header.location ? `Location: ${content.header.location}` : '');
  lines.push(content.header.publicProfileUrl ? `Public profile: ${content.header.publicProfileUrl}` : '');
  lines.push(`Verification ID: ${verificationId}`);
  lines.push('');

  lines.push('Summary');
  lines.push(content.summary || 'No summary provided.');
  lines.push('');

  lines.push('Education');
  lines.push([content.education.university, content.education.course, content.education.level].filter(Boolean).join(' · ') || 'Not provided');
  if (content.education.graduationYear) lines.push(`Graduation year: ${content.education.graduationYear}`);
  for (const achievement of content.education.achievements ?? []) lines.push(`- ${achievement}`);
  lines.push('');

  lines.push('Leadership');
  if (!content.leadership.length) lines.push('No leadership entries.');
  for (const item of content.leadership) {
    lines.push(`- ${item.title} @ ${item.organization}`);
    const period = [formatDate(item.startDate), item.current ? 'Present' : formatDate(item.endDate)].filter(Boolean).join(' - ');
    if (period) lines.push(`  Period: ${period}`);
    if (item.verified) lines.push('  Verified');
    for (const bullet of item.bullets ?? []) lines.push(`  • ${bullet}`);
  }
  lines.push('');

  lines.push('Experience');
  if (!content.experience.length) lines.push('No experience entries.');
  for (const item of content.experience) {
    lines.push(`- ${item.title} (${item.kind}) @ ${item.organization}`);
    if (item.period) lines.push(`  Period: ${item.period}`);
    if (item.url) lines.push(`  URL: ${item.url}`);
    for (const bullet of item.bullets ?? []) lines.push(`  • ${bullet}`);
  }
  lines.push('');

  lines.push('Certifications');
  if (!content.certifications.length) lines.push('No certifications.');
  for (const cert of content.certifications) {
    lines.push(`- ${cert.title} · ${cert.issuer}`);
    if (cert.date) lines.push(`  Date: ${formatDate(cert.date)}`);
    if (cert.serial) lines.push(`  Serial: ${cert.serial}`);
    if (cert.verifyUrl) lines.push(`  Verify: ${cert.verifyUrl}`);
    if (cert.status) lines.push(`  Status: ${cert.status}`);
  }
  lines.push('');

  lines.push('Skills');
  lines.push(content.skills.length ? content.skills.join(', ') : 'No skills listed.');
  lines.push('');

  lines.push('Projects');
  if (!content.projects.length) lines.push('No projects.');
  for (const project of content.projects) {
    lines.push(`- ${project.name}`);
    if (project.role) lines.push(`  Role: ${project.role}`);
    if (project.url) lines.push(`  URL: ${project.url}`);
    if (project.description) lines.push(`  ${project.description}`);
  }
  lines.push('');

  lines.push('Awards');
  lines.push(content.awards.length ? content.awards.join(', ') : 'No awards listed.');
  lines.push('');

  if (content.guildScore) {
    lines.push(`Guild Score: ${content.guildScore.score} (${content.guildScore.level})`);
  }

  return lines.filter((line) => line !== '');
}

function cvToPdf(cv: {
  cvId: string;
  verificationId: string;
  content: CvContent;
}) {
  return buildSimpleTextPdf({
    title: `GuildOS CV — ${cv.content.header.fullName}`,
    lines: contentToLines(cv.content, cv.verificationId),
    footer: `CV ${cv.cvId}`,
  });
}

export async function generateOwnerCvPdf(cvId: string, userId: string) {
  const cv = await CvDocumentModel.findOne({ cvId, userId }).lean();
  if (!cv) throw new Error('CV not found');
  return {
    filename: `${cv.cvId}.pdf`,
    pdf: cvToPdf(cv),
  };
}

export async function generateVerifiedCvPdf(verificationId: string) {
  const cv = await CvDocumentModel.findOne({ verificationId }).lean();
  if (!cv) throw new Error('CV not found');
  return {
    filename: `${cv.cvId}.pdf`,
    pdf: cvToPdf(cv),
  };
}
