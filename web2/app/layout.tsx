import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Shell } from '@/components/shell/shell';
import { themeScript } from '@/lib/theme';
import { BRAND } from '@/lib/brand';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-bricolage', display: 'swap' });
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-figtree', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${BRAND}: every event you attend counts`, template: `%s · ${BRAND}` },
  description: 'Find campus events, register free, get scanned in, and collect a stamp for every event you attend.',
};
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FAFAF7' }, { media: '(prefers-color-scheme: dark)', color: '#0A0D0B' }],
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

/** `modal` is the overlay slot: an event opened from a list shows on top of it, with its own URL. */
export default function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-dvh">
        <Providers>
          <Shell>
            <main className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
          </Shell>
          {modal}
        </Providers>
      </body>
    </html>
  );
}
