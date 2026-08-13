'use client';

import { confirmDialog } from '../../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import { SelectMenu } from '../../../../components/guildos/ui/select-menu';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Award, BadgeCheck, Camera, Archive, Copy, ExternalLink, FileUp, GraduationCap, MessageCircle, PenLine, Plus, RotateCcw, Trash2, UserCog, XCircle,
} from 'lucide-react';

import { getCurrentUser, searchPeople, type PersonResult } from '../../../../components/guildos/auth-api';
import {
  getCommunity, resolveAvatarUrl,
  getCommunityLeaders, getCommunityLeaderSessions, addCommunityLeader, updateCommunityLeader, removeCommunityLeader, uploadLeaderPhoto,
  dissolveCommunityLeaderSession, extractLeadersFromDocument, bulkCreateCommunityLeaders, handoverCommunityLeadership, issueLeaderCertificate,
  type CommunitySummary, type CommunityLeader, type CommunityLeaderSession, type ExtractedLeaderCandidate,
  type LeaderCertificateChoice, type IssuedLeaderCertificate, type HandoverResult,
} from '../../../../components/guildos/community-list-api';
import { StudentNav } from '../../../../components/guildos/student-nav';
import { getPremiumStatus } from '../../../../components/guildos/event-api';
import { drawStandardCertificate, CERT_BACKGROUNDS, CERT_FONTS } from '../../../../components/guildos/certificate-canvas';

const CERT_STYLES = ['CLASSIC', 'MODERN', 'MINIMAL', 'CORPORATE', 'DECO', 'GEOMETRIC', 'RIBBON', 'DOUBLE', 'ROUNDED', 'LAUREL', 'TECH', 'WAVE'] as const;

const NO_SESSION_LABEL = 'No session';

/**
 * wa.me deep link for sharing a certificate with a leader who may have no GuildOS account.
 * Local Nigerian numbers (leading 0) are converted to international format; anything already
 * international keeps its digits.
 */
function waCertificateLink(phone: string, name: string, communityName: string, url: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '234' + digits.slice(1);
  const text = `Congratulations ${name}! \u{1F393} Your leadership certificate from ${communityName} is ready \u2014 view and download it here: ${url}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function parseSessionStartYear(label: string): number | null {
  const match = /^(\d{4})\/(\d{4})$/.exec(label.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Picks which session counts as "Current": among sessions with at least one ACTIVE leader,
 * whichever has the highest starting year (parsed from "YYYY/YYYY") — NOT whichever was most
 * recently touched, since dissolving a session (a bulk status update) would otherwise make it
 * look freshly active again. Falls back to array order (already sorted by recent activity by
 * the backend) when nothing parses as a proper session year. Null when there are no leaders yet.
 */
function pickCurrentSessionLabel(buckets: Array<{ label: string; activeCount: number }>): string | null {
  if (buckets.length === 0) return null;
  const pool = buckets.some((b) => b.activeCount > 0) ? buckets.filter((b) => b.activeCount > 0) : buckets;
  let best = pool[0];
  let bestYear = parseSessionStartYear(best.label);
  for (const b of pool.slice(1)) {
    const y = parseSessionStartYear(b.label);
    if (y !== null && (bestYear === null || y > bestYear)) {
      best = b;
      bestYear = y;
    }
  }
  return best.label;
}

/**
 * Client-side mirror of the backend's session-label rule (defense in depth + instant feedback):
 * two consecutive 4-digit years ("2026/2027", never "2027/2026"), not starting earlier than the
 * current academic year (with a Jan/Feb grace window for schools still using last year's label).
 */
function validateSessionLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})\/(\d{4})$/.exec(trimmed);
  if (!match) return 'Session must be two consecutive years, e.g. 2026/2027';

  const y1 = Number(match[1]);
  const y2 = Number(match[2]);
  if (y2 !== y1 + 1) return 'Session years must be consecutive and in order, e.g. 2026/2027 (not 2027/2026)';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const effectiveYear = currentMonth <= 2 ? currentYear - 1 : currentYear;

  if (y1 < effectiveYear) return `Session can't start before ${effectiveYear}/${effectiveYear + 1} — dissolve the old session instead of backdating a new one`;

  return null;
}

