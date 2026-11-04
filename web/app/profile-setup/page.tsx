import { redirect } from 'next/navigation';

/** The current site's onboarding address, so old links and emails still work. */
export default function ProfileSetupRedirect() {
  redirect('/onboarding');
}
