'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { drawStandardCertificate, CERT_BACKGROUNDS, CERT_FONTS } from '../certificate-canvas';
import {
  generateCertificateWording,
  resolveEventImageUrl,
  uploadEventMedia,
  type CertificateContent,
  type CertificateLogoPlacement,
  type CertificateMode,
  type CertificateNamePlacement,
  type CertificateStyle,
  type CertificateTheme,
  type CertificateType,
  type EventInput,
} from '../event-api';
import { Section, Field, Toggle } from './event-form-ui';
import { SelectMenu } from '../ui/select-menu';

type Props = {
  enabled: boolean;
  mode: CertificateMode;
  certificateType: CertificateType;
  template: string;
  placement: CertificateNamePlacement;
  theme: CertificateTheme;
  style: CertificateStyle;
  content: CertificateContent;
  isPremium: boolean;
  premiumHref?: string;
  communityId?: string;
  eventTitle?: string;
  /** External partners — their logos render (logo-only) on the certificate preview. */
  partners?: { name: string; logo: string }[];
  onUnlockEvent?: () => void;
  eventUnlockTotal?: number;
  eventUnlockBusy?: boolean;
  /** Pay the per-event unlock from the community ticket wallet (only passed when the balance covers it). */
  onPayFromWallet?: () => void;
  walletBalanceNgn?: number;
  /** Wallet price = base price, no gateway fee. */
  eventWalletPrice?: number;
  onCheckPayment?: () => void;
  minimumAttendanceDuration: number;
  checkOutRequired: boolean;
  onChange: (patch: Partial<EventInput>) => void;
  onError: (message: string) => void;
};

const STYLES: { value: CertificateStyle; label: string; desc: string }[] = [
  { value: 'CLASSIC', label: 'Classic Diploma', desc: 'Ornate gold border with corner accents' },
  { value: 'MODERN', label: 'Modern Corners', desc: 'Bold geometric corner graphics' },
  { value: 'MINIMAL', label: 'Elegant Minimal', desc: 'Clean thin border, airy layout' },
  { value: 'CORPORATE', label: 'Corporate', desc: 'Letterhead bands, top and bottom' },
  { value: 'DECO', label: 'Art Deco', desc: 'Double frame with corner brackets' },
  { value: 'GEOMETRIC', label: 'Geometric', desc: 'Diamond studs around the border' },
  { value: 'RIBBON', label: 'Ribbon', desc: 'Banner flag at the top' },
  { value: 'DOUBLE', label: 'Double Frame', desc: 'Bold double border with corner squares' },
  { value: 'ROUNDED', label: 'Rounded', desc: 'Soft rounded double frame' },
  { value: 'LAUREL', label: 'Laurel', desc: 'Laurel wreath around the emblem' },
  { value: 'TECH', label: 'Tech', desc: 'Circuit-style corner traces' },
  { value: 'WAVE', label: 'Wave', desc: 'Flowing wave bands' },
];

const CERTIFICATE_TYPES: { value: CertificateType; label: string; desc: string }[] = [
  { value: 'ATTENDANCE', label: 'Attendance', desc: 'Awarded for participation' },
  { value: 'COMPLETION', label: 'Completion', desc: 'Awarded when activities are completed' },
  { value: 'LEADERSHIP', label: 'Leadership', desc: 'Awarded to organizers and staff' },
  { value: 'VOLUNTEER', label: 'Volunteer', desc: 'Awarded to event volunteers' },
];

const ACCENT_PRESETS = ['#b8933a', '#c99700', '#4f46e5', '#7c3aed', '#9333ea', '#0f766e', '#059669', '#16a34a', '#b91c1c', '#e11d48', '#be185d', '#0369a1', '#0891b2', '#ea580c', '#d97706', '#475569', '#1e293b', '#111827'];

const BACKGROUNDS = CERT_BACKGROUNDS;

const FONTS = CERT_FONTS;

const LOGO_PLACEMENTS: { value: CertificateLogoPlacement; label: string; desc: string }[] = [
  { value: 'EMBLEM', label: 'Top seal', desc: 'Inside the medallion' },
  { value: 'TOP_LEFT', label: 'Top left', desc: 'Corner header' },
  { value: 'TOP_RIGHT', label: 'Top right', desc: 'Corner header' },
  { value: 'WATERMARK', label: 'Watermark', desc: 'Faint, centered' },
];

