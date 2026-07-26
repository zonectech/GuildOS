import { aiChat, isAiConfigured, parseJsonLoose } from './ai-provider';

export type MatchExplanationInput = {
  opportunityTitle: string;
  category: string;
  organization: string;
  score: number;
  reasons: string[];
  studentSummary: string;
};

function heuristicReason(input: MatchExplanationInput): string {
  if (!input.reasons.length) {
    return `This ${input.category.toLowerCase()} opportunity is a general match for your profile.`;
  }
  const lead = input.reasons.slice(0, 2).join(' and ').toLowerCase();
  return `Your ${lead} align with ${input.opportunityTitle}${input.organization ? ` at ${input.organization}` : ''}.`;
}

async function openAiReason(input: MatchExplanationInput): Promise<string | null> {
  if (!isAiConfigured()) return null;
  try {
    const raw = await aiChat({
      temperature: 0.4,
      jsonMode: true,
      messages: [
        {
          role: 'system',
          content:
            'You explain to a student why an opportunity matches their VERIFIED profile. ' +
            'Use ONLY the provided reasons — never invent qualifications. One or two sentences, encouraging and specific. ' +
            'Return ONLY JSON: { "reason": string }.',
        },
        {
          role: 'user',
          content: `Opportunity: ${input.opportunityTitle} (${input.category}) at ${input.organization}. Match score: ${input.score}. Student: ${input.studentSummary}. Verified match reasons: ${input.reasons.join('; ')}.`,
        },
      ],
    });
    const parsed = parseJsonLoose<{ reason?: unknown }>(raw);
    if (!parsed) return null;
    return typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : null;
  } catch {
    return null;
  }
}

export async function generateMatchReason(input: MatchExplanationInput): Promise<string> {
  const ai = await openAiReason(input);
  return ai ?? heuristicReason(input);
}
