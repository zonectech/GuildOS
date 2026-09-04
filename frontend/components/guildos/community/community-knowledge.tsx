'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Library,
  Link2,
  Map as MapIcon,
  Package,
  Pencil,
  Plus,
  Rocket,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';

import {
  KNOWLEDGE_CATEGORIES,
  createKnowledgeResource,
  createKnowledgeStarterPack,
  deleteKnowledgeResource,
  getKnowledgeResource,
  listCommunityKnowledge,
  resolveKnowledgeFileUrl,
  toggleKnowledgeBookmark,
  trackKnowledgeDownload,
  updateKnowledgeResource,
  uploadKnowledgeFile,
  type KnowledgeCategory,
  type KnowledgeInput,
  type KnowledgeResource,
  type KnowledgeType,
} from '../knowledge-api';
import { renderMarkdown } from '../markdown';
import { FormattedTextEditor } from '../ui/formatted-text-editor';
import { SelectMenu } from '../ui/select-menu';

const CATEGORY_META = Object.fromEntries(KNOWLEDGE_CATEGORIES.map((c) => [c.value, c])) as Record<
  KnowledgeCategory,
  { value: KnowledgeCategory; label: string }
>;

const CATEGORY_ICONS: Record<KnowledgeCategory, ReactNode> = {
  GETTING_STARTED: <Rocket className="h-4 w-4 text-indigo-500" />,
  TUTORIAL: <BookOpen className="h-4 w-4 text-emerald-500" />,
  DOCUMENTATION: <FileText className="h-4 w-4 text-sky-500" />,
  ROADMAP: <MapIcon className="h-4 w-4 text-amber-500" />,
  OPPORTUNITY: <Target className="h-4 w-4 text-rose-500" />,
  PAST_QUESTIONS: <ClipboardList className="h-4 w-4 text-violet-500" />,
  OTHER: <Package className="h-4 w-4 text-slate-400 dark:text-slate-500" />,
};

const TYPE_META: Record<KnowledgeType, { label: string; icon: ReactNode }> = {
  ARTICLE: { label: 'Article', icon: <BookOpen className="h-3.5 w-3.5" /> },
  LINK: { label: 'Link', icon: <Link2 className="h-3.5 w-3.5" /> },
  FILE: { label: 'File', icon: <FileText className="h-3.5 w-3.5" /> },
};

/** Minimal, safe markdown rendering: headings, bold, inline code, lists, links, paragraphs. */
// (shared renderer lives in ../markdown)

type EditorState = {
  id?: string;
  type: KnowledgeType;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  url: string;
  file: string;
  fileName: string;
};

const EMPTY_EDITOR: EditorState = {
  type: 'ARTICLE',
  category: 'GETTING_STARTED',
  title: '',
  summary: '',
  content: '',
  url: '',
  file: '',
  fileName: '',
};

type Props = {
  communityId: string;
  communityName: string;
  /** COORDINATOR+ can publish, edit, and remove resources. */
  canManage: boolean;
  /** Deep link: open this resource once the hub loads (e.g. from global search). */
  initialResourceId?: string;
};

