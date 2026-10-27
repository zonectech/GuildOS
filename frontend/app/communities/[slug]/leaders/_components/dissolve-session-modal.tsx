'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Copy, ExternalLink, GraduationCap, Plus, Trash2, XCircle } from 'lucide-react';

import { SelectMenu } from '../../../../../components/guildos/ui/select-menu';
import { WhatsAppIcon } from '../../../../../components/guildos/ui/whatsapp-icon';
import {
  dissolveCommunityLeaderSession, uploadLeaderPhoto,
  type CommunityLeader, type CommunitySummary, type IssuedLeaderCertificate, type LeaderCertificateChoice,
} from '../../../../../components/guildos/community-list-api';
import { getPremiumStatus } from '../../../../../components/guildos/event-api';
import { drawStandardCertificate, CERT_BACKGROUNDS, CERT_FONTS } from '../../../../../components/guildos/certificate-canvas';
import { waCertificateLink } from './wa-certificate-link';

const CERT_STYLES = ['CLASSIC', 'MODERN', 'MINIMAL', 'CORPORATE', 'DECO', 'GEOMETRIC', 'RIBBON', 'DOUBLE', 'ROUNDED', 'LAUREL', 'TECH', 'WAVE'] as const;

const SMALL_INPUT = 'mt-0.5 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400';
const FIELD_LABEL = 'text-[11px] font-semibold text-slate-500 dark:text-slate-400';

type CertMode = 'NONE' | 'STANDARD' | 'CUSTOM';
type NamePlacement = { x: number; y: number; fontSize: number; color: string; align: 'left' | 'center' | 'right' };
type Signatory = { name: string; title: string; image: string; preview: string };

/**
 * Dissolve-session: the end-of-term bulk transition, with an optional certificate step —
 * none, the GuildOS-designed certificate, or the community's own uploaded design.
 */
