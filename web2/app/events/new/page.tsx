import type { Metadata } from 'next';
import { EventForm } from '@/components/host/event-form';

export const metadata: Metadata = { title: 'Create an event' };

export default function NewEventPage() {
  return <EventForm />;
}
