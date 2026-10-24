'use client';

import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  deleteCv,
  generateCv,
  getCv,
  getCvFreshness,
  getCvProjects,
  getMyCvs,
  downloadOwnerCvPdf,
  refreshCv,
  updateCvCustomization,
  type CvDetail,
  type CvFreshness,
  type CvMode,
  type CvSummary,
  type CvTemplate,
  type ProjectInput,
} from '../../components/guildos/cv-api';
import { CvDocumentView } from '../../components/guildos/cv/cv-document-view';
import {
  CV_SECTION_LABELS,
  buildLinkedInText,
  downloadCvAsDocx,
  downloadCvAsEuropassDocx,
  normalizeOrder,
  type CvSectionKey,
} from '../../components/guildos/cv/cv-export';
import { StudentNav } from '../../components/guildos/student-nav';
import { getReputationSummary, type ReputationSummary } from '../../components/guildos/reputation-api';
import { Award, CalendarCheck, Crown, FileText, Sparkles, Trophy, Users } from 'lucide-react';

const TEMPLATES: { value: CvTemplate; label: string }[] = [
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'MODERN', label: 'Modern' },
  { value: 'EXECUTIVE', label: 'Executive' },
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'TECHNICAL', label: 'Technical' },
];

const MODES: { value: CvMode; label: string; hint: string }[] = [
  { value: 'INTERNSHIP', label: 'Internship', hint: 'Internships & entry-level roles' },
  { value: 'SCHOLARSHIP', label: 'Scholarship', hint: 'Fellowships, scholarships, grants' },
  { value: 'LEADERSHIP', label: 'Leadership', hint: 'Leadership, volunteering, impact' },
  { value: 'TECHNICAL', label: 'Technical', hint: 'Projects, skills, certifications' },
];

