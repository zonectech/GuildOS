'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { Button } from '../../../components/guildos/ui/button';
import { Card } from '../../../components/guildos/ui/card';
import { SelectMenu } from '../../../components/guildos/ui/select-menu';
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

const INPUT_CLASS =
  'w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';

const CHECKBOX_CLASS =
  'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';

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
    setDepartment(nextUser.profile?.department ?? '');
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
        eyebrow="Settings"
        title="Profile Settings"
        subtitle="Manage your profile, privacy, avatar, and account security."
      />

      {(message || error) && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Personal &amp; Academic Information</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name">
              <input className={INPUT_CLASS} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </Field>

            <Field label="Email">
              <input className={`${INPUT_CLASS} cursor-not-allowed opacity-70`} value={user?.email ?? ''} readOnly />
            </Field>

            <Field label="Username">
              <input className={INPUT_CLASS} value={username} onChange={(event) => setUsername(event.target.value)} />
            </Field>

            <Field label="Phone Number">
              <input className={INPUT_CLASS} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            </Field>

            <Field label="Bio" span>
              <textarea
                className={`min-h-32 ${INPUT_CLASS}`}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>

            <Field label="Location" span>
              <LocationInput value={location} onChange={setLocation} placeholder="Search city, state or country" />
            </Field>

            <div className="md:col-span-2">
              <SocialLinkEditor value={socialLinks} onChange={setSocialLinks} />
            </div>

            <Field label="University">
              <input className={INPUT_CLASS} value={university} onChange={(event) => setUniversity(event.target.value)} />
            </Field>

            <Field label="Faculty">
              <input className={INPUT_CLASS} value={faculty} onChange={(event) => setFaculty(event.target.value)} />
            </Field>

            <Field label="Department">
              <input className={INPUT_CLASS} value={department} onChange={(event) => setDepartment(event.target.value)} />
            </Field>

            <Field label="Level">
              <input className={INPUT_CLASS} value={level} onChange={(event) => setLevel(event.target.value)} />
            </Field>

            <Field label="Graduation Year">
              <input
                type="number"
                className={INPUT_CLASS}
                value={graduationYear}
                onChange={(event) => setGraduationYear(event.target.value)}
              />
            </Field>

            <Field label="Interests" span>
              <TagInput value={interests} onChange={setInterests} suggestions={STUDENT_INTEREST_OPTIONS} placeholder="Type an interest and press Enter" max={15} />
            </Field>

            <Field label="Skills" span>
              <TagInput value={skills} onChange={setSkills} placeholder="Type a skill and press Enter (e.g. Public Speaking, Figma, Python)" max={20} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="primary" onClick={handleSave}>
              Save Profile
            </Button>
          </div>
        </Card>

        <OtherCredentialsCard />

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Avatar</h2>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                {avatarPreview ? (
                  <img
                    src={resolveAvatarUrl(avatarPreview)}
                    alt={user?.fullName ?? 'Avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs">No avatar</span>
                )}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-medium text-slate-900 dark:text-slate-100">Current avatar</p>
                <p>{avatarPreview ? 'Uploaded avatar is shown here.' : 'No avatar uploaded'}</p>
              </div>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-400 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700"
              onChange={(event) => setAvatarFile(event.currentTarget.files?.[0] ?? null)}
            />
            <Button variant="secondary" onClick={handleAvatarUpload} disabled={!avatarFile}>
              Upload Avatar
            </Button>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Career &amp; Availability</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Let recruiters know whether you&apos;re open to opportunities. This shows on your public profile and controls whether recruiters can find you.
            </p>
            <Field label="Availability status">
              <SelectMenu
                aria-label="Availability status"
                className="mt-1"
                value={availability}
                onChange={(v) => setAvailability(v as 'OPEN' | 'CASUAL' | 'CLOSED')}
                options={[
                  { value: 'OPEN', label: 'Open to opportunities' },
                  { value: 'CASUAL', label: 'Casually looking' },
                  { value: 'CLOSED', label: 'Not actively looking' },
                ]}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Checkbox label="Seeking a job" checked={jobSeeking} onChange={setJobSeeking} />
              <Checkbox label="Seeking an internship" checked={internshipSeeking} onChange={setInternshipSeeking} />
              <Checkbox label="Open to relocation" checked={openToRelocation} onChange={setOpenToRelocation} />
            </div>
            <Field label="Preferred industries (comma-separated)">
              <input
                className={INPUT_CLASS}
                placeholder="Fintech, Agriculture, AI"
                value={preferredIndustries}
                onChange={(event) => setPreferredIndustries(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="secondary" onClick={handleAvailabilitySave}>
                Update Availability
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Privacy</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Profile Visibility">
                <SelectMenu
                  aria-label="Profile visibility"
                  value={profileVisibility}
                  onChange={(v) => setProfileVisibility(v as ProfileVisibility)}
                  options={[
                    { value: 'PUBLIC', label: 'PUBLIC' },
                    { value: 'PRIVATE', label: 'PRIVATE' },
                    { value: 'UNLISTED', label: 'UNLISTED' },
                  ]}
                />
              </Field>

              <Checkbox label="Show Email" checked={showEmail} onChange={setShowEmail} />
              <Checkbox label="Show Phone Number" checked={showPhoneNumber} onChange={setShowPhoneNumber} />
              <Checkbox label="Show Location" checked={showLocation} onChange={setShowLocation} />
              <Checkbox label="Show Social Handles" checked={showSocialLinks} onChange={setShowSocialLinks} />
              <Checkbox label="Show University" checked={showUniversity} onChange={setShowUniversity} />
              <Checkbox label="Show Leadership" checked={showLeadership} onChange={setShowLeadership} />
              <Checkbox label="Show Certificates" checked={showCertificates} onChange={setShowCertificates} />
              <Checkbox label="Show Activity Timeline" checked={showTimeline} onChange={setShowTimeline} />
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="secondary" onClick={handlePrivacySave}>
                Update Privacy
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Account Security</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Current Password">
                <input
                  type="password"
                  className={INPUT_CLASS}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </Field>

              <Field label="New Password">
                <input
                  type="password"
                  className={INPUT_CLASS}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>

              <Field label="Confirm Password">
                <input
                  type="password"
                  className={INPUT_CLASS}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="secondary" onClick={handlePasswordUpdate}>
                Change Password
              </Button>
              <Button variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3.5 dark:border-rose-500/20 dark:bg-rose-500/5">
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Delete account</p>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/70">This permanently removes your profile and data. This cannot be undone.</p>
              </div>
              <Button variant="danger" size="sm" onClick={handleDeleteProfile}>
                Delete Account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}