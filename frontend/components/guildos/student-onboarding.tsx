'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Check, CircleCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { PeopleCluster } from './visuals/illustrated-people';
import { completeOnboarding, getCurrentUser, saveProfile as saveProfileRequest, uploadAvatar } from './auth-api';
import { STUDENT_INTEREST_OPTIONS, STUDENT_ONBOARDING_STEPS } from './onboarding-data';
import { NIGERIAN_UNIVERSITIES } from './nigerian-universities';
import { TagInput } from './ui/tag-input';
import { SocialLinkEditor } from './social-link';
import { SelectMenu } from './ui/select-menu';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type AnalyticsWindow = Window & {
  gtag?: (command: 'event', eventName: string, params?: Record<string, unknown>) => void;
  dataLayer?: Array<Record<string, unknown>>;
};

function trackOnboardingEvent(eventName: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const analyticsWindow = window as AnalyticsWindow;

  analyticsWindow.dataLayer?.push({ event: eventName, ...params });
  analyticsWindow.gtag?.('event', eventName, params);

  void fetch(`${API_BASE_URL}/api/analytics/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventName, ...params }),
    keepalive: true,
  }).catch(() => undefined);
}

const STUDY_LEVEL_OPTIONS = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
  'Postgraduate',
  'Other',
] as const;

const UNIVERSITY_FALLBACK_OPTIONS = [...NIGERIAN_UNIVERSITIES, 'Other'];

function AuthField({
  label,
  placeholder,
  type = 'text',
  autoComplete,
  value,
  onChange,
  required,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder ?? label}
        autoComplete={autoComplete}
        value={value}
        required={required}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </label>
  );
}

type StudentProfileState = {
  fullName: string;
  email: string;
  isStudent: boolean;
  university: string;
  faculty: string;
  department: string;
  level: string;
  interests: string[];
  skills: string[];
  location: string;
  socialLinks: string[];
  avatar: string;
  avatarFile: File | null;
};

export function StudentOnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [avatarSkipped, setAvatarSkipped] = useState(false);
  // Kept if signup already assigned one; otherwise built from the name at the end.
  const [existingUsername, setExistingUsername] = useState('');
  const [universitySearch, setUniversitySearch] = useState('');
  const [universityOptions, setUniversityOptions] = useState<string[]>(UNIVERSITY_FALLBACK_OPTIONS);
  const [universitySource, setUniversitySource] = useState<'loading' | 'registry' | 'fallback'>('loading');
  const [formData, setFormData] = useState<StudentProfileState>({
    fullName: '',
    email: '',
    isStudent: true,
    university: '',
    faculty: '',
    department: '',
    level: '',
    interests: [],
    skills: [],
    location: '',
    socialLinks: [],
    avatar: '',
    avatarFile: null,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user || cancelled) return;

        setFormData((state) => ({
          ...state,
          fullName: user.fullName,
          email: user.email,
        }));
        setExistingUsername(user.profile?.username ?? '');
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const normalizeOptions = (names: string[]) => {
        const normalized = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
          .filter((name) => name.toLowerCase() !== 'other')
          .sort((a, b) => a.localeCompare(b));
        return normalized.length ? [...normalized, 'Other'] : UNIVERSITY_FALLBACK_OPTIONS;
      };

      try {
        // GuildOS institution registry, merged with the bundled list. (The public
        // hipolabs API it replaced only serves plain http, which https pages can't call.)
        const registryResponse = await fetch(`${API_BASE_URL}/api/institutions`, {
          credentials: 'include',
        });
        if (registryResponse.ok && !cancelled) {
          const payload = (await registryResponse.json()) as { institutions?: Array<{ name?: string }> };
          const fromRegistry = (payload.institutions ?? []).map((row) => row.name ?? '');
          // Merge any GuildOS registry institutions on top of the bundled list so
          // nothing is lost when the registry only holds a handful of entries.
          const registryOptions = normalizeOptions([...fromRegistry, ...NIGERIAN_UNIVERSITIES]);
          if (registryOptions.length > 1) {
            setUniversityOptions(registryOptions);
            setUniversitySource('registry');
            return;
          }
        }
      } catch {
        // Fallback is handled below.
      }

      if (!cancelled) {
        setUniversityOptions(UNIVERSITY_FALLBACK_OPTIONS);
        setUniversitySource('fallback');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const photoPreview = useMemo(() => (formData.avatarFile ? URL.createObjectURL(formData.avatarFile) : ''), [formData.avatarFile]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const firstName = formData.fullName.trim().split(/\s+/)[0] || 'there';

  const step = STUDENT_ONBOARDING_STEPS[currentStep] ?? STUDENT_ONBOARDING_STEPS[0];
  const isLastStep = currentStep === STUDENT_ONBOARDING_STEPS.length - 1;

  const filteredUniversityOptions = useMemo(() => {
    const query = universitySearch.trim().toLowerCase();
    if (!query) return universityOptions;
    return universityOptions.filter((university) => university.toLowerCase().includes(query));
  }, [universityOptions, universitySearch]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (currentStep === 2 && formData.interests.length < 1) {
      setError('Please select at least 1 interest');
      return;
    }

    if (currentStep === 2 && formData.interests.length > 10) {
      setError('Please select no more than 10 interests');
      return;
    }

    if (currentStep === 3 && !formData.avatar && !avatarSkipped) {
      setError('Please upload a profile photo or skip for now');
      return;
    }

    if (!isLastStep) {
      trackOnboardingEvent('onboarding_step_completed', {
        step_index: currentStep,
        step_title: step.title,
        is_student: formData.isStudent,
      });
      setCurrentStep((s) => s + 1);
      return;
    }

    setIsSaving(true);
    try {
      const profilePayload = {
        fullName: formData.fullName.trim() || undefined,
        showUniversity: formData.isStudent,
        university: formData.isStudent ? formData.university : '',
        faculty: formData.isStudent ? formData.faculty : '',
        department: formData.isStudent ? formData.department : '',
        level: formData.isStudent ? formData.level : '',
        interests: formData.interests,
        skills: formData.skills,
        location: formData.location,
        socialLinks: formData.socialLinks,
        avatar: formData.avatar,
      };
      // There's no username field in setup, so a name someone else already has must not
      // block the last step: keep an existing username, else try the name, then the name plus digits.
      const base = formData.fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'student';
      const candidates = existingUsername ? [existingUsername] : [base, ...Array.from({ length: 3 }, () => `${base}${Math.floor(100 + Math.random() * 900)}`)];
      for (let i = 0; i < candidates.length; i += 1) {
        try {
          await saveProfileRequest({ ...profilePayload, username: candidates[i] });
          break;
        } catch (saveError) {
          const taken = saveError instanceof Error && /username/i.test(saveError.message);
          if (!taken || i === candidates.length - 1) throw saveError;
        }
      }

      if (formData.avatarFile && !avatarSkipped) {
        const avatarFormData = new FormData();
        avatarFormData.append('avatar', formData.avatarFile);
        await uploadAvatar(avatarFormData);
      }

      await completeOnboarding();
      trackOnboardingEvent('onboarding_completed', {
        is_student: formData.isStudent,
        university: formData.isStudent ? formData.university : '',
        courseOfStudy: formData.isStudent ? formData.department : '',
        has_location: Boolean(formData.location.trim()),
        interests_count: formData.interests.length,
      });
      setIsComplete(true);
    } catch (err) {
      trackOnboardingEvent('onboarding_completion_failed', {
        is_student: formData.isStudent,
      });
      setError(err instanceof Error ? err.message : 'Unable to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isComplete) {
    return (
      <main className="auth-page auth-page-center">
        <section className="auth-center-shell">
          <div className="auth-card auth-card-center auth-card-surface">
            <div className="flex flex-col items-center text-center">
              <PeopleCluster count={5} size={40} />
              <p className="auth-card-eyebrow mt-6">You’re all set</p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Welcome in, {firstName}!</h1>
              <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">Your profile is ready. The best next step is joining a community from your campus: that’s where events, certificates and your people are.</p>
            </div>
            <div className="mt-6 grid gap-2">
              <Link href="/communities" className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left transition hover:border-indigo-300 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                <Users className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Find your first community</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Clubs and societies at {formData.university || 'your university'}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
              </Link>
              <Link href="/events" className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-indigo-300 dark:border-slate-800">
                <CalendarDays className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Browse events</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Workshops, hackathons and meetups near you</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </div>
            <button type="button" className="auth-button auth-button-secondary mt-4 w-full" onClick={() => router.push('/home')}>
              Go to my home page
            </button>
          </div>
        </section>
      </main>
    );
  }

  const totalSteps = STUDENT_ONBOARDING_STEPS.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <main className="auth-page auth-page-split auth-page-setup">
      <section className="auth-shell auth-shell-setup">
        <div className="auth-setup-hero">
          <p className="auth-kicker">Set up your profile</p>
          <h1 className="font-display !text-[clamp(2rem,3.4vw,3rem)] !leading-tight">{step.title}</h1>
          <p className="auth-hero-text">{step.text}</p>

          {/* Where you are and what's left, instead of a lone "2 of 5". */}
          <ol className="mt-8 space-y-3">
            {STUDENT_ONBOARDING_STEPS.map((s, index) => {
              const done = index < currentStep;
              const active = index === currentStep;
              return (
                <li key={s.title} className="flex items-center gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-500/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={`text-sm ${active ? 'font-semibold text-slate-900 dark:text-white' : done ? 'text-slate-500 line-through decoration-slate-300 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{s.title}</span>
                </li>
              );
            })}
          </ol>

          <div className="mt-10 flex items-center gap-3">
            <PeopleCluster count={4} size={32} />
            <p className="text-sm text-slate-600 dark:text-slate-400">About two minutes. You can change anything later in Account settings.</p>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-card auth-card-surface auth-setup-card">
            {/* Progress lives in the card too: on phones the side panel is hidden. */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Step {currentStep + 1} of {totalSteps}</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 md:hidden">
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{step.text}</p>
              </div>
            </div>

            <form className="auth-form auth-setup-form" onSubmit={handleSubmit}>
              {currentStep === 0 ? (
                isLoadingUser ? (
                  <div className="space-y-3" aria-busy="true">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                    <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  </div>
                ) : (
                  <>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">Hi {firstName}! Is this right?</p>
                    <AuthField
                      label="Your full name"
                      autoComplete="name"
                      value={formData.fullName}
                      onChange={(value) => setFormData((s) => ({ ...s, fullName: value }))}
                      required
                    />
                    <label className="auth-field">
                      <span>Email (verified)</span>
                      <input type="email" value={formData.email} readOnly aria-readonly="true" className="cursor-not-allowed opacity-70" />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">This is the name on your certificates, so use the one you want employers to see.</p>
                  </>
                )
              ) : null}

              {currentStep === 1 ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Are you currently a student?</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">If yes, we’ll ask where you study so we can show your campus first.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formData.isStudent}
                        onClick={() => {
                          const nextIsStudent = !formData.isStudent;
                          trackOnboardingEvent('onboarding_student_toggle_changed', {
                            is_student: nextIsStudent,
                          });
                          setFormData((s) => ({
                            ...s,
                            isStudent: nextIsStudent,
                            university: nextIsStudent ? s.university : '',
                            faculty: nextIsStudent ? s.faculty : '',
                            department: nextIsStudent ? s.department : '',
                            level: nextIsStudent ? s.level : '',
                          }));
                        }}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${formData.isStudent ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-700'}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${formData.isStudent ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>
                  </div>

                  <AuthField
                    label="Where are you based?"
                    placeholder="City, state or country"
                    autoComplete="address-level2"
                    value={formData.location}
                    onChange={(value) => setFormData((s) => ({ ...s, location: value }))}
                    required
                  />

                  {formData.isStudent ? (
                    <>
                      <label className="auth-field">
                        <span>University or institution</span>
                        <input
                          type="text"
                          list="university-options"
                          placeholder="Start typing your university"
                          autoComplete="organization"
                          value={formData.university}
                          required={formData.isStudent}
                          onChange={(event) => {
                            const value = event.target.value;
                            setUniversitySearch(value);
                            setFormData((s) => ({ ...s, university: value }));
                          }}
                        />
                        {universitySource === 'loading' ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Loading universities…</p> : null}
                      </label>
                      <datalist id="university-options">
                        {filteredUniversityOptions.map((university) => (
                          <option key={university} value={university} />
                        ))}
                      </datalist>

                      <AuthField
                        label="Course"
                        placeholder="e.g. Computer Science"
                        autoComplete="off"
                        value={formData.department}
                        onChange={(value) => setFormData((s) => ({ ...s, department: value }))}
                        required={formData.isStudent}
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <AuthField
                          label="Faculty (optional)"
                          placeholder="e.g. Science"
                          autoComplete="off"
                          value={formData.faculty}
                          onChange={(value) => setFormData((s) => ({ ...s, faculty: value }))}
                        />
                        <label className="auth-field">
                          <span>Level (optional)</span>
                          <SelectMenu
                            aria-label="Current study level"
                            value={formData.level}
                            onChange={(value) => setFormData((s) => ({ ...s, level: value }))}
                            placeholder="Select your level"
                            options={STUDY_LEVEL_OPTIONS.map((level) => ({ value: level, label: level }))}
                          />
                        </label>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="auth-field">
                  <span>Pick at least one <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(up to 10)</span></span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STUDENT_INTEREST_OPTIONS.map((interest) => {
                      const selected = formData.interests.includes(interest);
                      return (
                        <button
                          type="button"
                          key={interest}
                          aria-pressed={selected}
                          onClick={() =>
                            setFormData((s) => {
                              if (s.interests.includes(interest)) {
                                return { ...s, interests: s.interests.filter((i) => i !== interest) };
                              }
                              if (s.interests.length >= 10) return s;
                              return { ...s, interests: [...s.interests, interest] };
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-100 dark:ring-indigo-500/20'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {selected ? <CircleCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden /> : null}
                          <span>{interest}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formData.interests.length}/10 selected</p>
                  <div className="mt-5">
                    <span>Skills <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(optional, these power job matches on your CV)</span></span>
                    <div className="mt-2">
                      <TagInput
                        value={formData.skills}
                        onChange={(skills) => setFormData((s) => ({ ...s, skills }))}
                        placeholder="Type a skill and press Enter (e.g. Python, Public Speaking, Figma)"
                        max={15}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700 ring-4 ring-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-slate-900">
                      {photoPreview ? <img src={photoPreview} alt="" className="h-full w-full object-cover" /> : firstName.slice(0, 1).toUpperCase()}
                    </div>
                    <label className="auth-field min-w-0 flex-1">
                      <span>Choose a photo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/15 dark:file:text-indigo-300"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0] ?? null;
                          setAvatarSkipped(false);
                          setFormData((s) => ({
                            ...s,
                            avatar: file ? file.name : '',
                            avatarFile: file,
                          }));
                        }}
                      />
                    </label>
                  </div>
                  {!formData.avatarFile ? (
                    <button
                      type="button"
                      className={`text-sm font-semibold ${avatarSkipped ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 hover:underline dark:text-indigo-400'}`}
                      onClick={() => {
                        setAvatarSkipped(true);
                        setError('');
                        setFormData((s) => ({ ...s, avatar: '', avatarFile: null }));
                      }}
                    >
                      {avatarSkipped ? 'Skipped. You can add one later.' : 'Skip for now'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {currentStep === 4 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 p-4 dark:bg-slate-900/40">
                  <SocialLinkEditor
                    value={formData.socialLinks}
                    onChange={(socialLinks) => setFormData((state) => ({ ...state, socialLinks }))}
                  />
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Optional. You can add or change links later in Account settings.</p>
                </div>
              ) : null}

              {error ? <p className="auth-error-text">{error}</p> : null}

              <div className="auth-stack-actions auth-setup-actions">
                <button
                  type="button"
                  className="auth-button auth-button-secondary"
                  onClick={() => (currentStep === 0 ? router.push('/home') : setCurrentStep((s) => s - 1))}
                >
                  {currentStep === 0 ? 'Skip for now' : 'Back'}
                </button>

                <button type="submit" className="auth-button auth-button-primary" disabled={isSaving || (currentStep === 0 && isLoadingUser)}>
                  {isSaving ? 'Saving…' : isLastStep ? 'Finish setup' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
