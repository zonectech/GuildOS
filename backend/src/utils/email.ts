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

function wrapTemplate(title: string, body: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="color: #0f172a;">${title}</h2>
      ${body}
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">GuildOS Security Platform</p>
    </div>
  `;
}

export function verificationEmailTemplate(name: string, verificationUrl: string): EmailTemplate {
  const subject = 'Verify your GuildOS email';
  const text = `Hi ${name},\n\nPlease verify your email by visiting:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`;
  const html = wrapTemplate(
    'Verify your email',
    `<p>Hi <strong>${name}</strong>,</p>
     <p>Please verify your email by clicking the button below:</p>
     <p><a href="${verificationUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px;">Verify Email</a></p>
     <p>If the button does not work, copy and paste this link into your browser:</p>
     <p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
  );

  return { subject, text, html };
}

export function passwordResetEmailTemplate(name: string, resetUrl: string): EmailTemplate {
  const subject = 'Reset your GuildOS password';
  const text = `Hi ${name},\n\nReset your password using this link:\n${resetUrl}\n\nIf you did not request this, ignore this email.`;
  const html = wrapTemplate(
    'Reset your password',
    `<p>Hi <strong>${name}</strong>,</p>
     <p>Use the button below to reset your password:</p>
     <p><a href="${resetUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px;">Reset Password</a></p>
     <p>If the button does not work, copy and paste this link into your browser:</p>
     <p><a href="${resetUrl}">${resetUrl}</a></p>`,
  );

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