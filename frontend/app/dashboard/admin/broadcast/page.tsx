'use client';

import { useState } from 'react';
import { Megaphone, Send, Bell, Mail } from 'lucide-react';

import { sendBroadcast, type AdminMessageCategory } from '../../../../components/guildos/admin-api';
import { confirmDialog } from '../../../../components/guildos/ui/confirm-dialog';

const ROLES = [
  { value: 'STUDENT', label: 'Students' },
  { value: 'COMMUNITY_LEADER', label: 'Community leaders' },
  { value: 'RECRUITER', label: 'Recruiters' },
  { value: 'ADMIN', label: 'Admins' },
];

const CATEGORIES: { value: AdminMessageCategory; label: string; hint: string }[] = [
  { value: 'INFO', label: '📣 Announcement', hint: 'General update' },
  { value: 'CONGRATS', label: '🎉 Congratulations', hint: 'Celebrate a win' },
  { value: 'WARNING', label: '⚠️ Warning', hint: 'Important / caution' },
  { value: 'CONFIRMATION', label: '✅ Confirmation', hint: 'Confirm an action' },
];

type Scope = 'ALL' | 'ROLE' | 'USER';

export default function BroadcastPage() {
  const [category, setCategory] = useState<AdminMessageCategory>('INFO');
  const [scope, setScope] = useState<Scope>('ALL');
  const [role, setRole] = useState('STUDENT');
  const [userEmail, setUserEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [viaNotification, setViaNotification] = useState(true);
  const [viaEmail, setViaEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function audienceLabel() {
    if (scope === 'USER') return userEmail.trim() || 'a specific user';
    if (scope === 'ROLE') return ROLES.find((r) => r.value === role)?.label ?? role;
    return 'Everyone';
  }

  async function send() {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    if (!viaNotification && !viaEmail) {
      setError('Choose at least one channel: in-app or email');
      return;
    }
    if (scope === 'USER' && !userEmail.trim()) {
      setError("Enter the recipient's email");
      return;
    }
    const channelLabel = [viaNotification ? 'in-app' : '', viaEmail ? 'email' : ''].filter(Boolean).join(' + ');
    if (!(await confirmDialog({ title: 'Send message?', message: `${audienceLabel()} will receive this via ${channelLabel}.`, confirmLabel: 'Send' }))) return;
    setError('');
    setNotice('');
    setSending(true);
    try {
      const target =
        scope === 'USER'
          ? { scope: 'USER' as const, email: userEmail.trim() }
          : scope === 'ROLE'
            ? { scope: 'ROLE' as const, role }
            : { scope: 'ALL' as const };
      const result = await sendBroadcast({
        title: title.trim(),
        body: body.trim(),
        link: link.trim(),
        category,
        channels: { notification: viaNotification, email: viaEmail },
        target,
      });
      setNotice(`Sent to ${result.recipients} ${result.recipients === 1 ? 'person' : 'people'} — ${result.notified} in-app, ${result.emailed} emailed.`);
      setTitle('');
      setBody('');
      setLink('');
      if (scope === 'USER') setUserEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><Megaphone className="h-6 w-6" /> Send message</h1>
        <p className="text-sm text-slate-500">Message everyone, a role, or one specific user — via in-app notification and/or branded email. Delivery is instant.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="max-w-xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Category */}
        <div className="text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">Type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-xl border px-3 py-2 text-left transition ${category === c.value ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="block text-xs font-semibold text-slate-800">{c.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{c.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div className="text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">Audience</span>
          <div className="flex flex-wrap gap-2">
            {([['ALL', 'Everyone'], ['ROLE', 'A role'], ['USER', 'Specific user']] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setScope(v)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${scope === v ? 'border-slate-900 ring-1 ring-slate-900 text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {scope === 'ROLE' ? (
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} mt-2`}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          ) : null}
          {scope === 'USER' ? (
            <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} type="email" placeholder="user@email.com" className={`${inputCls} mt-2`} />
          ) : null}
        </div>

        {/* Channels */}
        <div className="text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">Channels</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViaNotification((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${viaNotification ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Bell className="h-3.5 w-3.5" /> In-app notification
            </button>
            <button
              type="button"
              onClick={() => setViaEmail((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${viaEmail ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Mail className="h-3.5 w-3.5" /> Branded email
            </button>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="e.g. Congratulations on your certificate!" className={inputCls} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Message <span className="font-normal text-slate-400">(optional)</span></span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} placeholder="Write your message… (blank line = new paragraph)" className={inputCls} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Link / button <span className="font-normal text-slate-400">(optional, e.g. /events)</span></span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/events" className={inputCls} />
        </label>

        <button onClick={() => void send()} disabled={sending || !title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">
          <Send className="h-4 w-4" /> {sending ? 'Sending…' : `Send to ${audienceLabel()}`}
        </button>
      </div>
    </div>
  );
}