/**
 * Template catalog — curated one-click looks combining design, colours and font.
 * Free presets only pick a design (theme stays default); premium presets apply
 * the full colour/font combination and are locked behind the premium gate.
 */
const TEMPLATE_CATALOG: {
  name: string;
  desc: string;
  premium: boolean;
  style: CertificateStyle;
  theme?: Partial<CertificateTheme>;
  swatch: string;
}[] = [
  { name: 'Gold Classic', desc: 'Timeless diploma look', premium: false, style: 'CLASSIC', swatch: 'linear-gradient(135deg,#fdfbf4,#e7cf8f)' },
  { name: 'Campus Modern', desc: 'Bold geometric corners', premium: false, style: 'MODERN', swatch: 'linear-gradient(135deg,#eef2ff,#c7d2fe)' },
  { name: 'Clean Minimal', desc: 'Airy and understated', premium: false, style: 'MINIMAL', swatch: 'linear-gradient(135deg,#ffffff,#e2e8f0)' },
  { name: 'Royal Navy', desc: 'Navy + gold, Playfair', premium: true, style: 'DECO', theme: { accent: '#c99700', background: 'NAVY', font: 'PLAYFAIR' } as Partial<CertificateTheme>, swatch: 'linear-gradient(135deg,#1d2d4f,#c99700)' },
  { name: 'Emerald Academy', desc: 'Forest + emerald, Cormorant', premium: true, style: 'LAUREL', theme: { accent: '#059669', background: 'FOREST', font: 'CORMORANT' } as Partial<CertificateTheme>, swatch: 'linear-gradient(135deg,#1f3a2e,#059669)' },
  { name: 'Charcoal Tech', desc: 'Dark + cyan circuit traces', premium: true, style: 'TECH', theme: { accent: '#0891b2', background: 'CHARCOAL', font: 'MONTSERRAT' } as Partial<CertificateTheme>, swatch: 'linear-gradient(135deg,#2b2f36,#0891b2)' },
  { name: 'Burgundy Honours', desc: 'Deep red + gold, formal', premium: true, style: 'DOUBLE', theme: { accent: '#b8933a', background: 'BURGUNDY', font: 'ELEGANT' } as Partial<CertificateTheme>, swatch: 'linear-gradient(135deg,#4a1f2b,#b8933a)' },
  { name: 'Ivory Executive', desc: 'Letterhead bands, Merriweather', premium: true, style: 'CORPORATE', theme: { accent: '#475569', background: 'IVORY', font: 'MERRIWEATHER' } as Partial<CertificateTheme>, swatch: 'linear-gradient(135deg,#fdfbf4,#94a3b8)' },
  { name: 'Blush Ceremony', desc: 'Soft rose + script accents', premium: true, style: 'RIBBON', theme: { accent: '#e11d48', background: 'BLUSH', font: 'SCRIPT' } as Partial<CertificateTheme>, swatch: 'linear-gradient(135deg,#fdf3f3,#e11d48)' },
];

