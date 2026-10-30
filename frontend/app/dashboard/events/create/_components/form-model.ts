import type { EventInput } from '../../../../../components/guildos/api/event-api';

export const DEFAULT_PLACEMENT = { x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' as const };
export const DEFAULT_THEME = { accent: '#b8933a', background: 'IVORY' as const, font: 'SERIF' as const };
export const DEFAULT_CONTENT = { title: '', presentation: '', message: '', signatories: [] as { name: string; title: string; image: string }[], logo: '', logoAlign: 'CENTER' as const };

/**
 * The ~14-section form is split into 4 digestible steps. Steps hide/show with CSS
 * (never unmount) so in-progress uploads, editor state and previews survive switching,
 * and Save Draft / Publish always act on the whole form regardless of the visible step.
 */
export const WIZARD_STEPS = [
  { label: 'Basics', hint: 'Title, description, schedule, day agenda' },
  { label: 'Logistics & tickets', hint: 'Venue, contacts, capacity, media, registration, pricing' },
  { label: 'Certificates & email', hint: 'Certificate design, thank-you email' },
  { label: 'Speakers & partners', hint: 'Speakers, sponsors, sponsorship, co-hosts' },
] as const;

export const emptyForm: EventInput = {
  title: '',
  type: 'WORKSHOP',
  shortDescription: '',
  description: '',
  theme: '',
  features: [],
  days: [],
  minimumAttendanceDays: 0,
  contacts: [],
  bannerImage: '',
  mode: 'PHYSICAL',
  venue: '',
  address: '',
  state: '',
  meetingLink: '',
  attendeeChatLink: '',
  attendanceSource: 'GUILDOS',
  partnerRegistrationUrl: '',
  partnerRegistrationLabel: '',
  startDate: null,
  endDate: null,
  timezone: '',
  registrationPolicy: 'OPEN',
  registrationDeadline: null,
  capacity: 0,
  waitlistEnabled: false,
  ticketPrice: 0,
  ticketTiers: [],
  ticketPromoCodes: [],
  ticketGroupDiscount: { minQuantity: 0, percentOff: 0 },
  ticketTemplate: '',
  ticketStyle: 'MIDNIGHT',
  ticketAccent: '#6366f1',
  ticketQrPlacement: 'BOTTOM_RIGHT',
  ticketQrBox: null,
  allowWalkIns: true,
  qrEnabled: true,
  certificateEnabled: false,
  certificateMode: 'STANDARD',
  certificateType: 'ATTENDANCE',
  certificateTemplate: '',
  certificateNamePlacement: DEFAULT_PLACEMENT,
  certificateTheme: DEFAULT_THEME,
  certificateStyle: 'CLASSIC',
  certificateContent: DEFAULT_CONTENT,
  sponsorshipOpen: false,
  sponsorshipPitch: '',
  sponsorshipPackages: [],
  partners: [],
  minimumAttendanceDuration: 0,
  checkOutRequired: true,
  visibility: 'PUBLIC',
};

export type EventDay = NonNullable<EventInput['days']>[number];

export const EMPTY_DAY: EventDay = { date: null, theme: '', venue: '', startTime: '', endTime: '', features: [], facilitators: [], sessions: [] };

/** Sets one top-level form field. */
export type UpdateField = <K extends keyof EventInput>(key: K, value: EventInput[K]) => void;

/** Props every form section receives. */
export type SectionProps = { form: EventInput; update: UpdateField };

/** Tracks that can be assigned to sessions / ticket tiers (saved ones have a server-minted key). */
export function namedSections(form: EventInput) {
  return (form.sections ?? []).filter((s) => s.key && s.name);
}

/** ISO string → value for a datetime-local input (local time, minute precision). */
export function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

/** datetime-local input value → ISO string (or null when cleared). */
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export const DASHED_ADD_BUTTON = 'rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600';
export const DASHED_ADD_BUTTON_SM = 'rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600';
export const REMOVE_LINK = 'text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600';
export const REMOVE_SQUARE = 'grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-rose-600';
export const HINT = 'mt-1 text-xs text-slate-500 dark:text-slate-400';
