import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  Crown,
  Flag,
  Megaphone,
  MonitorPlay,
  QrCode,
  Rocket,
  ShieldCheck,
  Trophy,
  Users,
  Video,
  Wallet,
} from 'lucide-react';

/**
 * The Community Mode leader playbook. Plain data so the page can render a
 * table of contents, search it, and keep every chapter in one consistent shape.
 * Keep it true to the product: name real buttons and pages, and update it when
 * a flow changes.
 */

export type PlaybookBlock =
  | { kind: 'text'; text: string }
  | { kind: 'steps'; title?: string; items: string[] }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'tip'; text: string }
  | { kind: 'warn'; text: string }
  | { kind: 'table'; title?: string; head: [string, string]; rows: [string, string][] }
  | { kind: 'checklist'; title: string; items: string[] }
  | { kind: 'links'; items: { label: string; href: string }[] };

export type PlaybookChapter = {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  /** Lowest community role that can do the main things in this chapter. */
  who?: string;
  sections: { heading: string; blocks: PlaybookBlock[] }[];
};

export const PLAYBOOK: PlaybookChapter[] = [
  {
    id: 'start',
    title: 'Start here',
    summary: 'What Community mode is, how to get in, and your first week as a leader.',
    icon: Rocket,
    sections: [
      {
        heading: 'Student mode and Community mode',
        blocks: [
          { kind: 'text', text: 'GuildOS has two modes. Student mode is your own profile, events, CV and Guild Score. Community mode is where you run a club: members, events, check-in, certificates and money. Switch between them with the Student / Community toggle at the top of the page. Your account is the same in both.' },
          { kind: 'text', text: 'Community mode is approval-only, so that every club on GuildOS is run by a real student leader. You ask for access once; after that you can create and run as many communities as you lead.' },
        ],
      },
      {
        heading: 'Get access to Community mode',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Tap Community at the top of the page. You will see "Community Mode is approval-only".',
              'Verify your school email: enter it, then type the code we send you.',
              'No school email (ambassadors, leaders of outside organizations)? Explain your role in the note instead.',
              'Submit the request. An admin reviews every request and you get a notification when you are approved.',
            ],
          },
          { kind: 'tip', text: 'Use the school email the club is known by. A matching school email is the fastest way to be approved and later to get your community verified.' },
        ],
      },
      {
        heading: 'Your first week',
        blocks: [
          {
            kind: 'checklist',
            title: 'First-week checklist',
            items: [
              'Create your community and choose how to verify it (chapter 2).',
              'Add a logo, a cover image, a clear short description and your WhatsApp / Telegram links.',
              'Decide on join approval: auto-approve, or review each request.',
              'Invite your existing members by email from Members.',
              'Give your executives their roles so they can help (chapter 3).',
              'Add your leadership team for this session on the Leaders page (chapter 5).',
              'Post your first update or community status so new members see life on the page.',
              'Plan your first event and announce it early (chapter 6).',
            ],
          },
          { kind: 'links', items: [{ label: 'Your communities', href: '/dashboard/communities' }, { label: 'Create a community', href: '/dashboard/communities/create' }] },
        ],
      },
    ],
  },
  {
    id: 'community',
    title: 'Set up your community',
    summary: 'Create the community, get it verified, and make the page worth joining.',
    icon: Building2,
    who: 'Founder',
    sections: [
      {
        heading: 'Create the community',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Go to Communities and tap Create a community.',
              'Fill in the community name, category, university (and faculty or department if it belongs to one), a short description and a full description.',
              'Upload a logo (square works best) and, optionally, a cover image.',
              'Choose visibility and join approval. Auto-approve lets people in straight away; otherwise you approve each request.',
              'Add your chat links (WhatsApp, Telegram and so on) and an optional channel link.',
              'Choose a verification method, then tap Create Community.',
            ],
          },
          { kind: 'tip', text: 'If your institution is missing from the list, ask a GuildOS admin to add it rather than picking a close match.' },
        ],
      },
      {
        heading: 'Verification',
        blocks: [
          { kind: 'text', text: 'Verification tells students your club is real. It is what lets you issue certificates that employers trust.' },
          {
            kind: 'table',
            head: ['Method', 'What happens'],
            rows: [
              ['University email (instant)', 'If your verified school email matches the institution, the community is verified straight away. If it does not match, an admin reviews it.'],
              ['Endorsement letter', 'Upload a letter from your faculty, department or student affairs. An admin reviews it.'],
              ['Skip for now: create unverified', 'You can start right away, but only with free events, and without certificates, Guild Score points or leadership roles. Verify later to unlock them.'],
            ],
          },
          { kind: 'warn', text: 'While verification is pending you can set up the page and invite members, but you cannot host events yet.' },
        ],
      },
      {
        heading: 'Make the page worth joining',
        blocks: [
          {
            kind: 'list',
            items: [
              'Short description: one sentence on who the club is for and what you do. It shows everywhere your community appears.',
              'Gallery: up to 6 photos from past events. Real photos convince people faster than any description.',
              'Chat links: members see them after they join, so they can find the group chat on day one.',
              'Keep the About section current: meeting times, how to get involved, who to contact.',
            ],
          },
          { kind: 'links', items: [{ label: 'Your communities', href: '/dashboard/communities' }] },
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: 'Roles and permissions',
    summary: 'Who can do what. Give each executive the lowest role that lets them do their job.',
    icon: ShieldCheck,
    sections: [
      {
        heading: 'The nine roles',
        blocks: [
          { kind: 'text', text: 'Roles stack: each role can do everything the roles below it can, plus more. Everyone except plain members counts as part of the leadership team.' },
          {
            kind: 'table',
            head: ['Role', 'Can do'],
            rows: [
              ['Member', 'Join events, see member-only posts, download their certificates.'],
              ['Volunteer', 'Help at the door: scan QR passes, check people in and out, see live attendance.'],
              ['Coordinator', 'Create and edit events, run check-in, finalize attendance, issue event certificates, invite members, see the member list and analytics.'],
              ['Organizer', 'Everything above, for running events end to end.'],
              ['Secretary', 'Send community announcements to members.'],
              ['Treasurer', 'See the wallet and ticket earnings, withdraw to bank, pay for Premium from the wallet.'],
              ['Vice President', 'Manage members (suspend, remove), respond to co-host requests, archive or delete events, hand over the community.'],
              ['President', 'Approve join requests, manage the leadership team, issue community certificates, monthly Premium.'],
              ['Founder', 'Full control, including transferring ownership and all settings.'],
            ],
          },
          { kind: 'tip', text: 'Door helpers do not need a high role. Make them Volunteers, or send them a door scanner link (no account needed) for the day.' },
        ],
      },
      {
        heading: 'Assigning roles',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Open Members and find the person.',
              'Pick their new role. You can only assign roles below your own.',
              'Every role and membership change is logged, so there is always a record of who changed what.',
            ],
          },
          { kind: 'links', items: [{ label: 'Members', href: '/dashboard/members' }] },
        ],
      },
    ],
  },
  {
    id: 'members',
    title: 'Members',
    summary: 'Approve requests, invite people, and keep the member list healthy.',
    icon: Users,
    who: 'Coordinator',
    sections: [
      {
        heading: 'Join requests',
        blocks: [
          { kind: 'text', text: 'If your community reviews new members, requests wait at the top of Members. People cannot see member-only posts or events until you approve them.' },
          { kind: 'list', items: ['Approve or decline one at a time, or use Approve all when you have checked the list.', 'A President or higher approves requests.'] },
        ],
      },
      {
        heading: 'Inviting people',
        blocks: [
          { kind: 'steps', items: ['Open Members and choose Invite.', 'Paste email addresses, separated by commas or new lines.', 'Each person gets a branded email with a join link.'] },
          { kind: 'tip', text: 'Right after a fair or a first meeting, invite everyone who signed your sheet the same day, while they still remember you.' },
        ],
      },
      {
        heading: 'Removing, suspending and handing over',
        blocks: [
          { kind: 'list', items: ['A Vice President or higher can suspend or remove a member. The change is logged.', 'To pass the club on to the next leader, use "Hand the community over to this member" on their row. Do this before you graduate, not after.'] },
          { kind: 'warn', text: 'A handover gives the other person control. Check you picked the right member before you confirm.' },
          { kind: 'links', items: [{ label: 'Members', href: '/dashboard/members' }] },
        ],
      },
    ],
  },
  {
    id: 'leaders',
    title: 'Leadership team and sessions',
    summary: 'Show who leads the club this year, and thank them properly when the term ends.',
    icon: Crown,
    who: 'President',
    sections: [
      {
        heading: 'The Leaders page',
        blocks: [
          { kind: 'text', text: 'Your community page has a Leaders page: the public roster of your executives, with photo, title and short bio. Leaders are grouped by academic session, written as two consecutive years, for example 2026/2027.' },
          { kind: 'steps', items: ['Open your community page and go to Leaders.', 'Add each executive with their title, and link their GuildOS account if they have one.', 'Order the list the way your constitution does (President first, and so on).'] },
        ],
      },
      {
        heading: 'When someone leaves early',
        blocks: [{ kind: 'text', text: 'Archive that person. They leave the current team card but stay on record. Archived leaders do not get the end-of-term certificate automatically; if they served long enough, use "Issue anyway" on their entry.' }],
      },
      {
        heading: 'End of term: dissolve the session',
        blocks: [
          {
            kind: 'steps',
            items: [
              'At the end of the term, choose Dissolve session.',
              'Everyone still active in that session moves to Past together, and the next session becomes Current.',
              'Optionally issue verifiable leadership certificates ("thank you for your service") to everyone being dissolved, with the GuildOS design or your own uploaded template.',
            ],
          },
          { kind: 'tip', text: 'Leadership certificates add Guild Score for your executives and show up on their CVs. It is the best thank-you you can give them.' },
        ],
      },
    ],
  },
  {
    id: 'content',
    title: 'Posts, statuses, announcements and the Knowledge Hub',
    summary: 'Keep the community feeling alive between events.',
    icon: Megaphone,
    sections: [
      {
        heading: 'Posts and community status',
        blocks: [
          { kind: 'list', items: ['Post as the community from its page: photos, recaps, calls for volunteers.', 'Community status: short updates that sit in the status row at the top of Home. Use the You / Community switch on Post a status to post as your club.', 'After an event, share a recap with two or three photos. It is the best invitation to the next one.'] },
          { kind: 'links', items: [{ label: 'Post a status', href: '/status/new' }] },
        ],
      },
      {
        heading: 'Announcements',
        blocks: [{ kind: 'text', text: 'A Secretary or higher can send an announcement to members. Keep them for things people must not miss, such as a venue change or an election. If every post is an announcement, people stop reading them.' }],
      },
      {
        heading: 'Knowledge Hub',
        blocks: [{ kind: 'text', text: 'The Knowledge Hub on your community page holds lasting resources: slides from workshops, guides, past questions, recordings. Coordinators and above can add to it. Ask each speaker for their slides and add them the same week.' }],
      },
    ],
  },
  {
    id: 'events-plan',
    title: 'Plan and publish an event',
    summary: 'Every option on the create-event form, and how to choose.',
    icon: CalendarDays,
    who: 'Coordinator',
    sections: [
      {
        heading: 'Basics and schedule',
        blocks: [
          {
            kind: 'list',
            items: [
              'Title, theme, event type, short description and full description. The short description shows on cards and in search, so make it say what attendees get.',
              'Tags (up to 5) help students find it.',
              'Event features: one line per thing attendees get (certificate, refreshments, networking).',
              'Start, end and timezone. The end time matters: in-person and online attendees need to stay to the end for full attendance and the certificate.',
            ],
          },
        ],
      },
      {
        heading: 'Location: in person, online or hybrid',
        blocks: [
          {
            kind: 'table',
            head: ['Mode', 'You need'],
            rows: [
              ['In person', 'Venue name, address and state. Attendees check in with a QR pass at the door.'],
              ['Online', 'A meeting link (Zoom, Teams, Google Meet). Attendees check themselves in, which unlocks the link (chapter 9).'],
              ['Hybrid', 'Both a venue and a meeting link. Each attendee picks in person or online when they register.'],
            ],
          },
          { kind: 'text', text: 'Add one or more contact persons with phone or WhatsApp, so attendees know who to call on the day.' },
        ],
      },
      {
        heading: 'Capacity, media and registration',
        blocks: [
          {
            kind: 'list',
            items: [
              'Maximum participants (0 = unlimited) and an optional waitlist. When someone cancels, the next person on the waitlist moves up.',
              'Event banner: required to publish. Use one fixed size for all your events so they look consistent. Add up to 6 flyers or photos.',
              'Registration policy: Open (anyone registered gets a spot), Approval (you approve each person) or Invite only (only people with your invite link).',
              'Registration questions (optional): text, dropdown, or a link such as a GitHub or LinkedIn profile.',
              'Registration deadline, and an optional official partner registration link if a partner needs its own form filled.',
              'Allow walk-ins, Enable QR attendance, and visibility.',
              'Attendee group chat (optional): only people who hold a spot see it.',
            ],
          },
        ],
      },
      {
        heading: 'Tickets (paid events)',
        blocks: [
          {
            kind: 'list',
            items: [
              'Ticket types such as Early Bird, Regular and VIP, each with a price and an optional quantity.',
              'Multi-day events can sell day tickets (for example days 1 and 3).',
              'Promo codes (percent off, optional use limit) and group discounts (for example buy 3, save 10%).',
              'Ticket design: pick a style and accent colour for the pass.',
            ],
          },
          { kind: 'text', text: 'Payment processing fees are shown at checkout and in your wallet; GuildOS sets them and they can change, so check there rather than guessing.' },
        ],
      },
      {
        heading: 'Multi-day events and tracks',
        blocks: [
          { kind: 'list', items: ['Add each day with its date, times, theme, venue (if different), seat cap, activities and facilitators.', 'Days required for a certificate: 0 means attend every day; otherwise the number of days someone must attend.', 'Sections or tracks: parallel groups (for example Beginner and Advanced), each with its own seat cap, venue and group chat.'] },
          { kind: 'warn', text: 'Once an event is published you cannot remove days. If a day cannot happen, use Cancel a day instead, so attendees are told.' },
        ],
      },
      {
        heading: 'Announce, publish and share',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Save as a draft while you work.',
              'Announce early (optional): the event appears as "coming soon" and students can follow it. The moment you publish, everyone who followed it is told registration is open.',
              'Publish when the details are final. Registration opens.',
              'Share it: Share to status, copy the invite link, and post the link in your group chats.',
            ],
          },
          { kind: 'tip', text: 'Announce two to three weeks ahead, publish one to two weeks ahead. GuildOS sends reminders before the start, and a last call in the final hour.' },
          { kind: 'links', items: [{ label: 'Create event', href: '/dashboard/events/create' }, { label: 'All events', href: '/dashboard/events' }] },
        ],
      },
      {
        heading: 'Co-hosts, speakers, volunteers and sponsors',
        blocks: [
          { kind: 'list', items: ['Co-host with another community: they accept the request (a Vice President or higher on their side), and their leaders can help run the event.', 'Add speakers and volunteers to the event so they are credited and earn Guild Score.', 'Looking for sponsors? Mark the event as seeking sponsorship with a short pitch. It appears on the public Sponsors page with your registration numbers.'] },
        ],
      },
    ],
  },
  {
    id: 'event-day',
    title: 'Event day: check-in and check-out in person',
    summary: 'Run the door smoothly and make sure attendance is real.',
    icon: QrCode,
    who: 'Volunteer',
    sections: [
      {
        heading: 'How attendance works',
        blocks: [
          { kind: 'text', text: 'Every registered attendee has a QR pass (and a short gate code) in their GuildOS app under My events. You scan them in when they arrive and out when they leave. Someone who checks out at or after the scheduled end gets full attendance and is eligible for the certificate. Leaving early counts as partial attendance.' },
        ],
      },
      {
        heading: 'Run the door',
        blocks: [
          {
            kind: 'steps',
            items: [
              'On All events, tap Open Check-In when doors open. Registered online attendees are notified at the same time.',
              'Open Scanner on your phone and tap the big camera button. Scan each pass; you hear and see a confirmation.',
              'If a phone camera will not scan, type the gate code shown under their QR pass.',
              'Need more scanners? Use Door scanners… to create links (up to 10 per event). Each link works on one device only and needs no account. Revoke any link instantly.',
              'Walk-ins: if you allowed them, search for the student and check them in.',
              'Near the end, tap Open Check-Out and scan people out as they leave.',
            ],
          },
          { kind: 'tip', text: 'Put one scanner at the entrance and one at the exit. Queues at the door are the most common complaint about events.' },
        ],
      },
      {
        heading: 'Live view and projector',
        blocks: [
          { kind: 'list', items: ['The scanner and Attendees pages show live counts: checked in, still to arrive, checked out.', 'Projector opens a big-screen view for the hall: event title, QR to register and live numbers. Put it on the screen before you start.'] },
          { kind: 'links', items: [{ label: 'All events', href: '/dashboard/events' }] },
        ],
      },
      {
        heading: 'Event-day checklist',
        blocks: [
          {
            kind: 'checklist',
            title: 'On the day',
            items: [
              'Phones charged; scanner links sent to door helpers the night before.',
              'Message attendees… with the venue, the start time and "have your QR pass ready".',
              'Open Check-In 30 minutes before the start.',
              'Projector on the hall screen.',
              'Open Check-Out before the end, and scan people out at the exit.',
              'Take photos for the recap post.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'online',
    title: 'Online and hybrid events',
    summary: 'How online check-in, the meeting link and check-out work, and how to make sure people get their certificates.',
    icon: Video,
    who: 'Coordinator',
    sections: [
      {
        heading: 'How it works for attendees',
        blocks: [
          {
            kind: 'steps',
            items: [
              'They register. Their confirmation tells them they are attending online.',
              'The meeting link is hidden until they check in. It is never in emails, event listings or the page before then, so only people who check in can join.',
              'From 15 minutes before the start, once you have opened check-in, they see "Check in & join meeting". One tap checks them in and opens the meeting.',
              'At the end they come back to the event page and tap Check out. Checking out at or after the scheduled end gives full attendance and the certificate.',
            ],
          },
          { kind: 'text', text: 'If someone tries to check out early, GuildOS warns them that it will count as partial attendance and asks them to confirm. After checking out they can still rejoin the call, but their attendance stays as recorded.' },
        ],
      },
      {
        heading: 'Your job as the host',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Open Check-In on All events before the start. Until you do, nobody can check in or see the link.',
              'Online attendees get a "Doors open" notification as soon as check-in is open and the 15-minute window has started.',
              'Watch the live count on Attendees during the session.',
              'Say it out loud near the end: "Before you leave, go back to the event page and tap Check out to get your certificate."',
              'When the session ends, anyone still checked in automatically gets an "Event has ended. Check out now" notification.',
              'On Attendees, tap "Check out N still online" to check out everyone who is still in, in one go. After the scheduled end they all get full attendance.',
            ],
          },
          { kind: 'warn', text: 'Open Check-In on time. If you forget, attendees cannot get the meeting link at all. Set a reminder for 20 minutes before the start.' },
          { kind: 'tip', text: 'Use "Check out N still online" only after the session has really ended. Before the scheduled end time it records partial attendance for everyone.' },
        ],
      },
      {
        heading: 'Hybrid events',
        blocks: [
          { kind: 'list', items: ['Each attendee picks in person or online when they register.', 'In-person attendees use their QR pass at the venue; they cannot self check-in.', 'Online attendees follow the online flow above.', '"Check out N still online" only touches online attendees; scan in-person attendees out at the door as usual.'] },
        ],
      },
    ],
  },
  {
    id: 'after',
    title: 'After the event',
    summary: 'Finalize attendance, issue certificates, say thank you and learn from it.',
    icon: Award,
    who: 'Coordinator',
    sections: [
      {
        heading: 'Finalize attendance',
        blocks: [
          { kind: 'text', text: 'Finalizing settles everyone\'s attendance. Registered people who never checked in become no-shows. People who checked in but never checked out become partial attendance (no certificate). GuildOS finalizes automatically 30 minutes after the scheduled end, or you can tap Finalize Attendance on the Attendees page.' },
          { kind: 'warn', text: 'Before finalizing, make sure everyone who stayed has been checked out, either at the door or with "Check out N still online". After finalizing, people who never checked out cannot get the certificate.' },
        ],
      },
      {
        heading: 'Certificates and thank-you',
        blocks: [
          {
            kind: 'steps',
            items: [
              'On Attendees, tap Issue Certificates. Only people with full attendance receive one.',
              'Each certificate has a QR code and a public verification page, so employers can check it is real.',
              'Thank-you email: set it to Auto when you create the event and it goes out when you issue certificates, or Custom to design your own from the Attendees page with Send Appreciation.',
            ],
          },
        ],
      },
      {
        heading: 'Feedback and reports',
        blocks: [
          { kind: 'list', items: ['Attendees are asked to rate the event after it ends; you see the ratings on the event page.', 'You get a wrap-up summary of the event.', 'The Attendees report lists everyone with status, check-in and check-out times, minutes attended and certificate eligibility. Export it for your records.', 'Use "Run again" to start next year\'s edition from this one.'] },
        ],
      },
      {
        heading: 'If plans change',
        blocks: [
          { kind: 'list', items: ['Postpone: registrations and tickets stay valid, sign-ups pause, and everyone is told a new date is coming. Resume once you have new dates.', 'Cancel a day of a multi-day event: attendees and that day\'s speakers are told.', 'Cancel the event: registrants are notified and paid tickets are refunded.', 'Removing a single attendee needs a reason, which they see. A paid ticket is refunded automatically.'] },
        ],
      },
    ],
  },
  {
    id: 'certificates',
    title: 'Community certificates',
    summary: 'Recognise members for things that are not a single event.',
    icon: BookOpen,
    who: 'President',
    sections: [
      {
        heading: 'When to use them',
        blocks: [
          { kind: 'text', text: 'Event certificates come from attendance. Community certificates are for everything else: running a project, volunteering all semester, winning an internal competition, serving on a committee.' },
          { kind: 'table', head: ['Type', 'Use it for'], rows: [['Achievement', 'Winning, completing a project, a standout contribution.'], ['Leadership', 'Serving in a role (end-of-term leadership certificates come from the Leaders page).'], ['Participation', 'Taking part in a programme over time.'], ['Volunteer', 'Helping run events or the club.']] },
        ],
      },
      {
        heading: 'Issue one',
        blocks: [
          { kind: 'steps', items: ['Open Certificates and pick the community.', 'Choose the kind of certificate and write what it is for.', 'Choose the members and issue. Each person is notified and emailed, and it appears on their profile and CV.'] },
          { kind: 'warn', text: 'Your community must be verified, and you must be a President or higher. The same person cannot get two certificates with the same title.' },
          { kind: 'links', items: [{ label: 'Certificates', href: '/dashboard/certificates' }] },
        ],
      },
    ],
  },
  {
    id: 'hackathons',
    title: 'Hackathons',
    summary: 'Teams, judging and results in one place.',
    icon: Trophy,
    who: 'Coordinator',
    sections: [
      {
        heading: 'Running a hackathon',
        blocks: [
          {
            kind: 'steps',
            items: [
              'Create the event with the hackathon type, then open "Hackathon: teams, judging & results" from the event menu on All events.',
              'Teams form and submit their projects.',
              'Judges score each submission on the score sheet. Locked sheets are collapsed and unscored ones are marked "Not scored", so you can see who still has to judge.',
              'Publish results. Winners show first on the hackathon page.',
            ],
          },
          { kind: 'text', text: 'Submitting a project and winning a place both add to a student\'s Guild Score under Projects. Winners get a winner\'s certificate, separate from the attendance certificate.' },
        ],
      },
    ],
  },
  {
    id: 'money',
    title: 'Money: tickets, wallet and Premium',
    summary: 'Earn from tickets, get paid out, and decide whether Premium is worth it.',
    icon: Wallet,
    who: 'Treasurer',
    sections: [
      {
        heading: 'Wallet',
        blocks: [
          { kind: 'list', items: ['Ticket sales collect in your community wallet, minus refunds and processing fees.', 'A Treasurer or higher sees the wallet and can Withdraw to bank: add the account number and GuildOS checks the account name first.', 'Keep your treasurer and president in the loop on every withdrawal; it is the club\'s money.'] },
          { kind: 'links', items: [{ label: 'Wallet', href: '/dashboard/wallet' }] },
        ],
      },
      {
        heading: 'Premium',
        blocks: [
          { kind: 'text', text: 'Every certificate design is free. Premium adds customisation: your own colours, fonts and wording on certificates, up to 3 signatures instead of 1, and AI help with event wording. You can pay monthly for the whole community, or unlock a single event.' },
          { kind: 'list', items: ['Pay by card, or from the wallet (a President or higher for the monthly plan, a Treasurer for a single event).', 'If a payment does not show, use Check payment status on the Premium page.'] },
          { kind: 'links', items: [{ label: 'Premium', href: '/dashboard/premium' }] },
        ],
      },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation and safety',
    summary: 'Keep your community a place people want to be.',
    icon: Flag,
    who: 'Coordinator',
    sections: [
      {
        heading: 'Reported posts and comments',
        blocks: [
          { kind: 'text', text: 'When members report a post or comment, it appears on Moderation. Remove what breaks your rules and dismiss the rest. Write your rules on the community page so people know them before they post.' },
          { kind: 'list', items: ['Act within a day. Leaving a harmful post up is worse than removing it a little too quickly.', 'For serious issues (harassment, threats, scams), remove the content, suspend the member from Members, and report it to GuildOS.'] },
          { kind: 'links', items: [{ label: 'Moderation', href: '/dashboard/moderation' }] },
        ],
      },
    ],
  },
  {
    id: 'score',
    title: 'Guild Score for leaders',
    summary: 'What running a community adds to your record.',
    icon: MonitorPlay,
    sections: [
      {
        heading: 'Points you earn',
        blocks: [
          {
            kind: 'table',
            head: ['Activity', 'Points'],
            rows: [
              ['Organizing an event (once attendance is finalized)', '50'],
              ['Serving in a leadership role', '40'],
              ['Co-hosting with another community', '30'],
              ['Each sponsor you secure for an event', '20'],
              ['Speaking: panel 30, workshop or training 40', '30–40'],
              ['Volunteering at an event', '20'],
              ['Hackathon: submitting a project 25; 1st, 2nd, 3rd place 100 / 75 / 50', '25–100'],
              ['Attending an event to the end', '10'],
            ],
          },
          { kind: 'text', text: 'Your members earn too, which is a reason to run events properly: real check-ins and check-outs are what turn into points and certificates on their CVs.' },
        ],
      },
    ],
  },
  {
    id: 'help',
    title: 'Common problems and fixes',
    summary: 'Quick answers to the things leaders ask most.',
    icon: CircleHelp,
    sections: [
      {
        heading: 'Questions',
        blocks: [
          {
            kind: 'table',
            head: ['Problem', 'Fix'],
            rows: [
              ['"Check-in has not started" on the scanner', 'Tap Open Check-In for the event on All events.'],
              ['An online attendee cannot see the meeting link', 'Check-in must be open and it must be within 15 minutes of the start. They tap "Check in & join meeting" to get it.'],
              ['Someone stayed to the end but forgot to check out', 'Before attendance is finalized, check them out from their row on Attendees (or "Check out N still online" for online events).'],
              ['A student\'s camera will not show the QR pass', 'Type the gate code under their pass on the scanner.'],
              ['A door helper\'s scanner link stopped working', 'Each link works on one device. Revoke it and send them a new one from Door scanners….'],
              ['We cannot issue certificates', 'The community must be verified, and only people with full attendance receive event certificates.'],
              ['I cannot create an event', 'You need Coordinator or higher, and the community cannot be pending verification.'],
              ['A payment does not show', 'Open Premium or Wallet and use Check payment status.'],
              ['I am graduating', 'Hand the community over to the next leader from Members, and dissolve your session on the Leaders page so your team gets their certificates.'],
            ],
          },
          { kind: 'tip', text: 'Stuck? Open the Guild Captain assistant (the sparkle button in Community mode) and ask in your own words.' },
        ],
      },
    ],
  },
];
