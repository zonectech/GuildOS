const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantMode = 'student' | 'leader';

export async function askAssistant(messages: AssistantMessage[], mode: AssistantMode = 'student') {
  const response = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ messages, mode }),
  });
  const payload = (await response.json().catch(() => ({}))) as { reply?: string; source?: 'ai' | 'fallback'; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Assistant unavailable');
  }
  return { reply: payload.reply ?? '', source: payload.source ?? 'fallback' };
}
