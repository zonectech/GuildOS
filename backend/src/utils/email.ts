import nodemailer from 'nodemailer';
import { config } from '../config';

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

const transporter = config.smtpHost
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: config.smtpUser && config.smtpPass ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    })
  : null;

if (transporter) {
  console.log(
    `[GuildOS Email] Nodemailer transport ready (${config.smtpHost}:${config.smtpPort}${config.smtpUser ? ', auth enabled' : ', no auth'})`,
  );
} else {
  console.warn('[GuildOS Email] SMTP not configured; email sending is disabled');
}

export type EmailCategory = 'INFO' | 'CONGRATS' | 'WARNING' | 'CONFIRMATION';

const BRAND = {
  name: 'GuildOS',
  tagline: 'Turn campus activity into a verified professional portfolio',
  navy: '#0f172a',
  ink: '#111827',
  sub: '#6b7280',
  gold: '#b8933a',
  pageBg: '#f4f5f7',
  border: '#e6e8ec',
};

const CATEGORY: Record<EmailCategory, { accent: string; chip: string; chipBg: string; chipInk: string }> = {
  INFO: { accent: '#1d2d4f', chip: 'Announcement', chipBg: '#eef2ff', chipInk: '#3730a3' },
  CONGRATS: { accent: '#059669', chip: '🎉 Congratulations', chipBg: '#ecfdf5', chipInk: '#065f46' },
  WARNING: { accent: '#d97706', chip: '⚠️ Important notice', chipBg: '#fffbeb', chipInk: '#92400e' },
  CONFIRMATION: { accent: '#0369a1', chip: '✓ Confirmed', chipBg: '#eff6ff', chipInk: '#075985' },
};

