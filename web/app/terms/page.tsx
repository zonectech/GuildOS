import { LegalPage } from '@/components/legal-page';
import { BRAND_NAME } from '@/lib/brand';
import { TERMS, TERMS_UPDATED } from '@/lib/legal';

export const metadata = { title: `Terms | ${BRAND_NAME}` };
export default function TermsPage() {
  return <LegalPage current="terms" title="Terms of use" updated={TERMS_UPDATED} sections={TERMS} />;
}
