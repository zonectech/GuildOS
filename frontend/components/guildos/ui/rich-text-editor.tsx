'use client';

import dynamic from 'next/dynamic';
import type { RichTextEditorProps } from './rich-text-editor-impl';

/**
 * Client-only wrapper: Tiptap (~large) stays out of the shared bundle and only
 * loads on pages that actually render the editor.
 */
export const RichTextEditor = dynamic<RichTextEditorProps>(
  () => import('./rich-text-editor-impl').then((m) => m.RichTextEditorImpl),
  {
    ssr: false,
    loading: () => <div className="min-h-56 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900" />,
  },
);
