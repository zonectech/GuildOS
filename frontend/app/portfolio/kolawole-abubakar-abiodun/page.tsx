import type { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Code2,
  Download,
  FileText,
  GraduationCap,
  Languages,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Rocket,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kolawole Abubakar Abiodun | Resume Portfolio',
  description:
    'A GuildOS-styled personal resume portfolio for Kolawole Abubakar Abiodun, featuring projects, leadership experience, education, and technical skills.',
};

const profile = {
  name: 'Kolawole Abubakar Abiodun',
  shortName: 'Kolawole Abiodun',
  location: 'Minna, Niger State, Nigeria',
  phone: '+234 813 993 5240',
  phoneHref: 'tel:+2348139935240',
  email: 'abubakar.m2300346@st.futminna.edu.ng',
  emailHref: 'mailto:abubakar.m2300346@st.futminna.edu.ng',
  status: 'Open to Internship & Graduate Opportunities',
  summary:
    'Motivated and innovative undergraduate student of Agricultural Extension and Rural Development at the Federal University of Technology, Minna, with a CGPA of 3.86/5.00. Passionate about leveraging technology to solve real-world problems in education, finance, and community development. Experienced in software development, product design, student leadership, and community-based research, with a proven ability to lead teams, manage projects, and build scalable digital solutions. Seeking internship and graduate opportunities where I can contribute technical expertise while continuously learning and growing.',
  pitch:
    'Full-stack builder, product-minded researcher, and student leader creating practical digital solutions for education, finance, and community development.',
  education: {
    school: 'Federal University of Technology, Minna (FUT Minna)',
    degree: 'B.Tech. Agricultural Extension and Rural Development',
    level: '300 Level',
    graduation: '2028',
    cgpa: '3.86 / 5.00',
  },
};

const skillGroups = [
  {
    title: 'Programming & Web',
    icon: Code2,
    skills: [
      'JavaScript (ES6+)',
      'TypeScript',
      'React.js',
      'Next.js',
      'Node.js',
      'Express.js',
      'HTML5',
      'CSS3',
      'Tailwind CSS',
    ],
  },
  {
    title: 'Databases',
    icon: FileText,
    skills: ['MongoDB', 'Firebase Firestore'],
  },
  {
    title: 'Tools & Platforms',
    icon: Wrench,
    skills: ['Git & GitHub', 'Vercel', 'Netlify', 'Firebase', 'Postman', 'VS Code', 'Figma'],
  },
  {
    title: 'Other Skills',
    icon: Sparkles,
    skills: [
      'REST API Development',
      'Authentication Systems',
      'Database Design',
      'Product Management',
      'UI/UX Design',
      'Technical Documentation',
      'Data Management (Excel/Google Sheets, JotForm)',
    ],
  },
];

const projects = [
  {
    title: 'GuildOS',
    role: 'Product Designer & Full-Stack Developer',
    description:
      'AI-powered student community platform for managing communities, events, certificates, student profiles, leadership, and opportunities.',
    bullets: [
      'Designed the complete product architecture.',
      'Developed community and membership management features.',
      'Built authentication and user role management.',
      'Designed recruiter and student profile systems.',
      'Implemented public student profiles and reputation scoring.',
      'Developed event registration and verification workflows.',
    ],
    stack: ['Next.js', 'React', 'MongoDB', 'Firebase', 'Node.js', 'TypeScript'],
  },
  {
    title: 'Exdollarium',
    role: 'Founder & Full-Stack Developer',
    description:
      'Digital exchange platform focused on digital asset exchange and payment solutions.',
    bullets: [
      'Designed exchange workflow for digital payments.',
      'Integrated secure authentication.',
      'Built backend APIs.',
      'Developed responsive user dashboard.',
      'Worked on transaction management and financial workflows.',
    ],
    stack: ['React', 'Node.js', 'Express.js', 'MongoDB', 'Firebase'],
  },
  {
    title: 'Community Needs Assessment',
    role: 'Lead Researcher',
    description:
      'Academic research project for Dama Community, Bosso LGA, assessing development needs through structured survey methodology and feasibility analysis.',
    bullets: [
      'Designed a 12-question structured questionnaire covering socio-economic characteristics and community development needs.',
      'Analyzed primary survey data alongside secondary literature and institutional data (NAMDA) to validate findings.',
      'Authored a complete project report and a feasibility study covering technical, institutional, social, and financial viability.',
    ],
    stack: ['Research Design', 'Survey Analysis', 'Feasibility Study', 'Community Development'],
  },
];

