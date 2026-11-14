import type { Metadata } from 'next';
import { DesignSystem } from './system';

export const metadata: Metadata = { title: 'Design system' };

export default function DesignPage() {
  return <DesignSystem />;
}