function MemberAvatar({ fullName, avatar, size = 'md' }: { fullName: string; avatar?: string; size?: 'sm' | 'md' }) {
  const url = resolveAvatarUrl(avatar);
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  const cls = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm';
  if (url) return <img src={url} alt={fullName} className={`${cls} shrink-0 rounded-full border border-slate-200 dark:border-slate-800 object-cover`} />;
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600`}>
      {initials || '?'}
    </div>
  );
}

/**
 * A small icon action nested inside a leader card (which is itself a <button>) —
 * a real <button> can't nest inside another, so this is a keyboard-accessible
 * span: clickable, focusable (tabIndex), and Enter/Space triggers it like a button.
 */
function LeaderCardAction({
  onClick,
  title,
  className,
  children,
}: {
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  title: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      }}
      className={className}
    >
      {children}
    </span>
  );
}

export default function CommunityLeadersPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  // "Issue anyway" — per-person certificate for archived/skipped leaders.
  const [issueCertBusy, setIssueCertBusy] = useState(false);
  const [community, setCommunity] = useState<CommunitySummary | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [leaders, setLeaders] = useState<CommunityLeader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leaderSessions, setLeaderSessions] = useState<CommunityLeaderSession[]>([]);
  const [actionError, setActionError] = useState('');
  // Every tab — including "Current" — is a specific session's full roster (current + past
  // members of that session; archived ones are flagged, not hidden). "Current" is simply an
  // alias for whichever session is most recently active — it is NOT a cross-session
  // "active status" filter, so a session's own archived members still show up under it.
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // View-bio modal
  const [viewLeader, setViewLeader] = useState<CommunityLeader | null>(null);
  // Full-size click-to-preview for any photo shown in the add/edit form.
  const [photoLightbox, setPhotoLightbox] = useState('');

  // Add/edit modal
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [editingLeaderId, setEditingLeaderId] = useState('');
  const [leaderForm, setLeaderForm] = useState({ name: '', title: '', session: '', bio: '', phone: '', department: '', level: '', displayRank: '' });
  const [leaderPhotoFile, setLeaderPhotoFile] = useState<File | null>(null);
  const [leaderPhotoPreview, setLeaderPhotoPreview] = useState('');
  const [leaderPhotoCleared, setLeaderPhotoCleared] = useState(false);
  // Raw `/uploads/...` path reused directly from a tagged GuildOS account's own avatar — no
  // re-upload needed. Cleared as soon as the admin uploads their own file instead.
  const [leaderPhotoFromAvatar, setLeaderPhotoFromAvatar] = useState('');
  const [leaderLinkedUser, setLeaderLinkedUser] = useState<{ id: string; fullName: string; username: string; avatar: string } | null>(null);
  const [leaderSearchQuery, setLeaderSearchQuery] = useState('');
  const [leaderSearchResults, setLeaderSearchResults] = useState<PersonResult[]>([]);
  const [leaderBusy, setLeaderBusy] = useState(false);
  const [leaderError, setLeaderError] = useState('');

  // Import-from-document modal — step 1 uploads a PDF and gets AI-extracted candidates back,
  // step 2 lets the admin review/edit the rows before committing them all under one session.
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'review'>('upload');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSession, setImportSession] = useState('');
  const [importRows, setImportRows] = useState<(ExtractedLeaderCandidate & { _rowId: number })[]>([]);

  // Dissolve-session modal — end-of-term bulk transition, with an optional certificate step:
  // none, the GuildOS-designed certificate, or the community's own uploaded design.
  const [dissolveModalOpen, setDissolveModalOpen] = useState(false);
  const [dissolveBusy, setDissolveBusy] = useState(false);
  const [dissolveError, setDissolveError] = useState('');
  const [dissolveCertMode, setDissolveCertMode] = useState<'NONE' | 'STANDARD' | 'CUSTOM'>('NONE');
  // CUSTOM templates: where each leader's name lands on the uploaded design (x/y %, size, colour, align).
  const [dissolveNamePlacement, setDissolveNamePlacement] = useState({ x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' as 'left' | 'center' | 'right' });
  const [dissolveTemplateFile, setDissolveTemplateFile] = useState<File | null>(null);
  const [dissolveTemplatePreview, setDissolveTemplatePreview] = useState('');
  // Issued certificates shown after a successful dissolve so admins can share the
  // verification links (especially for leaders without GuildOS accounts).
  const [dissolveResults, setDissolveResults] = useState<IssuedLeaderCertificate[] | null>(null);
  const [copiedSerial, setCopiedSerial] = useState('');
  // Session label captured at dissolve time — powers the shareable "collect your
  // certificate" group link (currentSessionLabel changes once the roster refreshes).
  const [dissolvedSessionLabel, setDissolvedSessionLabel] = useState('');
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  // Premium customization of the GuildOS-designed certificate (wording + colours + style).
  const [communityIsPremium, setCommunityIsPremium] = useState(false);
  const [certTitle, setCertTitle] = useState('');
  const [certPresentation, setCertPresentation] = useState('');
  const [certMessage, setCertMessage] = useState('');
  const [certStyle, setCertStyle] = useState('CLASSIC');
  const [certBackground, setCertBackground] = useState('IVORY');
  const [certFont, setCertFont] = useState('SERIF');
  const [certAccent, setCertAccent] = useState('#b8933a');
  // Signatures — same rule as event certificates: everyone gets one, premium up to three.
  // `image` is the already-uploaded raw /uploads path; `preview` is a local object URL.
  const [certSignatories, setCertSignatories] = useState<{ name: string; title: string; image: string; preview: string }[]>([]);
  // Re-dissolving a session whose leaders already hold certificates: update those to the
  // newly chosen design too (same serial/link) so nobody is stuck on an older design.
  const [dissolveReissue, setDissolveReissue] = useState(true);
  // Handover, outgoing half: step the dissolved leaders' linked accounts down to MEMBER.
  const [dissolveDemote, setDissolveDemote] = useState(true);
  const certPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // Handover modal — the incoming half: turn the current session's linked roster entries
  // into REAL Membership roles (and optionally transfer ownership) in one action.
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [handoverError, setHandoverError] = useState('');
  const [handoverRoles, setHandoverRoles] = useState<Record<string, string>>({});
  const [handoverOwnerLeaderId, setHandoverOwnerLeaderId] = useState('');
  const [handoverResult, setHandoverResult] = useState<HandoverResult | null>(null);

  function openImportModal() {
    setImportStep('upload');
    setImportBusy(false);
    setImportError('');
    setImportSession(selectedSession && selectedSession !== NO_SESSION_LABEL ? selectedSession : '');
    setImportRows([]);
    setImportModalOpen(true);
  }

  async function handleImportUpload(file: File) {
    try {
      setImportBusy(true);
      setImportError('');
      const result = await extractLeadersFromDocument(file);
      if (!result.candidates.length) {
        setImportError("Couldn't find any names in that document. Try a clearer PDF, or add leaders manually.");
        return;
      }
      setImportSession(result.session || importSession);
      setImportRows(result.candidates.map((c, i) => ({ ...c, _rowId: i })));
      setImportStep('review');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to extract leaders from that document');
    } finally {
      setImportBusy(false);
    }
  }

  function updateImportRow(rowId: number, patch: Partial<ExtractedLeaderCandidate>) {
    setImportRows((rows) => rows.map((r) => (r._rowId === rowId ? { ...r, ...patch } : r)));
  }

  function removeImportRow(rowId: number) {
    setImportRows((rows) => rows.filter((r) => r._rowId !== rowId));
  }

  async function handleCommitImport() {
    if (!community) return;
    if (!importRows.length) return;
    const sessionError = validateSessionLabel(importSession);
    if (sessionError) {
      setImportError(sessionError);
      return;
    }
    if (!importRows.some((r) => r.name.trim())) {
      setImportError('At least one row needs a name');
      return;
    }

    try {
      setImportBusy(true);
      setImportError('');
      const entries = importRows
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), title: r.title.trim(), department: r.department.trim(), level: r.level.trim(), phone: r.phone.trim() }));
      await bulkCreateCommunityLeaders(community._id, importSession.trim(), entries);
      await refreshSessions(community._id);
      if (selectedSession === importSession.trim()) {
        await fetchLeadersForView(community._id, importSession.trim());
      }
      setImportModalOpen(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to create leaders');
    } finally {
      setImportBusy(false);
    }
  }

  /** Fetches one session's full roster (current + past members of that session). */
  async function fetchLeadersForView(communityId: string, session: string | null) {
    if (session === null) {
      setLeaders([]);
      return;
    }
    setLeadersLoading(true);
    try {
      const { leaders: fetched } = await getCommunityLeaders(communityId, { session: session === NO_SESSION_LABEL ? '' : session });
      setLeaders(fetched ?? []);
    } finally {
      setLeadersLoading(false);
    }
  }

  async function refreshSessions(communityId: string) {
    const { sessions: fetched } = await getCommunityLeaderSessions(communityId);
    setLeaderSessions(fetched ?? []);
    return fetched ?? [];
  }

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const response = await getCommunity(slug);
        setCommunity(response.community);
        const role = response.viewerMembership?.role;
        setCanManage(Boolean(role && ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(role)));

        if (response.community?._id) {
          const fetchedSessions = await refreshSessions(response.community._id);
          const defaultSession = pickCurrentSessionLabel(
            fetchedSessions.map((s) => ({ label: s.session.trim() || NO_SESSION_LABEL, activeCount: s.activeCount })),
          );
          setSelectedSession(defaultSession);
          await fetchLeadersForView(response.community._id, defaultSession);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load leadership team');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      void load();
    }
  }, [router, slug]);

  // Session buckets (label + counts), most-recently-active first. Sourced from the lightweight
  // /leaders/sessions endpoint so browsing history doesn't require fetching every leader up front.
  const sessions = useMemo(
    () =>
      leaderSessions.map((s) => ({
        label: s.session.trim() || NO_SESSION_LABEL,
        total: s.total,
        activeCount: s.activeCount,
        archivedCount: s.archivedCount,
        pastCount: s.pastCount,
      })),
    [leaderSessions],
  );

  // "Current" is an alias for whichever session has the highest starting year among those with
  // at least one ACTIVE leader — NOT the most-recently-touched bucket (dissolving a session is a
  // bulk status update, so it must never make the just-dissolved session look "current" again).
  const currentSessionLabel = useMemo(() => pickCurrentSessionLabel(sessions), [sessions]);
  const currentSessionActiveCount = sessions.find((s) => s.label === currentSessionLabel)?.activeCount ?? 0;
  const otherSessions = useMemo(() => sessions.filter((s) => s.label !== currentSessionLabel), [sessions, currentSessionLabel]);

  function selectSession(session: string) {
    setSelectedSession(session);
    if (community) void fetchLeadersForView(community._id, session);
  }

  // Existing session labels (most recently active first) — offered as autocomplete
  // suggestions so leaders re-use "2026/2027" instead of typos like "2026/27".
  const sessionSuggestions = useMemo(() => sessions.map((s) => s.label).filter((l) => l !== NO_SESSION_LABEL), [sessions]);

  async function refreshLeaders() {
    if (!community) return;
    const fetchedSessions = await refreshSessions(community._id);
    const mapped = fetchedSessions.map((s) => ({ label: s.session.trim() || NO_SESSION_LABEL, activeCount: s.activeCount }));
    // The currently-selected session might no longer exist (e.g. its last leader was just
    // deleted) — fall back to whichever session is now "Current", or null if there are none left.
    const stillExists = selectedSession !== null && mapped.some((s) => s.label === selectedSession);
    const nextSession = stillExists ? selectedSession : pickCurrentSessionLabel(mapped);
    if (nextSession !== selectedSession) setSelectedSession(nextSession);
    await fetchLeadersForView(community._id, nextSession);
  }

  function openDissolveModal() {
    setDissolveBusy(false);
    setDissolveError('');
    setDissolveCertMode('NONE');
    setDissolveTemplateFile(null);
    setDissolveTemplatePreview('');
    setDissolveNamePlacement({ x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' });
    setDissolveResults(null);
    setCopiedSerial('');
    setCopiedShareLink(false);
    setCertTitle('');
    setCertPresentation('');
    setCertMessage('');
    setCertStyle('CLASSIC');
    setCertBackground('IVORY');
    setCertFont('SERIF');
    setCertAccent('#b8933a');
    setCertSignatories([]);
    setDissolveReissue(true);
    setDissolveDemote(true);
    setDissolveModalOpen(true);
    // Premium unlocks the wording/colour customization — fetched lazily, best-effort.
    if (community) {
      getPremiumStatus(community._id)
        .then((status) => setCommunityIsPremium(Boolean(status.isPremium)))
        .catch(() => setCommunityIsPremium(false));
    }
  }

  async function handleConfirmDissolve() {
    if (!community || currentSessionLabel === null) return;
    if (dissolveCertMode === 'CUSTOM' && !dissolveTemplateFile) {
      setDissolveError('Upload your certificate design first (PNG/JPG of the full certificate — each leader\u2019s name is drawn on top of it)');
      return;
    }

    try {
      setDissolveBusy(true);
      setDissolveError('');

      let certificate: LeaderCertificateChoice | null = null;
      if (dissolveCertMode === 'STANDARD') {
        const signatories = certSignatories
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name.trim(), title: s.title.trim(), image: s.image }));
        certificate = communityIsPremium
          ? {
              mode: 'STANDARD',
              style: certStyle,
              theme: { accent: certAccent, background: certBackground, font: certFont },
              content: { title: certTitle.trim(), presentation: certPresentation.trim(), message: certMessage.trim(), signatories },
              reissueExisting: dissolveReissue,
            }
          : { mode: 'STANDARD', content: { signatories }, reissueExisting: dissolveReissue };
      } else if (dissolveCertMode === 'CUSTOM' && dissolveTemplateFile) {
        const uploaded = await uploadLeaderPhoto(dissolveTemplateFile);
        certificate = { mode: 'CUSTOM', templateImage: uploaded.photo, namePlacement: dissolveNamePlacement, reissueExisting: dissolveReissue };
      }

      const sessionForShare = currentSessionLabel === NO_SESSION_LABEL ? '' : currentSessionLabel;
      const result = await dissolveCommunityLeaderSession(community._id, sessionForShare, certificate, { demoteOutgoing: dissolveDemote });
      setDissolvedSessionLabel(sessionForShare);
      await refreshLeaders();

      if (result.certificates?.length) {
        setDissolveResults(result.certificates);
      } else {
        setDissolveModalOpen(false);
      }
    } catch (err) {
      setDissolveError(err instanceof Error ? err.message : 'Unable to dissolve session');
    } finally {
      setDissolveBusy(false);
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

  function sessionShareLink() {
    if (!community) return '';
    return `${window.location.origin}/communities/${community.slug}/leaders/certificates?session=${encodeURIComponent(dissolvedSessionLabel)}`;
  }

  // Live preview of the GuildOS-designed certificate inside the dissolve modal —
  // same renderer as the real certificate page, sampled with the first outgoing leader.
  useEffect(() => {
    if (!dissolveModalOpen || dissolveCertMode !== 'STANDARD' || dissolveResults) return;
    const canvas = certPreviewRef.current;
    if (!canvas) return;
    const sample = leaders.find((l) => l.status === 'ACTIVE') ?? leaders[0];
    const sessionLabel = currentSessionLabel === NO_SESSION_LABEL ? '' : currentSessionLabel ?? '';
    void drawStandardCertificate(canvas, {
      attendeeName: sample?.name ?? 'Leader Name',
      eventTitle: [sample?.title || 'President', sessionLabel ? `${sessionLabel} Session` : ''].filter(Boolean).join(' — '),
      communityName: community?.name ?? '',
      type: 'LEADERSHIP',
      theme: communityIsPremium
        ? { accent: certAccent, background: certBackground, font: certFont }
        : { accent: '#b8933a', background: 'IVORY', font: 'SERIF' },
      style: certStyle,
      content: {
        title: (communityIsPremium && certTitle.trim()) || 'Certificate of Leadership',
        presentation: (communityIsPremium && certPresentation.trim()) || 'for serving as',
        message: communityIsPremium ? certMessage.trim() : '',
        signatories: certSignatories
          .filter((s) => s.name.trim())
          .slice(0, communityIsPremium ? 3 : 1)
          .map((s) => ({ name: s.name.trim(), title: s.title.trim(), image: s.image })),
      },
      serial: 'GLD-0000-000000',
      verificationUrl: '',
    });
  }, [dissolveModalOpen, dissolveCertMode, dissolveResults, communityIsPremium, certTitle, certPresentation, certMessage, certStyle, certBackground, certFont, certAccent, certSignatories, leaders, currentSessionLabel, community]);

  async function copyShareAllLink() {
    try {
      await navigator.clipboard.writeText(sessionShareLink());
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  // Same group link, but for whichever session is currently being browsed — available
  // any time after a dissolve, not just in the results modal.
  const [copiedSessionLink, setCopiedSessionLink] = useState(false);
  async function copySessionCertificatesLink() {
    if (!community) return;
    const session = selectedSession === NO_SESSION_LABEL ? '' : selectedSession ?? '';
    const url = `${window.location.origin}/communities/${community.slug}/leaders/certificates?session=${encodeURIComponent(session)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSessionLink(true);
      setTimeout(() => setCopiedSessionLink(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const maxSignatures = communityIsPremium ? 3 : 1;

  function openHandoverModal() {
    setHandoverBusy(false);
    setHandoverError('');
    setHandoverRoles({});
    setHandoverOwnerLeaderId('');
    setHandoverResult(null);
    setHandoverModalOpen(true);
  }

  async function handleConfirmHandover() {
    if (!community) return;
    const assignments = Object.entries(handoverRoles)
      .filter(([, role]) => role)
      .map(([leaderId, role]) => ({ leaderId, role }));
    if (!assignments.length && !handoverOwnerLeaderId) {
      setHandoverError('Pick at least one role to assign (or a new owner)');
      return;
    }

    try {
      setHandoverBusy(true);
      setHandoverError('');
      const result = await handoverCommunityLeadership(community._id, assignments, handoverOwnerLeaderId || null);
      setHandoverResult(result);
      await refreshLeaders();
    } catch (err) {
      setHandoverError(err instanceof Error ? err.message : 'Unable to hand over leadership');
    } finally {
      setHandoverBusy(false);
    }
  }

  function updateSignatory(index: number, patch: Partial<{ name: string; title: string }>) {
    setCertSignatories((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSignatureImage(index: number, file: File) {
    try {
      const uploaded = await uploadLeaderPhoto(file);
      setCertSignatories((rows) => rows.map((r, i) => (i === index ? { ...r, image: uploaded.photo, preview: URL.createObjectURL(file) } : r)));
    } catch {
      setDissolveError('Unable to upload the signature image');
    }
  }

  function resetLeaderForm() {
    setEditingLeaderId('');
    setLeaderForm({ name: '', title: '', session: '', bio: '', phone: '', department: '', level: '', displayRank: '' });
    setLeaderPhotoFile(null);
    setLeaderPhotoPreview('');
    setLeaderPhotoCleared(false);
    setLeaderPhotoFromAvatar('');
    setLeaderLinkedUser(null);
    setLeaderSearchQuery('');
    setLeaderSearchResults([]);
    setLeaderError('');
  }

  function openAddLeader() {
    resetLeaderForm();
    // Pre-fill the session field with whatever's currently selected, for convenience.
    if (selectedSession && selectedSession !== NO_SESSION_LABEL) {
      setLeaderForm((f) => ({ ...f, session: selectedSession }));
    }
    setLeaderModalOpen(true);
  }

  function openEditLeader(leader: CommunityLeader) {
    setEditingLeaderId(leader.id);
    setLeaderForm({
      name: leader.name,
      title: leader.title,
      session: leader.session,
      bio: leader.bio,
      phone: leader.phone,
      department: leader.department,
      level: leader.level,
      displayRank: leader.displayRank !== null && leader.displayRank !== undefined ? String(leader.displayRank) : '',
    });
    setLeaderPhotoFile(null);
    setLeaderPhotoPreview(leader.photo ? resolveAvatarUrl(leader.photo) : '');
    setLeaderPhotoCleared(false);
    setLeaderPhotoFromAvatar('');
    setLeaderLinkedUser(leader.linkedUser);
    setLeaderSearchQuery('');
    setLeaderSearchResults([]);
    setLeaderError('');
    setLeaderModalOpen(true);
  }

  async function handleLeaderSearch(q: string) {
    setLeaderSearchQuery(q);
    if (q.trim().length < 2) {
      setLeaderSearchResults([]);
      return;
    }
    try {
      const { people } = await searchPeople(q.trim());
      setLeaderSearchResults(people);
    } catch {
      /* typeahead is best-effort */
    }
  }

  async function handleSaveLeader() {
    if (!community) return;
    if (!leaderForm.name.trim()) {
      setLeaderError('Name is required');
      return;
    }

    // Only re-validate the session format/range when it's actually changing — leaving an
    // existing leader's untouched, legitimately-historical session alone should never fail.
    const originalSession = editingLeaderId ? leaders.find((l) => l.id === editingLeaderId)?.session : undefined;
    if (leaderForm.session.trim() !== (originalSession ?? '')) {
      const sessionError = validateSessionLabel(leaderForm.session);
      if (sessionError) {
        setLeaderError(sessionError);
        return;
      }
    }

    try {
      setLeaderBusy(true);
      setLeaderError('');

      let photo = '';
      if (leaderPhotoFile) {
        const uploaded = await uploadLeaderPhoto(leaderPhotoFile);
        photo = uploaded.photo;
      } else if (leaderPhotoFromAvatar) {
        photo = leaderPhotoFromAvatar;
      } else if (!leaderPhotoCleared && editingLeaderId) {
        photo = leaders.find((l) => l.id === editingLeaderId)?.photo ?? '';
      }

      const input = {
        name: leaderForm.name.trim(),
        title: leaderForm.title.trim(),
        session: leaderForm.session.trim(),
        bio: leaderForm.bio.trim(),
        photo,
        phone: leaderForm.phone.trim(),
        department: leaderForm.department.trim(),
        level: leaderForm.level.trim(),
        displayRank: leaderForm.displayRank.trim() === '' ? null : Number(leaderForm.displayRank),
        linkedUserId: leaderLinkedUser?.id ?? null,
      };

      if (editingLeaderId) {
        await updateCommunityLeader(community._id, editingLeaderId, input);
      } else {
        await addCommunityLeader(community._id, input);
      }

      await refreshLeaders();
      setLeaderModalOpen(false);
      resetLeaderForm();
    } catch (err) {
      setLeaderError(err instanceof Error ? err.message : 'Unable to save leader');
    } finally {
      setLeaderBusy(false);
    }
  }

  async function handleArchiveLeader(leaderId: string) {
    if (!community) return;
    const confirmed = await confirmDialog({
      title: 'Archive this leader?',
      message: "They'll be marked as having left the post before their session ended — kept on record, but flagged as an individual exception. This is different from dissolving the whole session.",
      confirmLabel: 'Archive',
    });
    if (!confirmed) return;

    try {
      setLeaderBusy(true);
      await updateCommunityLeader(community._id, leaderId, { status: 'ARCHIVED' });
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to archive leader');
    } finally {
      setLeaderBusy(false);
    }
  }

  async function handleRestoreLeader(leaderId: string) {
    if (!community) return;
    try {
      setLeaderBusy(true);
      await updateCommunityLeader(community._id, leaderId, { status: 'ACTIVE' });
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to restore leader');
    } finally {
      setLeaderBusy(false);
    }
  }

  async function handleRemoveLeader(leaderId: string) {
    if (!community) return;
    const confirmed = await confirmDialog({ title: 'Permanently delete this entry?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;

    try {
      setLeaderBusy(true);
      await removeCommunityLeader(community._id, leaderId);
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to remove leader');
    } finally {
      setLeaderBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950">
        <LogoSpinner />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        <StudentNav active="/communities" />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Community not found'}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav active="/communities" />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <a href={`/communities/${community.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to {community.name}
        </a>

        <div className="mt-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {community.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveAvatarUrl(community.logo)} alt={community.name} className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600">
                {community.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-950 dark:text-white">
                <Award className="h-5 w-5 text-indigo-500" /> Leadership Team
              </h1>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{community.name}</p>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <button
                  onClick={openHandoverModal}
                  title="Give the listed leaders real management roles"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <UserCog className="h-4 w-4" /> Hand over roles
                </button>
                <button
                  onClick={openImportModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileUp className="h-4 w-4" /> Import from document
                </button>
                <button
                  onClick={openAddLeader}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Plus className="h-4 w-4" /> Add leader
                </button>
              </div>
            )}
          </div>

          {actionError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
          )}

          {/* Session chips — every chip (including "Current") is a specific session's full
              roster. "Current" is the session with the highest starting year that still has
              at least one active leader; its own archived/past members still show up there
              (flagged, not hidden) — browsing by session is how you see who led in earlier years. */}
          {currentSessionLabel !== null && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => selectSession(currentSessionLabel)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedSession === currentSessionLabel ? 'bg-slate-900 text-white' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title={`Current session${currentSessionLabel !== NO_SESSION_LABEL ? `: ${currentSessionLabel}` : ''}`}
              >
                Current{currentSessionLabel !== NO_SESSION_LABEL ? ` · ${currentSessionLabel}` : ''}
              </button>
              {otherSessions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => selectSession(s.label)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    selectedSession === s.label ? 'bg-slate-900 text-white' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title={`${s.activeCount} active${s.archivedCount > 0 ? `, ${s.archivedCount} archived` : ''}${s.pastCount > 0 ? `, ${s.pastCount} past` : ''}`}
                >
                  {s.label} ({s.total})
                </button>
              ))}
            </div>
          )}

          {/* Dissolve session — bulk end-of-term action, shown only for the Current session
              while it still has active leaders. Distinct from archiving one person who left early. */}
          {canManage && selectedSession === currentSessionLabel && currentSessionActiveCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Ending this session?</p>
                <p className="text-xs text-amber-700">Dissolving moves everyone currently serving to Past Leadership together, then you can add a new set of leaders under a new session.</p>
              </div>
              <button
                onClick={openDissolveModal}
                disabled={leaderBusy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                <GraduationCap className="h-3.5 w-3.5" /> Dissolve session
              </button>
            </div>
          )}

          {/* Certificates directory for the session being viewed — appears whenever this
              session has issued certificates (i.e. it was dissolved with certificates), so
              admins can grab the group "collect your certificate" link anytime later. */}
          {canManage && leaders.some((l) => l.certificate) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-indigo-900">
                  Certificates issued for this session ({leaders.filter((l) => l.certificate).length})
                </p>
                <p className="text-xs text-indigo-700">One public link for the whole set — each person finds their name and downloads their own certificate. No account needed.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => void copySessionCertificatesLink()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Copy className="h-3.5 w-3.5" /> {copiedSessionLink ? 'Copied!' : 'Copy certificates link'}
                </button>
                <a
                  href={`/communities/${community.slug}/leaders/certificates?session=${encodeURIComponent(selectedSession === NO_SESSION_LABEL ? '' : selectedSession ?? '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              </div>
            </div>
          )}

          {/* Roster — scoped server-side to whichever session tab is selected (archived members of that session still appear, flagged below) */}
          {leadersLoading ? (
            <div className="mt-6 flex justify-center">
              <LogoSpinner />
            </div>
          ) : leaders.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {leaders.map((leader) => (
                <button
                  key={leader.id}
                  onClick={() => setViewLeader(leader)}
                  className="group relative flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5 text-left transition hover:border-indigo-200 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
                >
                  <MemberAvatar fullName={leader.name} avatar={leader.photo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{leader.name}</p>
                      {leader.linkedUser && (
                        <span title="Has a GuildOS account" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                          <BadgeCheck className="h-3 w-3" /> On GuildOS
                        </span>
                      )}
                      {leader.status === 'ARCHIVED' && (
                        <span title="Archived — left the post before their session ended" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          Archived
                        </span>
                      )}
                      {/* "Past" = completed their term: either explicitly dissolved (status PAST), or
                          simply belonging to an earlier session than the current one — belt and braces
                          so stale ACTIVE rows in old sessions still read correctly. */}
                      {(leader.status === 'PAST' || (leader.status === 'ACTIVE' && currentSessionLabel !== null && leader.session !== currentSessionLabel)) && (
                        <span title="Past — served in an earlier session" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-800">
                          Past
                        </span>
                      )}
                    </div>
                    {(leader.title || leader.session) && (
                      <p className="truncate text-xs font-medium text-indigo-600">
                        {leader.title}
                        {leader.title && leader.session ? ' · ' : ''}
                        {leader.session}
                      </p>
                    )}
                    {leader.bio && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{leader.bio}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <LeaderCardAction
                        onClick={(e) => { e.stopPropagation(); openEditLeader(leader); }}
                        title="Edit leader"
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:border-indigo-200 hover:text-indigo-600"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </LeaderCardAction>
                      {leader.status !== 'ACTIVE' ? (
                        <LeaderCardAction
                          onClick={(e) => { e.stopPropagation(); void handleRestoreLeader(leader.id); }}
                          title="Restore to active"
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:border-emerald-200 hover:text-emerald-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </LeaderCardAction>
                      ) : (
                        <LeaderCardAction
                          onClick={(e) => { e.stopPropagation(); void handleArchiveLeader(leader.id); }}
                          title="Archive (left the post early)"
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:border-amber-200 hover:text-amber-600"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </LeaderCardAction>
                      )}
                      <LeaderCardAction
                        onClick={(e) => { e.stopPropagation(); void handleRemoveLeader(leader.id); }}
                        title="Delete permanently"
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </LeaderCardAction>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedSession === null
                  ? 'No leaders listed yet.'
                  : selectedSession === currentSessionLabel
                    ? 'No leaders listed for the current session yet.'
                    : `No leaders found for ${selectedSession}.`}
              </p>
              {canManage && (
                <button
                  onClick={openAddLeader}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add your first leader
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {viewLeader ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setViewLeader(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <MemberAvatar fullName={viewLeader.name} avatar={viewLeader.photo} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900 dark:text-slate-100">{viewLeader.name}</p>
                  {(viewLeader.title || viewLeader.session) && (
                    <p className="truncate text-xs font-medium text-indigo-600">
                      {viewLeader.title}
                      {viewLeader.title && viewLeader.session ? ' · ' : ''}
                      {viewLeader.session}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setViewLeader(null)} className="shrink-0 rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            {viewLeader.linkedUser && (
              <a
                href={`/u/${viewLeader.linkedUser.username}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
              >
                <BadgeCheck className="h-3.5 w-3.5" /> View GuildOS profile
              </a>
            )}
            {(viewLeader.department || viewLeader.level || viewLeader.phone) && (
              <div className="mt-4 space-y-1 rounded-2xl bg-slate-50 dark:bg-slate-900 px-3.5 py-3 text-sm">
                {viewLeader.department && (
                  <p className="flex justify-between gap-3"><span className="text-slate-400 dark:text-slate-500">Department</span><span className="font-medium text-slate-700 dark:text-slate-300">{viewLeader.department}</span></p>
                )}
                {viewLeader.level && (
                  <p className="flex justify-between gap-3"><span className="text-slate-400 dark:text-slate-500">Level</span><span className="font-medium text-slate-700 dark:text-slate-300">{viewLeader.level}</span></p>
                )}
                {viewLeader.phone && (
                  <p className="flex justify-between gap-3"><span className="text-slate-400 dark:text-slate-500">Phone</span><a href={`tel:${viewLeader.phone}`} className="font-medium text-indigo-600 hover:underline">{viewLeader.phone}</a></p>
                )}
              </div>
            )}
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{viewLeader.bio || 'No bio added yet.'}</p>

            {/* End-of-term certificate reference — admins can copy the verification link any
                time (e.g. to re-send it to a past exco) without re-running a dissolve. */}
            {canManage && viewLeader.certificate && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5">
                <GraduationCap className={`h-4 w-4 shrink-0 ${viewLeader.certificate.status === 'REVOKED' ? 'text-rose-400' : 'text-indigo-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Leadership certificate
                    {viewLeader.certificate.status === 'REVOKED' && <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 ring-1 ring-rose-200">Revoked</span>}
                  </p>
                  <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{viewLeader.certificate.serial}</p>
                </div>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(viewLeader.certificate!.verificationUrl).then(() => {
                      setCopiedSerial(viewLeader.certificate!.serial);
                      setTimeout(() => setCopiedSerial(''), 2000);
                    }).catch(() => undefined);
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="h-3 w-3" /> {copiedSerial === viewLeader.certificate.serial ? 'Copied' : 'Copy link'}
                </button>
                {viewLeader.phone ? (
                  <a
                    href={waCertificateLink(viewLeader.phone, viewLeader.name, community?.name ?? 'your community', viewLeader.certificate.verificationUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Send via WhatsApp"
                    className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <a
                  href={viewLeader.certificate.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open certificate"
                  className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {/* "Issue anyway": archived (left early) or skipped PAST leaders get no certificate at
                dissolve by default — this is the explicit per-person exception for partial service. */}
            {canManage && !viewLeader.certificate && viewLeader.status !== 'ACTIVE' && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 px-3.5 py-2.5">
                <GraduationCap className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                <p className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
                  {viewLeader.status === 'ARCHIVED' ? 'Left before the session ended — no certificate was issued.' : 'No certificate was issued for this leader.'}
                </p>
                <button
                  disabled={issueCertBusy}
                  onClick={() => {
                    void (async () => {
                      if (!community) return;
                      const confirmed = await confirmDialog({
                        title: `Issue a certificate to ${viewLeader.name}?`,
                        message: 'They will receive a verified Certificate of Leadership (GuildOS standard design) with its own serial and public verification page.',
                        confirmLabel: 'Issue certificate',
                      });
                      if (!confirmed) return;
                      try {
                        setIssueCertBusy(true);
                        const { certificate } = await issueLeaderCertificate(community._id, viewLeader.id);
                        setViewLeader({ ...viewLeader, certificate: { serial: certificate.serial, status: 'VERIFIED', verificationUrl: certificate.verificationUrl } });
                        await refreshLeaders();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Unable to issue certificate');
                      } finally {
                        setIssueCertBusy(false);
                      }
                    })();
                  }}
                  className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {issueCertBusy ? 'Issuing…' : 'Issue anyway'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {leaderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setLeaderModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{editingLeaderId ? 'Edit leader' : 'Add leader'}</h3>
              <button onClick={() => setLeaderModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">List anyone on your leadership team — they don't need a GuildOS account.</p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                {leaderPhotoPreview ? (
                  <button
                    type="button"
                    onClick={() => setPhotoLightbox(leaderPhotoPreview)}
                    title="Click to preview"
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-slate-800"
                  >
                    <img src={leaderPhotoPreview} alt="" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-300">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
                <div className="flex flex-col items-start gap-1">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Camera className="h-3.5 w-3.5" /> {leaderPhotoPreview ? 'Change photo' : 'Add photo (optional)'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLeaderPhotoFile(file);
                        setLeaderPhotoCleared(false);
                        setLeaderPhotoFromAvatar('');
                        setLeaderPhotoPreview(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                  {leaderPhotoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setLeaderPhotoFile(null);
                        setLeaderPhotoPreview('');
                        setLeaderPhotoFromAvatar('');
                        setLeaderPhotoCleared(true);
                      }}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              {/* Suggest reusing the tagged GuildOS account's own profile picture when no photo is set yet. */}
              {leaderLinkedUser?.avatar && !leaderPhotoPreview && (
                <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setPhotoLightbox(resolveAvatarUrl(leaderLinkedUser.avatar))}
                    title="Click to preview"
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-sky-200"
                  >
                    <img src={resolveAvatarUrl(leaderLinkedUser.avatar)} alt="" className="h-full w-full object-cover" />
                  </button>
                  <p className="flex-1 text-xs text-sky-800">Use {leaderLinkedUser.fullName.split(' ')[0]}'s GuildOS profile picture as their photo?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLeaderPhotoFromAvatar(leaderLinkedUser.avatar);
                      setLeaderPhotoFile(null);
                      setLeaderPhotoCleared(false);
                      setLeaderPhotoPreview(resolveAvatarUrl(leaderLinkedUser.avatar));
                    }}
                    className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                  >
                    Use it
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Name *</label>
                <input
                  type="text"
                  value={leaderForm.name}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, name: e.target.value.slice(0, 120) }))}
                  placeholder="e.g. Amina Yusuf"
                  maxLength={120}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
                <input
                  type="text"
                  value={leaderForm.title}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, title: e.target.value.slice(0, 80) }))}
                  placeholder="e.g. Amirah, General Secretary, PRO"
                  maxLength={80}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Department</label>
                  <input
                    type="text"
                    value={leaderForm.department}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, department: e.target.value.slice(0, 80) }))}
                    placeholder="e.g. Mechatronics Engineering"
                    maxLength={80}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Level</label>
                  <input
                    type="text"
                    value={leaderForm.level}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, level: e.target.value.slice(0, 40) }))}
                    placeholder="e.g. 300 Level"
                    maxLength={40}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Phone number</label>
                <input
                  type="tel"
                  value={leaderForm.phone}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, phone: e.target.value.slice(0, 30) }))}
                  placeholder="e.g. +234 801 234 5678"
                  maxLength={30}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Session</label>
                  <input
                    type="text"
                    value={leaderForm.session}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, session: e.target.value.slice(0, 40) }))}
                    placeholder="e.g. 2026/2027"
                    maxLength={40}
                    list="leader-session-options"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <datalist id="leader-session-options">
                    {sessionSuggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {sessionSuggestions.length > 0 ? 'Re-use an existing session so leaders group together. ' : ''}Format: 2026/2027 (consecutive years, current session or later).
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Display order</label>
                  <input
                    type="number"
                    value={leaderForm.displayRank}
                    onChange={(e) => setLeaderForm((f) => ({ ...f, displayRank: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">About</label>
                <textarea
                  value={leaderForm.bio}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, bio: e.target.value.slice(0, 280) }))}
                  rows={3}
                  placeholder="A short bio — background, focus area, what they lead…"
                  maxLength={280}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">{leaderForm.bio.length}/280</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tag their GuildOS account (optional)</label>
                {leaderLinkedUser ? (
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                    <MemberAvatar fullName={leaderLinkedUser.fullName} avatar={leaderLinkedUser.avatar} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium text-sky-800">{leaderLinkedUser.fullName}</span>
                    <button type="button" onClick={() => setLeaderLinkedUser(null)} className="text-xs font-semibold text-sky-700 hover:underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={leaderSearchQuery}
                      onChange={(e) => void handleLeaderSearch(e.target.value)}
                      placeholder="Search by name…"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    {leaderSearchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
                        {leaderSearchResults.map((person) => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => {
                              setLeaderLinkedUser({ id: person.id, fullName: person.fullName, username: person.username, avatar: person.avatar });
                              setLeaderSearchQuery('');
                              setLeaderSearchResults([]);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <MemberAvatar fullName={person.fullName} avatar={person.avatar} size="sm" />
                            <span className="truncate">{person.fullName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {leaderError && <p className="text-xs font-medium text-rose-600">{leaderError}</p>}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void handleSaveLeader()}
                disabled={leaderBusy}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {leaderBusy ? 'Saving…' : editingLeaderId ? 'Save changes' : 'Add leader'}
              </button>
              <button
                onClick={() => setLeaderModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Import from document</h3>
              <button onClick={() => setImportModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {importStep === 'upload' ? (
              <div className="mt-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a nomination or appointment-letter PDF (e.g. a leadership list) and we'll pull out names, offices,
                  departments, levels and phone numbers for you to review before adding them.
                </p>
                {importError && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{importError}</div>
                )}
                <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                  <FileUp className="h-8 w-8 text-indigo-400" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {importBusy ? 'Reading document…' : 'Click to choose a PDF'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">PDF only, up to 10MB</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={importBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportUpload(file);
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {importError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{importError}</div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Session (applies to all rows) *</label>
                  <input
                    type="text"
                    value={importSession}
                    onChange={(e) => setImportSession(e.target.value.slice(0, 20))}
                    placeholder="e.g. 2026/2027"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{importRows.length} candidate{importRows.length === 1 ? '' : 's'} found — review and edit before adding</p>
                  {importRows.map((row) => (
                    <div key={row._rowId} className="grid grid-cols-12 gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                      <input
                        value={row.name}
                        onChange={(e) => updateImportRow(row._rowId, { name: e.target.value })}
                        placeholder="Name *"
                        className="col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                      />
                      <input
                        value={row.title}
                        onChange={(e) => updateImportRow(row._rowId, { title: e.target.value })}
                        placeholder="Office/Title"
                        className="col-span-3 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                      />
                      <input
                        value={row.department}
                        onChange={(e) => updateImportRow(row._rowId, { department: e.target.value })}
                        placeholder="Department"
                        className="col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                      />
                      <input
                        value={row.level}
                        onChange={(e) => updateImportRow(row._rowId, { level: e.target.value })}
                        placeholder="Level"
                        className="col-span-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                      />
                      <input
                        value={row.phone}
                        onChange={(e) => updateImportRow(row._rowId, { phone: e.target.value })}
                        placeholder="Phone"
                        className="col-span-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={() => removeImportRow(row._rowId)}
                        title="Remove row"
                        className="col-span-1 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => void handleCommitImport()}
                    disabled={importBusy || !importRows.length}
                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {importBusy ? 'Adding…' : `Create ${importRows.length} leader${importRows.length === 1 ? '' : 's'}`}
                  </button>
                  <button
                    onClick={() => setImportModalOpen(false)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {dissolveModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {dissolveResults ? 'Session dissolved — certificates issued' : `Dissolve ${currentSessionLabel}?`}
              </h3>
              <button onClick={() => setDissolveModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {dissolveResults ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Each outgoing leader received a verified Certificate of Leadership with its own serial and public
                  verification page. Leaders on GuildOS were notified automatically — share the links below with the rest.
                </p>
                {/* One link for the whole group — drop it in the WhatsApp/Telegram group chat and
                    everyone (account or not) finds their own name and downloads their certificate. */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5">
                  <p className="text-xs font-semibold text-indigo-900">Share with everyone at once</p>
                  <p className="mt-0.5 text-[11px] text-indigo-700">One public link for the whole set — each person finds their name and downloads their own certificate. No account needed.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void copyShareAllLink()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                    >
                      <Copy className="h-3 w-3" /> {copiedShareLink ? 'Copied!' : 'Copy group link'}
                    </button>
                    <a
                      href={sessionShareLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      <ExternalLink className="h-3 w-3" /> Preview page
                    </a>
                  </div>
                </div>
                <div className="space-y-2">
                  {dissolveResults.map((cert) => (
                    <div key={cert.serial} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                      <GraduationCap className="h-4 w-4 shrink-0 text-indigo-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{cert.name}</p>
                        <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {cert.serial}
                          {!cert.hasAccount && <span className="ml-1.5 text-amber-600">· no GuildOS account — share the link with them</span>}
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
                          href={waCertificateLink(cert.phone, cert.name, community?.name ?? 'your community', cert.verificationUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send via WhatsApp"
                          className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
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
                  onClick={() => setDissolveModalOpen(false)}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Everyone currently serving will be marked as having completed their term and move to Past Leadership
                  together — different from archiving one person who left early. You can then add a new set of leaders
                  under a new session.
                </p>

                {dissolveError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{dissolveError}</div>
                )}

                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Issue end-of-term certificates?</p>
                <div className="space-y-2">
                  <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${dissolveCertMode === 'NONE' ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="dissolve-cert" checked={dissolveCertMode === 'NONE'} onChange={() => setDissolveCertMode('NONE')} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">No certificates</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Just move the session to Past Leadership.</span>
                    </span>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${dissolveCertMode === 'STANDARD' ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="dissolve-cert" checked={dissolveCertMode === 'STANDARD'} onChange={() => setDissolveCertMode('STANDARD')} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">GuildOS certificate</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">A GuildOS-designed Certificate of Leadership for each outgoing leader — verified serial, QR code and public verification page included.</span>
                    </span>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${dissolveCertMode === 'CUSTOM' ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="dissolve-cert" checked={dissolveCertMode === 'CUSTOM'} onChange={() => setDissolveCertMode('CUSTOM')} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Your own design</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Upload your certificate as an image — each leader's name is drawn on it, and it still gets a verified serial + QR page.</span>
                      {dissolveCertMode === 'CUSTOM' && (
                        <span className="mt-2 block">
                          {dissolveTemplatePreview ? (
                            <span className="flex items-center gap-2">
                              <img src={dissolveTemplatePreview} alt="" className="h-14 w-auto rounded-lg border border-slate-200 dark:border-slate-800 object-contain" />
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setDissolveTemplateFile(null); setDissolveTemplatePreview(''); }}
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
                                  setDissolveTemplateFile(file);
                                  setDissolveTemplatePreview(URL.createObjectURL(file));
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
                {dissolveCertMode === 'CUSTOM' && dissolveTemplatePreview && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 p-3">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Position the name on your design</p>
                    <div className="relative mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" style={{ containerType: 'size' } as React.CSSProperties}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dissolveTemplatePreview} alt="Certificate template" className="block w-full" />
                      <span
                        style={{
                          position: 'absolute',
                          left: `${dissolveNamePlacement.x}%`,
                          top: `${dissolveNamePlacement.y}%`,
                          transform: `translate(${dissolveNamePlacement.align === 'center' ? '-50%' : dissolveNamePlacement.align === 'right' ? '-100%' : '0'}, -50%)`,
                          color: dissolveNamePlacement.color,
                          fontSize: `${dissolveNamePlacement.fontSize}cqh`,
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
                        Horizontal ({dissolveNamePlacement.x}%)
                        <input type="range" min={0} max={100} value={dissolveNamePlacement.x} onChange={(e) => setDissolveNamePlacement((p) => ({ ...p, x: Number(e.target.value) }))} className="w-full" />
                      </label>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Vertical ({dissolveNamePlacement.y}%)
                        <input type="range" min={0} max={100} value={dissolveNamePlacement.y} onChange={(e) => setDissolveNamePlacement((p) => ({ ...p, y: Number(e.target.value) }))} className="w-full" />
                      </label>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Font size ({dissolveNamePlacement.fontSize}% of height)
                        <input type="range" min={2} max={20} value={dissolveNamePlacement.fontSize} onChange={(e) => setDissolveNamePlacement((p) => ({ ...p, fontSize: Number(e.target.value) }))} className="w-full" />
                      </label>
                      <span className="flex items-end gap-3">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Colour
                          <input type="color" value={dissolveNamePlacement.color} onChange={(e) => setDissolveNamePlacement((p) => ({ ...p, color: e.target.value }))} className="block h-8 w-12 cursor-pointer rounded border border-slate-200 dark:border-slate-800" />
                        </label>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Align
                          <SelectMenu
                            aria-label="Text align"
                            className="mt-0.5 w-28"
                            size="sm"
                            value={dissolveNamePlacement.align}
                            onChange={(v) => setDissolveNamePlacement((p) => ({ ...p, align: v as 'left' | 'center' | 'right' }))}
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
                {dissolveCertMode === 'STANDARD' && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 p-3">
                    {communityIsPremium ? (
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Customize the certificate</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Certificate title</label>
                            <input
                              type="text"
                              value={certTitle}
                              onChange={(e) => setCertTitle(e.target.value.slice(0, 60))}
                              placeholder="Certificate of Leadership"
                              className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Presentation line</label>
                            <input
                              type="text"
                              value={certPresentation}
                              onChange={(e) => setCertPresentation(e.target.value.slice(0, 90))}
                              placeholder="for serving as"
                              className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Message (optional)</label>
                          <input
                            type="text"
                            value={certMessage}
                            onChange={(e) => setCertMessage(e.target.value.slice(0, 260))}
                            placeholder="e.g. With gratitude for a year of dedicated service."
                            className="mt-0.5 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Design</label>
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
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Background</label>
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
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Font</label>
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
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Accent</label>
                            <input type="color" value={certAccent} onChange={(e) => setCertAccent(e.target.value)} className="mt-0.5 h-7 w-full cursor-pointer rounded-lg border border-slate-200 dark:border-slate-800" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700">
                        <span className="font-semibold">Premium customization:</span> upgrade to change the wording, colours and fonts.
                        Free communities get the polished GuildOS default below.
                      </p>
                    )}

                    {/* Signatures — one for everyone, up to three with premium (event-certificate parity). */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Signatures {communityIsPremium ? '(up to 3)' : '(1 included — premium unlocks 3)'}
                        </p>
                        {certSignatories.length < maxSignatures && (
                          <button
                            type="button"
                            onClick={() => setCertSignatories((rows) => [...rows, { name: '', title: '', image: '', preview: '' }])}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-white dark:hover:bg-slate-800"
                          >
                            <Plus className="h-3 w-3" /> Add signature
                          </button>
                        )}
                      </div>
                      {certSignatories.length > 0 && (
                        <div className="mt-1.5 space-y-1.5">
                          {certSignatories.map((sig, i) => (
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
                                className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${sig.image ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
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
                                onClick={() => setCertSignatories((rows) => rows.filter((_, idx) => idx !== i))}
                                title="Remove signature"
                                className="shrink-0 rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Preview</p>
                      <canvas ref={certPreviewRef} width={1876} height={1450} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
                    </div>
                  </div>
                )}

                {/* Re-issue safety net: if some of these leaders already hold a certificate
                    (e.g. from an earlier dissolve of this same session), refresh those to this
                    design too — same serial and link, so nothing already shared breaks. */}
                {dissolveCertMode !== 'NONE' && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={dissolveReissue}
                      onChange={(e) => setDissolveReissue(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Apply this design to already-issued certificates too</span>
                      <br />If any of these leaders already received a certificate before, update it to this design — their serial and
                      verification link stay the same.
                    </span>
                  </label>
                )}

                {/* Handover, outgoing half: end-of-term should end management PERMISSIONS too,
                    or the old excos keep full control of the community forever. */}
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={dissolveDemote}
                    onChange={(e) => setDissolveDemote(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Step outgoing leaders down to Member (recommended)</span>
                    <br />Leaders with GuildOS accounts lose their management roles as their term ends — the founder and you are never
                    touched. Use “Hand over roles” afterwards to empower the new session’s leaders.
                  </span>
                </label>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => void handleConfirmDissolve()}
                    disabled={dissolveBusy}
                    className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {dissolveBusy ? 'Dissolving…' : dissolveCertMode === 'NONE' ? 'Dissolve session' : 'Dissolve & issue certificates'}
                  </button>
                  <button
                    onClick={() => setDissolveModalOpen(false)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {handoverModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {handoverResult ? 'Handover complete' : 'Hand over management roles'}
              </h3>
              <button onClick={() => setHandoverModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {handoverResult ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {handoverResult.assigned} role{handoverResult.assigned === 1 ? '' : 's'} assigned — each appointee was notified and now
                  has real management access.
                </p>
                <div className="space-y-2">
                  {handoverResult.results.map((r) => (
                    <div key={r.leaderId} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${r.status === 'ASSIGNED' ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
                      <UserCog className={`h-4 w-4 shrink-0 ${r.status === 'ASSIGNED' ? 'text-emerald-600' : 'text-rose-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{r.name || 'Unknown'}</p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {r.status === 'ASSIGNED' ? `Now ${r.role.replace('_', ' ')}` : r.error}
                        </p>
                      </div>
                    </div>
                  ))}
                  {handoverOwnerLeaderId && (
                    <p className={`text-xs ${handoverResult.ownershipTransferred ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {handoverResult.ownershipTransferred
                        ? 'Ownership transferred — the new founder now controls the community.'
                        : `Ownership transfer failed: ${handoverResult.ownershipError}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setHandoverModalOpen(false)}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The leadership roster is just a public listing — this gives the listed leaders <span className="font-semibold">real management
                  roles</span> on GuildOS. Only leaders with linked GuildOS accounts can receive one (they'll be added as members automatically
                  if they aren't yet). You can't assign a role at or above your own rank.
                </p>

                {handoverError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{handoverError}</div>
                )}

                {(() => {
                  const linkable = leaders.filter((l) => l.linkedUser);
                  if (!linkable.length) {
                    return <p className="rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">None of the leaders in this view has a linked GuildOS account yet — tag their accounts first (edit a leader → "Tag their GuildOS account").</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {linkable.map((leader) => (
                        <div key={leader.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                          <MemberAvatar fullName={leader.name} avatar={leader.photo} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{leader.name}</p>
                            {leader.title && <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{leader.title}</p>}
                          </div>
                          <SelectMenu
                            aria-label="Role change"
                            className="w-40 shrink-0"
                            size="sm"
                            value={handoverRoles[leader.id] ?? ''}
                            onChange={(v) => setHandoverRoles((r) => ({ ...r, [leader.id]: v }))}
                            placeholder="No role change"
                            options={[
                              { value: '', label: 'No role change' },
                              { value: 'PRESIDENT', label: 'President' },
                              { value: 'VICE_PRESIDENT', label: 'Vice President' },
                              { value: 'SECRETARY', label: 'Secretary' },
                              { value: 'TREASURER', label: 'Treasurer' },
                              { value: 'COORDINATOR', label: 'Coordinator' },
                            ]}
                          />
                        </div>
                      ))}

                      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2.5">
                        <label className="text-[11px] font-semibold text-violet-800">Transfer ownership (founder only, optional)</label>
                        <SelectMenu
                          aria-label="Transfer ownership"
                          className="mt-1"
                          size="sm"
                          value={handoverOwnerLeaderId}
                          onChange={setHandoverOwnerLeaderId}
                          placeholder="Keep current owner"
                          options={[{ value: '', label: 'Keep current owner' }, ...linkable.map((l) => ({ value: l.id, label: l.name }))]}
                        />
                        <p className="mt-1 text-[10px] text-violet-600">You'll stay on as a leadership member; the successor becomes the founder.</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => void handleConfirmHandover()}
                    disabled={handoverBusy}
                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {handoverBusy ? 'Assigning…' : 'Assign roles'}
                  </button>
                  <button
                    onClick={() => setHandoverModalOpen(false)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {photoLightbox ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPhotoLightbox('')}>
          <button
            onClick={(e) => { e.stopPropagation(); setPhotoLightbox(''); }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Close image preview"
          >
            <XCircle className="h-5 w-5" />
          </button>
          <img
            src={photoLightbox}
            alt=""
            className="max-h-[85vh] w-auto max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