export default function CvBuilderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [template, setTemplate] = useState<CvTemplate>('PROFESSIONAL');
  const [mode, setMode] = useState<CvMode>('INTERNSHIP');
  const [hideCertificates, setHideCertificates] = useState(false);
  const [hideGuildScore, setHideGuildScore] = useState(false);
  const [projects, setProjects] = useState<ProjectInput[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectInput>({ name: '', description: '', url: '', role: '' });

  const [cvs, setCvs] = useState<CvSummary[]>([]);
  const [active, setActive] = useState<CvDetail | null>(null);
  const [freshness, setFreshness] = useState<CvFreshness | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Drag-to-reorder state: the section key currently being dragged.
  const [dragKey, setDragKey] = useState<CvSectionKey | null>(null);
  // The verified record the CV is built from, shown before the first CV exists.
  const [record, setRecord] = useState<ReputationSummary | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        void getReputationSummary(user.id).then(setRecord).catch(() => setRecord(null));
        const [{ cvs: mine }, savedProjects] = await Promise.all([
          getMyCvs(),
          getCvProjects().catch(() => ({ projects: [] as ProjectInput[] })),
        ]);
        setCvs(mine);
        if (savedProjects.projects.length) setProjects(savedProjects.projects);
        if (mine.length) {
          const { cv } = await getCv(mine[0].cvId);
          setActive(cv);
          getCvFreshness(cv.cvId).then(setFreshness).catch(() => setFreshness(null));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the CV builder');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function addProject() {
    if (!projectDraft.name.trim()) return;
    setProjects((p) => [...p, projectDraft]);
    setProjectDraft({ name: '', description: '', url: '', role: '' });
  }

  async function handleGenerate() {
    try {
      setBusy(true);
      setError('');
      setNotice('');
      const result = await generateCv({
        template,
        mode,
        customization: { hideCertificates, hideGuildScore, sectionOrder: [] },
        projects,
      });
      const [{ cvs: mine }, { cv }] = await Promise.all([getMyCvs(), getCv(result.cvId)]);
      setCvs(mine);
      setActive(cv);
      setFreshness(await getCvFreshness(cv.cvId).catch(() => null));
      setNotice(`Generated ${result.cvId}${result.aiGenerated ? ' with AI' : ''}. Verify link: ${result.publicUrl}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate CV');
    } finally {
      setBusy(false);
    }
  }

  async function openCv(cvId: string) {
    try {
      const { cv } = await getCv(cvId);
      setActive(cv);
      setFreshness(await getCvFreshness(cvId).catch(() => null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open CV');
    }
  }

  async function handleRefresh() {
    if (!active) return;
    try {
      setRefreshing(true);
      setError('');
      await refreshCv(active.cvId);
      const [{ cvs: mine }, { cv }] = await Promise.all([getMyCvs(), getCv(active.cvId)]);
      setCvs(mine);
      setActive(cv);
      setFreshness(await getCvFreshness(cv.cvId).catch(() => null));
      setNotice('CV updated with your latest reputation, certificates and skills. The link stays the same.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh CV');
    } finally {
      setRefreshing(false);
    }
  }

  async function removeCv(cvId: string) {
    if (!(await confirmDialog({ title: 'Delete this CV?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await deleteCv(cvId);
      setCvs((list) => list.filter((c) => c.cvId !== cvId));
      if (active?.cvId === cvId) setActive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete CV');
    }
  }

  /** Persist a new section order after a drop (optimistic; reverts on failure). */
  async function reorderSections(from: CvSectionKey, to: CvSectionKey) {
    if (!active || from === to) return;
    const order = normalizeOrder(active.customization.sectionOrder);
    const next = order.filter((k) => k !== from);
    next.splice(next.indexOf(to), 0, from);
    const previous = active;
    setActive({ ...active, customization: { ...active.customization, sectionOrder: next } });
    try {
      await updateCvCustomization(active.cvId, { sectionOrder: next });
    } catch (err) {
      setActive(previous);
      setError(err instanceof Error ? err.message : 'Unable to save the section order');
    }
  }

  function verifyUrlFor(cv: CvDetail) {
    return `${window.location.origin}/cv/verify/${cv.verificationId}`;
  }

  function handleCopyLinkedIn() {
    if (!active) return;
    void navigator.clipboard?.writeText(buildLinkedInText(active.content, verifyUrlFor(active))).then(() => {
      setNotice('LinkedIn-ready text copied. Paste each block into the matching profile section.');
    });
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Loading your record…</p></main>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="no-print"><StudentNav active="/cv" /></div>
      <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Your CV</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[1.75rem]">A CV recruiters can verify</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Built from your verified record. Every certificate, event and role links to proof anyone can check.</p>
        </div>
        <button onClick={() => void handleGenerate()} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">
          <Sparkles className="h-4 w-4" /> {busy ? 'Generating…' : active ? 'Generate a new version' : 'Generate my CV'}
        </button>
      </header>

      {error ? <div className="no-print mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="no-print mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Controls */}
        <div className="no-print min-w-0 space-y-5">
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Template</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.value} onClick={() => setTemplate(t.value)} className={`rounded-xl border px-3 py-2 text-sm ${template === t.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>{t.label}</button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Writing Mode</h2>
            <div className="mt-3 space-y-2">
              {MODES.map((m) => (
                <button key={m.value} onClick={() => setMode(m.value)} className={`block w-full rounded-xl border px-3 py-2 text-left text-sm ${mode === m.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>
                  <span className="font-medium">{m.label}</span>
                  <span className={`block text-xs ${mode === m.value ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>{m.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Customization</h2>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={hideCertificates} onChange={(e) => setHideCertificates(e.target.checked)} /> Hide certificates</label>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={hideGuildScore} onChange={(e) => setHideGuildScore(e.target.checked)} /> Hide Guild Score</label>
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Projects</h2>
            {projects.map((p, i) => (
              <div key={i} className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                <span className="truncate font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                <button onClick={() => setProjects((list) => list.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">remove</button>
              </div>
            ))}
            <div className="mt-3 space-y-2">
              <input className="ev-input w-full" placeholder="Project name" value={projectDraft.name} onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })} />
              <input className="ev-input w-full" placeholder="Role (optional)" value={projectDraft.role} onChange={(e) => setProjectDraft({ ...projectDraft, role: e.target.value })} />
              <input className="ev-input w-full" placeholder="URL (optional)" value={projectDraft.url} onChange={(e) => setProjectDraft({ ...projectDraft, url: e.target.value })} />
              <textarea className="ev-input w-full" placeholder="Short description" value={projectDraft.description} onChange={(e) => setProjectDraft({ ...projectDraft, description: e.target.value })} />
              <button onClick={addProject} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Add project</button>
            </div>
          </section>

          <button onClick={() => void handleGenerate()} disabled={busy} className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Generating…' : active ? 'Generate a new version' : 'Generate my CV'}
          </button>

          {cvs.length ? (
            <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">My CVs</h2>
              <ul className="mt-3 space-y-2">
                {cvs.map((c) => (
                  <li key={c.cvId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <button onClick={() => void openCv(c.cvId)} className="min-w-0 text-left">
                      <span className="block truncate font-medium capitalize text-slate-900 dark:text-slate-100">{c.template.toLowerCase()} · {c.mode.toLowerCase()}{active?.cvId === c.cvId ? <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">open</span> : null}</span>
                      <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{c.cvId}{c.aiGenerated ? ' · AI-written' : ''}</span>
                      <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                        {c.refreshedAt ? `Updated ${new Date(c.refreshedAt).toLocaleDateString()}` : `Generated ${new Date(c.createdAt).toLocaleDateString()}`}
                      </span>
                    </button>
                    <button onClick={() => void removeCv(c.cvId)} className="shrink-0 text-xs text-red-600 hover:underline">delete</button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Preview — min-w-0 so the CV document (which has its own intrinsic width)
            can't inflate the shared grid track and blow out the page on mobile. */}
        <div className="min-w-0">
          {active ? (
            <>
              {freshness?.stale ? (
                <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
                  <span>Your reputation or activity has changed since this CV was generated. Refresh to bring it up to date. The link stays the same, so anything you've already shared keeps working.</span>
                  <button onClick={() => void handleRefresh()} disabled={refreshing} className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                    {refreshing ? 'Refreshing…' : 'Refresh now'}
                  </button>
                </div>
              ) : null}
              <div className="no-print mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => { if (active) void downloadOwnerCvPdf(active.cvId).catch((err) => setError(err instanceof Error ? err.message : 'Unable to download PDF')); }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}${active.publicUrl}`); setNotice('Verification link copied. Paste it in applications so recruiters can check your CV.'); }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Copy verify link
                  </button>
                  <button
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                    title="Rebuild this CV from your current reputation, certificates, skills and credentials, keeping the same link"
                  >
                    {refreshing ? 'Refreshing…' : 'Refresh with latest'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">More</span>
                  <button onClick={() => window.print()} className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Print</button>
                  <button onClick={() => downloadCvAsDocx(active.content, active.cvId, verifyUrlFor(active), active.customization.sectionOrder)} className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Word (DOCX)</button>
                  <button onClick={() => downloadCvAsEuropassDocx(active.content, active.cvId, verifyUrlFor(active))} className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" title="Europass section names and ordering, ready for the Europass editor">Europass DOCX</button>
                  <button onClick={handleCopyLinkedIn} className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" title="Copies About / Experience / Education / Certifications blocks formatted for LinkedIn">Copy for LinkedIn</button>
                  <a href={active.publicUrl} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Open verification page</a>
                </div>
              </div>
              <p className="no-print mb-3 text-xs text-slate-400 dark:text-slate-500">
                {active.refreshedAt ? `Last refreshed ${new Date(active.refreshedAt).toLocaleString()}${active.refreshCount ? ` (${active.refreshCount}×)` : ''}` : `Generated ${new Date(active.createdAt).toLocaleString()}`}
              </p>
              <div className="no-print mb-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Arrange sections (drag to reorder)</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {normalizeOrder(active.customization.sectionOrder).map((key) => (
                    <span
                      key={key}
                      draggable
                      onDragStart={() => setDragKey(key)}
                      onDragEnd={() => setDragKey(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (dragKey) void reorderSections(dragKey, key); setDragKey(null); }}
                      className={`cursor-grab select-none rounded-full border px-3 py-1.5 text-xs font-medium active:cursor-grabbing ${dragKey === key ? 'border-indigo-400 bg-indigo-50 text-indigo-700 opacity-60 dark:bg-indigo-500/15 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-300'}`}
                    >
                      ⋮⋮ {CV_SECTION_LABELS[key]}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">The preview, print/PDF and DOCX export all follow this order. Saved automatically.</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <CvDocumentView
                  content={active.content}
                  template={active.template}
                  cvId={active.cvId}
                  verificationId={active.verificationId}
                  hideCertificates={active.customization.hideCertificates}
                  hideGuildScore={active.customization.hideGuildScore}
                  sectionOrder={active.customization.sectionOrder}
                />
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><FileText className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">What goes into your CV</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pulled from your verified GuildOS record. You don’t type any of it.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Guild Score', value: record?.reputation.guildScore ?? 0, icon: <Trophy className="h-4 w-4" /> },
                  { label: 'Verified certificates', value: record?.stats.certificatesEarned ?? 0, icon: <Award className="h-4 w-4" /> },
                  { label: 'Events attended', value: record?.stats.eventsCompleted ?? 0, icon: <CalendarCheck className="h-4 w-4" /> },
                  { label: 'Leadership roles', value: record?.stats.leadershipRoles ?? 0, icon: <Crown className="h-4 w-4" /> },
                  { label: 'Communities', value: record?.stats.communitiesJoined ?? 0, icon: <Users className="h-4 w-4" /> },
                  { label: 'Hackathon project points', value: record?.reputation.projectScore ?? 0, icon: <Sparkles className="h-4 w-4" /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">{item.icon} {item.label}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-slate-950 dark:text-white">{item.value.toLocaleString('en-NG')}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Plus your skills, interests and any projects you add on the left. Pick a template and a writing mode, then generate. You can make new versions any time, and each one gets its own verification link.</p>
              <button onClick={() => void handleGenerate()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> {busy ? 'Generating…' : 'Generate my CV'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
    </div>
  );
}
