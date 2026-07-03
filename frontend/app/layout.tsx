import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './mobile.css';

export const metadata: Metadata = {
  title: 'GuildOS — Campus Activities Into a Professional Portfolio',
  description: 'GuildOS helps student communities manage events, verify attendance with QR check-ins, issue certificates, and build student portfolios from campus activities.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

