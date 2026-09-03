'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Search, BadgeCheck, Ban, RotateCcw, Trash2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { SelectMenu } from '../../../../components/guildos/ui/select-menu';
import { searchAdminUsers, setUserRole, blockUser, unblockUser, deleteUser, restoreUser, type AdminUser, type AdminUserRole } from '../../../../components/guildos/admin-api';

const ROLES: AdminUserRole[] = ['STUDENT', 'COMMUNITY_LEADER', 'RECRUITER', 'ADMIN'];

const ROLE_TONE: Record<AdminUserRole, string> = {
  STUDENT: 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300',
  COMMUNITY_LEADER: 'bg-indigo-50 text-indigo-700',
  RECRUITER: 'bg-sky-50 text-sky-700',
  ADMIN: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [meId, setMeId] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.role !== 'ADMIN') {
        setStatus('denied');
        return;
      }
      setMeId(user.id);
      setStatus('ready');
      await load('');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load(term: string) {
    try {
      setListLoading(true);
      setError('');
      const { users: list } = await searchAdminUsers(term);
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users');
    } finally {
      setListLoading(false);
    }
  }

  async function changeRole(user: AdminUser, role: AdminUserRole) {
    if (role === user.role) return;
    try {
      setBusyId(user.id);
      setError('');
      setNotice('');
      await setUserRole(user.id, role);
      setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, role } : u)));
      setNotice(`${user.fullName} is now ${role.replace(/_/g, ' ').toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update role');
    } finally {
      setBusyId('');
    }
  }

  async function toggleBlock(user: AdminUser) {
    try {
      setBusyId(user.id);
      setError('');
      setNotice('');
      if (user.blocked) {
        await unblockUser(user.id);
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, blocked: false, status: 'ACTIVE' } : u)));
        setNotice(`${user.fullName} has been unblocked.`);
      } else {
        const reason = window.prompt(`Block ${user.fullName}? They will be signed out and cannot log in. Optional reason:`);
        if (reason === null) return;
        await blockUser(user.id, reason.trim());
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, blocked: true, status: 'BLOCKED', blockReason: reason.trim() } : u)));
        setNotice(`${user.fullName} has been blocked.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update account status');
    } finally {
      setBusyId('');
    }
  }

  async function toggleDelete(user: AdminUser) {
    try {
      setBusyId(user.id);
      setError('');
      setNotice('');
      if (user.deleted) {
        await restoreUser(user.id);
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, deleted: false } : u)));
        setNotice(`${user.fullName} has been restored.`);
      } else {
        if (!window.confirm(`Delete ${user.fullName}? Their account is removed from the platform (recoverable from Inactive & Removed).`)) return;
        await deleteUser(user.id);
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, deleted: true } : u)));
        setNotice(`${user.fullName} has been deleted.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update account');
    } finally {
      setBusyId('');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-semibold text-amber-900">Admins only</h2>
        <p className="mt-1 text-sm text-amber-800">User &amp; role management is restricted to administrators.</p>
        <Link href="/home" className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Student Home</Link>
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        eyebrow="Admin Console"
        title="Users & Roles"
        subtitle="Search accounts and assign roles (Student, Community Leader, Recruiter, Admin)."
        action={<Link href="/dashboard/admin" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">← Admin Console</Link>}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(search);
        }}
        className="mb-6 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or username…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Search</button>
      </form>

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {listLoading ? (
          <div className="flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-slate-400" /></div>
        ) : users.length ? (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{u.fullName}</p>
                    {u.emailVerified ? <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" /> : null}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_TONE[u.role]}`}>{u.role.replace(/_/g, ' ')}</span>
                    {u.blocked ? <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">Blocked</span> : null}
                    {u.deleted ? <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Deleted</span> : null}
                    {u.id === meId ? <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">You</span> : null}
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{u.email}{u.username ? ` · @${u.username}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SelectMenu
                    aria-label="Change role"
                    className="w-44"
                    size="sm"
                    value={u.role}
                    onChange={(v) => void changeRole(u, v as AdminUserRole)}
                    disabled={busyId === u.id || u.id === meId}
                    options={ROLES.map((r) => ({ value: r, label: r.replace(/_/g, ' ') }))}
                  />
                  {u.id !== meId ? (
                    <>
                      <button
                        onClick={() => void toggleBlock(u)}
                        disabled={busyId === u.id}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${u.blocked ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'}`}
                        title={u.blocked ? 'Unblock account' : 'Block account'}
                      >
                        {u.blocked ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        {u.blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        onClick={() => void toggleDelete(u)}
                        disabled={busyId === u.id}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${u.deleted ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}`}
                        title={u.deleted ? 'Restore account' : 'Delete account'}
                      >
                        {u.deleted ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        {u.deleted ? 'Restore' : 'Delete'}
                      </button>
                    </>
                  ) : null}
                  {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" /> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No users found. Try a different search.</p>
        )}
      </div>
    </>
  );
}
