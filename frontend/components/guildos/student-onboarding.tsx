'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding, getCurrentUser, saveProfile as saveProfileRequest, uploadAvatar } from './auth-api';
import { STUDENT_INTEREST_OPTIONS, STUDENT_ONBOARDING_STEPS } from './onboarding-data';

const STUDY_LEVEL_OPTIONS = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
  'Postgraduate',
  'Other',
] as const;

const UNIVERSITY_OPTIONS = [
  'University of Lagos',
  'University of Ibadan',
  'Obafemi Awolowo University',
  'University of Nigeria, Nsukka',
  'Ahmadu Bello University',
  'University of Benin',
  'Bayero University Kano',
  'University of Ilorin',
  'Federal University of Technology, Akure',
  'Covenant University',
  'Lagos State University',
  'University of Port Harcourt',
  'Nnamdi Azikiwe University',
  'University of Jos',
  'University of Calabar',
  'Other',
] as const;

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
  university: string;
  faculty: string;
  department: string;
  level: string;
  interests: string[];
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
  const [universitySearch, setUniversitySearch] = useState('');
  const [formData, setFormData] = useState<StudentProfileState>({
    fullName: '',
    email: '',
    university: '',
    faculty: '',
    department: '',
    level: '',
    interests: [],
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
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const step = STUDENT_ONBOARDING_STEPS[currentStep] ?? STUDENT_ONBOARDING_STEPS[0];
  const isLastStep = currentStep === STUDENT_ONBOARDING_STEPS.length - 1;

  const filteredUniversityOptions = useMemo(() => {
    const query = universitySearch.trim().toLowerCase();
    if (!query) return UNIVERSITY_OPTIONS;
    return UNIVERSITY_OPTIONS.filter((university) => university.toLowerCase().includes(query));
  }, [universitySearch]);

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
      setCurrentStep((s) => s + 1);
      return;
    }

    setIsSaving(true);
    try {
      await saveProfileRequest({
        username: formData.fullName.trim().toLowerCase().replace(/\s+/g, '_'),
        university: formData.university,
        faculty: formData.faculty,
        department: formData.department,
        level: formData.level,
        interests: formData.interests,
        location: formData.location,
        socialLinks: formData.socialLinks,
        avatar: formData.avatar,
      });

      if (formData.avatarFile && !avatarSkipped) {
        const avatarFormData = new FormData();
        avatarFormData.append('avatar', formData.avatarFile);
        await uploadAvatar(avatarFormData);
      }

      await completeOnboarding();
      setIsComplete(true);
    } catch (err) {
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
            <div className="auth-card-header auth-card-header-center">
              <div>
                <p className="auth-card-eyebrow">Setup Complete</p>
                <h1>Your profile is ready</h1>
              </div>
            </div>
            <p className="auth-description">Start discovering communities and events.</p>
            <div className="auth-stack-actions">
              <button
                type="button"
                className="auth-button auth-button-primary"
                onClick={() => router.push('/home')}
              >
                Go To Dashboard
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page auth-page-split auth-page-setup">
      <section className="auth-shell auth-shell-setup">
        <div className="auth-setup-hero">
          <p className="auth-kicker">Profile Setup</p>
          {isLoadingUser ? <p className="auth-description">Loading your account...</p> : null}
          <h1>{step.title}</h1>
          <p className="auth-hero-text">{step.text}</p>
          <div className="auth-setup-summary">
            <div>
              <span>Progress</span>
              <strong>
                {currentStep + 1} of {STUDENT_ONBOARDING_STEPS.length}
              </strong>
            </div>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-card auth-card-surface auth-setup-card">
            <form className="auth-form auth-setup-form" onSubmit={handleSubmit}>
              <AuthField
                label="Your Full Name"
                autoComplete="name"
                value={formData.fullName}
                onChange={(value) => setFormData((s) => ({ ...s, fullName: value }))}
                required
              />

              <label className="auth-field">
                <span>Verified Email</span>
                <input type="email" value={formData.email} readOnly aria-readonly="true" />
              </label>

              {currentStep === 0 ? (
                <div className="space-y-3">
                  <p className="auth-description">
                    Turn campus participation into verifiable achievements.
                  </p>
                  <div className="auth-stack-actions">
                    <button
                      type="button"
                      className="auth-button auth-button-primary"
                      onClick={() => setCurrentStep(1)}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      className="auth-button auth-button-secondary"
                      onClick={() => router.push('/home')}
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div className="space-y-3">
                  <label className="auth-field">
                    <span>University / Institution</span>
                    <input
                      type="text"
                      list="university-options"
                      placeholder="Search your university"
                      autoComplete="organization"
                      value={formData.university}
                      required
                      onChange={(event) => {
                        const value = event.target.value;
                        setUniversitySearch(value);
                        setFormData((s) => ({ ...s, university: value }));
                      }}
                    />
                  </label>
                  <datalist id="university-options">
                    {filteredUniversityOptions.map((university) => (
                      <option key={university} value={university} />
                    ))}
                  </datalist>

                  <AuthField
                    label="Faculty or School"
                    autoComplete="off"
                    value={formData.faculty}
                    onChange={(value) => setFormData((s) => ({ ...s, faculty: value }))}
                  />

                  <AuthField
                    label="Department or Program"
                    autoComplete="off"
                    value={formData.department}
                    onChange={(value) => setFormData((s) => ({ ...s, department: value }))}
                  />

                  <label className="auth-field">
                    <span>Current Study Level</span>
                    <select
                      value={formData.level}
                      required
                      onChange={(event) =>
                        setFormData((s) => ({ ...s, level: event.target.value }))
                      }
                    >
                      <option value="" disabled>
                        Select your level
                      </option>
                      {STUDY_LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="auth-field">
                  <span>What are you interested in? <span className="text-xs font-normal text-slate-400">(tap to pick, up to 10)</span></span>
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
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                          }`}
                        >
                          {selected ? '✓ ' : ''}{interest}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{formData.interests.length}/10 selected</p>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="space-y-3">
                  <label className="auth-field">
                    <span>Profile Photo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
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

                  <button
                    type="button"
                    className="auth-button auth-button-secondary"
                    onClick={() => {
                      setAvatarSkipped(true);
                      setFormData((s) => ({ ...s, avatar: '', avatarFile: null }));
                    }}
                  >
                    Skip for now
                  </button>
                </div>
              ) : null}

              {error ? <p className="auth-error-text">{error}</p> : null}

              <div className="auth-stack-actions auth-setup-actions">
                <button
                  type="button"
                  className="auth-button auth-button-secondary"
                  onClick={() =>
                    currentStep === 0 ? router.push('/signup') : setCurrentStep((s) => s - 1)
                  }
                >
                  {currentStep === 0 ? 'Back to Sign Up' : 'Back'}
                </button>

                <button type="submit" className="auth-button auth-button-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : isLastStep ? 'Finish Setup' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
