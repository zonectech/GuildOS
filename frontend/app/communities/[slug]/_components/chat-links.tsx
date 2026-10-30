'use client';

import { useState } from 'react';
import { ExternalLink, Link2, MessageCircle, Radio } from 'lucide-react';

import { WhatsAppIcon } from '../../../../components/guildos/ui/whatsapp-icon';
import { DiscordIcon, TelegramIcon, SlackIcon } from '../../../../components/guildos/ui/brand-icons';
import type { CommunitySummary } from '../../../../components/guildos/api/community-list-api';

/** Per-platform styling for chat-link buttons (WhatsApp green, Discord indigo, …). */
const CHAT_LINK_STYLES: Record<string, { name: string; className: string; iconClassName: string }> = {
  WHATSAPP: { name: 'WhatsApp Group', className: 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20', iconClassName: 'text-emerald-600 dark:text-emerald-400' },
  DISCORD: { name: 'Discord Server', className: 'border-indigo-100 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20', iconClassName: 'text-indigo-600 dark:text-indigo-400' },
  TELEGRAM: { name: 'Telegram Group', className: 'border-sky-100 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20', iconClassName: 'text-sky-600 dark:text-sky-400' },
  SLACK: { name: 'Slack Workspace', className: 'border-purple-100 bg-purple-50 text-purple-800 hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20', iconClassName: 'text-purple-600 dark:text-purple-400' },
  OTHER: { name: 'Chat Link', className: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800', iconClassName: 'text-slate-500 dark:text-slate-400' },
};

function ChatPlatformIcon({ platform, url, className }: { platform: string; url?: string; className?: string }) {
  const [faviconBroken, setFaviconBroken] = useState(false);
  if (platform === 'WHATSAPP') return <WhatsAppIcon className={className} />;
  if (platform === 'DISCORD') return <DiscordIcon className={className} />;
  if (platform === 'TELEGRAM') return <TelegramIcon className={className} />;
  if (platform === 'SLACK') return <SlackIcon className={className} />;
  // "Other" platforms point at arbitrary domains — show the site's real favicon
  // (Google's keyless favicon endpoint), falling back to a generic link icon.
  if (url && !faviconBroken) {
    try {
      const host = new URL(url).hostname;
      return (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
          alt=""
          loading="lazy"
          onError={() => setFaviconBroken(true)}
          className={`${className ?? ''} rounded-sm object-contain`}
        />
      );
    } catch {
      /* invalid URL — fall through to the generic icon */
    }
  }
  return <Link2 className={className} />;
}

/** New multi-platform list, falling back to the legacy WhatsApp-only field. */
function effectiveChatLinks(community: CommunitySummary): Array<{ platform: string; url: string; label?: string }> {
  if (community.chatLinks?.length) return community.chatLinks;
  if (community.whatsappLink) return [{ platform: 'WHATSAPP', url: community.whatsappLink }];
  return [];
}

/** Chat + channel links — the single home for social handles. Chat links are insiders-only. */
export function CommunityConnectLinks({ community, isInsider }: { community: CommunitySummary; isInsider: boolean }) {
  const chatLinks = effectiveChatLinks(community);
  if (chatLinks.length === 0 && !community.channelLink) return null;

  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      {isInsider ? (
        chatLinks.map((link) => {
          const style = CHAT_LINK_STYLES[link.platform] ?? CHAT_LINK_STYLES.OTHER;
          return (
            <a key={`${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${style.className}`}>
              <ChatPlatformIcon platform={link.platform} url={link.url} className={`h-4 w-4 ${style.iconClassName}`} /> {link.label?.trim() || style.name}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          );
        })
      ) : chatLinks.length > 0 ? (
        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          <MessageCircle className="h-4 w-4 text-slate-400" /> Join the community to get the chat links
        </span>
      ) : null}
      {community.channelLink && (
        <a href={community.channelLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20">
          <Radio className="h-4 w-4 text-sky-600" /> Community Channel
          <ExternalLink className="h-3.5 w-3.5 text-sky-500" />
        </a>
      )}
    </div>
  );
}
