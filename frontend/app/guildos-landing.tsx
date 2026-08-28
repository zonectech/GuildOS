'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const observed = useRef(false);

  useEffect(() => {
    if (observed.current) return;
    observed.current = true;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('.sr, .stagger'),
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px' },
    );
    targets.forEach((el) => {
      // Already visible in viewport — show immediately, no observer needed.
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.classList.add('visible');
      } else {
        io.observe(el);
      }
    });
    return () => io.disconnect();
  }, []);

  return (
    <main className="page-shell">
      <div className="bg-orb orb-one" aria-hidden />
      <div className="bg-orb orb-two" aria-hidden />
      <div className="bg-orb orb-three" aria-hidden />

      <header className="navbar">
        <GuildOSLogo href="#top" variant="nav" />
        <nav className="nav-links">
          <a href="#how-it-works">How it Works</a>
          <a href="#students">For Students</a>
          <a href="#communities">For Communities</a>
          <a href="#preview">Preview</a>
        </nav>
        <div className="nav-actions">
          <Link className="nav-link" href="/login">Log in</Link>
          <Link className="button button-primary" href="/signup">Get Started</Link>
        </div>
        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          <a href="#how-it-works" onClick={closeMenu}>How it Works</a>
          <a href="#students" onClick={closeMenu}>For Students</a>
          <a href="#communities" onClick={closeMenu}>For Communities</a>
          <a href="#preview" onClick={closeMenu}>Preview</a>
          <Link href="/login" onClick={closeMenu}>Log in</Link>
          <Link className="button button-primary" href="/signup" onClick={closeMenu}>Get Started Free</Link>
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
