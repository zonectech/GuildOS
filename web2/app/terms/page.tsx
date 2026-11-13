import type { Metadata } from 'next';
import { TERMS, TERMS_UPDATED } from '@/lib/legal';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Terms of use' };
export default function Page() { return <LegalPage current="terms" title="Terms of use" updated={TERMS_UPDATED} sections={TERMS} />; }
