'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Award, Building2, CalendarDays, CircleDot, LayoutDashboard, Plus, Settings, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react';

type NavItem = { label: string; href: string; icon: LucideIcon; tour?: string };
type NavSection = { title?: string; items: NavItem[] };

/**
 * Community Mode navigation, grouped the way an organizer works: run the community,
 * run its events, handle the money. Shared by the desktop sidebar and the mobile drawer.
 */
export const DASHBOARD_NAV: NavSection[] = [
  { items: [{ label: 'Overview', href: '/dashboard', icon: LayoutDashboard }] },
  {
    title: 'Community',
    items: [
      { label: 'Communities', href: '/dashboard/communities', icon: Building2, tour: 'side-communities' },
      { label: 'Members', href: '/dashboard/members', icon: Users, tour: 'side-members' },
      { label: 'Moderation', href: '/dashboard/moderation', icon: ShieldCheck, tour: 'side-moderation' },
      { label: 'Post a status', href: '/status/new', icon: CircleDot },
    ],
  },
  {
    title: 'Events',
    items: [
      { label: 'All events', href: '/dashboard/events', icon: CalendarDays, tour: 'side-events' },
      { label: 'Create event', href: '/dashboard/events/create', icon: Plus },
      { label: 'Certificates', href: '/dashboard/certificates', icon: Award, tour: 'side-certificates' },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Wallet', href: '/dashboard/wallet', icon: Wallet, tour: 'side-wallet' },
      { label: 'Premium', href: '/dashboard/premium', icon: Sparkles },
    ],
  },
  { items: [{ label: 'Account settings', href: '/dashboard/settings', icon: Settings }] },
];

/** The most specific item matching the path, so "Create event" doesn't also light up "All events". */
function activeHref(pathname: string) {
  let best = '';
  for (const section of DASHBOARD_NAV) {
    for (const { href } of section.items) {
      const matches = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      if (matches && href.length > best.length) best = href;
    }
  }
  return best;
}

export function DashboardNavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const current = activeHref(pathname);
  return (
    <nav className="space-y-4">
      {DASHBOARD_NAV.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title ? <p className="mb-1.5 px-3.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{section.title}</p> : null}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.href === current;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  data-tour={item.tour}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity ${isActive ? 'bg-indigo-400 opacity-100' : 'bg-transparent opacity-0 group-hover:opacity-50'}`} />
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
