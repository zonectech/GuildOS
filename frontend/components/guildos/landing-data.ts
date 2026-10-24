export const heroStats = [
  ['Leaders', 'Run communities with structure'],
  ['Members', 'Build verified credibility'],
  ['Partners', 'Support impact with confidence'],
] as const;

export const dashboardActions = ['Create Event', 'Generate QR Code', 'Verify Attendance'] as const;

export const features = [
  ['Verified Certificates', 'Store every award and participation record in one trusted profile.'],
  ['Event Check-Ins', 'Capture attendance instantly with QR-based verification.'],
  ['Leadership Records', 'Preserve roles, responsibilities, and community impact.'],
  ['Professional Portfolio', 'Showcase your campus journey in a clean public profile.'],
  ['CV Generation', 'Turn verified activity into a resume-ready summary.'],
] as const;

export const journey = [
  ['Year 1', 'Join and Explore', '120'],
  ['Year 2', 'Lead and Contribute', '380'],
  ['Year 3', 'Represent and Grow', '820'],
  ['Year 4', 'Graduate with Proof', '1450'],
] as const;

export const trustLabels = [
  'Verified identity and participation',
  'Secure QR attendance records',
  'Community-issued certificates',
] as const;

export const communities = [
  'Student Unions',
  'Departmental Associations',
  'Tech Communities',
  'Campus NGOs',
  'Ambassador Programs',
] as const;

export const faq = [
  'How do I join a community?',
  'How are attendance records verified?',
  'Can I export my portfolio?',
  'How do certificates get issued?',
] as const;

export const howItWorks = [
  'Choose Your Role',
  'Create or Join an Event',
  'Scan QR Code',
  'Capture Verified Outcomes',
  'Grow Shared Impact',
] as const;

export const howItWorksSteps = [
  {
    title: 'Choose Your Role',
    detail: 'Lead a community, join as a member, or participate as a partner. GuildOS gives each role a clear path inside one shared platform.',
    visual: 'community',
  },
  {
    title: 'Create or Join an Event',
    detail: 'Leaders publish events quickly while members discover, RSVP, and show up with clarity. Partners can align with events that match their goals.',
    visual: 'event',
  },
  {
    title: 'Scan QR Code',
    detail: 'Check in at the venue by scanning a unique QR code. Participation is captured instantly and verified without paper lists or manual disputes.',
    visual: 'qr',
  },
  {
    title: 'Capture Verified Outcomes',
    detail: 'After each event, communities issue trusted records and certificates while partners see clear engagement and delivery outcomes.',
    visual: 'certificate',
  },
  {
    title: 'Grow Shared Impact',
    detail: 'Each verified action strengthens member portfolios, community credibility, and partner trust, creating a cycle of sustainable growth.',
    visual: 'portfolio',
  },
] as const;

export const studentFeatures = [
  'Verified Certificates',
  'Track Event Participation',
  'Leadership Records',
  'Professional Portfolio',
  'CV Generation',
] as const;

export const studentFeatureDetails = [
  {
    title: 'Verified Certificates',
    detail: 'Every certificate you earn is issued by a real community and verifiable with a scan — no more screenshots that anyone could fake.',
    visual: 'certificate',
  },
  {
    title: 'Track Event Participation',
    detail: 'A complete, timestamped history of every event you attended, backed by QR check-ins you can prove.',
    visual: 'event',
  },
  {
    title: 'Leadership Records',
    detail: 'Capture the roles you held and the impact you made — executive positions, committees, and volunteer work all in one record.',
    visual: 'leadership',
  },
  {
    title: 'Professional Portfolio',
    detail: 'A clean, shareable public profile that grows automatically as you participate — perfect for recruiters and applications.',
    visual: 'portfolio',
  },
  {
    title: 'CV Generation',
    detail: 'Turn your verified activity into a polished, resume-ready summary with one click — always up to date.',
    visual: 'cv',
  },
] as const;

export const communityFeatures = [
  'Create Events',
  'QR Attendance Verification',
  'Ticketing & Community Wallet',
  'Sponsorships & Partnerships',
  'One-Click Certificates',
  'Member Management',
  'Event Reports',
] as const;

export const communityFeatureDetails = [
  {
    title: 'Create Events',
    detail: 'Publish events in minutes with RSVP, reminders, and capacity limits — members discover and register in a single tap.',
    visual: 'event',
  },
  {
    title: 'QR Attendance Verification',
    detail: 'Generate a unique QR code per event and verify real attendance instantly. No paper sheets, no padded numbers.',
    visual: 'qr',
  },
  {
    title: 'Ticketing & Community Wallet',
    detail: 'Sell tickets with tiers, promo codes, and group discounts. Money lands in your community wallet with escrow protection — withdraw straight to your bank.',
    visual: 'tickets',
  },
  {
    title: 'Sponsorships & Partnerships',
    detail: 'Publish sponsorship packages, collect payments through the platform, and deliver sponsor perks — logos, thank-you posts, and impact reports — automatically.',
    visual: 'sponsors',
  },
  {
    title: 'One-Click Certificates',
    detail: 'Issue branded certificates to every verified attendee in one click when your event ends — each carries a serial and QR code anyone can verify.',
    visual: 'certificate',
  },
  {
    title: 'Member Management',
    detail: 'See who is active, assign roles, and manage your whole community from one dashboard with live membership stats.',
    visual: 'members',
  },
  {
    title: 'Event Reports',
    detail: 'Get attendance, engagement, and certificate analytics after every event to show real impact to partners and sponsors.',
    visual: 'reports',
  },
] as const;

export const whyGuildOS = [
  {
    title: 'Trust',
    description: 'Verified records leaders, members, and partners can all rely on.',
  },
  {
    title: 'Recognition',
    description: 'Make leadership, service, and participation visible in one shared system.',
  },
  {
    title: 'Growth',
    description: 'Turn every activity into measurable progress for people and communities.',
  },
] as const;

export const productPreview = [
  {
    title: 'Community Dashboard',
    description: 'Monitor event performance, attendance, and member activity.',
    visual: 'community',
  },
  {
    title: 'QR Check-In Screen',
    description: 'Fast check-ins for real events with verified attendance records.',
    visual: 'qr',
  },
  {
    title: 'Student Portfolio Page',
    description: 'A clean public profile that grows with each verified achievement.',
    visual: 'portfolio',
  },
  {
    title: 'Certificate Preview',
    description: 'Professional certificates that are easy to issue and verify.',
    visual: 'certificate',
  },
] as const;

/** Single source of truth for the team contact address (support page, contact link). */
export const SUPPORT_EMAIL = 'support@guildos.app';

/** Social profiles — fill in real URLs as they go live; empty entries are hidden from the footer. */
export const socialLinks = [
  { label: 'LinkedIn', href: '' },
  { label: 'X', href: '' },
  { label: 'Instagram', href: '' },
  { label: 'GitHub', href: '' },
] as const;

export const footerLinks = {
  product: {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#students' },
      { label: 'Sponsor an event', href: '/sponsors' },
      { label: 'Documentation', href: '/docs' },
      { label: 'Support', href: '/support' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Contact', href: `mailto:${SUPPORT_EMAIL}` },
    ],
  },
} as const;
