import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';
import './mobile.css';
import { MessageToaster } from '../components/guildos/message-toaster';
import { AiAssistant } from '../components/guildos/ai-assistant';
import { Toaster } from '../components/guildos/ui/toast';
import { DialogHost } from '../components/guildos/ui/confirm-dialog';
import { PwaProvider } from '../components/guildos/pwa-provider';
import { ThemeScript } from '../components/guildos/theme-toggle';

// Self-hosted UI fonts (no layout shift, no third-party request). globals.css maps these
// onto --font-inter / --font-display with system fallbacks.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter-next' });
const display = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', weight: ['500', '600', '700', '800'], variable: '--font-display-next' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SITE_TITLE = 'GuildOS | Find your people on campus';
const SITE_DESCRIPTION =
  'Find your people on campus. Join clubs, check in to events with a QR pass, earn verified certificates and stand out to employers.';

export const viewport: Viewport = {
  themeColor: '#4f46e5',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  appleWebApp: {
    capable: true,
    title: 'GuildOS',
    statusBarStyle: 'default',
  },
  // The standard tag Chrome asks for; appleWebApp above still emits the iOS one.
  other: { 'mobile-web-app-capable': 'yes' },
  openGraph: {
    type: 'website',
    siteName: 'GuildOS',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'GuildOS: find your people on campus',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Certificate fonts only — canvas rendering needs their real family names.
            The UI fonts (Inter, Bricolage Grotesque) are self-hosted via next/font above. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Cormorant+Garamond:wght@600;700&family=Merriweather:wght@700&family=Montserrat:wght@600;700&family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <MessageToaster />
        <AiAssistant />
        <Toaster />
        <DialogHost />
        <PwaProvider />
      </body>
    </html>
  );
}
