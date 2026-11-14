import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Support' };
export default function Page() { return <LegalPage current="support" title="Support" />; }
