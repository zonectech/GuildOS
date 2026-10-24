import { redirect } from 'next/navigation';

/**
 * Old public-profile URL. There is one profile page now (/u/<username>); this keeps
 * links people already shared working. The layout still serves link-preview metadata.
 */
export default function LegacyProfilePage({ params }: { params: { username: string } }) {
  redirect(`/u/${encodeURIComponent(decodeURIComponent(params.username))}`);
}
