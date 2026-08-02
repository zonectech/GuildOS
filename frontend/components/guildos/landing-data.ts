export const heroStats = [
  ['12 Certificates', 'Student Portfolio'],
  ['4 Leadership Roles', 'Campus Involvement'],
  ['18 Events Attended', 'Verified Activity'],
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
  'Create or Join a Community',
  'Attend an Event',
  'Scan QR Code',
  'Receive Verified Certificate',
  'Build Your Portfolio',
] as const;

export const howItWorksSteps = [
  {
    title: 'Create or Join a Community',
    detail: 'Start a student community or join one that already exists. Set up your team, invite members, and manage everything from a single dashboard.',
    visual: 'community',
  },
  {
    title: 'Attend an Event',
    detail: 'Discover events from communities you follow, RSVP in one tap, and get reminders so you never miss what matters on campus.',
    visual: 'event',
  },
  {
    title: 'Scan QR Code',
    detail: 'Check in at the venue by scanning a unique QR code. Attendance is captured instantly and verified — no paper sheets, no disputes.',
    visual: 'qr',
  },
  {
    title: 'Receive Verified Certificate',
    detail: 'Once the event ends, an official certificate is issued automatically to every verified attendee — tamper-proof and shareable.',
    visual: 'certificate',
  },
  {
    title: 'Build Your Portfolio',
    detail: 'Every verified activity flows into your public portfolio, growing a credible record of your leadership and participation over time.',
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
    detail: 'Every certificate you earn is issued by a real community and cryptographically verifiable — no more screenshots that anyone could fake.',
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
  'Automated Certificates',
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
    title: 'Automated Certificates',
    detail: 'Certificates are issued automatically to every verified attendee the moment an event ends — fully branded to your community.',
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
    description: 'Verified participation records that communities can stand behind.',
  },
  {
    title: 'Recognition',
    description: 'Showcase leadership, service, and involvement in one place.',
  },
  {
    title: 'Growth',
    description: 'Build a stronger student profile over time with every campus activity.',
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

export const footerLinks = {
  product: {
    title: 'Product',
    links: [
      { label: 'Features', href: '#' },
      { label: 'Sponsor an event', href: '/sponsors' },
      { label: 'Documentation', href: '#' },
      { label: 'Support', href: '#' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
} as const;