const leadership = [
  {
    title: 'Naqeeb (Student Leader)',
    organization: 'Agricultural Muslim Students (AMAS), FUT Minna',
    responsibilities: [
      'Coordinated executive members and student activities.',
      'Organized academic, religious, and leadership programs.',
      'Led orientation and mentoring sessions for new students.',
      'Facilitated meetings and represented students during official engagements.',
      'Promoted teamwork and effective communication among members.',
    ],
  },
  {
    title: 'Shura Committee General Secretary',
    organization: 'Agricultural Muslim Students (AMAS), FUT Minna',
    responsibilities: [
      'Coordinated Shura Committee meetings and prepared official minutes for AMAS executive proceedings.',
      'Oversaw the nomination and interview process for AMAS executive elections, including online and printed nomination forms.',
      'Managed nominee tracking documentation, including attendance records across the nomination and interview process.',
    ],
  },
];

const strengths = [
  'Leadership',
  'Problem Solving',
  'Critical Thinking',
  'Public Speaking',
  'Team Collaboration',
  'Communication',
  'Time Management',
  'Project Coordination',
  'Community Development',
  'Adaptability',
];

const interests = [
  'Agricultural Extension',
  'Community Development',
  'Digital Innovation',
  'Educational Technology',
  'Financial Technology (FinTech)',
  'Artificial Intelligence Applications',
  'Product Development',
];

const languages = [
  'English - Fluent',
  'Yoruba - Native',
];

const heroStats = [
  {
    label: 'CGPA',
    value: '3.86',
    tone: 'bg-gradient-to-br from-indigo-500/12 via-purple-500/10 to-white',
  },
  {
    label: 'Projects',
    value: '3',
    tone: 'bg-slate-100/80',
  },
  {
    label: 'Leadership Roles',
    value: '2',
    tone: 'bg-emerald-500/10',
  },
  {
    label: 'Languages',
    value: '2',
    tone: 'bg-sky-500/10',
  },
];

function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 max-w-3xl">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 shadow-sm">
        <Icon className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">{title}</h2>
      {description ? <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">{description}</p> : null}
    </div>
  );
}

function Chip({ children, tint = 'default' }: { children: React.ReactNode; tint?: 'default' | 'success' | 'accent' }) {
  const tones = {
    default: 'border-slate-200 dark:border-slate-800 bg-white/90 text-slate-700 dark:text-slate-300',
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-700',
    accent: 'border-indigo-200 bg-indigo-50/90 text-indigo-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm ${tones[tint]}`}>
      {children}
    </span>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3 rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
      <div className="mt-0.5 rounded-2xl bg-white/10 p-2">
        <Icon className="h-4 w-4 text-indigo-200" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-medium text-white sm:text-base">{value}</p>
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="transition hover:-translate-y-0.5 hover:text-white">
      {content}
    </a>
  ) : content;
}

