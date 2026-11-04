import { redirect } from 'next/navigation';

// Links from the current site keep working here.
export default function MyEventsRedirect() {
  redirect('/me');
}
