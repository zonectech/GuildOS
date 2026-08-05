import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './mobile.css';
import { MessageToaster } from '../components/guildos/message-toaster';
import { AiAssistant } from '../components/guildos/ai-assistant';
import { Toaster } from '../components/guildos/ui/toast';
import { DialogHost } from '../components/guildos/ui/confirm-dialog';
import { PwaProvider } from '../components/guildos/pwa-provider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SITE_TITLE = 'GuildOS — Campus Activities Into a Professional Portfolio';
const SITE_DESCRIPTION =
  'GuildOS helps student communities manage events, verify attendance with QR check-ins, issue certificates, and build student portfolios from campus activities.';

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
  openGraph: {
    type: 'website',
    siteName: 'GuildOS',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&family=Playfair+Display:wght@600;700&family=Cormorant+Garamond:wght@600;700&family=Merriweather:wght@700&family=Montserrat:wght@600;700&family=Great+Vibes&display=swap"
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
