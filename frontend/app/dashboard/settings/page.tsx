'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';

import { useEffect, useState } from 'react';

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

function resolveAvatarUrl(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  if (avatar.startsWith('/uploads/')) return `${API_BASE_URL}${avatar}`;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-slate-950">Personal & Academic Information</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Full Name</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={user?.email ?? ''}
                readOnly
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Username</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Phone Number</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Bio</span>
              <textarea
                className="min-h-32 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>

                        <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Location</span>
              <LocationInput
                value={location}
                onChange={setLocation}
                placeholder="Search city, state or country…"
              />
            </label>

            <div className="md:col-span-2">
              <SocialLinkEditor value={socialLinks} onChange={setSocialLinks} />
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">University</span>

              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={university}
                onChange={(event) => setUniversity(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Faculty</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={faculty}
                onChange={(event) => setFaculty(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Department</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Level</span>
              <input
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Graduation Year</span>
              <input
                type="number"
                className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                value={graduationYear}
                onChange={(event) => setGraduationYear(event.target.value)}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Interests</span>
              <TagInput value={interests} onChange={setInterests} suggestions={STUDENT_INTEREST_OPTIONS} placeholder="Type an interest and press Enter" max={15} />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleSave}>
              Save Profile
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
                        <h2 className="text-lg font-semibold text-slate-950">Avatar</h2>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500">
                {avatarPreview ? (
                  <img
                                        src={resolveAvatarUrl(avatarPreview)}
                    alt={user?.fullName ?? 'Avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>No avatar</span>
                )}
              </div>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-900">Current avatar</p>
                <p>{avatarPreview ? 'Uploaded avatar is shown here.' : 'No avatar uploaded'}</p>
              </div>
            </div>
            <input

              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setAvatarFile(event.currentTarget.files?.[0] ?? null)}
            />
            <Button variant="secondary" onClick={handleAvatarUpload} disabled={!avatarFile}>
              Upload Avatar
            </Button>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950">Career & Availability</h2>
            <p className="text-sm text-slate-500">Let recruiters know whether you&apos;re open to opportunities. This shows on your public profile and controls whether recruiters can find you.</p>
            <label className="block text-sm">
              <span className="text-slate-600">Availability status</span>
              <select className="ev-input mt-1 w-full" value={availability} onChange={(e) => setAvailability(e.target.value as 'OPEN' | 'CASUAL' | 'CLOSED')}>
                <option value="OPEN">Open to opportunities</option>
                <option value="CASUAL">Casually looking</option>
                <option value="CLOSED">Not actively looking</option>
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={jobSeeking} onChange={(e) => setJobSeeking(e.target.checked)} /><span>Seeking a job</span></label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={internshipSeeking} onChange={(e) => setInternshipSeeking(e.target.checked)} /><span>Seeking an internship</span></label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={openToRelocation} onChange={(e) => setOpenToRelocation(e.target.checked)} /><span>Open to relocation</span></label>
            </div>
            <label className="block text-sm">
              <span className="text-slate-600">Preferred industries (comma-separated)</span>
              <input className="ev-input mt-1 w-full" placeholder="Fintech, Agriculture, AI" value={preferredIndustries} onChange={(e) => setPreferredIndustries(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleAvailabilitySave}>Update Availability</Button>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950">Privacy</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Profile Visibility</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                  value={profileVisibility}
                  onChange={(event) => setProfileVisibility(event.target.value as ProfileVisibility)}
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                  <option value="UNLISTED">UNLISTED</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showEmail}
                  onChange={(event) => setShowEmail(event.target.checked)}
                />
                <span>Show Email</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showPhoneNumber}
                  onChange={(event) => setShowPhoneNumber(event.target.checked)}
                />
                <span>Show Phone Number</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(event) => setShowLocation(event.target.checked)}
                />
                <span>Show Location</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showSocialLinks}
                  onChange={(event) => setShowSocialLinks(event.target.checked)}
                />
                <span>Show Social Handles</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showUniversity}
                  onChange={(event) => setShowUniversity(event.target.checked)}
                />
                <span>Show University</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showLeadership}
                  onChange={(event) => setShowLeadership(event.target.checked)}
                />
                <span>Show Leadership</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showCertificates}
                  onChange={(event) => setShowCertificates(event.target.checked)}
                />
                <span>Show Certificates</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={showTimeline}
                  onChange={(event) => setShowTimeline(event.target.checked)}
                />
                <span>Show Activity Timeline</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handlePrivacySave}>
                Update Privacy
              </Button>
            </div>
          </Card>

                    <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-950">Account</h2>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Current Password</span>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">New Password</span>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Confirm Password</span>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-slate-400"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handlePasswordUpdate}>
                Change Password
              </Button>
              <Button variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
              <Button variant="secondary" onClick={handleDeleteProfile}>
                Delete Account
              </Button>
            </div>
          </Card>

        </div>
      </div>

      {message ? <p className="mt-4 text-green-600">{message}</p> : null}
      {error ? <p className="mt-4 text-red-600">{error}</p> : null}
    </DashboardShell>
  );
}