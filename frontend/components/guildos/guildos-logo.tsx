import Link from 'next/link';
import type { ReactNode } from 'react';

type GuildOSLogoVariant = 'nav' | 'auth' | 'center' | 'footer';

type GuildOSLogoProps = {
  variant?: GuildOSLogoVariant;
  href?: string;
  label?: ReactNode;
  tagline?: ReactNode;
  showTagline?: boolean;
  className?: string;
};

const VARIANT_CLASS_NAMES: Record<GuildOSLogoVariant, string> = {
  nav: 'brand',
  auth: 'auth-brand',
  center: 'auth-center-brand',
  footer: 'brand footer-brand',
};

const VARIANT_MARK_CLASS_NAMES: Record<GuildOSLogoVariant, string> = {
  nav: 'brand-mark',
  auth: 'brand-mark',
  center: 'brand-mark',
  footer: 'brand-mark',
};

export function GuildOSLogo({
  variant = 'nav',
  href,
  label = 'GuildOS',
  tagline = 'Student reputation infrastructure',
  showTagline = true,
  className,
}: GuildOSLogoProps) {
  const rootClassName = className ? `${VARIANT_CLASS_NAMES[variant]} ${className}` : VARIANT_CLASS_NAMES[variant];
  const markClassName = VARIANT_MARK_CLASS_NAMES[variant];
  const content = (
    <>
      <span className={markClassName} aria-hidden="true">
        G
      </span>
      <span className="guildos-logo-copy">
        <strong>{label}</strong>
        {showTagline ? <span>{tagline}</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={rootClassName}>
        {content}
      </Link>
    );
  }

  return <div className={rootClassName}>{content}</div>;
}
