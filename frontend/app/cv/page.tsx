'use client';

import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  deleteCv,
  generateCv,
  getCv,
  getMyCvs,
  type CvDetail,
  type CvMode,
  type CvSummary,
  type CvTemplate,
  type ProjectInput,
} from '../../components/guildos/cv-api';
import { CvDocumentView } from '../../components/guildos/cv/cv-document-view';
import { StudentNav } from '../../components/guildos/student-nav';

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

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        const { cvs: mine } = await getMyCvs();
        setCvs(mine);
        if (mine.length) {
          const { cv } = await getCv(mine[0].cvId);
          setActive(cv);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open CV');
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

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10"><p className="text-slate-500">Loading…</p></main>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print"><StudentNav active="/cv" /></div>
      <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="no-print mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">AI Verifiable CV Builder</h1>
        <p className="text-sm text-slate-500">Turn your verified activities, leadership, and certificates into a professional, verifiable CV.</p>
      </header>

      {error ? <div className="no-print mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="no-print mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Controls */}
        <div className="no-print space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Template</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.value} onClick={() => setTemplate(t.value)} className={`rounded-xl border px-3 py-2 text-sm ${template === t.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700'}`}>{t.label}</button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Writing Mode</h2>
            <div className="mt-3 space-y-2">
              {MODES.map((m) => (
                <button key={m.value} onClick={() => setMode(m.value)} className={`block w-full rounded-xl border px-3 py-2 text-left text-sm ${mode === m.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700'}`}>
                  <span className="font-medium">{m.label}</span>
                  <span className={`block text-xs ${mode === m.value ? 'text-slate-200' : 'text-slate-500'}`}>{m.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Customization</h2>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={hideCertificates} onChange={(e) => setHideCertificates(e.target.checked)} /> Hide certificates</label>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={hideGuildScore} onChange={(e) => setHideGuildScore(e.target.checked)} /> Hide Guild Score</label>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Projects</h2>
            {projects.map((p, i) => (
              <div key={i} className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <span className="truncate font-medium text-slate-900">{p.name}</span>
                <button onClick={() => setProjects((list) => list.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">remove</button>
              </div>
            ))}
            <div className="mt-3 space-y-2">
              <input className="ev-input w-full" placeholder="Project name" value={projectDraft.name} onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })} />
              <input className="ev-input w-full" placeholder="Role (optional)" value={projectDraft.role} onChange={(e) => setProjectDraft({ ...projectDraft, role: e.target.value })} />
              <input className="ev-input w-full" placeholder="URL (optional)" value={projectDraft.url} onChange={(e) => setProjectDraft({ ...projectDraft, url: e.target.value })} />
              <textarea className="ev-input w-full" placeholder="Short description" value={projectDraft.description} onChange={(e) => setProjectDraft({ ...projectDraft, description: e.target.value })} />
              <button onClick={addProject} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">Add project</button>
            </div>
          </section>

          <button onClick={() => void handleGenerate()} disabled={busy} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
            {busy ? 'Generating…' : 'Generate CV'}
          </button>

          {cvs.length ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">My CVs</h2>
              <ul className="mt-3 space-y-2">
                {cvs.map((c) => (
                  <li key={c.cvId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <button onClick={() => void openCv(c.cvId)} className="min-w-0 text-left">
                      <span className="block truncate font-medium text-slate-900">{c.cvId}</span>
                      <span className="block text-xs text-slate-500">{c.template} · {c.mode}{c.aiGenerated ? ' · AI' : ''}</span>
                    </button>
                    <button onClick={() => void removeCv(c.cvId)} className="shrink-0 text-xs text-red-600 hover:underline">delete</button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Preview */}
        <div>
          {active ? (
            <>
              <div className="no-print mb-3 flex flex-wrap items-center gap-3">
                <button onClick={() => window.print()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Download / Print PDF</button>
                <a href={active.publicUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900">Open verification page</a>
                <button
                  onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}${active.publicUrl}`); setNotice('Verification link copied.'); }}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Copy verify link
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <CvDocumentView
                  content={active.content}
                  template={active.template}
                  cvId={active.cvId}
                  verificationId={active.verificationId}
                  hideCertificates={active.customization.hideCertificates}
                  hideGuildScore={active.customization.hideGuildScore}
                />
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Choose a template and mode, then generate your first verifiable CV.
            </div>
          )}
        </div>
      </div>
    </main>
    </div>
  );
}
