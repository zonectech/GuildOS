import { LegalPage } from '@/components/legal-page';
import { BRAND_NAME } from '@/lib/brand';
import { PRIVACY, PRIVACY_UPDATED } from '@/lib/legal';

export const metadata = { title: `Privacy | ${BRAND_NAME}` };
export default function PrivacyPage() {
  return <LegalPage current="privacy" title="Privacy policy" updated={PRIVACY_UPDATED} sections={PRIVACY} />;
}
