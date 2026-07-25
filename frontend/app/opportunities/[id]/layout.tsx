import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const CATEGORY_LABEL: Record<string, string> = {
  INTERNSHIP: 'Internship',
  SCHOLARSHIP: 'Scholarship',
  JOB: 'Job',
  COMPETITION: 'Competition',
  VOLUNTEER: 'Volunteer role',
  TRAINING: 'Training',
  GRANT: 'Grant',
  OTHER: 'Opportunity',
};

/**
 * Server-side metadata so shared opportunity links unfurl with the title,
 * organization, location, and deadline on WhatsApp/Telegram/LinkedIn/X.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = decodeURIComponent(params.id);
  const canonical = `${SITE_URL}/opportunities/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/opportunities/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('not found');
    const { opportunity } = (await res.json()) as {
      opportunity: {
        title: string;
        description?: string;
        category?: string;
        organization?: string;
        location?: string;
        deadline?: string | null;
      };
    };

    const label = CATEGORY_LABEL[opportunity.category ?? ''] ?? 'Opportunity';
    const deadline = opportunity.deadline
      ? new Date(opportunity.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const facts = [
      label,
      opportunity.organization,
      opportunity.location,
      deadline ? `Apply by ${deadline}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const blurb = (opportunity.description || '').trim().slice(0, 200);

    const title = `${opportunity.title} · GuildOS`;
    const description = [facts, blurb].filter(Boolean).join(' — ') || 'Verified student opportunities on GuildOS.';

    return {
      metadataBase: new URL(SITE_URL),
      title,
      description,
      alternates: { canonical },
      openGraph: { type: 'website', url: canonical, title, description, siteName: 'GuildOS' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return {
      title: 'Opportunity · GuildOS',
      description: 'Verified student opportunities on GuildOS.',
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }
}

export default function OpportunityLayout({ children }: { children: ReactNode }) {
  return children;
}
