'use client';
import { createContext, useContext, type ReactNode } from 'react';
import Link from 'next/link';
import { Bookmark, CalendarDays, FileText, MessageSquare, Settings, Trophy, User, Users, type LucideIcon } from 'lucide-react';
import { useCurrentUser } from './use-current-user';
import { Card } from './ui/card';
const StudentRailContext = createContext(false);
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


function StudentRailNavCardContent({ profileHref, active, compact = false }: { profileHref: string; active?: string; compact?: boolean }) {
 return <Card className={compact ? 'group relative z-30 w-16 overflow-hidden p-2 transition-[width,box-shadow] duration-200 hover:w-60 hover:shadow-xl focus-within:w-60 focus-within:shadow-xl motion-reduce:transition-none' : 'p-2'}>
  <nav className="space-y-0.5">
   {studentRailItems(profileHref).map(({ href, label, Icon }) => {
    const selected = active === href || (label === 'Profile' && active === 'PROFILE');
    return <Link key={label} href={href} aria-label={label} title={label} aria-current={selected ? 'page' : undefined}
     className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
      <Icon aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
      <span className={compact ? 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none' : 'truncate'}>{label}</span>
    </Link>;
   })}
  </nav>
 </Card>;
}
export function StudentRailNavCard(props: { profileHref: string; active?: string; compact?: boolean }) {
 const shared = useContext(StudentRailContext);
 return shared ? null : <StudentRailNavCardContent {...props} />;
}
function Rail({ active, compact = false, hidden = false }: { active?: string; compact?: boolean; hidden?: boolean }) {
 const user = useCurrentUser();
 const profileHref = user?.profile?.username ? '/u/' + encodeURIComponent(user.profile.username) : '/profile';
 return <aside aria-label="Personal navigation" className={hidden ? 'hidden' : compact ? 'sticky top-20 z-40 hidden w-16 shrink-0 self-start sm:block' : 'sticky top-20 z-40 hidden w-[250px] shrink-0 self-start lg:block'}>
  <StudentRailNavCardContent profileHref={profileHref} active={active} compact={compact} />
 </aside>;
}
export function StudentNavRail({ active }: { active?: string }) {
 const shared = useContext(StudentRailContext);
 return shared ? null : <Rail active={active} />;
}
export function CompactStudentNavRail({ active }: { active?: string }) {
 const shared = useContext(StudentRailContext);
 return shared ? null : <Rail active={active} compact />;
}
/** The rail lives outside the changing page, including its loading boundary. */
export function PersistentStudentRail({ active, children }: { active: string; children: ReactNode }) {
 if (active === '/home' || active.startsWith('/home/')) return <>{children}</>;
 return <StudentRailContext.Provider value={true}>
  <div className="mx-auto flex w-full max-w-7xl items-start gap-4 px-4 py-6">
   <Rail active={active} compact />
   <div className="min-w-0 flex-1 [&>div>main]:m-0 [&>div>main]:max-w-none [&>div>main]:p-0">{children}</div>
  </div>
 </StudentRailContext.Provider>;
}
