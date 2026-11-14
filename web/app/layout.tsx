import type { Metadata } from 'next';
import { SessionProvider } from '@/lib/session';
import { SiteFooter, SiteHeader } from '@/components/site';
import './globals.css';
import { BRAND_NAME } from '@/lib/brand';

const description = 'See every event and community at your school. When a certificate is offered, you get it the moment you check out.';

// metadataBase turns the preview images' paths into full links for WhatsApp, X and LinkedIn.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002'),
  title: BRAND_NAME,
  description,
  openGraph: { title: BRAND_NAME, description, siteName: BRAND_NAME, type: 'website', images: [{ url: '/og/site', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: BRAND_NAME, description, images: ['/og/site'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded by the browser, not at build time, so builds never depend on reaching Google. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <SessionProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
