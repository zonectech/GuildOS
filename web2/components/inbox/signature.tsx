'use client';
import { CommunityLogo } from '@/components/communities/bits';

/**
 * How a community speaks: its logo and name on top, then who on the team wrote it,
 * e.g. "Amina Yusuf (she/her) · Publicity Secretary". The title is the one they held when they
 * sent it; "former" if they no longer hold it. With "Title only", students see just the title.
 */
export function TeamSignature({ community, name, pronouns, title, former, align = 'start' }: {
  community: { name: string; logo: string }; name?: string; pronouns?: string; title?: string; former?: boolean; align?: 'start' | 'end';
}) {
  return (
    <span className={`mb-1 flex flex-col gap-0.5 px-1 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <span className="flex items-center gap-1.5 text-[12.5px] font-bold"><CommunityLogo c={community} size={18} />{community.name}</span>
      {name || title ? (
        <span className="flex flex-wrap items-center gap-1 text-[11.5px] text-muted">
          {name ? <b className="font-semibold text-ink">{name}</b> : null}
          {name && pronouns ? <span>({pronouns})</span> : null}
          {name && title ? <span aria-hidden>·</span> : null}
          {title ? <span className="rounded-full bg-tint px-1.5 py-px font-bold text-green-text">{title}</span> : null}
          {former ? <span className="rounded-full bg-mist px-1.5 py-px font-bold" title="No longer holds this role">former</span> : null}
        </span>
      ) : null}
    </span>
  );
}
