'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { GuildOSLogo } from '../components/guildos/guildos-logo';
import {
  FooterSection,
  LandingCommunitiesSection,
  LandingFinalCTASection,
  LandingHeroSection,
  LandingHowItWorksSection,
  LandingProductPreviewSection,
  LandingStudentsSection,
  LandingWhyGuildOSSection,
} from '../components/guildos/landing-sections';

export default function GuildOSLandingPage() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.18 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="page-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      <div className="bg-orb orb-three" />

      <header className="navbar">
        <GuildOSLogo href="#top" variant="nav" />
        <nav className="nav-links">
          <a href="#how-it-works">How it Works</a>
          <a href="#students">For Students</a>
          <a href="#communities">For Communities</a>
          <a href="#preview">Preview</a>
        </nav>
        <div className="nav-actions">
          <a className="nav-link" href="#contact">Documentation</a>
          <Link className="button button-primary" href="/signup">Get Started</Link>
        </div>
      </header>

      <LandingHeroSection />
      <LandingHowItWorksSection />
      <LandingStudentsSection />
      <LandingCommunitiesSection />
      <LandingWhyGuildOSSection />
      <LandingProductPreviewSection />
      <LandingFinalCTASection />
      <FooterSection />
    </main>
  );
}
