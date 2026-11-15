import nodemailer from 'nodemailer';
import { config } from '../config';

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl?: string;
};

const transporter = config.smtpHost
  ? nodemailer.createTransport({
      host: config.smtpHost,
      connectionTimeout: 30_000, greetingTimeout: 30_000, socketTimeout: 60_000,
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
  name: config.brandName,
  tagline: 'Find your people. Make your next move.',
  primary: config.brandColor,
  secondary: '#7c3aed',
  navy: '#173D38',
  ink: '#172923',
  sub: '#5B6B63',
  muted: '#6C7971',
  pageBg: '#F6F7F3',
  surface: '#ffffff',
  // Neutral tints, so they suit whatever BRAND_COLOR is.
  soft: '#EFF6F2',
  border: '#E0E7E1',
  success: '#059669',
  warning: '#d97706',
  info: '#2563eb',
};

const CATEGORY: Record<EmailCategory, { accent: string; chip: string; chipBg: string; chipInk: string }> = {
  INFO: { accent: BRAND.primary, chip: `${config.brandName} update`, chipBg: BRAND.soft, chipInk: BRAND.navy },
  CONGRATS: { accent: BRAND.success, chip: 'Achievement unlocked', chipBg: '#ecfdf5', chipInk: '#047857' },
  WARNING: { accent: BRAND.warning, chip: 'Action needed', chipBg: '#fffbeb', chipInk: '#b45309' },
  CONFIRMATION: { accent: BRAND.primary, chip: 'Confirmation', chipBg: BRAND.soft, chipInk: BRAND.primary },
};

/** "Amaka Okonkwo" -> "Amaka": emails greet people the way a person would. */
function firstName(name?: string): string {
  return String(name ?? '').trim().split(/\s+/)[0] ?? '';
}

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

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td style="border-radius:10px;background:${BRAND.navy};">
    <a href="${esc(url)}" style="display:inline-block;color:#ffffff;padding:15px 22px;text-decoration:none;border:1px solid ${BRAND.navy};border-radius:10px;font-weight:700;font-size:15px;line-height:20px;">${esc(label)}</a>
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
  unsubscribeUrl?: string;
};

