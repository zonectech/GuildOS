import { useMemo, type ReactNode } from 'react';
import { AtSign, ExternalLink, Globe, Plus, Trash2 } from 'lucide-react';

function normalizeSocialLink(link: string) {
  const trimmed = link.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function safeSocialHref(link: string) {
  const trimmed = link.trim();
  if (!trimmed || trimmed.startsWith('@') || /^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return null;
  try {
    const url = new URL(normalizeSocialLink(trimmed));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function socialLinkHost(link: string) {
  try {
    const href = safeSocialHref(link);
    return href ? new URL(href).hostname.replace(/^www\./i, '') : link.trim();
  } catch {
    return link.trim();
  }
}

function isImageLink(link: string) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(link);
}

/** A 24×24 brand glyph rendered in the platform's colour. */
function Brand({ path, color }: { path: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={color} aria-hidden focusable="false">
      <path d={path} />
    </svg>
  );
}

// Official brand marks (simple-icons paths) so X, LinkedIn, GitHub, … look like themselves.
const BRANDS: { key: string; label: string; color: string; path: string; domains: string[] }[] = [
  {
    key: 'x',
    label: 'X',
    color: '#000000',
    domains: ['x.com', 'twitter.com', 't.co'],
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    domains: ['linkedin.com', 'lnkd.in'],
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    key: 'github',
    label: 'GitHub',
    color: '#181717',
    domains: ['github.com', 'github.io'],
    path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    color: '#E4405F',
    domains: ['instagram.com', 'instagr.am'],
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#0866FF',
    domains: ['facebook.com', 'fb.com', 'fb.me'],
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    domains: ['youtube.com', 'youtu.be'],
    path: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '#000000',
    domains: ['tiktok.com'],
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    color: '#26A5E4',
    domains: ['t.me', 'telegram.me', 'telegram.org'],
    path: 'M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    domains: ['wa.me', 'whatsapp.com'],
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413',
  },
];

type SocialBrand = { key: string | null; label: string; color: string; icon: ReactNode };

function matchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function socialLinkDetail(raw: string, brand: SocialBrand) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('@')) return trimmed;
  const href = safeSocialHref(trimmed);
  if (!href) return 'Link unavailable';
  const url = new URL(href);
  const host = url.hostname.replace(/^www\./i, '');
  const path = decodeURIComponent(url.pathname).replace(/\/$/, '');
  return brand.key ? `${host}${path}` : path ? path : 'Website';
}

/** Detect the platform (icon + label + brand colour) from a URL or @handle. */
export function detectSocialBrand(raw: string): SocialBrand {
  const host = socialLinkHost(raw).toLowerCase();
  for (const b of BRANDS) {
    if (b.domains.some((domain) => matchesDomain(host, domain))) {
      return { key: b.key, label: b.label, color: b.color, icon: <Brand path={b.path} color={b.color} /> };
    }
  }
  // Bare @handle with no domain — can't detect the platform, show it as a handle.
  if (raw.trim().startsWith('@')) {
    return { key: null, label: 'Social handle', color: '#64748b', icon: <AtSign className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" /> };
  }
  return { key: null, label: socialLinkHost(raw) || 'Website', color: '#64748b', icon: <Globe className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" /> };
}

/**
 * A social link rendered with the platform's brand logo (X, LinkedIn, GitHub, …)
 * auto-detected from the URL. Direct image URLs still render as an image preview.
 */
export function SocialLinkChip({ link, compact = false }: { link: string; compact?: boolean }) {
  const href = safeSocialHref(link);
  const brand = useMemo(() => detectSocialBrand(link), [link]);
  const detail = useMemo(() => socialLinkDetail(link, brand), [brand, link]);

  if (href && isImageLink(link)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open social image in a new tab"
        className="group block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
      >
        <img src={href} alt="Social profile preview" loading="lazy" decoding="async" className="h-32 w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
      </a>
    );
  }

  const content = (
    <>
      <span
        className={`flex shrink-0 items-center justify-center border ${compact ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'}`}
        style={{ backgroundColor: `${brand.color}0D`, borderColor: `${brand.color}22` }}
      >
        {brand.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{brand.label}</span>
        {!compact ? <span className="mt-0.5 block truncate text-xs font-normal text-slate-500 dark:text-slate-400">{detail}</span> : null}
      </span>
      {href ? <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" aria-hidden /> : null}
    </>
  );

  if (!href) {
    return (
      <div title={detail} className={`flex min-w-0 items-center border border-slate-200 dark:border-slate-800 bg-slate-50/80 ${compact ? 'gap-2 rounded-xl px-2.5 py-2' : 'gap-3 rounded-2xl px-3 py-2.5'}`}>
        {content}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${brand.label} in a new tab`}
      className={`group flex min-w-0 items-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 ${compact ? 'gap-2 rounded-xl px-2.5 py-2' : 'gap-3 rounded-2xl px-3 py-2.5'}`}
    >
      {content}
    </a>
  );
}

/** A grid of social links; renders nothing when there are none. */
export function SocialLinks({ links, compact = false }: { links?: string[] | null; compact?: boolean }) {
  const cleanLinks = links
    ? Array.from(new Set(links.map((link) => link.trim()).filter(Boolean)))
    : [];
  if (!cleanLinks.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cleanLinks.map((link) => (
        <SocialLinkChip key={link} link={link} compact={compact} />
      ))}
    </div>
  );
}

/** Structured editor shared by profile settings surfaces. */
export function SocialLinkEditor({
  value,
  onChange,
  max = 10,
}: {
  value: string[];
  onChange: (links: string[]) => void;
  max?: number;
}) {
  const rows = value.length ? value : [''];

  function update(index: number, next: string) {
    const links = [...rows];
    links[index] = next;
    onChange(links);
  }

  function remove(index: number) {
    const links = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(links.length ? links : ['']);
  }

  function add() {
    if (rows.length < max) onChange([...rows, '']);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Social links</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Add full profile links so visitors can find the right account.</p>
      </div>

      <div className="space-y-2">
        {rows.map((link, index) => {
          const brand = link.trim() ? detectSocialBrand(link) : null;
          return (
            <div key={index} className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                {brand ? (
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center" aria-hidden>
                    {brand.icon}
                  </span>
                ) : (
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden />
                )}
                <input
                  type="text"
                  inputMode="url"
                  aria-label={`Social link ${index + 1}`}
                  value={link}
                  onChange={(event) => update(index, event.target.value)}
                  placeholder={index === 0 ? 'linkedin.com/in/your-name' : 'Add another profile link'}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 pl-10 pr-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove social link ${index + 1}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= max}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add link
        </button>
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{rows.filter((link) => link.trim()).length}/{max}</span>
      </div>
    </div>
  );
}
