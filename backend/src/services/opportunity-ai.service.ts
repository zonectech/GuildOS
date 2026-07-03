import { config } from '../config';

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
  if (!config.openAiApiKey) return null;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: config.openAiModel,
        temperature: 0.4,
        response_format: { type: 'json_object' },
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
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { reason?: unknown };
    return typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : null;
  } catch {
    return null;
  }
}

export async function generateMatchReason(input: MatchExplanationInput): Promise<string> {
  const ai = await openAiReason(input);
  return ai ?? heuristicReason(input);
}