/** The shared, branded email shell (table-based + inline styles for mail clients). */
function shell(opts: ShellOptions): string {
  const preheader = opts.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(opts.preheader)}</span>`
    : '';
  const chip = opts.chip
    ? `<span style="display:inline-block;background:${opts.chip.bg};color:${opts.chip.ink};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${esc(opts.chip.label)}</span>`
    : '';
  const cta = opts.ctaLabel && opts.ctaUrl ? `<div style="margin:22px 0 4px;">${button(opts.ctaLabel, opts.ctaUrl)}</div>` : '';
  const note = noteBox(opts.note);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>@media(max-width:480px){.email-pad{padding-left:20px!important;padding-right:20px!important}h1{font-size:26px!important}}a{overflow-wrap:anywhere}</style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.pageBg};">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;table-layout:fixed;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr><td class="email-pad" style="background:${BRAND.surface};padding:28px 32px 22px;border-bottom:1px solid ${BRAND.border};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="${esc(config.frontendUrl)}" style="color:${BRAND.navy};font-size:27px;font-weight:800;letter-spacing:-1px;text-decoration:none;">${esc(BRAND.name.toLowerCase())}<span style="color:#B07800;">.</span></a>
                  <p style="margin:6px 0 0;font-size:12px;color:${BRAND.sub};">Events. Communities. Your people.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td class="email-pad" style="padding:30px 32px 10px;overflow-wrap:anywhere;">
            ${chip ? `<div style="margin:0 0 16px;">${chip}</div>` : ''}
            <h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;letter-spacing:-.025em;color:${BRAND.ink};">${esc(opts.heading)}</h1>
            <div style="font-size:15px;line-height:1.7;color:#334155;">${opts.bodyHtml}</div>
            ${cta}
            ${note}
          </td></tr>
          <tr><td class="email-pad" style="padding:24px 32px 30px;">
            <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
            <p style="margin:0;font-size:12px;line-height:1.55;color:${BRAND.sub};"><strong style="color:${BRAND.navy};">${esc(BRAND.name)}</strong> · ${esc(BRAND.tagline)}.</p>
            <p style="margin:7px 0 0;font-size:12px;line-height:1.55;color:${BRAND.muted};">${opts.unsubscribeUrl ? 'You asked for occasional event and community recommendations. At most one email every seven days, only when there is something relevant.' : `You’re getting this because you have a ${esc(BRAND.name)} account or joined a community or event on ${esc(BRAND.name)}.`}</p>
            ${opts.unsubscribeUrl ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.7;"><a href="${esc(opts.unsubscribeUrl)}" style="color:${BRAND.navy};">Unsubscribe from recommendations</a> &nbsp;·&nbsp; <a href="${esc(config.frontendUrl.replace(/\/+$/, '') + '/notifications/settings')}" style="color:${BRAND.navy};">Email preferences</a></p>` : ''}
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
  input: { name?: string; subject: string; heading?: string; imageUrl?: string; message: string; ctaLabel?: string; ctaUrl?: string; note?: string },
): EmailTemplate {
  const meta = CATEGORY[category];
  const heading = input.heading ?? input.subject;
  const greeting = input.name ? `<p style="margin:0 0 14px;">Hi ${esc(firstName(input.name))},</p>` : '';
  const image = input.imageUrl && /^https?:\/\//i.test(input.imageUrl) ? `<img src="${esc(input.imageUrl)}" alt="Event image" style="display:block;width:100%;max-width:560px;height:auto;margin:16px 0;border-radius:8px;" />` : '';
  const bodyHtml = `${greeting}${image}${paragraphs(input.message)}`;
  const textParts = [
    input.name ? `Hi ${firstName(input.name)},` : '',
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

export type EmailRecommendation = { title: string; url: string; detail: string; reason: string };

/** Curated cards have a plain-text equivalent; no remote images are needed to read the email. */
export function recommendationEmail(input: { name: string; events: EmailRecommendation[]; communities: EmailRecommendation[]; unsubscribeUrl: string }): EmailTemplate {
  const section = (title: string, items: EmailRecommendation[], label: string) => items.length ? `<h2 style="margin:26px 0 12px;font-size:18px;color:${BRAND.ink};">${esc(title)}</h2>` + items.map(item => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid ${BRAND.border};border-radius:12px;table-layout:fixed;"><tr><td style="padding:18px;overflow-wrap:anywhere;">
    <p style="margin:0 0 7px;font-size:11px;letter-spacing:1px;font-weight:700;color:${BRAND.primary};text-transform:uppercase;">${esc(item.reason)}</p>
    <h3 style="margin:0 0 7px;font-size:18px;line-height:1.35;color:${BRAND.ink};">${esc(item.title)}</h3>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:${BRAND.sub};">${esc(item.detail)}</p>
    <a href="${esc(item.url)}" style="display:inline-block;padding:7px 0;color:${BRAND.navy};font-weight:700;text-decoration:underline;">${label} →</a>
    </td></tr></table>`).join('') : '';
  const sections = section('Events worth a look', input.events.slice(0, 3), 'View event') + section('Find your people', input.communities.slice(0, 2), 'Explore community');
  const textSection = (title: string, items: EmailRecommendation[]) => items.length ? title + '\n' + items.map(i=>`${i.title}\n${i.detail}\n${i.reason}\n${i.url}`).join('\n\n') : '';
  return {
    subject: `You might be interested · ${BRAND.name}`,
    unsubscribeUrl: input.unsubscribeUrl,
    text: [`Hi ${firstName(input.name)},`, 'A few new events and communities that fit your interests, skills or school.', textSection('Events worth a look', input.events.slice(0,3)), textSection('Find your people', input.communities.slice(0,2)), 'At most one recommendation email every seven days. Nothing relevant? We stay quiet.', `Unsubscribe: ${input.unsubscribeUrl}`, textFooter()].filter(Boolean).join('\n\n'),
    html: shell({ accent: BRAND.primary, chip: {label:'Picked for you', bg:BRAND.soft, ink:BRAND.navy}, preheader:'A few relevant events and communities. A little discovery, at your pace.', heading:'You might be interested', bodyHtml:`<p style="margin:0 0 14px;">Hi ${esc(firstName(input.name))},</p><p style="margin:0 0 14px;">Your next good connection could start here. These picks match your interests, skills or school.</p>${sections}`, unsubscribeUrl:input.unsubscribeUrl }),
  };
}

/** Congratulations email sent the moment a verified certificate is issued. */
export function certificateEarnedEmail(name: string, eventTitle: string, communityName: string, verifyUrl: string): EmailTemplate {
  return categoryEmail('CONGRATS', {
    name,
    subject: `You earned a certificate for ${eventTitle}`,
    heading: 'Your certificate is ready',
    message: `Congratulations! ${communityName} has issued you a verified certificate for "${eventTitle}".\n\nIt’s already on your ${config.brandName} profile and CV. Anyone you share it with can check it’s genuine by scanning its QR code.`,
    ctaLabel: 'View and share your certificate',
    ctaUrl: verifyUrl,
  });
}

export function communityAccessCodeEmail(name: string, code: string): EmailTemplate {
  const subject = `Your ${config.brandName} school-email verification code`;
  const text = `Hi ${firstName(name)},\n\nYour school email verification code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.\n\n${textFooter()}`;
  const html = shell({
    accent: CATEGORY.CONFIRMATION.accent,
    chip: { label: 'Community Mode', bg: CATEGORY.CONFIRMATION.chipBg, ink: CATEGORY.CONFIRMATION.chipInk },
    preheader: `Your code is ${code}`,
    heading: 'Verify your school email',
    bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(firstName(name))},</p>
      <p style="margin:0 0 14px;">Enter this code to verify your school email and unlock Community Mode:</p>
      <div style="display:inline-block;margin:4px 0 2px;padding:16px 18px;background:${BRAND.soft};border:1px solid ${BRAND.border};border-radius:16px;">
        <p style="font-size:30px;line-height:1;font-weight:850;letter-spacing:8px;color:${BRAND.primary};margin:0;">${esc(code)}</p>
      </div>`,
    note: 'This code expires in 15 minutes. If you didn’t request it, you can ignore this email.',
  });
  return { subject, text, html };
}

export function verificationEmailTemplate(name: string, verificationUrl: string): EmailTemplate {
  const subject = `Verify your ${config.brandName} email`;
  const text = `Hi ${firstName(name)},\n\nWelcome to ${config.brandName}! Verify your email by visiting:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.\n\n${textFooter()}`;
  const html = shell({
    accent: CATEGORY.CONFIRMATION.accent,
    chip: { label: 'Welcome', bg: CATEGORY.CONFIRMATION.chipBg, ink: CATEGORY.CONFIRMATION.chipInk },
    preheader: 'One tap and you’re in',
    heading: 'Confirm your email to get started',
    bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(firstName(name))},</p>
      <p style="margin:0 0 14px;">Welcome to ${esc(BRAND.name)}. Confirm your email to discover events and communities that fit your interests, skills and school.</p>
      <p style="margin:0 0 14px;">Find something you care about, meet your people and keep your attendance record in one place. When an organizer offers a certificate, you’ll find it on your profile once it’s issued.</p>`,
    ctaLabel: 'Confirm my email',
    ctaUrl: verificationUrl,
    note: 'Button not working? Copy this link into your browser: ' + verificationUrl + '. If you didn’t sign up, you can ignore this email.',
  });
  return { subject, text, html };
}

export function passwordResetEmailTemplate(name: string, resetUrl: string): EmailTemplate {
  const subject = `Reset your ${config.brandName} password`;
  const text = `Hi ${firstName(name)},\n\nReset your password using this link:\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\n${textFooter()}`;
  const html = shell({
    accent: CATEGORY.WARNING.accent,
    chip: { label: 'Security', bg: CATEGORY.WARNING.chipBg, ink: CATEGORY.WARNING.chipInk },
    preheader: `Reset your ${config.brandName} password`,
    heading: 'Reset your password',
    bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(firstName(name))},</p>
      <p style="margin:0 0 6px;">Someone (hopefully you) asked to reset your ${esc(BRAND.name)} password. Tap below to choose a new one.</p>`,
    ctaLabel: 'Choose a new password',
    ctaUrl: resetUrl,
    note: 'Didn’t ask for this? Ignore this email and your password stays the same. The link expires soon.',
  });
  return { subject, text, html };
}

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendEmail(to: string, template: EmailTemplate, attachments?: EmailAttachment[], delivery?: { messageId?: string; requireConfigured?: boolean }) {
  if (!transporter) {
    if (delivery?.requireConfigured) throw new Error('Email delivery is not configured');
    console.warn(`Email disabled: missing SMTP host. Skipping send to ${to}.`);
    return;
  }

  const result = await transporter.sendMail({
    from: config.emailFrom,
    to,
    subject: template.subject,
    ...(delivery?.messageId ? { messageId: delivery.messageId } : {}),
    text: template.text,
    html: template.html,
    ...(template.unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${template.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
    ...(attachments?.length ? { attachments } : {}),
  });
  if (delivery?.requireConfigured && (!result.accepted?.length || result.rejected?.length)) throw new Error('Email was not accepted by the provider');
}

/** Verify the SMTP connection/credentials without sending an email. */
export async function verifyEmailTransport(): Promise<boolean> {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}
