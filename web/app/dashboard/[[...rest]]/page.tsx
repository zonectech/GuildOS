import { redirect } from 'next/navigation';

/** There is no dashboard here: organizer tools live on the event and community pages. */
export default function DashboardRedirect() {
  redirect('/me');
}
