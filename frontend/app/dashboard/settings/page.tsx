'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Camera, KeyRound, Lock, Medal, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { Button } from '../../../components/guildos/ui/button';
import { Card } from '../../../components/guildos/ui/card';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { LocationInput } from '../../../components/guildos/location-input';
import { TagInput } from '../../../components/guildos/ui/tag-input';
import { STUDENT_INTEREST_OPTIONS } from '../../../components/guildos/onboarding-data';
import { SocialLinkEditor } from '../../../components/guildos/social-link';
import { OtherCredentialsCard } from '../../../components/guildos/other-credentials';
import {
  deleteProfile,
  getCurrentUser,
  logout,
  saveProfile,
  updateAvailability,
  updatePassword,
  updatePrivacy,
  uploadAvatar,
} from '../../../components/guildos/auth-api';


type ProfileVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';

type SettingsTab = 'profile' | 'photo' | 'career' | 'privacy' | 'credentials' | 'security';

const SETTINGS_TABS: { key: SettingsTab; label: string; icon: typeof UserRound }[] = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'photo', label: 'Photo', icon: Camera },
  { key: 'career', label: 'Career', icon: Briefcase },
  { key: 'privacy', label: 'Privacy', icon: Lock },
  { key: 'credentials', label: 'Other credentials', icon: Medal },
  { key: 'security', label: 'Password & account', icon: KeyRound },
];

const AVAILABILITY_OPTIONS: { value: 'OPEN' | 'CASUAL' | 'CLOSED'; label: string; hint: string }[] = [
  { value: 'OPEN', label: 'Open to opportunities', hint: 'Recruiters can find and message you' },
  { value: 'CASUAL', label: 'Casually looking', hint: 'Open to the right offer' },
  { value: 'CLOSED', label: 'Not looking', hint: 'Hidden from recruiter search' },
];

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Anyone can find and view your profile' },
  { value: 'UNLISTED', label: 'Unlisted', hint: 'Only people with your link' },
  { value: 'PRIVATE', label: 'Private', hint: 'Hidden from search and visitors' },
];

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';

const CHECKBOX_CLASS =
  'flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';

