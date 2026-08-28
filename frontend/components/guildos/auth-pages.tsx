'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { GuildOSLogo } from './guildos-logo';

type AuthSplitLayoutProps = {
  heroKicker: string;
  heroTitle: string;
  heroText: string;
  heroBody: ReactNode;
  cardTitle: string;
  cardSubtitle?: string;
  children: ReactNode;
};

function AuthBackdrop() {
  return (
    <>
      <div className="auth-bg-orb auth-bg-orb-one" aria-hidden="true" />
      <div className="auth-bg-orb auth-bg-orb-two" aria-hidden="true" />
      <div className="auth-bg-grid" aria-hidden="true" />
    </>
  );
}

export function AuthSplitLayout({ heroKicker, heroTitle, heroText, heroBody, cardTitle, cardSubtitle, children }: AuthSplitLayoutProps) {
  return (
    <main className="auth-page auth-page-split">
      <AuthBackdrop />
      <section className="auth-shell">
        <div className="auth-hero auth-hero-mobile-hide">
          <div className="auth-brand-row">
            <GuildOSLogo variant="nav" href="/" />
          </div>
          <p className="auth-kicker">{heroKicker}</p>
          <h1>{heroTitle}</h1>
          <p className="auth-hero-text">{heroText}</p>
          <div className="auth-hero-body">{heroBody}</div>
        </div>

        <div className="auth-panel auth-panel-mobile-full">
          <div className="auth-card auth-card-surface auth-card-mobile-full">
            <div className="auth-card-header">
              <div>
                <p className="auth-card-eyebrow">GuildOS Access</p>
                <h2>{cardTitle}</h2>
                {cardSubtitle ? <p>{cardSubtitle}</p> : null}
              </div>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthField({
  label,
  placeholder,
  type = 'text',
  autoComplete,
  value,
  onChange,
  required,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-field-control">
        <input
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder ?? label}
          autoComplete={autoComplete}
          value={value}
          required={required}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          className={isPassword ? 'auth-field-with-toggle' : undefined}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        ) : null}
      </div>
    </label>
  );
}

export function AuthSuccessCard({ title, subtitle, message, actions }: { title: string; subtitle: string; message: string; actions: ReactNode }) {
  return (
    <main className="auth-page auth-page-center">
      <AuthBackdrop />
      <section className="auth-center-shell auth-center-shell-mobile-full">
        <div className="auth-center-brand auth-mobile-brand">
          <GuildOSLogo variant="nav" />
        </div>
        <div className="auth-card auth-card-center auth-card-surface auth-card-mobile-full">
          <div className="auth-success-icon" aria-hidden="true">
            <svg viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" />
              <path d="M23 36.5 31.5 45 50 27" />
            </svg>
          </div>
          <div className="auth-card-header auth-card-header-center">
            <div>
              <p className="auth-card-eyebrow">{title}</p>
              <h1>{subtitle}</h1>
            </div>
          </div>
          <p className="auth-description">{message}</p>
          <div className="auth-center-actions">{actions}</div>
        </div>
      </section>
    </main>
  );
}
