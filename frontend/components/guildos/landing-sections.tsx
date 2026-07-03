import Link from 'next/link';

import { GuildOSLogo } from './guildos-logo';
import { communities, faq, features, journey, trustLabels, dashboardActions, footerLinks, heroStats, howItWorks, communityFeatures, productPreview, studentFeatures, whyGuildOS } from './landing-data';

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeatureGlyph({ index }: { index: number }) {
  const glyphs = [
    <path key="0" d="M13 18h18M13 26h18M13 34h18" />,
    <path key="1" d="M18 34c2.8-2.8 4.4-6.6 4.4-10.5 0-6.8 5.3-11.5 11.6-11.5" />,
    <path key="2" d="M16 30h8m4-16h16l-6 9 6 9H28l6-9-6-9Z" />,
    <path key="3" d="M16 16h14v20H16zM30 20h12v16H30z" />,
  ];

  return (
    <svg className="feature-glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" />
      {glyphs[index % glyphs.length]}
    </svg>
  );
}

function FeatureCard({ title, description, index }: { title: string; description: string; index: number }) {
  return (
    <article className="feature-card reveal" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="feature-index">0{index + 1}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

function PreviewCard({ title, description, index }: { title: string; description: string; index: number }) {
  const artClassName = `preview-art preview-art-${index + 1}`;

  return (
    <article className="preview-card reveal" style={{ animationDelay: `${index * 0.07}s` }}>
      <div className={artClassName} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

function HeroSection() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy reveal">
        <span className="badge">Trusted by Student Communities Across Africa</span>
        <h1>Turn Campus Activities Into Career Opportunities</h1>
        <p className="hero-subtitle">GuildOS helps students build verifiable portfolios, earn trusted credentials, prove leadership experience, and get discovered through real campus impact.</p>
        <div className="cta-row" id="get-started">
          <Link className="button button-primary" href="/signup">Build Your Reputation</Link>
          <a className="button button-secondary" href="#recruiters">See Verification</a>
        </div>
        <div className="stat-strip">
          <Stat label="Students Verified" value="24K+" />
          <Stat label="Communities Active" value="860" />
          <Stat label="Recruiter Matches" value="4.9K" />
          <Stat label="Certificates Issued" value="18K" />
        </div>
      </div>
      <div className="hero-visual reveal">
        <div className="glass-card mockup visual-frame">
          <div className="mockup-header">
            <span>GuildOS Dashboard</span>
            <span className="live-pill">Live</span>
          </div>
          <div className="mockup-grid">
            <div className="metric-card accent"><span>Guild Score</span><strong>1450</strong></div>
            <div className="metric-card"><span>Leadership Score</span><strong>920</strong></div>
            <div className="metric-card"><span>Participation Score</span><strong>530</strong></div>
            <div className="metric-card success"><span>Match Rate</span><strong>96%</strong></div>
          </div>
          <svg className="visual-chart" viewBox="0 0 640 180" aria-hidden="true">
            <path d="M32 140h576" stroke="#dbe4ee" strokeWidth="2" />
            <path d="M52 120c58-30 96-8 146-42s92-42 144-10 102 48 206-18" fill="none" stroke="url(#heroLine)" strokeWidth="8" strokeLinecap="round" />
            <defs>
              <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <div className="progress-panel">
            <div><span>Reputation Growth</span><strong>+32% this semester</strong></div>
            <div className="progress-bar"><span /></div>
          </div>
        </div>

      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="section content-width" id="features">
      <SectionHeading eyebrow="Product Features" title="Everything Needed To Power Student Reputation" subtitle="A premium operating system for students, communities, recruiters, and universities." />
      <div className="feature-grid">
        {features.map(([title, description], index) => (
          <FeatureCard key={title} title={title} description={description} index={index} />
        ))}
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="section content-width problem-section" id="students">
      <SectionHeading eyebrow="The Problem" title="Your Hard Work Disappears After Graduation" subtitle="Activity without verification becomes invisible to employers, scholarship boards, and the wider professional world." />
      <div className="problem-grid">
        {['Attended Events', 'Organized Programs', 'Led Communities', 'Earned Certificates'].map((item) => (
          <article key={item} className="problem-card">
            <span>{item}</span>
          </article>
        ))}
        <div className="problem-outcome">
          <div className="broken-timeline"><span /><span /><span /><span /></div>
          <strong>No Verifiable Record</strong>
          <p>All that effort, with nothing credible to show.</p>
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section className="section content-width" id="communities">
      <SectionHeading eyebrow="The Solution" title="Transform Activity Into Opportunity" subtitle="Every event, contribution, and leadership moment becomes a verified career asset." />
      <div className="flow-panel">
        {['Attend Event', 'Verify Attendance', 'Earn Certificate', 'Build Reputation', 'Generate Verifiable CV', 'Get Opportunities'].map((step, index) => (
          <div key={step} className="flow-step">
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function JourneySection() {
  return (
    <section className="section content-width">
      <SectionHeading eyebrow="Student Journey" title="A Reputation That Compounds Every Year" subtitle="GuildOS turns campus involvement into a clear progression of trust, leadership, and career readiness." />
      <div className="timeline-panel">
        {journey.map(([year, stage, score], index) => (
          <div key={year} className="timeline-item">
            <div className="timeline-dot" />
            <div>
              <p>{year}</p>
              <strong>{stage}</strong>
            </div>
            <span>Guild Score {score}</span>
            {index < journey.length - 1 ? <div className="timeline-connector" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function LeaderSection() {
  return (
    <section className="section content-width leader-grid">
      <div>
        <SectionHeading eyebrow="Community Leaders" title="Built For Student Leaders" subtitle="Run communities with analytics, reports, and certificate workflows that look enterprise-grade." />
        <div className="leader-stats">
          <Stat label="Communities Managed" value="4" />
          <Stat label="Students Impacted" value="1,280" />
          <Stat label="Events Organized" value="36" />
          <Stat label="Certificates Issued" value="1,150" />
        </div>
      </div>
      <div className="glass-card analytics-mockup">
        <div className="mockup-header">
          <span>Monthly Report</span>
          <span className="live-pill">Generated</span>
        </div>
        <svg viewBox="0 0 440 240" className="analytics-svg" aria-hidden="true">
          <rect x="0" y="0" width="440" height="240" rx="24" fill="rgba(248,250,252,0.9)" />
          <path d="M34 200h372" stroke="#cbd5e1" strokeWidth="2" />
          <path d="M54 194V88M126 194V136M198 194V70M270 194V106M342 194V52" stroke="url(#analyticsGradient)" strokeWidth="26" strokeLinecap="round" />
          <defs>
            <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <path d="M54 90l72 48 72-66 72 42 72-48" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="54" cy="90" r="7" fill="#10b981" />
          <circle cx="126" cy="138" r="7" fill="#10b981" />
          <circle cx="198" cy="72" r="7" fill="#10b981" />
          <circle cx="270" cy="114" r="7" fill="#10b981" />
          <circle cx="342" cy="66" r="7" fill="#10b981" />
        </svg>
        <p>Professional analytics for governance, accountability, and growth.</p>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="section content-width trust-section">
      <SectionHeading eyebrow="Trust" title="Three Layers of Verification" subtitle="GuildOS proves identity, leadership, and community legitimacy in one trust system." />
      <div className="trust-grid">
        {trustLabels.map((item) => (
          <article key={item} className="trust-badge">
            <span aria-hidden="true">✓</span>
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecruiterSection() {
  return (
    <section className="section content-width recruiter-grid" id="recruiters">
      <div className="recruiter-copy">
        <SectionHeading eyebrow="Recruiters" title="Hire Based On Proof, Not Claims" subtitle="Instantly verify student leadership, participation, and awards through secure public credentials." />
      </div>
      <div className="credential-card">
        <div className="credential-header">
          <div>
            <strong>Student: Idowu Taye</strong>
            <p>guildos.app/u/taye</p>
          </div>
          <span className="verified-chip">Verified</span>
        </div>
        <div className="credential-list">
          <div><span>Guild Score</span><strong>1450</strong></div>
          <div><span>Leadership</span><strong>President, AgriConnect AI</strong></div>
          <div><span>Events Organized</span><strong>18</strong></div>
          <div><span>Students Reached</span><strong>1240</strong></div>
        </div>
      </div>
    </section>
  );
}

function AISection() {
  return (
    <section className="section content-width ai-section" id="resources">
      <SectionHeading eyebrow="AI" title="AI That Understands Your Journey" subtitle="GuildOS uses your verified history to generate smarter resumes, reports, and opportunity matches." />
      <div className="ai-grid">
        {['AI Event Generator', 'AI Resume Builder', 'AI Opportunity Matching', 'AI Community Reports'].map((item, index) => (
          <article key={item} className="ai-card">
            <FeatureGlyph index={index} />
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProfileSection() {
  return (
    <section className="section content-width profile-section">
      <SectionHeading eyebrow="Public Profile" title="Your Reputation, Public and Portable" subtitle="Share a single verified profile that grows with every meaningful action." />
      <div className="profile-card">
        <div className="profile-left">
          <div className="avatar">TY</div>
          <div>
            <strong>guildos.app/u/taye</strong>
            <p>Profile, activity timeline, certificates, and opportunities</p>
          </div>
        </div>
        <div className="profile-right">
          <Stat label="Guild Score" value="1450" />
          <Stat label="Leadership History" value="4 roles" />
          <Stat label="Certificates" value="18" />
          <Stat label="Opportunities" value="96% match" />
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="section content-width testimonials-section">
      <SectionHeading eyebrow="Testimonials" title="Loved By Students, Trusted By Recruiters" subtitle="A network that rewards real contribution and makes it visible to the world." />
      <div className="testimonial-grid">
        <article className="testimonial-card large">
          <p>“GuildOS transformed my campus activities into a professional portfolio.”</p>
          <strong>Student Leader</strong>
        </article>
        <article className="testimonial-card">
          <p>“For the first time, we can verify student leadership and participation.”</p>
          <strong>Recruiter</strong>
        </article>
        <article className="testimonial-card">
          <p>“It feels like the missing operating system for campus growth.”</p>
          <strong>University Community</strong>
        </article>
      </div>
    </section>
  );
}

function CommunitiesSection() {
  return (
    <section className="section content-width communities-section">
      <SectionHeading eyebrow="Community Showcase" title="A Platform For Every Campus Builder" subtitle="From innovation hubs to student governments, GuildOS supports real communities that need trust and momentum." />
      <div className="community-grid">
        {communities.map((item) => (
          <article key={item} className="community-pill">{item}</article>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="section content-width" id="pricing">
      <SectionHeading eyebrow="Pricing" title="Simple Plans For Every Stage" subtitle="Start free, grow your community, and scale into institution-level trust infrastructure." />
      <div className="pricing-grid">
        <article className="pricing-card">
          <h3>Students</h3>
          <strong>Free Forever</strong>
          <p>Build your reputation and public profile at no cost.</p>
        </article>
        <article className="pricing-card">
          <h3>Community Starter</h3>
          <strong>Free</strong>
          <p>Basic event tracking, attendance, and certificates.</p>
        </article>
        <article className="pricing-card featured">
          <h3>Community Pro</h3>
          <strong>₦10,000/month</strong>
          <p>Advanced analytics, reports, verification, and opportunity tools.</p>
        </article>
        <article className="pricing-card">
          <h3>Enterprise</h3>
          <strong>Custom</strong>
          <p>For universities, NGOs, and large organizations.</p>
        </article>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="section content-width faq-section">
      <SectionHeading eyebrow="FAQ" title="Common Questions" subtitle="Fast answers for students, leaders, recruiters, and universities." />
      <div className="faq-list">
        {faq.map((item) => (
          <details key={item} className="faq-item">
            <summary>{item}</summary>
            <p>GuildOS is designed to verify participation, leadership, and community impact in a transparent and professional way.</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="final-cta">
      <SectionHeading eyebrow="Final CTA" title="Don't Let Your Campus Impact Disappear" subtitle="Build a reputation that grows with every verified achievement." />
      <div className="cta-row">
        <Link className="button button-primary" href="/signup">Start Building Your Reputation</Link>
        <a className="button button-secondary" href="#recruiters">Create a Community</a>
      </div>
    </section>
  );
}

export function FooterSection() {
  const { product, legal } = footerLinks;

  return (
    <footer className="footer">
      <div>
        <GuildOSLogo variant="footer" showTagline={false} />
        <p>Student reputation infrastructure for Africa's next generation.</p>
      </div>
      <div className="footer-columns">
        <div>
          <strong>{product.title}</strong>
          <a href="#features">{product.links[0]}</a>
          <a href="#contact">{product.links[1]}</a>
          <a href="#contact">{product.links[2]}</a>
        </div>
        <div>
          <strong>{legal.title}</strong>
          <a href="#contact">{legal.links[0]}</a>
          <a href="#contact">{legal.links[1]}</a>
          <a href="#contact">{legal.links[2]}</a>
        </div>
      </div>
      <div className="footer-meta">
        <span>LinkedIn</span>
        <span>X</span>
        <span>Instagram</span>
        <span>GitHub</span>
      </div>
    </footer>
  );
}

export function LandingHeroSection() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy reveal">
        <span className="badge">Verified campus records for student communities</span>
        <h1>Turn Campus Activities Into a Professional Portfolio</h1>
        <p className="hero-subtitle">Track participation, earn certificates, and showcase your leadership journey through verified campus experiences.</p>
        <div className="cta-row">
          <Link className="button button-primary" href="/signup">Get Started</Link>
          <a className="button button-secondary" href="#communities">Create Community</a>
        </div>
        <div className="stat-strip">
          {heroStats.map(([value, label]) => <Stat key={label} label={label} value={value} />)}
        </div>
      </div>
      <div className="hero-visual reveal">
        <div className="hero-split glass-card">
          <div className="hero-split-col">
            <span className="split-eyebrow">Student Portfolio</span>
            <strong className="split-value">12 Certificates</strong>
            <div className="split-mini-grid">
              <div className="split-mini-card"><span>Leadership Roles</span><strong>4</strong></div>
              <div className="split-mini-card"><span>Events Attended</span><strong>18</strong></div>
            </div>
            <div className="split-timeline" aria-hidden="true"><span /><span /><span /></div>
            <p>Keep a clean, verified record of everything you do on campus.</p>
          </div>
          <div className="hero-split-col hero-split-right">
            <span className="split-eyebrow">Community Dashboard</span>
            <div className="split-actions">{dashboardActions.map((item) => <span key={item}>{item}</span>)}</div>
            <div className="split-kpi-grid">
              <div><span>Check-ins</span><strong>148</strong></div>
              <div><span>Certificates</span><strong>96</strong></div>
              <div><span>Members</span><strong>312</strong></div>
              <div><span>Attendance</span><strong>91%</strong></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingHowItWorksSection() {
  return (
    <section className="section content-width" id="how-it-works">
      <SectionHeading eyebrow="How It Works" title="How GuildOS Works" subtitle="A simple path from participation to a verified portfolio." />
      <div className="flow-panel">
        {howItWorks.map((step, index) => (
          <div key={step} className="flow-step">
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingStudentsSection() {
  return (
    <section className="section content-width" id="students">
      <SectionHeading eyebrow="For Students" title="Everything You Achieve, Organized" subtitle="A portfolio-first experience that keeps your certificates, roles, and participation in one place." />
      <div className="dual-layout">
        <div className="feature-grid compact-grid">
          {studentFeatures.map((title, index) => <FeatureCard key={title} title={title} description="Built from real campus activity and verified check-ins." index={index} />)}
        </div>
        <div className="dashboard-mock glass-card reveal">
          <div className="mockup-header"><span>Portfolio Page</span><span className="live-pill">Updated</span></div>
          <div className="dashboard-mock-grid">
            <div className="dashboard-metric accent"><span>Certificates</span><strong>12</strong></div>
            <div className="dashboard-metric"><span>Roles</span><strong>4</strong></div>
            <div className="dashboard-metric"><span>Events</span><strong>18</strong></div>
            <div className="dashboard-metric success"><span>CV Ready</span><strong>Yes</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingCommunitiesSection() {
  return (
    <section className="section content-width" id="communities">
      <SectionHeading eyebrow="For Communities" title="Manage Events Without The Chaos" subtitle="Everything a student leader needs to create events, verify attendance, and issue certificates with confidence." />
      <div className="dual-layout">
        <div className="feature-grid compact-grid">
          {communityFeatures.map((title, index) => <FeatureCard key={title} title={title} description="Simple workflows designed for fast-moving campus teams." index={index} />)}
        </div>
        <div className="analytics-mock glass-card reveal">
          <div className="mockup-header"><span>Dashboard Analytics</span><span className="live-pill">Monthly</span></div>
          <div className="analytics-card-row">
            <div className="analytics-card"><span>Attendance</span><strong>91%</strong></div>
            <div className="analytics-card"><span>Certificates</span><strong>96</strong></div>
            <div className="analytics-card"><span>Members</span><strong>312</strong></div>
          </div>
          <div className="analytics-bars">
            <span style={{ width: '82%' }} />
            <span style={{ width: '64%' }} />
            <span style={{ width: '90%' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingWhyGuildOSSection() {
  return (
    <section className="section content-width">
      <SectionHeading eyebrow="Why GuildOS" title="Built For Real Student Communities" subtitle="Trust, recognition, and growth in a platform that feels credible from day one." />
      <div className="why-grid">
        {whyGuildOS.map((item, index) => (
          <article key={item.title} className="why-card reveal" style={{ animationDelay: `${index * 0.08}s` }}>
            <span>{item.title}</span>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LandingProductPreviewSection() {
  return (
    <section className="section content-width" id="preview">
      <SectionHeading eyebrow="Product Preview" title="See the Platform in Action" subtitle="Realistic mockups for the community dashboard, QR check-in screen, student portfolio, and certificate preview." />
      <div className="preview-grid">
        {productPreview.map(({ title, description }, index) => <PreviewCard key={title} title={title} description={description} index={index} />)}
      </div>
    </section>
  );
}

export function LandingFinalCTASection() {
  return (
    <section className="final-cta content-width" id="contact">
      <SectionHeading eyebrow="Final CTA" title="Don't Let Your Campus Achievements Get Lost" subtitle="Start building a verified record of your university journey." />
      <div className="cta-row">
        <Link className="button button-primary" href="/signup">Get Started Free</Link>
        <a className="button button-secondary" href="#communities">Create Community</a>
      </div>
    </section>
  );
}
