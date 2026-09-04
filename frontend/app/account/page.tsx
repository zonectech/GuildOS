'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser, saveProfile, updateAvailability, updatePrivacy, uploadAvatar, updatePassword, exportMyData, type AuthUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { StudentNavRail } from '../../components/guildos/student-nav-rail';
import { toast } from '../../components/guildos/ui/toast';
import { LocationInput } from '../../components/guildos/location-input';
import { TagInput } from '../../components/guildos/ui/tag-input';
import { SelectMenu } from '../../components/guildos/ui/select-menu';
import { STUDENT_INTEREST_OPTIONS } from '../../components/guildos/onboarding-data';
import { SocialLinkEditor } from '../../components/guildos/social-link';
import { OtherCredentialsCard } from '../../components/guildos/other-credentials';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function resolveAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [exporting, setExporting] = useState(false);

  // Profile
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  const [graduationYear, setGraduationYear] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);

  // Availability
  const [availability, setAvailability] = useState<'OPEN' | 'CASUAL' | 'CLOSED'>('CLOSED');
  const [jobSeeking, setJobSeeking] = useState(false);
  const [internshipSeeking, setInternshipSeeking] = useState(false);
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [preferredIndustries, setPreferredIndustries] = useState('');

  // Privacy
  const [profileVisibility, setProfileVisibility] = useState<'PUBLIC' | 'PRIVATE' | 'UNLISTED'>('PUBLIC');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showSocialLinks, setShowSocialLinks] = useState(true);
  const [showUniversity, setShowUniversity] = useState(true);
  const [showLeadership, setShowLeadership] = useState(true);
  const [showCertificates, setShowCertificates] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function sync(u: AuthUser) {
    setUser(u);
    setAvatarPreview(resolveAvatar(u.profile?.avatar));
    setFullName(u.fullName ?? '');
    setUsername(u.profile?.username ?? '');
    setBio(u.profile?.bio ?? '');
    setLocation(u.profile?.location ?? '');
    setPhoneNumber(u.profile?.phoneNumber ?? '');
    setSocialLinks(u.profile?.socialLinks ?? []);
    setGraduationYear(u.profile?.graduationYear != null ? String(u.profile.graduationYear) : '');
    setUniversity(u.profile?.university ?? '');
    setFaculty(u.profile?.faculty ?? '');
    setDepartment(u.profile?.department ?? '');
    setLevel(u.profile?.level ?? '');
    setInterests(u.profile?.interests ?? []);
    setSkills(u.profile?.skills ?? []);
    setAvailability((u.profile?.availability as 'OPEN' | 'CASUAL' | 'CLOSED') ?? 'CLOSED');
    setJobSeeking(Boolean(u.profile?.jobSeeking));
    setInternshipSeeking(Boolean(u.profile?.internshipSeeking));
    setOpenToRelocation(Boolean(u.profile?.openToRelocation));
    setPreferredIndustries((u.profile?.preferredIndustries ?? []).join(', '));
    setProfileVisibility((u.profile?.profileVisibility as 'PUBLIC' | 'PRIVATE' | 'UNLISTED') ?? 'PUBLIC');
    setShowEmail(Boolean(u.profile?.showEmail ?? false));
    setShowPhoneNumber(Boolean(u.profile?.showPhoneNumber ?? false));
    setShowLocation(Boolean(u.profile?.showLocation ?? true));
    setShowSocialLinks(Boolean(u.profile?.showSocialLinks ?? true));
    setShowUniversity(Boolean(u.profile?.showUniversity ?? true));
    setShowLeadership(Boolean(u.profile?.showLeadership ?? true));
    setShowCertificates(Boolean(u.profile?.showCertificates ?? true));
    setShowTimeline(Boolean(u.profile?.showTimeline ?? true));
  }

  useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentUser();
        if (!current) {
          router.replace('/login');
          return;
        }
        sync(current);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function flash(msg: string) {
    toast.success(msg);
  }

  function setError(msg: string) {
    toast.error(msg);
  }

  async function handleProfileSave() {
    try {
      const result = await saveProfile({
        fullName,
        username,
        phoneNumber,
        bio,
        location,
        socialLinks: socialLinks.map((s) => s.trim()).filter(Boolean),
        graduationYear: graduationYear ? Number(graduationYear) : null,
        university,
        faculty,
        department,
        level,
        interests: interests.map((s) => s.trim()).filter(Boolean),
        skills: skills.map((s) => s.trim()).filter(Boolean),
        avatar: user?.profile?.avatar ?? '',
      });
      sync(result.user);
      flash(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile');
    }
  }

  async function handleAvatar() {
    if (!avatarFile) return;
    try {
      const fd = new FormData();
      fd.append('avatar', avatarFile);
      const result = await uploadAvatar(fd);
      sync(result.user);
      setAvatarFile(null);
      flash('Avatar updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload avatar');
    }
  }

  async function handleAvailability() {
    try {
      const result = await updateAvailability({
        availability,
        jobSeeking,
        internshipSeeking,
        openToRelocation,
        preferredIndustries: preferredIndustries.split(',').map((s) => s.trim()).filter(Boolean),
      });
      sync(result.user);
      flash(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update availability');
    }
  }

  async function handlePrivacy() {
    try {
      const result = await updatePrivacy({
        profileVisibility,
        showEmail,
        showPhoneNumber,
        showLocation,
        showSocialLinks,
        showUniversity,
        showLeadership,
        showCertificates,
        showTimeline,
      });
      sync(result.user);
      flash(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update privacy');
    }
  }

  async function handlePassword() {
    if (!currentPassword || !newPassword) return setError('Enter your current and new password');
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match');
    try {
      await updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flash('Password updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportMyData();
      flash('Your data export has started downloading');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export your data');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-100 dark:bg-slate-950"><StudentNav /><main className="mx-auto max-w-3xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Loading…</p></main></div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav />
      <main className="mx-auto flex max-w-6xl items-start gap-6 px-4 py-8">
        <StudentNavRail active="/account" />
        <div className="min-w-0 flex-1 space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Account settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your profile, availability, privacy, and security.</p>
        </header>

        {/* Avatar */}
        <Card title="Photo">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            {avatarPreview ? <img src={avatarPreview} alt="You" className="h-16 w-16 rounded-full object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-200 text-lg font-semibold text-slate-600 dark:text-slate-400">{(fullName || 'U').slice(0, 1)}</span>}
            <input className="min-w-0 w-full text-sm text-slate-600 dark:text-slate-400 sm:flex-1 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300 dark:hover:file:bg-slate-700" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setAvatarFile(f); if (f) setAvatarPreview(URL.createObjectURL(f)); }} />
            <button onClick={() => void handleAvatar()} disabled={!avatarFile} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50">Upload</button>
          </div>
        </Card>

        {/* Profile */}
        <Card title="Profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><input className="ev-input w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label="Username"><input className="ev-input w-full" value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            <Field label="Location"><LocationInput value={location} onChange={setLocation} /></Field>
            <Field label="Phone"><input className="ev-input w-full" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></Field>
            <div className="sm:col-span-2"><SocialLinkEditor value={socialLinks} onChange={setSocialLinks} /></div>
          </div>
          <Field label="Bio"><textarea className="ev-input w-full" value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="University"><input className="ev-input w-full" value={university} onChange={(e) => setUniversity(e.target.value)} /></Field>
            <Field label="Faculty"><input className="ev-input w-full" value={faculty} onChange={(e) => setFaculty(e.target.value)} /></Field>
            <Field label="Department"><input className="ev-input w-full" value={department} onChange={(e) => setDepartment(e.target.value)} /></Field>
            <Field label="Level"><input className="ev-input w-full" value={level} onChange={(e) => setLevel(e.target.value)} /></Field>
            <Field label="Graduation year"><input className="ev-input w-full" type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} /></Field>
          </div>
          <Field label="Interests"><TagInput value={interests} onChange={setInterests} suggestions={STUDENT_INTEREST_OPTIONS} placeholder="Type an interest and press Enter" max={15} /></Field>
          <Field label="Skills"><TagInput value={skills} onChange={setSkills} placeholder="Type a skill and press Enter (e.g. Public Speaking, Figma, Python)" max={20} /></Field>
          <button onClick={() => void handleProfileSave()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save profile</button>
        </Card>

        {/* Availability */}
        <Card title="Career & Availability">
          <Field label="Availability status">
            <SelectMenu
              aria-label="Availability status"
              value={availability}
              onChange={(v) => setAvailability(v as 'OPEN' | 'CASUAL' | 'CLOSED')}
              options={[
                { value: 'OPEN', label: 'Open to opportunities' },
                { value: 'CASUAL', label: 'Casually looking' },
                { value: 'CLOSED', label: 'Not actively looking' },
              ]}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={jobSeeking} onChange={(e) => setJobSeeking(e.target.checked)} />Seeking a job</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={internshipSeeking} onChange={(e) => setInternshipSeeking(e.target.checked)} />Seeking internship</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={openToRelocation} onChange={(e) => setOpenToRelocation(e.target.checked)} />Open to relocation</label>
          </div>
          <Field label="Preferred industries (comma-separated)"><input className="ev-input w-full" placeholder="Fintech, Agriculture, AI" value={preferredIndustries} onChange={(e) => setPreferredIndustries(e.target.value)} /></Field>
          <button onClick={() => void handleAvailability()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Update availability</button>
        </Card>

        {/* Privacy */}
        <Card title="Privacy">
          <Field label="Profile visibility">
            <SelectMenu
              aria-label="Profile visibility"
              value={profileVisibility}
              onChange={(v) => setProfileVisibility(v as 'PUBLIC' | 'PRIVATE' | 'UNLISTED')}
              options={[
                { value: 'PUBLIC', label: 'Public' },
                { value: 'UNLISTED', label: 'Unlisted' },
                { value: 'PRIVATE', label: 'Private' },
              ]}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />Show email publicly</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showPhoneNumber} onChange={(e) => setShowPhoneNumber(e.target.checked)} />Show phone publicly</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} />Show location publicly</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showSocialLinks} onChange={(e) => setShowSocialLinks(e.target.checked)} />Show social handles publicly</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showUniversity} onChange={(e) => setShowUniversity(e.target.checked)} />Show university</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showLeadership} onChange={(e) => setShowLeadership(e.target.checked)} />Show leadership</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showCertificates} onChange={(e) => setShowCertificates(e.target.checked)} />Show certificates</label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-sm"><input type="checkbox" checked={showTimeline} onChange={(e) => setShowTimeline(e.target.checked)} />Show activity timeline</label>
          </div>
          <button onClick={() => void handlePrivacy()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Update privacy</button>
        </Card>

        {/* Password */}
        <Card title="Password">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Current"><input className="ev-input w-full" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
            <Field label="New"><input className="ev-input w-full" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
            <Field label="Confirm"><input className="ev-input w-full" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Field>
          </div>
          <button onClick={() => void handlePassword()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Change password</button>
        </Card>

        {/* Other credentials */}
        <OtherCredentialsCard />

        {/* Data */}
        <Card title="Your data">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Download everything GuildOS holds about you — posts, certificates, reputation history, memberships, connections, and CVs — as a single JSON file.
          </p>
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {exporting ? 'Preparing export…' : 'Export my data'}
          </button>
        </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
