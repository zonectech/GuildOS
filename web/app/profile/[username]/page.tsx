import { redirect } from 'next/navigation';

export default function OldProfileRedirect({ params }: { params: { username: string } }) {
  redirect(`/u/${encodeURIComponent(params.username)}`);
}