function esc(value: string): string {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Turn plain multi-line text into safe HTML paragraphs (escaped, blank line = new paragraph). */
function paragraphs(text: string): string {
  const safe = esc(text).trim();
  if (!safe) return '';
  return safe
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px;">${block.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function button(label: string, url: string, accent: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:${accent};color:#ffffff;padding:13px 24px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">${esc(label)}</a>`;
}

type ShellOptions = {
  accent: string;
  chip?: { label: string; bg: string; ink: string };
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
};

/** The shared, branded GuildOS email shell (table-based + inline styles for mail clients). */
function shell(opts: ShellOptions): string {
  const { accent } = opts;
  const preheader = opts.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(opts.preheader)}</span>`
    : '';
  const chip = opts.chip
    ? `<span style="display:inline-block;background:${opts.chip.bg};color:${opts.chip.ink};font-size:12px;font-weight:700;letter-spacing:.4px;padding:5px 12px;border-radius:999px;">${esc(opts.chip.label)}</span>`
    : '';
  const cta = opts.ctaLabel && opts.ctaUrl ? `<div style="margin:8px 0 6px;">${button(opts.ctaLabel, opts.ctaUrl, accent)}</div>` : '';
  const note = opts.note ? `<p style="margin:16px 0 0;font-size:13px;color:${BRAND.sub};">${esc(opts.note)}</p>` : '';
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.pageBg};">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
          <tr><td style="height:5px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:22px 32px 0;">
            <span style="font-size:20px;font-weight:800;letter-spacing:.5px;color:${BRAND.navy};">Guild<span style="color:${BRAND.gold};">OS</span></span>
          </td></tr>
          <tr><td style="padding:18px 32px 8px;">
            ${chip ? `<div style="margin:0 0 14px;">${chip}</div>` : ''}
            <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${BRAND.ink};">${esc(opts.heading)}</h1>
            <div style="font-size:15px;line-height:1.65;color:#374151;">${opts.bodyHtml}</div>
            ${cta}
            ${note}
          </td></tr>
          <tr><td style="padding:22px 32px 26px;">
            <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
            <p style="margin:0;font-size:12px;color:${BRAND.sub};">${esc(BRAND.name)} — ${esc(BRAND.tagline)}.</p>
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">You received this email because you have a ${esc(BRAND.name)} account.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Build a branded email for a given category with an optional call-to-action. */
export function categoryEmail(
  category: EmailCategory,
  input: { name?: string; subject: string; heading?: string; message: string; ctaLabel?: string; ctaUrl?: string; note?: string },
): EmailTemplate {
  const meta = CATEGORY[category];
  const heading = input.heading ?? input.subject;
  const greeting = input.name ? `<p style="margin:0 0 14px;">Hi <strong>${esc(input.name)}</strong>,</p>` : '';
  const bodyHtml = `${greeting}${paragraphs(input.message)}`;
  const textParts = [
    input.name ? `Hi ${input.name},` : '',
    input.message,
    input.ctaLabel && input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : '',
    input.note ?? '',
    `— ${BRAND.name}`,
  ].filter(Boolean);
  return {
    subject: input.subject,
    text: textParts.join('\n\n'),
    html: shell({
      accent: meta.accent,
      chip: { label: meta.chip, bg: meta.chipBg, ink: meta.chipInk },
      preheader: input.message.slice(0, 120),
      heading,
      bodyHtml,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      note: input.note,
    }),
  };
}

export const congratulationsEmail = (name: string, subject: string, message: string, ctaLabel?: string, ctaUrl?: string) =>
  categoryEmail('CONGRATS', { name, subject, message, ctaLabel, ctaUrl });
export const warningEmail = (name: string, subject: string, message: string, ctaLabel?: string, ctaUrl?: string) =>
  categoryEmail('WARNING', { name, subject, message, ctaLabel, ctaUrl });
export const confirmationEmail = (name: string, subject: string, message: string, ctaLabel?: string, ctaUrl?: string) =>
  categoryEmail('CONFIRMATION', { name, subject, message, ctaLabel, ctaUrl });

/** Congratulations email sent the moment a verified certificate is issued. */
export function certificateEarnedEmail(name: string, eventTitle: string, communityName: string, verifyUrl: string): EmailTemplate {
  return categoryEmail('CONGRATS', {
    name,
    subject: `🎉 You earned a certificate for ${eventTitle}`,
    heading: 'Your certificate is ready',
    message: `Congratulations! ${communityName} has issued you a verified certificate for "${eventTitle}". It's now part of your GuildOS portfolio and can be shared with anyone — scan or open the link to verify its authenticity.`,
    ctaLabel: 'View your certificate',
    ctaUrl: verifyUrl,
  });
}

export function communityAccessCodeEmail(name: string, code: string): EmailTemplate {
  const subject = 'Your GuildOS school-email verification code';
  const text = `Hi ${name},\n\nYour school email verification code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.`;
  const html = shell({
    accent: CATEGORY.CONFIRMATION.accent,
    chip: { label: CATEGORY.CONFIRMATION.chip, bg: CATEGORY.CONFIRMATION.chipBg, ink: CATEGORY.CONFIRMATION.chipInk },
    preheader: 'Your school email verification code',
    heading: 'Verify your school email',
    bodyHtml: `<p style="margin:0 0 14px;">Hi <strong>${esc(name)}</strong>,</p>
      <p style="margin:0 0 14px;">Use this code to verify your school email for Community Mode:</p>
      <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:${BRAND.navy};margin:0;">${esc(code)}</p>`,
    note: 'This code expires in 15 minutes. If you didn’t request it, you can ignore this email.',
  });
  return { subject, text, html };
}

export function verificationEmailTemplate(name: string, verificationUrl: string): EmailTemplate {
  const subject = 'Verify your GuildOS email';
  const text = `Hi ${name},\n\nPlease verify your email by visiting:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`;
  const html = shell({
    accent: CATEGORY.CONFIRMATION.accent,
    chip: { label: CATEGORY.CONFIRMATION.chip, bg: CATEGORY.CONFIRMATION.chipBg, ink: CATEGORY.CONFIRMATION.chipInk },
    preheader: 'Confirm your email to activate your account',
    heading: 'Verify your email',
    bodyHtml: `<p style="margin:0 0 14px;">Hi <strong>${esc(name)}</strong>,</p>
      <p style="margin:0 0 6px;">Please confirm your email address to finish setting up your account.</p>`,
    ctaLabel: 'Verify Email',
    ctaUrl: verificationUrl,
    note: 'If the button doesn’t work, copy and paste this link into your browser: ' + verificationUrl,
  });
  return { subject, text, html };
}

export function passwordResetEmailTemplate(name: string, resetUrl: string): EmailTemplate {
  const subject = 'Reset your GuildOS password';
  const text = `Hi ${name},\n\nReset your password using this link:\n${resetUrl}\n\nIf you did not request this, ignore this email.`;
  const html = shell({
    accent: CATEGORY.WARNING.accent,
    chip: { label: '🔒 Security', bg: CATEGORY.WARNING.chipBg, ink: CATEGORY.WARNING.chipInk },
    preheader: 'Reset your GuildOS password',
    heading: 'Reset your password',
    bodyHtml: `<p style="margin:0 0 14px;">Hi <strong>${esc(name)}</strong>,</p>
      <p style="margin:0 0 6px;">We received a request to reset your password. Click below to choose a new one.</p>`,
    ctaLabel: 'Reset Password',
    ctaUrl: resetUrl,
    note: 'If you didn’t request this, you can safely ignore this email. The link expires soon.',
  });
  return { subject, text, html };
}

export async function sendEmail(to: string, template: EmailTemplate) {
  if (!transporter) {
    console.warn(`Email disabled: missing SMTP host. Skipping send to ${to}.`);
    return;
  }

  await transporter.sendMail({
    from: config.emailFrom,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

/** Verify the SMTP connection/credentials without sending an email. */
export async function verifyEmailTransport(): Promise<boolean> {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}