export function CommunityKnowledge({ communityId, communityName, canManage, initialResourceId }: Props) {
  const [resources, setResources] = useState<KnowledgeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openResource, setOpenResource] = useState<KnowledgeResource | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [packBusy, setPackBusy] = useState(false);

  /** One click fills an empty hub with editable, category-aware article drafts. */
  async function handleStarterPack() {
    try {
      setPackBusy(true);
      setError('');
      await createKnowledgeStarterPack(communityId);
      const { resources: list } = await listCommunityKnowledge(communityId);
      setResources(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the starter pack');
    } finally {
      setPackBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { resources: list } = await listCommunityKnowledge(communityId);
        if (cancelled) return;
        setResources(list);
        // Deep link (e.g. global search result): open the requested resource.
        if (initialResourceId) {
          const target = list.find((r) => r._id === initialResourceId);
          if (target?.type === 'ARTICLE') {
            const { resource: full } = await getKnowledgeResource(initialResourceId);
            if (!cancelled) setOpenResource(full);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load the Knowledge Hub');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, initialResourceId]);

  const grouped = useMemo(() => {
    const map = new Map<KnowledgeCategory, KnowledgeResource[]>();
    for (const cat of KNOWLEDGE_CATEGORIES) map.set(cat.value, []);
    for (const r of resources) (map.get(r.category) ?? map.get('OTHER')!).push(r);
    return KNOWLEDGE_CATEGORIES.map((c) => ({ ...c, items: map.get(c.value) ?? [] })).filter((g) => g.items.length > 0);
  }, [resources]);

  // Leader analytics: computed straight from the listing (Phase 2).
  const stats = useMemo(() => {
    if (!resources.length) return null;
    const views = resources.reduce((sum, r) => sum + (r.viewCount ?? 0), 0);
    const downloads = resources.reduce((sum, r) => sum + (r.downloadCount ?? 0), 0);
    const mostViewed = [...resources].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))[0];
    return { count: resources.length, views, downloads, mostViewed };
  }, [resources]);

  async function handleBookmark(resource: KnowledgeResource) {
    try {
      const { bookmarked } = await toggleKnowledgeBookmark(resource._id);
      setResources((prev) => prev.map((r) => (r._id === resource._id ? { ...r, viewerBookmarked: bookmarked } : r)));
      setOpenResource((prev) => (prev && prev._id === resource._id ? { ...prev, viewerBookmarked: bookmarked } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in to save resources');
    }
  }

  async function handleOpen(resource: KnowledgeResource) {
    if (resource.type === 'LINK') {
      window.open(resource.url.startsWith('http') ? resource.url : `https://${resource.url}`, '_blank', 'noopener');
      // Count the visit without blocking navigation.
      void getKnowledgeResource(resource._id).catch(() => undefined);
      void trackKnowledgeDownload(resource._id).catch(() => undefined);
      return;
    }
    if (resource.type === 'FILE') {
      window.open(resolveKnowledgeFileUrl(resource.file), '_blank', 'noopener');
      void getKnowledgeResource(resource._id).catch(() => undefined);
      void trackKnowledgeDownload(resource._id).catch(() => undefined);
      return;
    }
    try {
      const { resource: full } = await getKnowledgeResource(resource._id);
      setOpenResource({ ...full, viewerBookmarked: resource.viewerBookmarked });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open resource');
    }
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    setError('');
    try {
      const input: KnowledgeInput = {
        type: editor.type,
        category: editor.category,
        title: editor.title,
        summary: editor.summary,
        content: editor.content,
        url: editor.url,
        file: editor.file,
        fileName: editor.fileName,
      };
      if (editor.id) {
        const { resource } = await updateKnowledgeResource(editor.id, input);
        setResources((prev) => prev.map((r) => (r._id === resource._id ? { ...resource, content: '' } : r)));
        if (openResource?._id === resource._id) setOpenResource(resource);
      } else {
        const { resource } = await createKnowledgeResource(communityId, input);
        setResources((prev) => [{ ...resource, content: '' }, ...prev]);
      }
      setEditor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save resource');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this resource from the Knowledge Hub?')) return;
    try {
      await deleteKnowledgeResource(id);
      setResources((prev) => prev.filter((r) => r._id !== id));
      if (openResource?._id === id) setOpenResource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete resource');
    }
  }

  async function handleFile(file: File | null) {
    if (!file || !editor) return;
    setUploading(true);
    try {
      const uploaded = await uploadKnowledgeFile(file);
      setEditor((prev) => (prev ? { ...prev, file: uploaded.file, fileName: uploaded.fileName || file.name } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload file');
    } finally {
      setUploading(false);
    }
  }

  async function handleEdit(resource: KnowledgeResource) {
    try {
      const { resource: full } = resource.type === 'ARTICLE' && !resource.content ? await getKnowledgeResource(resource._id) : { resource };
      setEditor({
        id: full._id,
        type: full.type,
        category: full.category,
        title: full.title,
        summary: full.summary,
        content: full.content,
        url: full.url,
        file: full.file,
        fileName: full.fileName,
      });
      setOpenResource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to edit resource');
    }
  }

  // ── Article reader ──
  if (openResource) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setOpenResource(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Knowledge Hub
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => void handleBookmark(openResource)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium ${openResource.viewerBookmarked ? 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${openResource.viewerBookmarked ? 'fill-indigo-600 text-indigo-600' : ''}`} /> {openResource.viewerBookmarked ? 'Saved' : 'Save'}
            </button>
            {canManage ? (
              <>
                <button onClick={() => void handleEdit(openResource)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => void handleDelete(openResource._id)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-600">
          <span className="inline-flex items-center gap-1.5">{CATEGORY_ICONS[openResource.category]} {CATEGORY_META[openResource.category]?.label}</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500"><Eye className="h-3.5 w-3.5" /> {openResource.viewCount} views</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{openResource.title}</h1>
        {openResource.authorName ? (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">By {openResource.authorName} · Updated {new Date(openResource.updatedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</p>
        ) : null}
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">{renderMarkdown(openResource.content)}</div>
      </div>
    );
  }

  // ── Editor ──
  if (editor) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{editor.id ? 'Edit resource' : 'Publish to the Knowledge Hub'}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Preserve {communityName}'s knowledge for the next generation of members. Publishing earns +15 Guild Score.</p>
        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['ARTICLE', 'LINK', 'FILE'] as const).map((t) => (
            <button key={t} onClick={() => setEditor({ ...editor, type: t })}
              className={`rounded-2xl border p-3 text-left transition ${editor.type === t ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'}`}>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{TYPE_META[t].icon} {TYPE_META[t].label}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                {t === 'ARTICLE' ? 'Write a guide or tutorial' : t === 'LINK' ? 'Point to an external site' : 'Attach a PDF or image'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <input className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm" placeholder="Title (e.g. How to claim the GitHub Student Pack)"
            value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value.slice(0, 140) })} />
          <SelectMenu
            aria-label="Category"
            value={editor.category}
            onChange={(v) => setEditor({ ...editor, category: v as KnowledgeCategory })}
            options={KNOWLEDGE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <input className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm" placeholder="One-line summary (shown on the card)"
            value={editor.summary} onChange={(e) => setEditor({ ...editor, summary: e.target.value.slice(0, 300) })} />

          {editor.type === 'ARTICLE' ? (
            <FormattedTextEditor
              className="min-h-64 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm"
              placeholder={'# Heading\n\nWrite your article…\n\n- Step one\n- Step two'}
              value={editor.content}
              onChange={(content) => setEditor({ ...editor, content })}
            />
          ) : null}
          {editor.type === 'LINK' ? (
            <input className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm" placeholder="https://…"
              value={editor.url} onChange={(e) => setEditor({ ...editor, url: e.target.value.slice(0, 500) })} />
          ) : null}
          {editor.type === 'FILE' ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
              {editor.file ? <p className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">✓ {editor.fileName || 'File attached'}</p> : null}
              <input type="file" accept="application/pdf,image/*" onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} className="text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300 dark:hover:file:bg-slate-700" />
              {uploading ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Uploading…</p> : <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">PDF, JPG, PNG or WEBP · max 10MB</p>}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={() => void handleSave()} disabled={saving || uploading}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Saving…' : editor.id ? 'Save changes' : 'Publish'}
          </button>
          <button onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
        </div>
      </div>
    );
  }

  // ── Hub listing ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
            <Library className="h-5 w-5 text-indigo-600" /> Knowledge Hub
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Guides, tutorials and resources — {communityName}'s institutional memory.</p>
        </div>
        {canManage ? (
          <button onClick={() => { setError(''); setEditor({ ...EMPTY_EDITOR }); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Add resource
          </button>
        ) : null}
      </div>

      {canManage && stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"><Library className="h-3.5 w-3.5" /> Resources</p>
            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{stats.count}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"><Eye className="h-3.5 w-3.5" /> Views</p>
            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{stats.views}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"><Download className="h-3.5 w-3.5" /> Opens</p>
            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{stats.downloads}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"><TrendingUp className="h-3.5 w-3.5" /> Most viewed</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={stats.mostViewed.title}>{stats.mostViewed.title}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{stats.mostViewed.viewCount} views</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{error}</p> : null}

      {loading ? (
        <p className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400 shadow-sm">Loading the Knowledge Hub…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">
          <Library className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Nothing here yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canManage
              ? 'Start the hub with a "Getting Started" guide — the questions new members ask every semester.'
              : 'The community leaders haven\'t published any resources yet. Check back soon!'}
          </p>
          {canManage ? (
            <button
              onClick={() => void handleStarterPack()}
              disabled={packBusy}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {packBusy ? 'Adding…' : 'Add starter pack'}
            </button>
          ) : null}
          {canManage ? (
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">4–6 pre-drafted guides (welcome, FAQ, rules, session plan…) tailored to your community type — edit or delete any of them.</p>
          ) : null}
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.value}>
            <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {CATEGORY_ICONS[group.value]} {group.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.items.map((resource) => (
                <div key={resource._id} className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
                  <button onClick={() => void handleOpen(resource)} className="block w-full text-left">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {TYPE_META[resource.type].icon} {TYPE_META[resource.type].label}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-700">{resource.title}</p>
                    {resource.summary ? <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{resource.summary}</p> : null}
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <Eye className="h-3 w-3" /> {resource.viewCount} · {new Date(resource.updatedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                    </p>
                  </button>
                  <div className={`absolute right-3 top-3 gap-1 ${resource.viewerBookmarked ? 'flex' : 'hidden group-hover:flex'}`}>
                    <button
                      onClick={() => void handleBookmark(resource)}
                      className={`rounded-lg bg-white dark:bg-slate-900 p-1.5 shadow-sm ${resource.viewerBookmarked ? 'text-indigo-600' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600'}`}
                      aria-label={resource.viewerBookmarked ? 'Remove from saved' : 'Save resource'}
                      title={resource.viewerBookmarked ? 'Saved — click to remove' : 'Save for later'}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${resource.viewerBookmarked ? 'fill-indigo-600' : ''}`} />
                    </button>
                    {canManage ? (
                      <>
                        <button onClick={() => void handleEdit(resource)} className="rounded-lg bg-white dark:bg-slate-900 p-1.5 text-slate-400 dark:text-slate-500 shadow-sm hover:text-indigo-600" aria-label="Edit resource">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void handleDelete(resource._id)} className="rounded-lg bg-white dark:bg-slate-900 p-1.5 text-slate-400 dark:text-slate-500 shadow-sm hover:text-rose-600" aria-label="Delete resource">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
