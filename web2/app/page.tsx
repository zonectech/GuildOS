import { redirect } from 'next/navigation';

// The landing page is a later stage; for now the site opens on Events.
export default function Home() {
  redirect('/events');
}
