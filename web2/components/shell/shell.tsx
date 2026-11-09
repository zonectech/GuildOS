'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Bell, CalendarDays, CalendarPlus, Link2, LogOut, MessageSquare, Monitor, Moon, Plus, Settings, Sun, User as UserIcon, Users } from 'lucide-react';
import { useSession } from '@/lib/session';
import { classic } from '@/lib/api/client';
import { signOut, stampsOf, unreadCount } from '@/lib/api/session';
import { useTheme, type Theme } from '@/lib/theme';
import { spring } from '@/lib/motion';
import { Avatar } from '@/components/ui/avatar';
import { Btn, Odometer } from '@/components/ui/bits';
import { BRAND } from '@/lib/brand';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/events" className="group inline-flex items-center gap-2.5 font-display text-[21px] font-extrabold tracking-tight" aria-label={`${BRAND} home`}>
      <span className="relative grid size-9 place-items-center rounded-full bg-green text-white shadow-[0_6px_16px_-6px_rgb(10_122_80/.7)] transition-transform duration-300 group-hover:rotate-[-14deg]">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" /><path d="M7.5 12.3l3 3 6-6.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      {compact ? null : BRAND}
    </Link>
  );
}

const CREATE = [
  { href: classic('/events/new?mode=create'), label: 'Create an event', hint: 'Free registration and QR check-in', icon: CalendarPlus },
  { href: classic('/events/new?mode=list'), label: 'List an event from a link', hint: 'Already on Luma, Eventbrite or elsewhere', icon: Link2 },
  { href: classic('/communities/new'), label: 'Start a community', hint: 'Reviewed once, then run events freely', icon: Users },
];

function useMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return { open, setOpen, box };
}

function useUnread(on: boolean) {
  const [n, setN] = useState(0);
  const path = usePathname();
  useEffect(() => { if (on) unreadCount().then((r) => setN(r.count)).catch(() => undefined); }, [on, path]);
  return n;
}

const Pop = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <m.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snap }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
    className={`absolute z-50 rounded-2xl border border-line bg-raised p-1.5 shadow-lift ${className}`}>{children}</m.div>
);
const itemCls = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold text-ink transition-colors hover:bg-mist focus-visible:bg-mist';

