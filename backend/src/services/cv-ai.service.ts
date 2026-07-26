import { aiChat, isAiConfigured, parseJsonLoose } from './ai-provider';
import type { CvContent, CvMode } from '../models/cv-document.model';

const PROMPT_VERSION = 'cv-v1';

const MODE_GUIDANCE: Record<CvMode, string> = {
  INTERNSHIP: 'Optimize for internships and entry-level roles. Emphasize learning ability, foundational skills, and hands-on participation.',
  SCHOLARSHIP: 'Optimize for scholarships, fellowships, and grants. Emphasize academic focus, service, leadership potential, and impact.',
  LEADERSHIP: 'Emphasize leadership experience, volunteering, ownership, and measurable impact.',
  TECHNICAL: 'Emphasize technical projects, engineering skills, certifications, and applied problem-solving.',
};

/**
 * Deterministic, evidence-backed summary built only from verified facts already on the CV.
 * Used as the baseline and as the fallback when no AI key is configured.
 */
function heuristicSummary(content: CvContent, mode: CvMode): string {
  const role = [content.education.course || content.education.level, content.education.university].filter(Boolean).join(' at ');
  const leadCount = content.leadership.length;
  const certCount = content.certifications.length;
  const eventLine = content.experience.filter((e) => e.kind === 'ORGANIZER' || e.kind === 'VOLUNTEER').length;
  const topSkills = content.skills.slice(0, 5).join(', ');

  const parts: string[] = [];
  parts.push(`${role || 'Student'} with a verified record of campus contribution on GuildOS.`);
  if (leadCount) parts.push(`Held ${leadCount} verified leadership ${leadCount === 1 ? 'role' : 'roles'} across student communities.`);
  if (eventLine) parts.push(`Actively organized and supported ${eventLine} ${eventLine === 1 ? 'event' : 'events'}.`);
  if (certCount) parts.push(`Earned ${certCount} verifiable ${certCount === 1 ? 'certificate' : 'certificates'}.`);
  if (topSkills) parts.push(`Core strengths include ${topSkills}.`);
  if (mode === 'SCHOLARSHIP') parts.push('Committed to service, learning, and community impact.');
  if (mode === 'TECHNICAL') parts.push('Focused on building practical, real-world technical skills.');
  return parts.join(' ');
}

async function openAiEnhance(content: CvContent, mode: CvMode): Promise<{ summary?: string; leadershipBullets?: string[][]; experienceBullets?: string[][] } | null> {
  if (!isAiConfigured()) return null;
  try {
    const evidence = {
      profile: content.header,
      education: content.education,
      guildScore: content.guildScore,
      leadership: content.leadership.map((l) => ({ title: l.title, organization: l.organization, current: l.current, facts: l.bullets })),
      experience: content.experience.map((e) => ({ kind: e.kind, title: e.title, organization: e.organization, period: e.period, facts: e.bullets })),
      certifications: content.certifications.map((c) => c.title),
      skills: content.skills,
      awards: content.awards,
    };

    const raw = await aiChat({
      temperature: 0.5,
      jsonMode: true,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional resume writer for verified student achievements. ' +
            'STRICT RULES: never invent skills, experience, impact, or roles. Only rephrase the FACTS provided. ' +
            'Do not add numbers or claims that are not in the evidence. ' +
            'Return ONLY JSON: { "summary": string, "leadershipBullets": string[][], "experienceBullets": string[][] }. ' +
            'leadershipBullets must have exactly one array per leadership item (same order); each is 2-3 concise, professional, past-tense bullets derived only from that item\'s facts. ' +
            'experienceBullets follows the same rule for experience items.',
        },
        {
          role: 'user',
          content: `${MODE_GUIDANCE[mode]}\n\nEVIDENCE (JSON):\n${JSON.stringify(evidence)}`,
        },
      ],
    });

    const parsed = parseJsonLoose<{ summary?: unknown; leadershipBullets?: unknown; experienceBullets?: unknown }>(raw);
    if (!parsed) return null;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      leadershipBullets: Array.isArray(parsed.leadershipBullets) ? (parsed.leadershipBullets as string[][]) : undefined,
      experienceBullets: Array.isArray(parsed.experienceBullets) ? (parsed.experienceBullets as string[][]) : undefined,
    };
  } catch {
    return null;
  }
}

function sanitizeBulletSets(sets: string[][] | undefined, expectedLength: number): string[][] | null {
  if (!Array.isArray(sets) || sets.length !== expectedLength) return null;
  return sets.map((set) =>
    (Array.isArray(set) ? set : [])
      .map((b) => String(b).trim())
      .filter(Boolean)
      .slice(0, 4),
  );
}

/**
 * Enhances a baseline CV with AI phrasing while guaranteeing every statement stays
 * evidence-backed. Skills are never changed by AI (they remain evidence-derived).
 */
export async function enhanceCvContent(baseline: CvContent, mode: CvMode): Promise<{ content: CvContent; aiGenerated: boolean; promptVersion: string }> {
  const withHeuristicSummary: CvContent = {
    ...baseline,
    summary: baseline.summary || heuristicSummary(baseline, mode),
  };

  const ai = await openAiEnhance(withHeuristicSummary, mode);
  if (!ai) {
    return { content: withHeuristicSummary, aiGenerated: false, promptVersion: PROMPT_VERSION };
  }

  const leadershipBullets = sanitizeBulletSets(ai.leadershipBullets, baseline.leadership.length);
  const experienceBullets = sanitizeBulletSets(ai.experienceBullets, baseline.experience.length);

  const content: CvContent = {
    ...withHeuristicSummary,
    summary: ai.summary?.trim() || withHeuristicSummary.summary,
    leadership: baseline.leadership.map((item, i) => ({
      ...item,
      bullets: leadershipBullets?.[i]?.length ? leadershipBullets[i] : item.bullets,
    })),
    experience: baseline.experience.map((item, i) => ({
      ...item,
      bullets: experienceBullets?.[i]?.length ? experienceBullets[i] : item.bullets,
    })),
  };

  return { content, aiGenerated: true, promptVersion: PROMPT_VERSION };
}

export { PROMPT_VERSION };
