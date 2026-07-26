/**
 * Provider-agnostic AI chat helper.
 *
 * Supports OpenAI and Google's Gemma models. Gemma is reached through Google's
 * OpenAI-compatible endpoint, so both providers share the same request/response
 * shape and the whole app can switch with one env var (AI_PROVIDER=openai|gemma).
 *
 * All callers already degrade gracefully (template fallbacks) when this returns
 * null, so a missing key or a provider error is never fatal.
 */
import { config } from '../config';

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ResolvedProvider = {
  provider: 'openai' | 'gemma';
  baseUrl: string;
  apiKey: string;
  model: string;
};

function resolveProvider(): ResolvedProvider | null {
  if (config.aiProvider === 'gemma') {
    if (!config.geminiApiKey) return null;
    return {
      provider: 'gemma',
      // Google's OpenAI-compatible surface — same schema as OpenAI's chat/completions.
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: config.geminiApiKey,
      model: config.gemmaModel,
    };
  }
  if (!config.openAiApiKey) return null;
  return {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
  };
}

/** True when the active provider has a usable API key. */
export function isAiConfigured(): boolean {
  return resolveProvider() !== null;
}

/** The provider that will actually be used, or null if none is configured. */
export function activeAiProvider(): 'openai' | 'gemma' | null {
  return resolveProvider()?.provider ?? null;
}

type ChatOptions = {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask for a strict JSON object (OpenAI response_format). Gemma relies on the prompt + parseJsonLoose. */
  jsonMode?: boolean;
};

/** Run a chat completion against the active provider. Returns the raw content, or null on any failure. */
export async function aiChat(options: ChatOptions): Promise<string | null> {
  const resolved = resolveProvider();
  if (!resolved) return null;

  try {
    let messages = options.messages;

    // Gemma (via Google's compat endpoint) has no `system` role — fold any system
    // instructions into the first user turn so the guidance still lands.
    if (resolved.provider === 'gemma') {
      const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ ...m }));
      if (systemText) {
        const firstUser = rest.findIndex((m) => m.role === 'user');
        if (firstUser >= 0) {
          rest[firstUser].content = `${systemText}\n\n${rest[firstUser].content}`;
        } else {
          rest.unshift({ role: 'user', content: systemText });
        }
      }
      messages = rest;
    }

    const body: Record<string, unknown> = {
      model: resolved.model,
      temperature: options.temperature ?? 0.5,
      messages,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    // response_format json_object is reliable on OpenAI; Gemma's compat layer can
    // reject it, so for Gemma we lean on the prompt's "return JSON" instruction + parseJsonLoose.
    if (options.jsonMode && resolved.provider === 'openai') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(resolved.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolved.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    return content ? stripThinking(content) : null;
  } catch {
    return null;
  }
}

/**
 * Remove <thought>/<thinking> reasoning blocks that "thinking" Gemma models
 * (e.g. gemma-3n / gemma-4 *-it) emit before their actual answer — otherwise
 * the reasoning leaks into user-facing replies and breaks JSON parsing.
 */
function stripThinking(text: string): string {
  return text
    .replace(/<(thought|thinking)>[\s\S]*?<\/\1>/gi, '')
    // Unclosed block (truncated output): drop everything up to the last close tag if any.
    .replace(/^[\s\S]*<\/(?:thought|thinking)>/i, '')
    .trim();
}

/**
 * Parse a JSON object from a model reply. Tolerates ```json fences or surrounding
 * prose (Gemma sometimes wraps JSON when response_format isn't available).
 */
export function parseJsonLoose<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const open = raw.indexOf('{');
    const close = raw.lastIndexOf('}');
    const candidate = fenced ? fenced[1] : open >= 0 && close > open ? raw.slice(open, close + 1) : '';
    if (!candidate) return null;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }
}
