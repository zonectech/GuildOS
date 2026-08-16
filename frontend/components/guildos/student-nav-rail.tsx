'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, CalendarDays, FileText, MessageSquare, Settings, Trophy, User, Users, type LucideIcon } from 'lucide-react';

import { getCurrentUser } from './auth-api';
import { Card } from './ui/card';

export type StudentRailItem = { href: string; label: string; Icon: LucideIcon };

export function studentRailItems(profileHref: string): StudentRailItem[] {
  return [
    { href: profileHref, label: 'Profile', Icon: User },
    { href: '/connections', label: 'Connections', Icon: Users },
    { href: '/messages', label: 'Messages', Icon: MessageSquare },
    { href: '/my-events', label: 'My events', Icon: CalendarDays },
    { href: '/events/saved', label: 'Saved events', Icon: Bookmark },
    { href: '/cv', label: 'CV builder', Icon: FileText },
    { href: '/reputation', label: 'Guild Score', Icon: Trophy },
    { href: '/account', label: 'Settings', Icon: Settings },
  ];
}

export function StudentRailNavCard({ profileHref, active }: { profileHref: string; active?: string }) {
  return (
    <Card className="p-2">
      <nav className="space-y-0.5">
        {studentRailItems(profileHref).map(({ href, label, Icon }) => {
          const isActive = active === href || (label === 'Profile' && active === 'PROFILE');
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'}`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
              {label}
            </Link>
          );
        })}
      </nav>
    </Card>
  );
}

/**
 * Standalone left nav rail for the pages the home sidebar links to
 * (Connections, My events, Saved, Settings…) so the left bar stays
 * visible with the page content in the center — Facebook/X style.
 */
export function StudentNavRail({ active }: { active?: string }) {
  const [profileHref, setProfileHref] = useState('/profile');
  useEffect(() => {
    void getCurrentUser()
      .then((u) => {
        if (u?.profile?.username) setProfileHref(`/u/${encodeURIComponent(u.profile.username)}`);
      })
      .catch(() => undefined);
  }, []);
  return (
    <aside className="hidden w-[250px] shrink-0 lg:block lg:sticky lg:top-20 lg:self-start">
      <StudentRailNavCard profileHref={profileHref} active={active} />
    </aside>
  );
}
