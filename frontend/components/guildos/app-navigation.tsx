'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PersistentStudentRail } from './student-nav-rail';
import { PersistentStudentNavigation } from './student-nav';
const studentRoots = ['/home', '/connections', '/messages', '/my-events', '/events', '/communities', '/search', '/account', '/notifications', '/profile', '/u', '/portfolio', '/resume', '/reputation', '/cv', '/opportunities', '/status', '/posts'];
export function AppNavigation({ children }: { children: ReactNode }) {
 const pathname = usePathname();
 const student = studentRoots.some(root => pathname === root || pathname.startsWith(root + '/'));
 if (!student) return <>{children}</>;
 const active = ['/home', '/communities', '/events', '/opportunities', '/cv', '/reputation'].find(root => pathname === root || pathname.startsWith(root + '/'));
 return <div className="guild-workspace guild-student min-h-screen bg-slate-100 dark:bg-slate-950"><PersistentStudentNavigation active={active}><PersistentStudentRail active={pathname}>{children}</PersistentStudentRail></PersistentStudentNavigation></div>;
}
