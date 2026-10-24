import type { KnowledgeCategory } from '../../models/knowledge-resource.model';

/**
 * The MLH-style organizer playbook — editable Knowledge Hub articles a community can add
 * in one click. Scaffolding to adapt, not rules: every entry is a normal ARTICLE.
 */
export const HACKATHON_PLAYBOOK: { category: KnowledgeCategory; title: string; summary: string; content: string }[] = [
  {
    category: 'GETTING_STARTED',
    title: 'Hackathon playbook: timeline & checklist',
    summary: 'What to do 8 weeks, 4 weeks, 1 week and on the day, so nothing is left to the last minute.',
    content: `# Hackathon timeline & checklist

## 8 weeks out
- [ ] Pick a date that avoids exams and public holidays
- [ ] Book the venue. Power sockets and Wi-Fi capacity matter more than chairs
- [ ] Set a theme and 2–4 prize tracks (e.g. "Best use of AI", "Best fintech hack")
- [ ] Create the event on GuildOS as type **Hackathon**, with registration open

## 4 weeks out
- [ ] Send sponsor pitches (see the sponsor-pitch template in this hub)
- [ ] Line up 3 to 5 judges. Mix industry people with lecturers
- [ ] Set team size and the submission deadline on the Hackathon dashboard
- [ ] Announce the judging criteria publicly. Teams build better when they know how they're scored

## 1 week out
- [ ] Send judges their private judging links from the Hackathon dashboard
- [ ] Confirm food, water, extension cables and a backup internet connection
- [ ] Brief volunteers: check-in desk, help desk, and room monitors
- [ ] Remind registered attendees to form teams on the hackathon page

## On the day
- [ ] Open check-in early. QR scanning is fast, but queues still form
- [ ] Opening talk: rules, criteria, deadline, where to get help
- [ ] Mid-point check-in with every team (catch stuck teams early)
- [ ] Hard stop at the deadline. Late submissions are unfair to on-time teams

## After
- [ ] Judges score on GuildOS; review the leaderboard together before publishing
- [ ] Publish results. Winners get certificates and Guild Score automatically
- [ ] Save the winning projects to the Knowledge Hub for next year's builders
- [ ] Send sponsors their impact report`,
  },
  {
    category: 'DOCUMENTATION',
    title: 'Hackathon playbook: sponsor pitch template',
    summary: 'A short, honest email to send to potential sponsors. Adapt the numbers to your event.',
    content: `# Sponsor pitch template

> Keep it short. Sponsors read dozens of these, so lead with who they'll reach.

**Subject:** Sponsor [Event name] and reach [N] student builders at [University]

Hi [Name],

I lead [Community], a student community at [University] with [N] members. On [date] we're running **[Event name]**, a [24/48]-hour hackathon where [expected number] students will build projects around [theme].

**What sponsors get**
- Logo on the event page, certificates and projector screens
- A prize track named after you (e.g. "Best use of [Product]")
- A 5-minute talk or workshop slot
- A verified post-event report: attendance, projects built, and engagement

**Packages**: listed on our GuildOS event page, payable securely through GuildOS.

Every attendee's check-in is verified, so the numbers in your report are real.

Could we have a 15-minute call this week?

[Your name]
[Role], [Community]`,
  },
  {
    category: 'DOCUMENTATION',
    title: 'Hackathon playbook: rules & code of conduct',
    summary: 'Fair-play rules and a code of conduct to read out at the opening.',
    content: `# Rules & code of conduct

## Rules
1. Teams of [min]–[max] people. Solo entries count as a team of one.
2. All code must be written during the hackathon. Open-source libraries and APIs are fine.
3. Submit on GuildOS before the deadline, with a repository link and a short demo video or live link.
4. Judges score every project on the published criteria. Their decision is final.
5. One project per team. Each team can enter any of the prize tracks.

## Code of conduct
- Be respectful. Harassment of any kind is not tolerated.
- Help each other. Mentors and other teams are not the competition; the problem is.
- Respect the venue and the people cleaning up after you.
- Report problems to any organizer. Reports are handled privately.

Breaking the code of conduct can mean removal from the event and disqualification.`,
  },
];