export default function KolawoleAbubakarAbiodunPortfolioPage() {
  return (
    <main className="page-shell min-h-screen bg-[#FAFAFA] text-slate-950 dark:text-white">
      <div className="bg-orb orb-one" aria-hidden />
      <div className="bg-orb orb-two" aria-hidden />
      <div className="bg-orb orb-three" aria-hidden />
      <div
        className="pp-griddrift pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.18) 70%, transparent)',
        }}
        aria-hidden
      />

      <div className="content-width relative z-10 pb-20 pt-4 sm:pt-6">
        <header className="sticky top-4 z-30 mb-10 rounded-[30px] border border-white/80 bg-white/80 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-extrabold text-white shadow-[0_14px_32px_rgba(79,70,229,0.32)]">
                KA
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-lg">{profile.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Student leader, product builder, and emerging technology professional</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 lg:justify-end">
                {[
                  ['About', '#about'],
                  ['Skills', '#skills'],
                  ['Projects', '#projects'],
                  ['Leadership', '#leadership'],
                  ['Contact', '#contact'],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="rounded-full px-3 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white">
                    {label}
                  </a>
                ))}
              </nav>
              <a
                href="/kolawole-abubakar-abiodun-resume.txt"
                download
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(79,70,229,0.3)]"
              >
                <Download className="h-4 w-4" />
                Download Resume
              </a>
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden pb-14 pt-4 lg:pt-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-4 py-2 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{profile.status}</span>
              </div>

              <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-[-0.06em] text-slate-950 dark:text-white sm:text-6xl xl:text-[4.2rem]">
                Building
                {' '}
                <span className="gradient-text">Technology</span>
                {' '}
                that solves real-world problems across education, finance, and community development.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-lg">
                {profile.pitch}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/kolawole-abubakar-abiodun-resume.txt"
                  download
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(79,70,229,0.32)]"
                >
                  <Download className="h-4 w-4" />
                  Download Resume
                </a>
                <a
                  href="#projects"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/90 px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-slate-950 dark:hover:text-white"
                >
                  View Projects
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-6">
                {[
                  ['CGPA', '3.86 / 5.00'],
                  ['Expected Graduation', '2028'],
                  ['Core Focus', 'Full-Stack + Product'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-2xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">{value}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="glass-card relative overflow-hidden rounded-[32px] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-indigo-500/10 via-violet-500/8 to-transparent" aria-hidden />
                <div className="relative">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">Profile Overview</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">GuildOS-inspired snapshot of academics, projects, and leadership</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Available
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {heroStats.map((item) => (
                      <div key={item.label} className={`rounded-[24px] p-4 shadow-sm ring-1 ring-white/70 ${item.tone}`}>
                        <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[24px] bg-slate-50/90 p-4 ring-1 ring-slate-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <span>Academic Progress</span>
                      <span>300 Level - On track for 2028</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="pp-shine h-full w-[60%] rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500" />
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/80">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                        <Rocket className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Current Focus</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Scalable digital products, research, and student leadership impact</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="float-card absolute -top-5 right-3 hidden rounded-2xl border border-emerald-200 bg-white dark:bg-slate-900 px-4 py-3 shadow-lg lg:block">
                <p className="text-xs text-slate-500 dark:text-slate-400">New leadership update</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-950 dark:text-white">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  AMAS Shura Secretary
                </p>
              </div>

              <div className="float-card-slow absolute -bottom-4 -left-4 hidden rounded-2xl border border-indigo-200 bg-white dark:bg-slate-900 px-4 py-3 shadow-lg lg:block">
                <p className="text-xs text-slate-500 dark:text-slate-400">Research milestone</p>
                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Dama Community report completed</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-28 py-10">
          <SectionIntro
            icon={FileText}
            eyebrow="About"
            title="Professional Summary"
            description="A concise overview of Kolawole's academic background, technical growth, leadership track record, and career direction."
          />
          <div className="rounded-[30px] bg-white/90 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70">
            <div className="max-w-4xl">
              <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-lg">
                {profile.summary}
              </p>
            </div>
          </div>
        </section>

        <section id="education" className="scroll-mt-28 py-10">
          <SectionIntro
            icon={GraduationCap}
            eyebrow="Education"
            title="Academic Foundation"
            description="A strong academic record in Agricultural Extension and Rural Development paired with practical technology building experience."
          />
          <div className="rounded-[30px] bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 sm:p-8">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[24px] bg-slate-50/90 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Institution</p>
                <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">{profile.education.school}</h3>
                <p className="mt-3 text-base text-slate-600 dark:text-slate-400">{profile.education.degree}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  ['Current Level', profile.education.level, 'bg-indigo-50/90'],
                  ['Expected Graduation', profile.education.graduation, 'bg-slate-100/90'],
                  ['CGPA', profile.education.cgpa, 'bg-emerald-50/90'],
                ].map(([label, value, tone]) => (
                  <div key={label} className={`rounded-[24px] p-5 shadow-sm ring-1 ring-slate-200/70 ${tone}`}>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-3 text-xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="skills" className="scroll-mt-28 py-10">
          <SectionIntro
            icon={Code2}
            eyebrow="Technical Skills"
            title="Tools, technologies, and product capabilities"
            description="A mix of modern web development, product execution, data handling, and collaboration tools."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {skillGroups.map(({ title, icon: Icon, skills }) => (
              <article
                key={title}
                className="rounded-[30px] bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(15,23,42,0.09)]"
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-3 text-white shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white">{title}</h3>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {skills.map((skill) => (
                    <Chip key={skill} tint={title === 'Other Skills' ? 'success' : title === 'Programming & Web' ? 'accent' : 'default'}>
                      {skill}
                    </Chip>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="projects" className="scroll-mt-28 py-10">
          <SectionIntro
            icon={Rocket}
            eyebrow="Projects"
            title="Selected work spanning product, engineering, and research"
            description="Three representative projects showing end-to-end product thinking, technical execution, and community-focused problem solving."
          />
          <div className="grid gap-5 xl:grid-cols-3">
            {projects.map((project, index) => (
              <article
                key={project.title}
                className="group overflow-hidden rounded-[30px] bg-white/90 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.1)]"
              >
                <div className={`h-2 bg-gradient-to-r ${index === 0 ? 'from-indigo-600 via-violet-600 to-sky-500' : index === 1 ? 'from-violet-600 via-indigo-600 to-emerald-500' : 'from-emerald-500 via-sky-500 to-indigo-600'}`} />
                <div className="p-6">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">{project.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-indigo-700">{project.role}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 dark:bg-slate-950 p-3 text-slate-600 dark:text-slate-400 transition group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-500/15 dark:group-hover:text-indigo-300">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>

                  <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{project.description}</p>

                  <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {project.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {project.stack.map((item) => (
                      <Chip key={item} tint={index === 2 ? 'success' : 'accent'}>
                        {item}
                      </Chip>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="leadership" className="scroll-mt-28 py-10">
          <SectionIntro
            icon={Users}
            eyebrow="Leadership Experience"
            title="Leading teams, programs, and student representation"
            description="Hands-on leadership across program coordination, mentoring, meeting facilitation, and election process management."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {leadership.map((item, index) => (
              <article
                key={item.title}
                className="rounded-[30px] bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70"
              >
                <div className="mb-5 flex items-start gap-4">
                  <div className={`rounded-2xl p-3 text-white shadow-sm ${index === 0 ? 'bg-gradient-to-br from-indigo-600 to-violet-600' : 'bg-gradient-to-br from-emerald-500 to-sky-500'}`}>
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold tracking-[-0.03em] text-slate-950 dark:text-white">{item.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{item.organization}</p>
                  </div>
                </div>

                <ul className="space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                  {item.responsibilities.map((responsibility) => (
                    <li key={responsibility} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600" />
                      <span>{responsibility}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="py-10">
          <SectionIntro
            icon={Lightbulb}
            eyebrow="Strengths & Academic Interests"
            title="Core strengths paired with long-term learning interests"
            description="A blend of people leadership, structured execution, and a strong interest in technology-driven development."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-[30px] bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white">Relevant Strengths</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {strengths.map((strength) => (
                  <Chip key={strength} tint="accent">{strength}</Chip>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold tracking-[-0.03em] text-slate-950 dark:text-white">Academic Interests</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {interests.map((interest) => (
                  <Chip key={interest} tint="success">{interest}</Chip>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="py-10">
          <SectionIntro
            icon={Languages}
            eyebrow="Languages"
            title="Clear communication across local and professional settings"
          />
          <div className="flex flex-wrap gap-3">
            {languages.map((language, index) => (
              <Chip key={language} tint={index === 0 ? 'accent' : 'success'}>
                {language}
              </Chip>
            ))}
          </div>
        </section>
      </div>

      <section
        id="contact"
        className="scroll-mt-28 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_22%),linear-gradient(135deg,#0f172a,#111827)] py-16"
      >
        <div className="content-width">
          <div className="grid gap-10 rounded-[36px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_100px_rgba(2,6,23,0.32)] backdrop-blur sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
                <Mail className="h-3.5 w-3.5" />
                Contact
              </div>
              <h2 className="max-w-xl text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-5xl">
                Let&apos;s build meaningful products and communities together.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Kolawole is open to internship and graduate opportunities where he can contribute technical expertise, product thinking, and leadership energy while continuing to grow.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={profile.emailHref}
                  className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 px-5 py-3.5 text-sm font-semibold text-slate-950 dark:text-white transition hover:-translate-y-0.5"
                >
                  <Mail className="h-4 w-4" />
                  Get in Touch
                </a>
                <a
                  href="/kolawole-abubakar-abiodun-resume.txt"
                  download
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  <Download className="h-4 w-4" />
                  Download Resume
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <ContactRow icon={MapPin} label="Location" value={profile.location} />
              <ContactRow icon={Phone} label="Phone" value={profile.phone} href={profile.phoneHref} />
              <ContactRow icon={Mail} label="Email" value={profile.email} href={profile.emailHref} />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 text-sm text-slate-400 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>References available upon request.</p>
            <p>Designed in the GuildOS visual style with modern SaaS-inspired presentation.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
