import type { Metadata } from 'next';
import { MyPassport } from './view';

export const metadata: Metadata = { title: 'Your passport' };

export default function MePage() {
  return <MyPassport />;
}
