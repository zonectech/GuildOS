'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getResume } from './../../../components/guildos/auth-api';
import { Card } from './../../../components/guildos/ui/card';

export default function ResumePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : ''; 
  const [resume, setResume] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    void (async () => {
      try {
        const result = await getResume(username);
        if (!cancelled) setResume(result.resume);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load resume');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card className="p-6">
          <p className="text-red-600">{error}</p>
        </Card>
      </main>
    );
  }

  if (!resume) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card className="p-6">
          <p>Loading resume...</p>
        </Card>
      </main>
    );
  }

  const profile = resume.profile ?? resume;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-slate-950">{profile.fullName}</h1>
        <p className="text-sm text-slate-600">{resume.headline}</p>
        <p className="mt-2 text-slate-700">{resume.summary}</p>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950">Skills</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {resume.skills?.length ? (
            resume.skills.map((skill: string) => (
              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {skill}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">No skills available</p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Academic Information</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>University: {profile.university}</p>
            <p>Faculty: {profile.faculty}</p>
            <p>Department: {profile.department}</p>
            <p>Level: {profile.level}</p>
            <p>Graduation Year: {profile.graduationYear ?? 'N/A'}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Profile</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>Username: @{profile.username}</p>
            <p>Location: {profile.location || 'N/A'}</p>
            <p>Interests: {profile.interests?.join(', ') || 'N/A'}</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