function CreateMenu({ className = '' }: { className?: string }) {
  const { open, setOpen, box } = useMenu();
  return (
    <div className={`relative ${className}`} ref={box}>
      <Btn wide aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Plus size={18} strokeWidth={2.6} />Create</Btn>
      <AnimatePresence>{open ? (
        <Pop className="top-[calc(100%+8px)] left-0 w-[310px]">
          {CREATE.map(({ href, label, hint, icon: Icon }) => (
            <a key={href} href={href} role="menuitem" className={`${itemCls} items-start`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tint text-green-text"><Icon size={18} /></span>
              <span className="flex flex-col"><b>{label}</b><small className="text-[12.5px] font-medium text-muted">{hint}</small></span>
            </a>
          ))}
        </Pop>
      ) : null}</AnimatePresence>
    </div>
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const opts: [Theme, React.ReactNode, string][] = [['light', <Sun key="l" size={15} />, 'Light'], ['dark', <Moon key="d" size={15} />, 'Dark'], ['system', <Monitor key="s" size={15} />, 'Auto']];
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-xl bg-mist p-1">
      {opts.map(([v, icon, label]) => (
        <button key={v} type="button" role="radio" aria-checked={theme === v} aria-label={label} onClick={() => setTheme(v)}
          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-semibold ${theme === v ? 'text-ink' : 'text-muted'}`}>
          {theme === v ? <m.span layoutId="theme-pill" className="absolute inset-0 rounded-lg bg-surface shadow-card" transition={spring.snap} /> : null}
          <span className="relative flex items-center gap-1.5">{icon}{label}</span>
        </button>
      ))}
    </div>
  );
}

function AccountMenu({ up, compact }: { up?: boolean; compact?: boolean }) {
  const { user, setUser } = useSession();
  const { open, setOpen, box } = useMenu();
  if (!user) return null;
  const out = () => void signOut().catch(() => undefined).finally(() => { setUser(null); setOpen(false); });
  return (
    <div className="relative" ref={box}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Your account" onClick={() => setOpen(!open)}
        className={compact ? 'rounded-full p-0.5 transition-shadow hover:shadow-[0_0_0_2px_var(--line)]' : 'flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-mist'}>
        <Avatar name={user.fullName} src={user.avatar} size={compact ? 34 : 36} />
        {compact ? null : <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{user.fullName}</b><small className="block truncate text-[12px] text-muted">{user.email}</small></span>}
      </button>
      <AnimatePresence>{open ? (
        <Pop className={`${up ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'} right-0 w-[270px]`}>
          <a href={classic('/me')} role="menuitem" className={itemCls}><UserIcon size={17} className="text-muted" />My profile</a>
          <a href={classic('/me/settings')} role="menuitem" className={itemCls}><Settings size={17} className="text-muted" />Settings</a>
          <a href={classic('/feedback')} role="menuitem" className={itemCls}><MessageSquare size={17} className="text-muted" />Send feedback</a>
          <div className="px-1.5 py-2"><ThemeSwitch /></div>
          <hr className="mx-2 my-1 border-line" />
          <button type="button" role="menuitem" onClick={out} className={itemCls}><LogOut size={17} className="text-muted" />Log out</button>
        </Pop>
      ) : null}</AnimatePresence>
    </div>
  );
}

/** Your attendance record, at a glance: the stamp count in a small tilted seal. Only this site has it. */
function RecordCard() {
  const { user } = useSession();
  const [record, setRecord] = useState<{ count: number; latest: string } | null>(null);
  useEffect(() => {
    if (user?.username) stampsOf(user.username).then((s) => setRecord({ count: s.length, latest: s[0]?.eventTitle ?? '' })).catch(() => undefined);
  }, [user?.username]);
  const count = record?.count ?? 0;
  return (
    <a href={user ? classic('/me') : classic('/signup')} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-[border-color,box-shadow] hover:border-[color-mix(in_srgb,var(--green-text)_45%,var(--line))] hover:shadow-card">
      <span className="relative grid size-12 shrink-0 -rotate-12 place-items-center rounded-full border-2 border-green-text bg-tint font-display text-[18px] font-extrabold text-green-text transition-transform duration-300 group-hover:rotate-0">
        <span className="absolute inset-[3px] rounded-full border border-dashed border-[color-mix(in_srgb,var(--green-text)_60%,transparent)]" />
        {user ? <Odometer value={count} /> : '✓'}
      </span>
      <span className="min-w-0">
        <b className="block text-[14px]">{user ? 'Your record' : 'Every event counts'}</b>
        <small className="line-clamp-2 text-[12.5px] leading-snug text-muted">{user ? (count ? `${count} stamp${count === 1 ? '' : 's'} · latest: ${record?.latest}` : 'Attend an event to earn your first stamp.') : 'Sign up and every event you attend is stamped on your profile.'}</small>
      </span>
    </a>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, loading } = useSession();
  const unread = useUnread(Boolean(user));
  const here = (href: string) => path === href || path.startsWith(`${href}/`);
  const navCls = (on: boolean) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${on ? 'text-ink' : 'text-muted hover:text-ink hover:bg-mist'}`;
  const Badge = () => (unread ? <b className="absolute -top-1.5 -right-2 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-coral px-1 text-[10.5px] text-[#111714] ring-2 ring-paper">{unread > 9 ? '9+' : unread}</b> : null);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col gap-6 border-r border-line bg-paper px-4 pt-6 pb-4 lg:flex" aria-label="Site">
        <div className="px-2"><Logo /></div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {[{ href: '/events', label: 'Events', icon: CalendarDays, local: true }, { href: classic('/communities'), label: 'Communities', icon: Users }].map(({ href, label, icon: Icon, local }) => {
            const on = Boolean(local && here(href));
            const inner = (<>{on ? <m.span layoutId="nav-on" className="absolute inset-0 rounded-xl bg-mist" transition={spring.snap} /> : null}<Icon size={20} className={`relative ${on ? 'text-green-text' : ''}`} /><span className="relative">{label}</span>{on ? <span className="relative ml-auto size-2 rounded-full bg-green-text shadow-[0_0_0_3px_color-mix(in_srgb,var(--green-text)_22%,transparent)]" /> : null}</>);
            return local ? <Link key={label} href={href} aria-current={on ? 'page' : undefined} className={navCls(on)}>{inner}</Link> : <a key={label} href={href} className={navCls(false)}>{inner}</a>;
          })}
          {user ? <a href={classic('/notifications')} className={navCls(false)}><span className="relative"><Bell size={20} /><Badge /></span>Notifications</a> : null}
          {user ? <a href={classic('/me')} className={navCls(false)}><Avatar name={user.fullName} src={user.avatar} size={22} ring={false} />Profile</a> : null}
        </nav>
        {loading ? null : user ? <CreateMenu /> : (
          <div className="flex flex-col gap-2"><Btn wide href={classic('/signup')}>Sign up free</Btn><Btn wide kind="secondary" href={'/login'}>Log in</Btn></div>
        )}
        <div className="mt-auto flex flex-col gap-2.5">
          {loading ? null : <RecordCard />}
          {user ? <AccountMenu up /> : <div className="px-1"><ThemeSwitch /></div>}
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="glass sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] lg:hidden">
        <div className="flex h-[58px] items-center justify-between px-4">
          <Logo />
          {loading ? null : user ? <AccountMenu compact /> : <div className="flex gap-2"><Btn size="sm" kind="secondary" href={'/login'}>Log in</Btn><Btn size="sm" href={classic('/signup')}>Sign up</Btn></div>}
        </div>
      </header>

      <div className="lg:pl-[256px]">{children}</div>

      {/* Phone floating pill */}
      <nav aria-label="Main" className="glass fixed bottom-[calc(14px+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--line)_80%,transparent)] p-1.5 shadow-lift lg:hidden">
        <PillLink href="/events" label="Events" on={here('/events')} local><CalendarDays size={22} /></PillLink>
        <PillLink href={classic('/communities')} label="Communities"><Users size={22} /></PillLink>
        {user ? (
          <>
            {/* Create is a stamp: green, with a dashed inner ring. */}
            <m.a href={classic('/events/new')} aria-label="Create" whileTap={{ scale: 0.9, rotate: -12 }} transition={spring.snap}
              className="relative mx-1 grid size-[52px] place-items-center rounded-full bg-green text-white shadow-[0_8px_20px_-6px_rgb(10_122_80/.7)]">
              <span className="absolute inset-1 rounded-full border-[1.5px] border-dashed border-white/55" /><Plus size={23} strokeWidth={2.6} />
            </m.a>
            <PillLink href={classic('/notifications')} label={unread ? `Notifications, ${unread} unread` : 'Notifications'}><span className="relative"><Bell size={22} /><Badge /></span></PillLink>
            <PillLink href={classic('/me')} label="Profile"><Avatar name={user.fullName} src={user.avatar} size={28} ring={false} /></PillLink>
          </>
        ) : <PillLink href="/login" label="Log in" local on={here('/login')}><UserIcon size={22} /></PillLink>}
      </nav>
    </>
  );
}

function PillLink({ href, label, on, local, children }: { href: string; label: string; on?: boolean; local?: boolean; children: React.ReactNode }) {
  const cls = `relative grid size-[50px] place-items-center rounded-full transition-colors ${on ? 'text-ink' : 'text-muted'}`;
  const inner = <>{on ? <m.span layoutId="pill-on" className="absolute inset-0 rounded-full bg-mist" transition={spring.snap} /> : null}<span className="relative">{children}</span></>;
  return local ? <Link href={href} aria-label={label} aria-current={on ? 'page' : undefined} className={cls}>{inner}</Link> : <a href={href} aria-label={label} className={cls}>{inner}</a>;
}
