import { config } from '../config';

export type EventDraft = {
  title: string;
  description: string;
  agenda: string[];
  audience: string;
  outcomes: string[];
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function heuristicDraft(prompt: string): EventDraft {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  const topicMatch = clean.match(/(?:teach|learn|about|on|for|introduce|cover)\s+(.*)/i);
  const topic = (topicMatch?.[1] ?? clean).replace(/[.?!]+$/, '');
  const audienceMatch = clean.match(/(first[- ]?year|second[- ]?year|final[- ]?year|freshers?|beginners?|students?|developers?|members?)/i);
  const audience = audienceMatch ? titleCase(audienceMatch[0]) : 'Students and community members';
  const shortTopic = topic.split(/,| and | using | with /i)[0].trim();

  const title = titleCase(shortTopic.length > 4 ? shortTopic : clean).slice(0, 90);

  const description =
    `This session introduces participants to ${topic}. ` +
    `Through guided, hands-on activities, attendees will build practical skills they can apply immediately. ` +
    `Come ready to learn, collaborate, and leave with real experience.`;

  const agenda = [
    'Welcome & introductions',
    `Fundamentals of ${shortTopic}`,
    'Hands-on walkthrough / live demo',
    'Guided practice & Q&A',
    'Wrap-up, next steps, and resources',
  ];

  const outcomes = [
    `Understand the core concepts of ${shortTopic}`,
    'Apply what they learned in a practical exercise',
    'Know where to go next to keep improving',
  ];

  return { title, description, agenda, audience, outcomes };
}

async function openAiDraft(prompt: string): Promise<EventDraft | null> {
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
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an assistant that drafts community event details. ' +
              'Respond ONLY with a JSON object: { "title": string, "description": string, ' +
              '"agenda": string[], "audience": string, "outcomes": string[] }.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<EventDraft>;
    return {
      title: String(parsed.title ?? '').slice(0, 120),
      description: String(parsed.description ?? ''),
      agenda: Array.isArray(parsed.agenda) ? parsed.agenda.map(String) : [],
      audience: String(parsed.audience ?? ''),
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.map(String) : [],
    };
  } catch {
    return null;
  }
}

export async function generateEventDraft(prompt: string): Promise<EventDraft & { source: 'ai' | 'template' }> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Describe the event you want to create');
  }

  const ai = await openAiDraft(trimmed);
  if (ai && ai.title) {
    return { ...ai, source: 'ai' };
  }
  return { ...heuristicDraft(trimmed), source: 'template' };
}
