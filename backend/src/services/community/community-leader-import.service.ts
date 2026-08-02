import { aiChat, isAiConfigured, parseJsonLoose } from '../ai-provider';

export type ExtractedLeaderCandidate = {
  name: string;
  title: string;
  department: string;
  level: string;
  phone: string;
};

export type ExtractedLeaderList = {
  session: string;
  candidates: ExtractedLeaderCandidate[];
};

// Keep the prompt bounded — a scanned appointment letter is a page or two of text, never a book.
const MAX_EXTRACT_TEXT = 12000;

/**
 * Turns raw text pulled from an uploaded appointment/nomination document (e.g. a PDF table of
 * newly appointed executives) into a structured candidate list, using the app's AI provider.
 * Returns null when AI isn't configured or the reply couldn't be parsed — callers should fall
 * back to "add leaders manually" messaging, never invent data.
 */
export async function extractLeadersFromDocumentText(rawText: string): Promise<ExtractedLeaderList | null> {
  if (!isAiConfigured()) return null;

  const text = rawText.trim().slice(0, MAX_EXTRACT_TEXT);
  if (!text) return null;

  const content = await aiChat({
    temperature: 0.1,
    jsonMode: true,
    messages: [
      {
        role: 'system',
        content:
          'You extract a leadership/executive appointment list from raw text pulled from a PDF (its table structure may be flattened into plain lines). ' +
          'Respond ONLY with a JSON object: { "session": string, "candidates": [{ "name": string, "title": string, "department": string, "level": string, "phone": string }] }. ' +
          '"session" is the academic session/year mentioned in the document (e.g. "2026/2027"), or "" if none is found — never invent one. ' +
          'Each candidate is one real person listed in the document: "name" is required (skip rows with no name); "title" is their office/role ' +
          '(e.g. "President", "General Secretary", "Naqeeb", "PRO"); "department" is their academic department/course if shown; ' +
          '"level" is their academic level/year (e.g. "200L", "Year 2") if shown; "phone" is their phone number if shown. ' +
          'Use "" for any field that is not present — never guess or fabricate a value. ' +
          'Ignore serial numbers, section/category headers (e.g. "BROTHERS"/"SISTERS"), page titles, and any other page furniture — just return the flat list of people.',
      },
      { role: 'user', content: text },
    ],
  });

  const parsed = parseJsonLoose<{ session?: unknown; candidates?: unknown }>(content);
  if (!parsed || !Array.isArray(parsed.candidates)) return null;

  const candidates: ExtractedLeaderCandidate[] = parsed.candidates
    .map((row): ExtractedLeaderCandidate | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      if (!name) return null;
      return {
        name,
        title: typeof r.title === 'string' ? r.title.trim() : '',
        department: typeof r.department === 'string' ? r.department.trim() : '',
        level: typeof r.level === 'string' ? r.level.trim() : '',
        phone: typeof r.phone === 'string' ? r.phone.trim() : '',
      };
    })
    .filter((c): c is ExtractedLeaderCandidate => c !== null);

  return {
    session: typeof parsed.session === 'string' ? parsed.session.trim() : '',
    candidates,
  };
}
