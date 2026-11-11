'use client';
import { useState } from 'react';
import * as m from 'motion/react-m';
import { Check, Eye, EyeOff } from 'lucide-react';
import { spring } from '@/lib/motion';
import { Stamp } from '@/components/brand/stamp';
import { Req } from '@/components/ui/req';

export const inputCls = 'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-green-text';

/** The shared frame for account pages: a stamp that drops in, a title, a line of copy. */
export function AuthCard({ stamp, title, lead, children, onSubmit }: { stamp: string; title: string; lead: React.ReactNode; children: React.ReactNode; onSubmit?: (e: React.FormEvent) => void }) {
  const Body = onSubmit ? m.form : m.div;
  return (
    <div className="mesh grid min-h-[80dvh] place-items-center px-4 py-10">
      <Body onSubmit={onSubmit} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: spring.soft }} className="flex w-full max-w-[440px] flex-col gap-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <m.span initial={{ scale: 1.8, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: -10, opacity: 1, transition: { ...spring.bouncy, delay: 0.1 } }}>
            <Stamp label={stamp} size={92} tilt={0} />
          </m.span>
          <h1 className="text-[38px] font-extrabold">{title}</h1>
          <p className="text-[15px] text-muted">{lead}</p>
        </div>
        {children}
      </Body>
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return text ? <p role="alert" className="rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">{text}</p> : null;
}

/** The backend's password rules, ticked off as you type. */
export const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ['8 or more characters', (p) => p.length >= 8], ['An uppercase letter', (p) => /[A-Z]/.test(p)], ['A lowercase letter', (p) => /[a-z]/.test(p)], ['A number', (p) => /[0-9]/.test(p)],
];
export const passwordOk = (p: string) => PASSWORD_RULES.every(([, ok]) => ok(p));

export function PasswordField({ value, onChange, label = 'Password', autoComplete = 'new-password', rules = true, required }: { value: string; onChange: (v: string) => void; label?: string; autoComplete?: string; rules?: boolean; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">{label}{required ? <Req /> : null}</span>
        <span className="relative">
          <input type={show ? 'text' : 'password'} required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-12`} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-mist">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </span>
      </label>
      {rules ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]" aria-label="Password rules">
          {PASSWORD_RULES.map(([t, ok]) => {
            const done = ok(value);
            return <li key={t} className={`flex items-center gap-1.5 ${done ? 'text-green-text' : 'text-muted'}`}><m.span animate={{ scale: done ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.25 }} className={`grid size-4 place-items-center rounded-full ${done ? 'bg-green text-white' : 'border border-line'}`}>{done ? <Check size={10} strokeWidth={3} /> : null}</m.span>{t}</li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}
