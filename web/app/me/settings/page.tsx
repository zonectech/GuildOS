'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { imageUrl, logout } from '@/lib/api';
import {
  changePassword, deleteAccount, exportUrl, getFullProfile, getNotificationPrefs, savePrivacy, saveNotificationPrefs, saveProfile, uploadAvatar,
  type FullUser, type Profile,
} from '@/lib/account';
import { useSession } from '@/lib/session';
import { Avatar } from '@/components/ui';

const PRIVACY: [keyof Profile, string][] = [
  ['showEmail', 'Show email publicly'], ['showPhoneNumber', 'Show phone publicly'], ['showLocation', 'Show location publicly'],
  ['showSocialLinks', 'Show social handles publicly'], ['showUniversity', 'Show university'], ['showLeadership', 'Show leadership'],
  ['showCertificates', 'Show certificates'], ['showTimeline', 'Show activity timeline'],
];
const list = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

/** One page with sections, the same settings as the current site, minus job options. */
export default function SettingsPage() {
  const router = useRouter();
  const { user: sessionUser, loading, setUser: setSession } = useSession();
  const [user, setUser] = useState<FullUser | null>(null);
  const [form, setForm] = useState({ fullName: '', username: '', bio: '', university: '', faculty: '', department: '', level: '', location: '', skills: '', interests: '', links: '' });
  const [privacy, setPrivacy] = useState<Partial<Profile>>({});
  const [newEvents, setNewEvents] = useState(true);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!sessionUser) { router.replace('/login?next=/me/settings'); return; }
    getFullProfile().then(({ user: u }) => {
      setUser(u);
      const p = u.profile ?? {};
      setForm({ fullName: u.fullName, username: p.username ?? '', bio: p.bio ?? '', university: p.university ?? '', faculty: p.faculty ?? '', department: p.department ?? '', level: p.level ?? '', location: p.location ?? '', skills: (p.skills ?? []).join(', '), interests: (p.interests ?? []).join(', '), links: (p.socialLinks ?? []).join(', ') });
      setPrivacy({ ...Object.fromEntries(PRIVACY.map(([k]) => [k, p[k] ?? false])), profileVisibility: p.profileVisibility ?? 'PUBLIC' });
    }).catch(() => undefined);
    getNotificationPrefs().then((r) => setNewEvents(r.newEventEmailEnabled)).catch(() => undefined);
  }, [loading, sessionUser, router]);

  async function run(section: string, action: () => Promise<unknown>, done: string) {
    setBusy(section); setMsg((m) => ({ ...m, [section]: '' }));
    try { await action(); setMsg((m) => ({ ...m, [section]: done })); }
    catch (e) { setMsg((m) => ({ ...m, [section]: e instanceof Error ? e.message : 'Something went wrong' })); }
    finally { setBusy(''); }
  }
  const field = (key: keyof typeof form, label: string, required = false) => (
    <label className="field"><span>{label}{required ? <em> *</em> : null}</span><input className="input" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>
  );
  const note = (k: string) => (msg[k] ? <p className={/saved|changed|updated/i.test(msg[k]) ? 'note' : 'error'}>{msg[k]}</p> : null);

  if (!user) return <div className="wrap page"><p className="empty">Loading settings…</p></div>;
  return (
    <div className="wrap page settings">
      <aside className="stack" style={{ gap: 12 }}>
        <h1>Settings</h1>
        <nav className="stack" style={{ gap: 10 }} aria-label="Settings sections">{['Profile', 'Privacy', 'Password', 'Notifications', 'Account'].map((s) => <a key={s} href={`#${s.toLowerCase()}`} className="muted">{s}</a>)}</nav>
      </aside>
      <div className="stack" style={{ gap: 28 }}>
        <section id="profile" className="sb">
          <h2>Profile</h2>
          <div className="row" style={{ gap: 14 }}>
            <Avatar name={user.fullName} src={imageUrl(user.profile?.avatar)} size={72} />
            <label className="btn s sm">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void run('profile', async () => { const r = await uploadAvatar(f); setUser(r.user); setSession(r.user as never); }, 'Photo saved.'); }} /></label>
          </div>
          <div className="two">{field('fullName', 'Full name', true)}{field('username', 'Username', true)}</div>
          <label className="field"><span>Bio</span><textarea className="input area" rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></label>
          <div className="two">{field('university', 'University')}{field('location', 'Where you are based')}</div>
          <div className="two">{field('faculty', 'Faculty')}{field('department', 'Course or department')}</div>
          {field('level', 'Current study level')}
          {field('skills', 'Skills, separated by commas')}
          {field('interests', 'Interests, separated by commas')}
          {field('links', 'Links (GitHub, LinkedIn, portfolio), separated by commas')}
          {note('profile')}
          <button type="button" className="btn p" disabled={busy === 'profile'} onClick={() => run('profile', async () => {
            const r = await saveProfile({ fullName: form.fullName.trim(), username: form.username.trim(), bio: form.bio.trim(), university: form.university.trim(), faculty: form.faculty.trim(), department: form.department.trim(), level: form.level.trim(), location: form.location.trim(), skills: list(form.skills), interests: list(form.interests), socialLinks: list(form.links) });
            setUser(r.user); setSession(r.user as never);
          }, 'Profile saved.')}>Save profile</button>
        </section>

        <section id="privacy" className="sb">
          <h2>Privacy</h2>
          <label className="field"><span>Who can see your profile</span>
            <select className="input" value={privacy.profileVisibility ?? 'PUBLIC'} onChange={(e) => setPrivacy((p) => ({ ...p, profileVisibility: e.target.value as Profile['profileVisibility'] }))}>
              <option value="PUBLIC">Everyone</option><option value="UNLISTED">Only people with the link</option><option value="PRIVATE">Only me</option>
            </select>
          </label>
          {PRIVACY.map(([k, label]) => <label key={k} className="tog"><span>{label}</span><input type="checkbox" checked={Boolean(privacy[k])} onChange={(e) => setPrivacy((p) => ({ ...p, [k]: e.target.checked }))} /></label>)}
          {note('privacy')}
          <button type="button" className="btn p" disabled={busy === 'privacy'} onClick={() => run('privacy', () => savePrivacy(privacy), 'Privacy updated.')}>Update privacy</button>
        </section>

        <section id="password" className="sb">
          <h2>Password</h2>
          <div className="two">
            <label className="field"><span>Current password</span><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} /></label>
            <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} /></label>
          </div>
          {note('password')}
          <button type="button" className="btn s" disabled={busy === 'password' || pw.next.length < 8} onClick={() => run('password', async () => { await changePassword(pw.current, pw.next); setPw({ current: '', next: '' }); }, 'Password changed.')}>Change password</button>
        </section>

        <section id="notifications" className="sb">
          <h2>Notifications</h2>
          <label className="tog"><span>Email me about new events from my communities</span><input type="checkbox" checked={newEvents} onChange={(e) => { const v = e.target.checked; setNewEvents(v); void run('notifications', () => saveNotificationPrefs(v), 'Notifications updated.'); }} /></label>
          <p className="small">Reminders, approvals and certificates always reach you in the bell.</p>
          {note('notifications')}
        </section>

        <section id="account" className="sb">
          <h2>Account</h2>
          <div className="row">
            <a className="btn s" href={exportUrl()}>Download my data</a>
            <button type="button" className="btn s" onClick={() => void logout().finally(() => { setSession(null); router.push('/'); })}>Log out</button>
          </div>
          <label className="field"><span>To delete your account, type DELETE</span><input className="input" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} /></label>
          {note('account')}
          <button type="button" className="btn d" disabled={confirmDelete !== 'DELETE' || busy === 'account'} onClick={() => run('account', async () => { await deleteAccount(); setSession(null); router.push('/'); }, 'Account deleted.')}>Delete account</button>
        </section>
      </div>
    </div>
  );
}
