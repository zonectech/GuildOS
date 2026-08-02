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
  primary: '#4f46e5',
  secondary: '#7c3aed',
  navy: '#0f172a',
  ink: '#111827',
  sub: '#64748b',
  muted: '#94a3b8',
  pageBg: '#f8fafc',
  surface: '#ffffff',
  soft: '#eef2ff',
  border: '#e2e8f0',
  success: '#059669',
  warning: '#d97706',
  info: '#2563eb',
};

const CATEGORY: Record<EmailCategory, { accent: string; chip: string; chipBg: string; chipInk: string }> = {
  INFO: { accent: BRAND.info, chip: 'GuildOS update', chipBg: '#eff6ff', chipInk: '#1d4ed8' },
  CONGRATS: { accent: BRAND.success, chip: 'Achievement unlocked', chipBg: '#ecfdf5', chipInk: '#047857' },
  WARNING: { accent: BRAND.warning, chip: 'Action needed', chipBg: '#fffbeb', chipInk: '#b45309' },
  CONFIRMATION: { accent: BRAND.primary, chip: 'Confirmation', chipBg: BRAND.soft, chipInk: '#4338ca' },
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
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td style="border-radius:14px;background:${accent};box-shadow:0 12px 26px rgba(79,70,229,.22);">
    <a href="${esc(url)}" style="display:inline-block;color:#ffffff;padding:13px 22px;text-decoration:none;border-radius:14px;font-weight:700;font-size:14px;letter-spacing:.1px;">${esc(label)}</a>
  </td></tr></table>`;
}

function noteBox(note?: string): string {
  if (!note) return '';
  return `<div style="margin:18px 0 0;padding:14px 16px;background:#f8fafc;border:1px solid ${BRAND.border};border-radius:14px;">
    <p style="margin:0;font-size:13px;line-height:1.55;color:${BRAND.sub};">${esc(note)}</p>
  </div>`;
}

function textFooter(): string {
  return `--\n${BRAND.name}\n${BRAND.tagline}`;
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
    ? `<span style="display:inline-block;background:${opts.chip.bg};color:${opts.chip.ink};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${esc(opts.chip.label)}</span>`
    : '';
  const cta = opts.ctaLabel && opts.ctaUrl ? `<div style="margin:22px 0 4px;">${button(opts.ctaLabel, opts.ctaUrl, accent)}</div>` : '';
  const note = noteBox(opts.note);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
  </head>
  <body style="margin:0;padding:0;background:${BRAND.pageBg};">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:24px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-shadow:0 20px 60px rgba(15,23,42,.08);">
          <tr><td style="background:${BRAND.navy};padding:24px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:14px;background:${BRAND.primary};color:#ffffff;font-size:18px;font-weight:900;vertical-align:middle;">G</span>
                  <span style="display:inline-block;margin-left:10px;color:#ffffff;font-size:20px;font-weight:850;letter-spacing:-.02em;vertical-align:middle;">GuildOS</span>
                </td>
                <td align="right" style="color:#c7d2fe;font-size:12px;font-weight:700;">Student success platform</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:30px 32px 10px;">
            ${chip ? `<div style="margin:0 0 16px;">${chip}</div>` : ''}
            <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;letter-spacing:-.025em;color:${BRAND.ink};">${esc(opts.heading)}</h1>
            <div style="font-size:15px;line-height:1.7;color:#334155;">${opts.bodyHtml}</div>
            ${cta}
            ${note}
          </td></tr>
          <tr><td style="padding:24px 32px 30px;">
            <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
            <p style="margin:0;font-size:12px;line-height:1.55;color:${BRAND.sub};"><strong style="color:${BRAND.navy};">${esc(BRAND.name)}</strong> - ${esc(BRAND.tagline)}.</p>
            <p style="margin:7px 0 0;font-size:12px;line-height:1.55;color:${BRAND.muted};">You received this email because you have a ${esc(BRAND.name)} account or interacted with a ${esc(BRAND.name)} community/event.</p>
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
    textFooter(),
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
    subject: `You earned a certificate for ${eventTitle}`,
    heading: 'Your certificate is ready',
    message: `Congratulations! ${communityName} has issued you a verified certificate for "${eventTitle}". It's now part of your GuildOS portfolio and can be shared with anyone - scan or open the link to verify its authenticity.`,
    ctaLabel: 'View your certificate',
    ctaUrl: verifyUrl,
  });
}

export function communityAccessCodeEmail(name: string, code: string): EmailTemplate {
  const subject = 'Your GuildOS school-email verification code';
  const text = `Hi ${name},\n\nYour school email verification code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.\n\n${textFooter()}`;
  const html = shell({
    accent: CATEGORY.CONFIRMATION.accent,
    chip: { label: CATEGORY.CONFIRMATION.chip, bg: CATEGORY.CONFIRMATION.chipBg, ink: CATEGORY.CONFIRMATION.chipInk },
    preheader: 'Your school email verification code',
    heading: 'Verify your school email',
    bodyHtml: `<p style="margin:0 0 14px;">Hi <strong>${esc(name)}</strong>,</p>
      <p style="margin:0 0 14px;">Use this code to verify your school email for Community Mode:</p>
      <div style="display:inline-block;margin:4px 0 2px;padding:16px 18px;background:${BRAND.soft};border:1px solid #c7d2fe;border-radius:16px;">
        <p style="font-size:30px;line-height:1;font-weight:850;letter-spacing:8px;color:${BRAND.primary};margin:0;">${esc(code)}</p>
      </div>`,
    note: 'This code expires in 15 minutes. If you didn’t request it, you can ignore this email.',
  });
  return { subject, text, html };
}

export function verificationEmailTemplate(name: string, verificationUrl: string): EmailTemplate {
  const subject = 'Verify your GuildOS email';
  const text = `Hi ${name},\n\nPlease verify your email by visiting:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.\n\n${textFooter()}`;
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
  const text = `Hi ${name},\n\nReset your password using this link:\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\n${textFooter()}`;
  const html = shell({
    accent: CATEGORY.WARNING.accent,
    chip: { label: 'Security', bg: CATEGORY.WARNING.chipBg, ink: CATEGORY.WARNING.chipInk },
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

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendEmail(to: string, template: EmailTemplate, attachments?: EmailAttachment[]) {
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
    ...(attachments?.length ? { attachments } : {}),
  });
}

/** Verify the SMTP connection/credentials without sending an email. */
export async function verifyEmailTransport(): Promise<boolean> {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}