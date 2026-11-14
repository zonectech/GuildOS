// Copied word for word from the current site; the site name comes from lib/brand.ts.
import { BRAND_NAME } from './brand';
export const SUPPORT_EMAIL = 'support@guildos.app';
export type LegalSection = { title: string; paragraphs: readonly string[] };
export const TERMS_UPDATED = 'August 15, 2026';
export const TERMS: readonly LegalSection[] = [
  {
    title: '1. Your account',
    paragraphs: [
      'You must provide accurate information when creating an account and keep your login credentials secure. You are responsible for activity on your account.',
      `${BRAND_NAME} is built for students, community leaders, and recruiters. One person, one account. Duplicate or impersonation accounts may be removed.`,
    ],
  },
  {
    title: '2. Verified records & certificates',
    paragraphs: [
      `Certificates and attendance records on ${BRAND_NAME} are issued by communities, not by ${BRAND_NAME} itself. ${BRAND_NAME} provides the verification infrastructure.`,
      'Attempting to forge attendance (for example, sharing QR check-in codes with people who are not present) is a violation of these terms and may result in revoked records or account suspension.',
      'Issuing communities may revoke a certificate they issued. Verification pages always reflect the current status.',
    ],
  },
  {
    title: '3. Communities & events',
    paragraphs: [
      'Community leaders are responsible for the accuracy of the events they publish, the tickets they sell, and the certificates they issue.',
      'Paid tickets and sponsorships are processed through our payment providers. Refunds follow the event\u2019s stated refund policy and applicable law.',
    ],
  },
  {
    title: '4. Acceptable use',
    paragraphs: [
      `Do not use ${BRAND_NAME} to post unlawful, harassing, or misleading content, spam other members, scrape data, or interfere with the platform\u2019s operation.`,
      'We may moderate, restrict, or remove content and accounts that violate these terms or harm the community.',
    ],
  },
  {
    title: '5. Intellectual property',
    paragraphs: [
      `You retain ownership of the content you post. By posting, you grant ${BRAND_NAME} a licence to host and display it as needed to operate the service.`,
      `The ${BRAND_NAME} name, logo, and software are the property of ${BRAND_NAME} and may not be used without permission.`,
    ],
  },
  {
    title: '6. Disclaimers & liability',
    paragraphs: [
      `${BRAND_NAME} is provided "as is". We work hard to keep it reliable but do not guarantee uninterrupted availability.`,
      `To the fullest extent permitted by law, ${BRAND_NAME} is not liable for indirect or consequential damages arising from your use of the platform.`,
    ],
  },
  {
    title: '7. Termination',
    paragraphs: [
      'You may delete your account at any time from settings. We may suspend or terminate accounts that violate these terms.',
      'Sections that by their nature should survive termination (such as liability limits) will survive.',
    ],
  },
  {
    title: '8. Changes to these terms',
    paragraphs: [
      `We may update these terms as ${BRAND_NAME} evolves. Material changes will be announced in-app or by email. Continued use after changes take effect means you accept the updated terms.`,
    ],
  },
] as const;
export const PRIVACY_UPDATED = 'August 15, 2026';
export const PRIVACY: readonly LegalSection[] = [
  {
    title: '1. Information we collect',
    paragraphs: [
      'Account information: your name, email address, university, and profile details you choose to add (such as a username, avatar, or bio).',
      'Activity records: events you register for, attendance verified via QR check-in, certificates issued to you, community memberships, and leadership roles.',
      'Payment information: when you pay for tickets or premium features, payments are processed by our payment providers. We store transaction references and statuses, never your card details.',
      'Technical data: basic device and log information (such as IP address and browser type) used to keep the platform secure and reliable.',
    ],
  },
  {
    title: '2. How we use your information',
    paragraphs: [
      `To operate ${BRAND_NAME}: creating your verified portfolio, issuing certificates, managing event registrations, and powering community features.`,
      'To build your public reputation pages. Only the achievements and activity you earn are shown, and you control your public profile visibility in settings.',
      'To communicate with you: transactional emails such as verification links, event reminders, and certificate notifications.',
      'To keep the platform safe: detecting fraud, abuse, and fake attendance attempts.',
    ],
  },
  {
    title: '3. What we share',
    paragraphs: [
      'Public by design: your public profile, portfolio, and certificate verification pages are visible to anyone with the link. That is the point of verifiable reputation. You control optional fields.',
      'With communities: leaders of communities you join can see your membership details and attendance for their own events.',
      'With recruiters: only if you apply to an opportunity or make your profile discoverable.',
      'We never sell your personal data to third parties.',
    ],
  },
  {
    title: '4. Data retention & your rights',
    paragraphs: [
      'We keep your data for as long as your account is active. You may request a copy of your data or deletion of your account at any time by contacting us.',
      'Certificates you earned may remain verifiable after account deletion, in anonymized form, to protect the integrity of records already shared with third parties.',
    ],
  },
  {
    title: '5. Security',
    paragraphs: [
      'Passwords are stored hashed and salted. Access to production data is restricted. Certificate verification uses unique, tamper-evident identifiers.',
      'No system is perfectly secure. If we become aware of a breach affecting your data, we will notify you promptly.',
    ],
  },
  {
    title: '6. Changes to this policy',
    paragraphs: [
      `We may update this policy as ${BRAND_NAME} evolves. Material changes will be announced in-app or by email. Continued use of ${BRAND_NAME} after changes take effect means you accept the updated policy.`,
    ],
  },
] as const;