export function CertificateDesigner({ enabled, mode, certificateType, template, placement, theme, style, content, isPremium, premiumHref, communityId, eventTitle, partners, onUnlockEvent, eventUnlockTotal, eventUnlockBusy, onPayFromWallet, walletBalanceNgn, eventWalletPrice, onCheckPayment, minimumAttendanceDuration, checkOutRequired, onChange, onError }: Props) {
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  async function handleAiWording() {
    if (!communityId) return;
    try {
      setAiBusy(true);
      const { wording } = await generateCertificateWording(communityId, eventTitle || 'this event', certificateType);
      updateContent({ presentation: wording.presentation, message: wording.message });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to generate wording');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('certificateTemplate', file);
      const uploaded = await uploadEventMedia(fd);
      onChange({ certificateTemplate: uploaded.certificateTemplate });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload certificate template');
    } finally {
      setUploading(false);
    }
  }

  function updatePlacement(patch: Partial<CertificateNamePlacement>) {
    onChange({ certificateNamePlacement: { ...placement, ...patch } });
  }

  function updateTheme(patch: Partial<CertificateTheme>) {
    onChange({ certificateTheme: { ...theme, ...patch } });
  }

  function updateContent(patch: Partial<CertificateContent>) {
    onChange({ certificateContent: { ...content, ...patch } });
  }

  const signatories = content.signatories ?? [];
  const maxSignatures = isPremium ? 3 : 1;
  function updateSignatory(index: number, patch: Partial<{ name: string; title: string; image: string }>) {
    updateContent({ signatories: signatories.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }
  function addSignatory() {
    if (signatories.length >= maxSignatures) return;
    updateContent({ signatories: [...signatories, { name: '', title: '', image: '' }] });
  }
  function removeSignatory(index: number) {
    updateContent({ signatories: signatories.filter((_, i) => i !== index) });
  }
  async function uploadSignature(index: number, file: File | null) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('signature', file);
      const uploaded = await uploadEventMedia(fd);
      updateSignatory(index, { image: uploaded.signature });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload signature');
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('certificateLogo', file);
      const uploaded = await uploadEventMedia(fd);
      updateContent({ logo: uploaded.certificateLogo, logoPlacement: content.logoPlacement === 'NONE' ? 'EMBLEM' : content.logoPlacement });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload logo');
    } finally {
      setUploading(false);
    }
  }

  function selectStyle(value: CertificateStyle) {
    onChange({ certificateStyle: value });
  }

  function applyPreset(preset: (typeof TEMPLATE_CATALOG)[number]) {
    if (preset.premium && !isPremium) return;
    const patch: Partial<EventInput> = { certificateStyle: preset.style };
    if (preset.theme) patch.certificateTheme = { ...theme, ...preset.theme };
    onChange(patch);
  }

  return (
    <Section title="Certificate Settings">
      <Toggle label="Issue certificate" checked={enabled} onChange={(v) => onChange({ certificateEnabled: v })} />
      {enabled ? (
        <>
          <Field label="Certificate Type">
            <SelectMenu
              aria-label="Certificate type"
              value={certificateType}
              onChange={(v) => onChange({ certificateType: v as CertificateType })}
              options={CERTIFICATE_TYPES.map((t) => ({ value: t.value, label: t.label, description: t.desc }))}
            />
          </Field>

          <Field label="Template Source">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onChange({ certificateMode: 'STANDARD' })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${mode === 'STANDARD' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
              >
                <span className="block font-medium">GuildOS Standard</span>
                <span className={`block text-xs ${mode === 'STANDARD' ? 'text-slate-200' : 'text-slate-500'}`}>Auto-generated design with QR verification. No upload needed.</span>
              </button>
              <button
                type="button"
                onClick={() => onChange({ certificateMode: 'CUSTOM' })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${mode === 'CUSTOM' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
              >
                <span className="block font-medium">Upload My Template</span>
                <span className={`block text-xs ${mode === 'CUSTOM' ? 'text-slate-200' : 'text-slate-500'}`}>Use your own certificate design and position the attendee name.</span>
              </button>
            </div>
          </Field>

          {mode === 'CUSTOM' ? (
            <>
              <Field label="Certificate Template (image design)">
                <input type="file" accept="image/*" onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-slate-500">Upload your certificate background. Position where the attendee&apos;s name should appear below.</p>
                {uploading ? <p className="mt-1 text-sm text-slate-500">Uploading…</p> : null}
              </Field>

              {template ? (
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200" style={{ containerType: 'size' } as CSSProperties}>
                    <img src={resolveEventImageUrl(template)} alt="Certificate template" className="block w-full" />
                    <span
                      style={{
                        position: 'absolute',
                        left: `${placement.x}%`,
                        top: `${placement.y}%`,
                        transform: `translate(${placement.align === 'center' ? '-50%' : placement.align === 'right' ? '-100%' : '0'}, -50%)`,
                        color: placement.color,
                        fontSize: `${placement.fontSize}cqh`,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      Attendee Name
                    </span>
                  </div>
                  <div className="space-y-3">
                    <Field label={`Horizontal position (${placement.x}%)`}>
                      <input type="range" min={0} max={100} value={placement.x} onChange={(e) => updatePlacement({ x: Number(e.target.value) })} className="w-full" />
                    </Field>
                    <Field label={`Vertical position (${placement.y}%)`}>
                      <input type="range" min={0} max={100} value={placement.y} onChange={(e) => updatePlacement({ y: Number(e.target.value) })} className="w-full" />
                    </Field>
                    <Field label={`Font size (${placement.fontSize}% of height)`}>
                      <input type="range" min={2} max={20} value={placement.fontSize} onChange={(e) => updatePlacement({ fontSize: Number(e.target.value) })} className="w-full" />
                    </Field>
                    <div className="flex items-center gap-3">
                      <Field label="Color"><input type="color" value={placement.color} onChange={(e) => updatePlacement({ color: e.target.value })} /></Field>
                      <Field label="Align">
                        <select className="ev-input" value={placement.align} onChange={(e) => updatePlacement({ align: e.target.value as CertificateNamePlacement['align'] })}>
                          {['left', 'center', 'right'].map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                GuildOS generates a branded certificate for each eligible attendee — including their name, the event, community, attendance duration, a unique certificate ID, and a scannable QR verification code. Customize its look below.
              </p>

              <Field label="Template catalog — one-click looks">
                {/* Mobile: dropdown; sm+: visual cards */}
                <SelectMenu
                  className="sm:hidden"
                  aria-label="Template catalog"
                  placeholder="Choose a look…"
                  value={(() => {
                    const match = TEMPLATE_CATALOG.find((preset) =>
                      style === preset.style &&
                      (!preset.theme ||
                        ((!preset.theme.accent || theme.accent.toLowerCase() === preset.theme.accent.toLowerCase()) &&
                          (!preset.theme.background || theme.background === preset.theme.background) &&
                          (!preset.theme.font || theme.font === preset.theme.font))),
                    );
                    return match?.name ?? '';
                  })()}
                  onChange={(name) => {
                    const preset = TEMPLATE_CATALOG.find((p) => p.name === name);
                    if (preset) applyPreset(preset);
                  }}
                  options={TEMPLATE_CATALOG.map((preset) => ({
                    value: preset.name,
                    label: preset.name,
                    description: preset.desc,
                    swatch: preset.swatch,
                    disabled: preset.premium && !isPremium,
                    badge: preset.premium ? 'Premium' : undefined,
                  }))}
                />
                <div className="hidden gap-2 sm:grid sm:grid-cols-3">
                  {TEMPLATE_CATALOG.map((preset) => {
                    const locked = preset.premium && !isPremium;
                    const selected =
                      style === preset.style &&
                      (!preset.theme ||
                        ((!preset.theme.accent || theme.accent.toLowerCase() === preset.theme.accent.toLowerCase()) &&
                          (!preset.theme.background || theme.background === preset.theme.background) &&
                          (!preset.theme.font || theme.font === preset.theme.font)));
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        disabled={locked}
                        title={locked ? 'Premium — upgrade to use this look' : preset.desc}
                        className={`relative rounded-2xl border px-3 py-2.5 text-left transition ${selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'} ${locked ? 'opacity-60' : ''}`}
                      >
                        <span className="mb-1.5 block h-6 w-full rounded-lg border border-black/5" style={{ background: preset.swatch }} />
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                          {preset.name}
                          {locked ? <Lock className="h-3 w-3 text-slate-400" /> : null}
                        </span>
                        <span className="block text-[11px] text-slate-500">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
                {!isPremium && premiumHref ? (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Locked looks bundle colours + fonts — <a href={premiumHref} className="font-medium text-indigo-600 hover:underline">upgrade to premium</a> to apply them, or pick any design below.
                  </p>
                ) : null}
              </Field>

              <Field label="Design">
                {/* Mobile: dropdown; sm+: visual cards */}
                <SelectMenu
                  className="sm:hidden"
                  aria-label="Certificate design"
                  value={style}
                  onChange={(v) => selectStyle(v as CertificateStyle)}
                  options={STYLES.map((s) => ({ value: s.value, label: s.label, description: s.desc }))}
                />
                <div className="hidden gap-2 sm:grid sm:grid-cols-3">
                  {STYLES.map((s) => {
                    const selected = style === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => selectStyle(s.value)}
                        className={`relative rounded-2xl border px-3 py-3 text-left transition ${selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className="block text-sm font-semibold text-slate-800">{s.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{s.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">All designs are free to use. {isPremium ? 'Customize colours, fonts, wording & signatures below.' : 'Upgrade to premium to customize colours, fonts, wording & signatures.'}</p>
              </Field>

              {isPremium ? (
              <>
              <Field label="Accent colour">
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Accent ${c}`}
                      onClick={() => updateTheme({ accent: c })}
                      className={`h-8 w-8 rounded-full ring-offset-2 transition ${theme.accent.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'}`}
                      style={{ background: c }}
                    />
                  ))}
                  <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    Custom
                    <input type="color" value={theme.accent} onChange={(e) => updateTheme({ accent: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
                  </label>
                </div>
              </Field>

              <Field label="Background">
                <div className="grid grid-cols-3 gap-2">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => updateTheme({ background: b.value as CertificateTheme['background'] })}
                      className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${theme.background === b.value ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
                    >
                      <span className="mb-1.5 block h-8 w-full rounded-lg border border-black/5" style={{ background: b.swatch }} />
                      <span className="text-xs font-medium text-slate-700">{b.label}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Font style">
                <select className="ev-input" value={theme.font} onChange={(e) => updateTheme({ font: e.target.value as CertificateTheme['font'] })}>
                  {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Wording</p>
                    <p className="mt-0.5 text-xs text-slate-500">Add your own text. Leave a field blank to use the default.</p>
                  </div>
                  <button type="button" onClick={() => void handleAiWording()} disabled={aiBusy || !communityId} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50">
                    {aiBusy ? 'Writing…' : 'Write with AI'}
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  <Field label="Title">
                    <input className="ev-input" maxLength={60} value={content.title} placeholder={TYPE_TITLE[certificateType]} onChange={(e) => updateContent({ title: e.target.value })} />
                  </Field>
                  <Field label="Presentation line">
                    <input className="ev-input" maxLength={90} value={content.presentation} placeholder="for participating in" onChange={(e) => updateContent({ presentation: e.target.value })} />
                  </Field>
                  <Field label="Custom message (optional)">
                    <textarea className="ev-input" rows={2} maxLength={260} value={content.message} placeholder="e.g. In recognition of outstanding dedication and contribution throughout the programme." onChange={(e) => updateContent({ message: e.target.value })} />
                  </Field>
                </div>
              </div>

              {/* Organization logo — premium */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">Your organization logo</p>
                <p className="mt-0.5 text-xs text-slate-500">Upload your logo and choose where it appears on the certificate. (This is your own logo — sponsor logos are added automatically from won sponsorships.)</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {content.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveEventImageUrl(content.logo)} alt="logo" className="h-12 rounded bg-white object-contain px-1 ring-1 ring-slate-200" />
                  ) : null}
                  <label className="cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
                    {content.logo ? 'Change logo' : 'Upload logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0] ?? null)} />
                  </label>
                  {content.logo ? (
                    <button type="button" onClick={() => updateContent({ logo: '', logoPlacement: 'NONE' })} className="text-xs text-rose-500">Remove logo</button>
                  ) : null}
                </div>
                {content.logo ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-slate-600">Placement</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {LOGO_PLACEMENTS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateContent({ logoPlacement: p.value })}
                          className={`rounded-xl border px-3 py-2 text-left text-xs transition ${content.logoPlacement === p.value ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                          <span className="block font-semibold text-slate-800">{p.label}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{p.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              </>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="inline-flex items-center gap-1.5 font-semibold"><Lock className="h-4 w-4 shrink-0" /> Premium customization</p>
                  <p className="mt-0.5 text-xs">Your chosen design is free to issue as-is — no designer needed. Unlock custom colours, fonts, wording, your logo and multiple signatures.</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {onPayFromWallet ? (
                      <button
                        type="button"
                        onClick={onPayFromWallet}
                        disabled={eventUnlockBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        title={`Wallet balance: ₦${(walletBalanceNgn ?? 0).toLocaleString()}`}
                      >
                        {eventUnlockBusy ? 'Paying…' : `Pay from wallet — ₦${(eventWalletPrice ?? 0).toLocaleString()} (no fee)`}
                      </button>
                    ) : null}
                    {onUnlockEvent ? (
                      <button
                        type="button"
                        onClick={onUnlockEvent}
                        disabled={eventUnlockBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                      >
                        {eventUnlockBusy ? 'Starting…' : `Unlock for this event${eventUnlockTotal ? ` — ₦${eventUnlockTotal.toLocaleString()}` : ''}`}
                      </button>
                    ) : null}
                    <a href={premiumHref ?? '/dashboard/premium'} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">Go Premium monthly</a>
                  </div>
                  {onPayFromWallet ? (
                    <p className="mt-1.5 text-[11px] text-emerald-700">Your community wallet has ₦{(walletBalanceNgn ?? 0).toLocaleString()} of ticket earnings — paying from it skips the card processing fee.</p>
                  ) : null}
                  {!onUnlockEvent && !onPayFromWallet ? (
                    <p className="mt-1.5 text-[11px] text-amber-700/80">Card payments aren’t configured yet{(walletBalanceNgn ?? 0) > 0 ? ` and the wallet balance (₦${(walletBalanceNgn ?? 0).toLocaleString()}) doesn’t cover the unlock` : ''} — sell tickets to build a wallet balance, or contact an admin.</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-amber-700/80">Per-event unlock is a one-time charge for this certificate. Monthly premium covers unlimited events. Payment includes the gateway processing fee.</p>
                  {onCheckPayment ? (
                    <p className="mt-1.5 text-[11px] text-amber-700/80">Already paid but not unlocked?{' '}
                      <button type="button" onClick={onCheckPayment} className="font-semibold text-amber-800 underline underline-offset-2">Check payment status</button>
                    </p>
                  ) : null}
                </div>
              )}

              {/* Signatures — one is free, up to three with premium; each can have an uploaded image */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Signatures</p>
                    <p className="mt-0.5 text-xs text-slate-500">Optional — default is no signature. {isPremium ? 'Add up to 3, each with an uploaded signature image.' : 'Add one signatory (with an uploaded signature); more need premium.'}</p>
                  </div>
                  {signatories.length < maxSignatures ? (
                    <button type="button" onClick={addSignatory} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">+ Add signature</button>
                  ) : !isPremium && premiumHref ? (
                    <a href={premiumHref} className="rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">+ Add more with Premium</a>
                  ) : null}
                </div>
                {signatories.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No signature (default). Add one if you want a signatory line.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {signatories.map((s, i) => (
                      <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input className="ev-input" maxLength={60} value={s.name} placeholder="Name (e.g. Dr. Amina Bello)" onChange={(e) => updateSignatory(i, { name: e.target.value })} />
                          <input className="ev-input" maxLength={80} value={s.title} placeholder="Title (e.g. President)" onChange={(e) => updateSignatory(i, { title: e.target.value })} />
                          <button type="button" onClick={() => removeSignatory(i)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100">Remove</button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {s.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveEventImageUrl(s.image)} alt="signature" className="h-9 rounded bg-white object-contain px-1 ring-1 ring-slate-200" />
                          ) : null}
                          <label className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            {s.image ? 'Change signature image' : 'Upload signature image'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadSignature(i, e.target.files?.[0] ?? null)} />
                          </label>
                          {s.image ? <button type="button" onClick={() => updateSignatory(i, { image: '' })} className="text-xs text-rose-500">Remove image</button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Live preview">
                <CertPreview theme={theme} style={style} type={certificateType} content={content} eventTitle={eventTitle} partners={partners} />
              </Field>
            </>
          )}

          <Field label="Minimum Attendance Duration (minutes)">
            <input type="number" className="ev-input" value={minimumAttendanceDuration} onChange={(e) => onChange({ minimumAttendanceDuration: Number(e.target.value) })} />
          </Field>
          <Toggle label="Require check-out — attendees must stay to the end to earn a certificate" checked={checkOutRequired} onChange={(v) => onChange({ checkOutRequired: v })} />
          <p className="text-xs text-slate-500">Certificates are only issued to attendees who check in and check out at or after the event ends.</p>
        </>
      ) : null}
    </Section>
  );
}

const TYPE_TITLE: Record<CertificateType, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

function CertPreview({ theme, style, type, content, eventTitle, partners }: { theme: CertificateTheme; style: CertificateStyle; type: CertificateType; content: CertificateContent; eventTitle?: string; partners?: { name: string; logo: string }[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    void drawStandardCertificate(canvas, {
      attendeeName: 'Attendee Name',
      eventTitle: eventTitle || 'Your Event Title',
      communityName: '',
      type,
      theme: { accent: theme.accent, background: theme.background, font: theme.font },
      style,
      content: {
        title: content.title || '',
        presentation: content.presentation || '',
        message: content.message || '',
        signatories: (content.signatories ?? []).map((s) => ({ name: s.name || '', title: s.title || '', image: s.image || '' })),
      },
      sponsors: [],
      partners: partners ?? [],
      serial: 'GLD-2026-000000',
      verificationUrl: 'guildos.app/verify',
      issueDate: new Date().toISOString(),
      qrCanvas: null,
    });
  }, [theme, style, type, content, eventTitle, partners]);
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <canvas ref={ref} className="block h-auto w-full" />
    </div>
  );
}
