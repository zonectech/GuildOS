import { redirect } from 'next/navigation';

/** Old "edit your event" links from emails open the event form here. */
export default function OldCreateEventLink({ searchParams }: { searchParams: { slug?: string } }) {
  redirect(searchParams.slug ? `/events/new?edit=${encodeURIComponent(searchParams.slug)}` : '/events/new');
}
