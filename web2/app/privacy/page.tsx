import type { Metadata } from 'next';
import { PRIVACY, PRIVACY_UPDATED } from '@/lib/legal';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };
export default function Page() { return <LegalPage current="privacy" title="Privacy policy" updated={PRIVACY_UPDATED} sections={PRIVACY} />; }
