import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';

// Written in full: the parent segment already sets a plain title, so the site template does not reach this one.
export const metadata: Metadata = { title: { absolute: `Notification settings · ${BRAND}` } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
