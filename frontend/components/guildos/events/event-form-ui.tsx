import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="guild-surface rounded-3xl border p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Field({ label, children, as = 'label' }: { label: string; children: ReactNode; as?: 'label' | 'div' }) {
  // Native <label> forwards clicks to its first focusable descendant — great for a single
  // input, but breaks fields with several interactive children (e.g. the rich text editor's
  // mode toggle + toolbar buttons): clicking empty space in the editor would steal focus to
  // that first button instead of the editable area. Use as="div" for those multi-control fields.
  const Wrapper = as;
  return (
    <Wrapper className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </Wrapper>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      {/* Modern pill switch — replaces the native checkbox. */}
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      {label}
    </label>
  );
}
