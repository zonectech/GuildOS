'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { unreadCount } from '@/lib/account';
import { imageUrl } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Avatar, Button } from './ui';
import { BRAND_NAME } from '@/lib/brand';

export function Logo() {
  return <Link href="/" className="logo"><i aria-hidden="true"><Check size={18} strokeWidth={3} /></i>{BRAND_NAME}</Link>;
}

/** Door scanners fill the phone screen, with no site menu. */
const fullScreen = (path: string) => /(^|\/)scan(\/|$)/.test(path);

const LINKS = [['/events', 'Events'], ['/communities', 'Communities'], ['/me', 'Profile']] as const;

export function SiteHeader() {
  const path = usePathname();
  const { user, loading } = useSession();
  const links = user ? LINKS : LINKS.filter(([href]) => href !== '/me');
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const check = () => unreadCount().then((r) => setUnread(r.count)).catch(() => undefined);
    void check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [user, path]);
  if (fullScreen(path)) return null;
  return (
    <header className="top">
      <div className="wrap">
        <Logo />
        <nav className="nav" aria-label="Main">
          {links.map(([href, label]) => <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <div className="who">
          {loading ? null : user ? (
            <><Link href="/notifications" className="bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}><Bell size={20} />{unread ? <b>{unread > 9 ? '9+' : unread}</b> : null}</Link><Link href="/me" aria-label="Your profile"><Avatar name={user.fullName} src={imageUrl(user.profile?.avatar)} size={34} /></Link></>
          ) : (
            <><Button kind="s" small href="/login">Log in</Button><Button small href="/signup">Sign up</Button></>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  if (fullScreen(usePathname())) return null;
  return (
    <footer className="foot">
      <div className="wrap">
        <Logo />
        <nav aria-label="Footer"><Link href="/communities">For communities</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/support">Support</Link></nav>
      </div>
    </footer>
  );
}
