const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  FOUNDER:       { bg: 'bg-violet-100', text: 'text-violet-700' },
  PRESIDENT:     { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  VICE_PRESIDENT:{ bg: 'bg-blue-100',   text: 'text-blue-700'   },
  TREASURER:     { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  SECRETARY:     { bg: 'bg-emerald-100',text: 'text-emerald-700'},
  COORDINATOR:   { bg: 'bg-sky-100',    text: 'text-sky-700'    },
  VOLUNTEER:     { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  MEMBER:        { bg: 'bg-slate-100 dark:bg-slate-950',  text: 'text-slate-600 dark:text-slate-400'  },
};

export function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.MEMBER;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.bg} ${s.text}`}>
      {role.replace('_', ' ')}
    </span>
  );
}
