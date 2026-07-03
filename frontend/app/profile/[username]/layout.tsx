import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildProfileMetadata } from '../../../components/guildos/profile-metadata';

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return buildProfileMetadata(params.username);
}

export default function PublicProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