function resolveAvatarUrl(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  if (avatar.startsWith('/uploads/')) return `${API_BASE_URL}${avatar}`;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className={`space-y-1.5 ${span ? 'md:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={CHECKBOX_CLASS}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}


export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [tab, setTab] = useState<SettingsTab>('profile');
  // Preview the chosen file before it's uploaded.
  const chosenPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : ''), [avatarFile]);
  useEffect(() => () => { if (chosenPreview) URL.revokeObjectURL(chosenPreview); }, [chosenPreview]);
  // #privacy etc. deep-links straight to a section.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as SettingsTab;
    if (SETTINGS_TABS.some((t) => t.key === fromHash)) setTab(fromHash);
  }, []);
  function changeTab(next: SettingsTab) {
    setTab(next);
    setMessage('');
    setError('');
    window.history.replaceState(null, '', `#${next}`);
  }


  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  const [graduationYear, setGraduationYear] = useState('');

  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('PUBLIC');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showSocialLinks, setShowSocialLinks] = useState(true);
  const [showUniversity, setShowUniversity] = useState(true);
  const [showLeadership, setShowLeadership] = useState(true);
  const [showCertificates, setShowCertificates] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [availability, setAvailability] = useState<'OPEN' | 'CASUAL' | 'CLOSED'>('CLOSED');
  const [jobSeeking, setJobSeeking] = useState(false);
  const [internshipSeeking, setInternshipSeeking] = useState(false);
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [preferredIndustries, setPreferredIndustries] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [university, setUniversity] = useState('');

  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentUser();
        setUser(current);
        if (current) {
          syncUserProfile(current);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profile');
      }
    })();
  }, []);

  const syncUserProfile = (nextUser: any) => {
    setUser(nextUser);
    setAvatarPreview(resolveAvatarUrl(nextUser.profile?.avatar ?? ''));
    setFullName(nextUser.fullName ?? '');
    setUsername(nextUser.profile?.username ?? '');
    setPhoneNumber(nextUser.profile?.phoneNumber ?? '');
    setBio(nextUser.profile?.bio ?? '');
    setLocation(nextUser.profile?.location ?? '');
    setSocialLinks(nextUser.profile?.socialLinks ?? []);
    setGraduationYear(nextUser.profile?.graduationYear != null ? String(nextUser.profile.graduationYear) : '');

    setProfileVisibility(nextUser.profile?.profileVisibility ?? 'PUBLIC');
    setShowEmail(Boolean(nextUser.profile?.showEmail ?? false));
    setShowPhoneNumber(Boolean(nextUser.profile?.showPhoneNumber ?? false));
    setShowLocation(Boolean(nextUser.profile?.showLocation ?? true));
    setShowSocialLinks(Boolean(nextUser.profile?.showSocialLinks ?? true));
    setShowUniversity(Boolean(nextUser.profile?.showUniversity ?? true));
    setShowLeadership(Boolean(nextUser.profile?.showLeadership ?? true));
    setShowCertificates(Boolean(nextUser.profile?.showCertificates ?? true));
    setShowTimeline(Boolean(nextUser.profile?.showTimeline ?? true));
    setAvailability((nextUser.profile?.availability as 'OPEN' | 'CASUAL' | 'CLOSED') ?? 'CLOSED');
    setJobSeeking(Boolean(nextUser.profile?.jobSeeking ?? false));
    setInternshipSeeking(Boolean(nextUser.profile?.internshipSeeking ?? false));
    setOpenToRelocation(Boolean(nextUser.profile?.openToRelocation ?? false));
    setPreferredIndustries((nextUser.profile?.preferredIndustries ?? []).join(', '));
    setUniversity(nextUser.profile?.university ?? '');
    setFaculty(nextUser.profile?.faculty ?? '');
    setDepartment(nextUser.profile?.department ?? nextUser.profile?.faculty ?? '');
    setLevel(nextUser.profile?.level ?? '');
    setInterests(nextUser.profile?.interests ?? []);
    setSkills(nextUser.profile?.skills ?? []);
  };


  const handleSave = async () => {
    if (!user) return;
    setMessage('');
    setError('');

    try {
      const result = await saveProfile({
        username,
        phoneNumber,
        bio,
        location,
        socialLinks: socialLinks.map((item) => item.trim()).filter(Boolean),
        graduationYear: graduationYear ? Number(graduationYear) : null,

        profileVisibility,
        showEmail,
        showPhoneNumber,
        showLocation,
        showSocialLinks,
        showUniversity,
        showLeadership,
        showCertificates,
        showTimeline,
        university,
        faculty,
        department,
        level,
        interests: interests
          .map((item) => item.trim())
          .filter(Boolean),
        skills: skills
          .map((item) => item.trim())
          .filter(Boolean),
        avatar: user.profile?.avatar ?? '',
      });

      syncUserProfile(result.user);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile');
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const result = await uploadAvatar(formData);
      syncUserProfile(result.user);
      setMessage(result.message);
      setAvatarFile(null);
      setAvatarPreview(resolveAvatarUrl(result.user.profile?.avatar ?? ''));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload avatar');
    }
  };

  const handlePrivacySave = async () => {
    if (!user) return;
    setMessage('');
    setError('');

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
      syncUserProfile(result.user);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update privacy');
    }
  };

  const handleAvailabilitySave = async () => {
    setMessage('');
    setError('');
    try {
      const result = await updateAvailability({
        availability,
        jobSeeking,
        internshipSeeking,
        openToRelocation,
        preferredIndustries: preferredIndustries.split(',').map((s) => s.trim()).filter(Boolean),
      });
      syncUserProfile(result.user);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update availability');
    }
  };

  const handlePasswordUpdate = async () => {
    setMessage('');
    setError('');

    if (!currentPassword || !newPassword) {
      setError('Please enter your current password and a new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    try {
      const result = await updatePassword({
        currentPassword,
        newPassword,
      });
      setMessage(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    }
  };


  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = '/login';
    }
  };

  const handleDeleteProfile = async () => {
    setMessage('');
    setError('');

    const confirmed = await confirmDialog({ title: 'Delete your account?', message: 'This cannot be undone.', confirmLabel: 'Delete account', tone: 'danger' });
    if (!confirmed) return;

    try {
      await deleteProfile();
      window.location.href = '/signup';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete profile');
    }
  };


  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Account"
        title="Account settings"
        subtitle="Your profile, photo, privacy and password. These apply in Student and Community mode."
      />

      {(message || error) && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Section nav: a sticky list on desktop, a scrollable tab row on phones. */}
        <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {SETTINGS_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => changeTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {tab === 'profile' ? (
            <Card className="space-y-5 p-6">
              <SectionTitle title="Profile" hint="What people see on your public profile and your CV." />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <input className={INPUT_CLASS} value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </Field>
                <Field label="Username">
                  <input className={INPUT_CLASS} value={username} onChange={(event) => setUsername(event.target.value)} />
                </Field>
                <Field label="Email">
                  <input className={`${INPUT_CLASS} cursor-not-allowed opacity-70`} value={user?.email ?? ''} readOnly />
                </Field>
                <Field label="Phone number">
                  <input className={INPUT_CLASS} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
                </Field>
                <Field label="Bio" span>
                  <textarea className={`min-h-28 ${INPUT_CLASS}`} placeholder="A line or two about you: what you study, build or lead." value={bio} onChange={(event) => setBio(event.target.value)} />
                </Field>
                <Field label="Location" span>
                  <LocationInput value={location} onChange={setLocation} placeholder="Search city, state or country" />
                </Field>
              </div>

              <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Academic</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Course">
                    <input className={INPUT_CLASS} value={department} onChange={(event) => setDepartment(event.target.value)} />
                  </Field>
                  <Field label="Level">
                    <input className={INPUT_CLASS} value={level} onChange={(event) => setLevel(event.target.value)} />
                  </Field>
                  <Field label="Graduation year">
                    <input type="number" className={INPUT_CLASS} value={graduationYear} onChange={(event) => setGraduationYear(event.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800">
                <Field label="Interests">
                  <TagInput value={interests} onChange={setInterests} suggestions={STUDENT_INTEREST_OPTIONS} placeholder="Type an interest and press Enter" max={15} />
                </Field>
                <Field label="Skills">
                  <TagInput value={skills} onChange={setSkills} placeholder="Type a skill and press Enter (e.g. Public Speaking, Figma, Python)" max={20} />
                </Field>
                <SocialLinkEditor value={socialLinks} onChange={setSocialLinks} />
              </div>

              <SaveBar>
                <Button variant="primary" onClick={handleSave}>Save profile</Button>
              </SaveBar>
            </Card>
          ) : null}

          {tab === 'photo' ? (
            <Card className="space-y-5 p-6">
              <SectionTitle title="Profile photo" hint="A clear photo of your face helps people recognise you at events." />
              <div className="flex flex-wrap items-center gap-5">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 text-2xl font-semibold text-indigo-700 ring-4 ring-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-slate-900">
                  {chosenPreview || avatarPreview ? (
                    <img src={chosenPreview || resolveAvatarUrl(avatarPreview)} alt={user?.fullName ?? 'Avatar'} className="h-full w-full object-cover" />
                  ) : (
                    (user?.fullName ?? '?').slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-400 dark:file:bg-indigo-500/15 dark:file:text-indigo-300"
                    onChange={(event) => setAvatarFile(event.currentTarget.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG or WEBP. A square photo works best.</p>
                </div>
              </div>
              <SaveBar>
                <Button variant="primary" onClick={handleAvatarUpload} disabled={!avatarFile}>
                  {avatarFile ? 'Upload photo' : 'Choose a photo first'}
                </Button>
              </SaveBar>
            </Card>
          ) : null}

          {tab === 'career' ? (
            <Card className="space-y-5 p-6">
              <SectionTitle title="Career & availability" hint="Shows on your public profile and decides whether recruiters can find you." />
              <div className="grid gap-2 sm:grid-cols-3">
                {AVAILABILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAvailability(option.value)}
                    aria-pressed={availability === option.value}
                    className={`rounded-xl border p-3 text-left transition ${availability === option.value ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-500/10' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'}`}
                  >
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{option.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Checkbox label="Seeking a job" checked={jobSeeking} onChange={setJobSeeking} />
                <Checkbox label="Seeking an internship" checked={internshipSeeking} onChange={setInternshipSeeking} />
                <Checkbox label="Open to relocation" checked={openToRelocation} onChange={setOpenToRelocation} />
              </div>
              <Field label="Preferred industries (comma-separated)">
                <input className={INPUT_CLASS} placeholder="Fintech, Agriculture, AI" value={preferredIndustries} onChange={(event) => setPreferredIndustries(event.target.value)} />
              </Field>
              <SaveBar>
                <Button variant="primary" onClick={handleAvailabilitySave}>Save availability</Button>
              </SaveBar>
            </Card>
          ) : null}

          {tab === 'privacy' ? (
            <Card className="space-y-5 p-6">
              <SectionTitle title="Privacy" hint="Choose who can find your profile and what it shows." />
              <div className="grid gap-2 sm:grid-cols-3">
                {VISIBILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProfileVisibility(option.value)}
                    aria-pressed={profileVisibility === option.value}
                    className={`rounded-xl border p-3 text-left transition ${profileVisibility === option.value ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-500/10' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'}`}
                  >
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{option.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                  </button>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Show on my profile</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Checkbox label="Email address" checked={showEmail} onChange={setShowEmail} />
                  <Checkbox label="Phone number" checked={showPhoneNumber} onChange={setShowPhoneNumber} />
                  <Checkbox label="Location" checked={showLocation} onChange={setShowLocation} />
                  <Checkbox label="Social links" checked={showSocialLinks} onChange={setShowSocialLinks} />
                  <Checkbox label="University and course" checked={showUniversity} onChange={setShowUniversity} />
                  <Checkbox label="Leadership roles" checked={showLeadership} onChange={setShowLeadership} />
                  <Checkbox label="Certificates" checked={showCertificates} onChange={setShowCertificates} />
                  <Checkbox label="Activity timeline" checked={showTimeline} onChange={setShowTimeline} />
                </div>
              </div>
              <SaveBar>
                <Button variant="primary" onClick={handlePrivacySave}>Save privacy</Button>
              </SaveBar>
            </Card>
          ) : null}

          {tab === 'credentials' ? <OtherCredentialsCard /> : null}

          {tab === 'security' ? (
            <div className="space-y-6">
              <Card className="space-y-5 p-6">
                <SectionTitle title="Password" hint="Use at least 8 characters. You’ll stay signed in on this device." />
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Current password">
                    <input type="password" autoComplete="current-password" className={INPUT_CLASS} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  </Field>
                  <Field label="New password">
                    <input type="password" autoComplete="new-password" className={INPUT_CLASS} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  </Field>
                  <Field label="Confirm new password">
                    <input type="password" autoComplete="new-password" className={INPUT_CLASS} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </Field>
                </div>
                <SaveBar>
                  <Button variant="primary" onClick={handlePasswordUpdate}>Change password</Button>
                  <Button variant="secondary" onClick={handleLogout}>Log out</Button>
                </SaveBar>
              </Card>

              <Card className="flex flex-wrap items-center justify-between gap-4 border-rose-200 p-6 dark:border-rose-500/30">
                <div>
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Delete account</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Permanently removes your profile, certificates and history. This can’t be undone.</p>
                </div>
                <Button variant="danger" size="sm" onClick={handleDeleteProfile}>Delete account</Button>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function SaveBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">{children}</div>;
}
