export type StatusKind =
  | 'event'
  | 'update'
  | 'milestone';

export type StatusStoryInput = {
  content?: string;
  kind?: string;
  title?: string;
  accent?: string;
  authorName?: string;
  avatar?: string;
};

export const VALID_STATUS_KINDS: StatusKind[] = [
  'event',
  'update',
  'milestone',
];

export const ACCENTS: Record<StatusKind, string> = {
  event: 'from-violet-500 to-purple-500',
  update: 'from-emerald-500 to-teal-500',
  milestone: 'from-amber-500 to-orange-500',
};

export const STATUS_ACCENTS = [
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-red-500 to-orange-500',
];

export function normalizeStatusStoryInput(
  input: StatusStoryInput = {},
) {
  const content =
    String(input.content ?? '').trim() ||
    'Campus update';

  const normalizedKind = VALID_STATUS_KINDS.includes(
    input.kind as StatusKind,
  )
    ? (input.kind as StatusKind)
    : 'update';

  const title =
    String(input.title ?? '').trim() || content;

  return {
    content,
    kind: normalizedKind,
    title,
    accent: STATUS_ACCENTS.includes(input.accent ?? '')
      ? input.accent!
      : ACCENTS[normalizedKind],
    authorName:
      String(input.authorName ?? 'You').trim() ||
      'You',
    avatar:
      String(input.avatar ?? '').trim(),
  };
}

export function sortStatusesByNewest<
  T extends { createdAt?: string | Date | null },
>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt
      ? new Date(a.createdAt).getTime()
      : 0;

    const bTime = b.createdAt
      ? new Date(b.createdAt).getTime()
      : 0;

    return bTime - aTime;
  });
}