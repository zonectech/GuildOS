/**
 * Deterministic, solid brand-colour initial avatars — the LinkedIn-style
 * coloured monogram people get when they have no photo. The colour is derived
 * from a seed (their name or id) so every person keeps the SAME colour across
 * the app, effectively branding their profile. Solid, saturated fills with
 * white text (not pale tints) so they read as intentional, not washed-out grey.
 */

/** Up to two uppercase letters from a name ("Abubakar Kolawole" -> "AK"). */
export function initials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A stable, vivid HSL fill for a seed. Fixed saturation/lightness keep white
 * text readable on every hue; the hue is spread across the full wheel so
 * different people look distinct.
 */
export function brandColor(seed: string): string {
  const key = (seed ?? '').trim() || 'U';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 60% 45%)`;
}

/**
 * Coloured monogram avatar. `size` is in pixels; `rounded` picks the corner
 * style (rounded-full for people, rounded-lg/xl for communities). Pass a
 * `seed` when you want the colour keyed off an id rather than the display name.
 */
export function InitialAvatar({
  name,
  seed,
  size = 36,
  rounded = 'rounded-full',
  className = '',
  title,
}: {
  name: string;
  seed?: string;
  size?: number;
  rounded?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center font-semibold text-white ${rounded} ${className}`}
      style={{
        backgroundColor: brandColor(seed || name),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
      title={title}
      aria-hidden={!title}
    >
      {initials(name)}
    </span>
  );
}
