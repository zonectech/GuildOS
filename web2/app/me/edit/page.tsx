import type { Metadata } from 'next';
import { EditProfile } from './view';

export const metadata: Metadata = { title: 'Edit profile and privacy' };

export default function EditProfilePage() {
  return <EditProfile />;
}