export function DissolveSessionModal({
  community,
  sessionLabel: sessionLabelProp,
  sessionValue: sessionValueProp,
  leaders,
  onClose,
  onDissolved,
}: {
  community: CommunitySummary;
  /** Human label for the session being dissolved (may be the "No session" bucket). */
  sessionLabel: string;
  /** The stored session string ('' for the "No session" bucket). */
  sessionValue: string;
  leaders: CommunityLeader[];
  onClose: () => void;
  onDissolved: () => Promise<void>;
}) {
  // Frozen at open: the roster refresh after dissolving moves the page's "current" session on,
  // but the results view and the group share link must keep pointing at the dissolved one.
  const [sessionLabel] = useState(sessionLabelProp);
  const [sessionValue] = useState(sessionValueProp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [certMode, setCertMode] = useState<CertMode>('NONE');
  // CUSTOM templates: where each leader's name lands on the uploaded design (x/y %, size, colour, align).
  const [namePlacement, setNamePlacement] = useState<NamePlacement>({ x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' });
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState('');
  // Issued certificates shown after a successful dissolve so admins can share the
  // verification links (especially for leaders without GuildOS accounts).
  const [results, setResults] = useState<IssuedLeaderCertificate[] | null>(null);
  const [copiedSerial, setCopiedSerial] = useState('');
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  // Premium customization of the GuildOS-designed certificate (wording + colours + style).
  const [isPremium, setIsPremium] = useState(false);
  const [certTitle, setCertTitle] = useState('');
  const [certPresentation, setCertPresentation] = useState('');
  const [certMessage, setCertMessage] = useState('');
  const [certStyle, setCertStyle] = useState('CLASSIC');
  const [certBackground, setCertBackground] = useState('IVORY');
  const [certFont, setCertFont] = useState('SERIF');
  const [certAccent, setCertAccent] = useState('#b8933a');
  // Signatures — same rule as event certificates: everyone gets one, premium up to three.
  // `image` is the already-uploaded raw /uploads path; `preview` is a local object URL.
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  // Re-dissolving a session whose leaders already hold certificates: update those to the
  // newly chosen design too (same serial/link) so nobody is stuck on an older design.
  const [reissue, setReissue] = useState(true);
  // Handover, outgoing half: step the dissolved leaders' linked accounts down to MEMBER.
  const [demote, setDemote] = useState(true);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const maxSignatures = isPremium ? 3 : 1;
  const shareLink = `${typeof window === 'undefined' ? '' : window.location.origin}/communities/${community.slug}/leaders/certificates?session=${encodeURIComponent(sessionValue)}`;

  // Premium unlocks the wording/colour customization — fetched lazily, best-effort.
  useEffect(() => {
    getPremiumStatus(community._id)
      .then((status) => setIsPremium(Boolean(status.isPremium)))
      .catch(() => setIsPremium(false));
  }, [community._id]);

  // Live preview of the GuildOS-designed certificate — same renderer as the real
  // certificate page, sampled with the first outgoing leader.
  useEffect(() => {
    if (certMode !== 'STANDARD' || results) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const sample = leaders.find((l) => l.status === 'ACTIVE') ?? leaders[0];
    void drawStandardCertificate(canvas, {
      attendeeName: sample?.name ?? 'Leader Name',
      eventTitle: [sample?.title || 'President', sessionValue ? `${sessionValue} Session` : ''].filter(Boolean).join(', '),
      communityName: community.name,
      type: 'LEADERSHIP',
      theme: isPremium
        ? { accent: certAccent, background: certBackground, font: certFont }
        : { accent: '#b8933a', background: 'IVORY', font: 'SERIF' },
      style: certStyle,
      content: {
        title: (isPremium && certTitle.trim()) || 'Certificate of Leadership',
        presentation: (isPremium && certPresentation.trim()) || 'for serving as',
        message: isPremium ? certMessage.trim() : '',
        signatories: signatories
          .filter((s) => s.name.trim())
          .slice(0, maxSignatures)
          .map((s) => ({ name: s.name.trim(), title: s.title.trim(), image: s.image })),
      },
      serial: 'GLD-0000-000000',
      verificationUrl: '',
    });
  }, [certMode, results, isPremium, certTitle, certPresentation, certMessage, certStyle, certBackground, certFont, certAccent, signatories, maxSignatures, leaders, sessionValue, community.name]);

  async function handleConfirm() {
    if (certMode === 'CUSTOM' && !templateFile) {
      setError('Upload your certificate design first (a PNG or JPG of the full certificate; each leader’s name is drawn on top of it)');
      return;
    }

    try {
      setBusy(true);
      setError('');

      let certificate: LeaderCertificateChoice | null = null;
      if (certMode === 'STANDARD') {
        const signed = signatories
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name.trim(), title: s.title.trim(), image: s.image }));
        certificate = isPremium
          ? {
              mode: 'STANDARD',
              style: certStyle,
              theme: { accent: certAccent, background: certBackground, font: certFont },
              content: { title: certTitle.trim(), presentation: certPresentation.trim(), message: certMessage.trim(), signatories: signed },
              reissueExisting: reissue,
            }
          : { mode: 'STANDARD', content: { signatories: signed }, reissueExisting: reissue };
      } else if (certMode === 'CUSTOM' && templateFile) {
        const uploaded = await uploadLeaderPhoto(templateFile);
        certificate = { mode: 'CUSTOM', templateImage: uploaded.photo, namePlacement, reissueExisting: reissue };
      }

      const result = await dissolveCommunityLeaderSession(community._id, sessionValue, certificate, { demoteOutgoing: demote });
      await onDissolved();

      if (result.certificates?.length) {
        setResults(result.certificates);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to dissolve session');
    } finally {
      setBusy(false);
    }
  }

  async function copyVerificationLink(cert: IssuedLeaderCertificate) {
    try {
      await navigator.clipboard.writeText(cert.verificationUrl);
      setCopiedSerial(cert.serial);
      setTimeout(() => setCopiedSerial(''), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyShareAllLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function updateSignatory(index: number, patch: Partial<Pick<Signatory, 'name' | 'title'>>) {
    setSignatories((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSignatureImage(index: number, file: File) {
    try {
      const uploaded = await uploadLeaderPhoto(file);
      setSignatories((rows) => rows.map((r, i) => (i === index ? { ...r, image: uploaded.photo, preview: URL.createObjectURL(file) } : r)));
    } catch {
      setError('Unable to upload the signature image');
    }
  }

  function modeOptionClass(mode: CertMode) {
    return `flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${certMode === mode ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white dark:bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {results ? 'Session dissolved and certificates issued' : `Dissolve ${sessionLabel}?`}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {results ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each outgoing leader received a verified Certificate of Leadership with its own serial and public
              verification page. Leaders on GuildOS were notified automatically. Share the links below with the rest.
            </p>
            {/* One link for the whole group — drop it in the WhatsApp/Telegram group chat and
                everyone (account or not) finds their own name and downloads their certificate. */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Share with everyone at once</p>
              <p className="mt-0.5 text-[11px] text-indigo-700 dark:text-indigo-300">One public link for the whole set. Each person finds their name and downloads their own certificate. No account needed.</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void copyShareAllLink()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Copy className="h-3 w-3" /> {copiedShareLink ? 'Copied!' : 'Copy group link'}
                </button>
                <a
                  href={shareLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
                >
                  <ExternalLink className="h-3 w-3" /> Preview page
                </a>
              </div>
            </div>
            <div className="space-y-2">
              {results.map((cert) => (
                <div key={cert.serial} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                  <GraduationCap className="h-4 w-4 shrink-0 text-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{cert.name}</p>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {cert.serial}
                      {!cert.hasAccount && <span className="ml-1.5 text-amber-600">· no GuildOS account, so share the link with them</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => void copyVerificationLink(cert)}
                    title="Copy verification link"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-3 w-3" /> {copiedSerial === cert.serial ? 'Copied' : 'Copy link'}
                  </button>
                  {cert.phone ? (
                    <a
                      href={waCertificateLink(cert.phone, cert.name, community.name, cert.verificationUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Send via WhatsApp"
                      className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <a
                    href={cert.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open certificate"
                    className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Everyone currently serving will be marked as having completed their term and move to Past Leadership
              together. This is different from archiving one person who left early. You can then add a new set of leaders
              under a new session.
            </p>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{error}</div>
            )}

            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Issue end-of-term certificates?</p>
            <div className="space-y-2">
              <label className={modeOptionClass('NONE')}>
                <input type="radio" name="dissolve-cert" checked={certMode === 'NONE'} onChange={() => setCertMode('NONE')} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">No certificates</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Just move the session to Past Leadership.</span>
                </span>
              </label>
              <label className={modeOptionClass('STANDARD')}>
                <input type="radio" name="dissolve-cert" checked={certMode === 'STANDARD'} onChange={() => setCertMode('STANDARD')} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">GuildOS certificate</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">A GuildOS-designed Certificate of Leadership for each outgoing leader, with a verified serial, QR code and public verification page.</span>
                </span>
              </label>
              <label className={modeOptionClass('CUSTOM')}>
                <input type="radio" name="dissolve-cert" checked={certMode === 'CUSTOM'} onChange={() => setCertMode('CUSTOM')} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Your own design</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Upload your certificate as an image. Each leader's name is drawn on it, and it still gets a verified serial + QR page.</span>
                  {certMode === 'CUSTOM' && (
                    <span className="mt-2 block">
                      {templatePreview ? (
                        <span className="flex items-center gap-2">
                          <img src={templatePreview} alt="" className="h-14 w-auto rounded-lg border border-slate-200 dark:border-slate-800 object-contain" />
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setTemplateFile(null); setTemplatePreview(''); }}
                            className="text-xs font-medium text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-white dark:hover:bg-slate-800">
                          <Camera className="h-3.5 w-3.5" /> Upload design (PNG/JPG)
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setTemplateFile(file);
                              setTemplatePreview(URL.createObjectURL(file));
                            }}
                          />
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </label>
            </div>

            {/* CUSTOM template: position each leader's name on the design — same editor as event
                certificates. Outside the <label> so the sliders don't fight the radio input. */}
            {certMode === 'CUSTOM' && templatePreview && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Position the name on your design</p>
                <div className="relative mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" style={{ containerType: 'size' } as React.CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={templatePreview} alt="Certificate template" className="block w-full" />
                  <span
                    style={{
                      position: 'absolute',
                      left: `${namePlacement.x}%`,
                      top: `${namePlacement.y}%`,
                      transform: `translate(${namePlacement.align === 'center' ? '-50%' : namePlacement.align === 'right' ? '-100%' : '0'}, -50%)`,
                      color: namePlacement.color,
                      fontSize: `${namePlacement.fontSize}cqh`,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    Leader Name
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Horizontal ({namePlacement.x}%)
                    <input type="range" min={0} max={100} value={namePlacement.x} onChange={(e) => setNamePlacement((p) => ({ ...p, x: Number(e.target.value) }))} className="w-full" />
                  </label>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Vertical ({namePlacement.y}%)
                    <input type="range" min={0} max={100} value={namePlacement.y} onChange={(e) => setNamePlacement((p) => ({ ...p, y: Number(e.target.value) }))} className="w-full" />
                  </label>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Font size ({namePlacement.fontSize}% of height)
                    <input type="range" min={2} max={20} value={namePlacement.fontSize} onChange={(e) => setNamePlacement((p) => ({ ...p, fontSize: Number(e.target.value) }))} className="w-full" />
                  </label>
                  <span className="flex items-end gap-3">
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Colour
                      <input type="color" value={namePlacement.color} onChange={(e) => setNamePlacement((p) => ({ ...p, color: e.target.value }))} className="block h-8 w-12 cursor-pointer rounded border border-slate-200 dark:border-slate-800" />
                    </label>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Align
                      <SelectMenu
                        aria-label="Text align"
                        className="mt-0.5 w-28"
                        size="sm"
                        value={namePlacement.align}
                        onChange={(v) => setNamePlacement((p) => ({ ...p, align: v as NamePlacement['align'] }))}
                        options={['left', 'center', 'right'].map((a) => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) }))}
                      />
                    </label>
                  </span>
                </div>
              </div>
            )}

            {/* GuildOS-design customization — wording/colours/style are premium tools
                (Model B, same as event certificates); the live preview always shows
                exactly what will be issued. */}
            {certMode === 'STANDARD' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3">
                {isPremium ? (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Customize the certificate</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={FIELD_LABEL}>Certificate title</label>
                        <input type="text" value={certTitle} onChange={(e) => setCertTitle(e.target.value.slice(0, 60))} placeholder="Certificate of Leadership" className={SMALL_INPUT} />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>Presentation line</label>
                        <input type="text" value={certPresentation} onChange={(e) => setCertPresentation(e.target.value.slice(0, 90))} placeholder="for serving as" className={SMALL_INPUT} />
                      </div>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>Message (optional)</label>
                      <input type="text" value={certMessage} onChange={(e) => setCertMessage(e.target.value.slice(0, 260))} placeholder="e.g. With gratitude for a year of dedicated service." className={SMALL_INPUT} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <label className={FIELD_LABEL}>Design</label>
                        <SelectMenu
                          aria-label="Certificate design"
                          className="mt-0.5"
                          size="sm"
                          value={certStyle}
                          onChange={setCertStyle}
                          options={CERT_STYLES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>Background</label>
                        <SelectMenu
                          aria-label="Certificate background"
                          className="mt-0.5"
                          size="sm"
                          value={certBackground}
                          onChange={setCertBackground}
                          options={CERT_BACKGROUNDS.map((b) => ({ value: b.value, label: b.label }))}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>Font</label>
                        <SelectMenu
                          aria-label="Certificate font"
                          className="mt-0.5"
                          size="sm"
                          value={certFont}
                          onChange={setCertFont}
                          options={CERT_FONTS.map((f) => ({ value: f.value, label: f.label }))}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>Accent</label>
                        <input type="color" value={certAccent} onChange={(e) => setCertAccent(e.target.value)} className="mt-0.5 h-7 w-full cursor-pointer rounded-lg border border-slate-200 dark:border-slate-800" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">Premium customization:</span> upgrade to change the wording, colours and fonts.
                    Free communities get the polished GuildOS default below.
                  </p>
                )}

                {/* Signatures — one for everyone, up to three with premium (event-certificate parity). */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className={FIELD_LABEL}>
                      Signatures {isPremium ? '(up to 3)' : '(1 included, premium unlocks 3)'}
                    </p>
                    {signatories.length < maxSignatures && (
                      <button
                        type="button"
                        onClick={() => setSignatories((rows) => [...rows, { name: '', title: '', image: '', preview: '' }])}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-white dark:hover:bg-slate-800"
                      >
                        <Plus className="h-3 w-3" /> Add signature
                      </button>
                    )}
                  </div>
                  {signatories.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      {signatories.map((sig, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={sig.name}
                            onChange={(e) => updateSignatory(i, { name: e.target.value.slice(0, 60) })}
                            placeholder="Signatory name *"
                            className="w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                          />
                          <input
                            type="text"
                            value={sig.title}
                            onChange={(e) => updateSignatory(i, { title: e.target.value.slice(0, 80) })}
                            placeholder="Title (e.g. Patron)"
                            className="w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                          />
                          <label
                            title={sig.image ? 'Change signature image' : 'Upload signature image (optional)'}
                            className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${sig.image ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
                          >
                            <Camera className="h-3 w-3" /> {sig.image ? 'Added' : 'Image'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleSignatureImage(i, file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setSignatories((rows) => rows.filter((_, idx) => idx !== i))}
                            title="Remove signature"
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <p className={FIELD_LABEL}>Preview</p>
                  <canvas ref={previewRef} width={1876} height={1450} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
                </div>
              </div>
            )}

            {/* Re-issue safety net: if some of these leaders already hold a certificate
                (e.g. from an earlier dissolve of this same session), refresh those to this
                design too — same serial and link, so nothing already shared breaks. */}
            {certMode !== 'NONE' && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                <input type="checkbox" checked={reissue} onChange={(e) => setReissue(e.target.checked)} className="mt-0.5" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Apply this design to already-issued certificates too</span>
                  <br />If any of these leaders already received a certificate before, update it to this design. Their serial and
                  verification link stay the same.
                </span>
              </label>
            )}

            {/* Handover, outgoing half: end-of-term should end management PERMISSIONS too,
                or the old excos keep full control of the community forever. */}
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
              <input type="checkbox" checked={demote} onChange={(e) => setDemote(e.target.checked)} className="mt-0.5" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Step outgoing leaders down to Member (recommended)</span>
                <br />Leaders with GuildOS accounts lose their management roles as their term ends. The founder and you are never
                touched. Use “Hand over roles” afterwards to empower the new session’s leaders.
              </span>
            </label>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void handleConfirm()}
                disabled={busy}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? 'Dissolving…' : certMode === 'NONE' ? 'Dissolve session' : 'Dissolve & issue certificates'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
