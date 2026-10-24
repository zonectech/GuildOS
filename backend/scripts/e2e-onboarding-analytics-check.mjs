import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const apiBase = 'http://localhost:3001';
const password = 'TestPass123!';

function parseMongoUri() {
  const envPath = path.resolve('backend/.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const line = envText.split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  if (!line) throw new Error('MONGODB_URI not found in backend/.env');
  return line.slice('MONGODB_URI='.length).trim();
}

async function signupAndTrack({ email, isStudent, university, courseOfStudy }) {
  const cookieJar = [];

  const captureCookies = (res) => {
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const item of setCookie) {
      const pair = item.split(';', 1)[0];
      const key = pair.split('=')[0];
      const index = cookieJar.findIndex((c) => c.startsWith(`${key}=`));
      if (index >= 0) cookieJar[index] = pair;
      else cookieJar.push(pair);
    }
  };

  const withCookies = () => (cookieJar.length ? { Cookie: cookieJar.join('; ') } : {});

  let res = await fetch(`${apiBase}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Run Flow User', email, password }),
  });
  captureCookies(res);
  if (!res.ok) throw new Error(`Signup failed for ${email}: ${res.status} ${await res.text()}`);

  res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withCookies() },
    body: JSON.stringify({ email, password }),
  });
  captureCookies(res);
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);

  res = await fetch(`${apiBase}/api/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...withCookies() },
    body: JSON.stringify({
      username: `run_${Math.random().toString(36).slice(2, 10)}`,
      showUniversity: isStudent,
      university,
      faculty: isStudent ? 'Engineering' : '',
      department: courseOfStudy,
      level: isStudent ? '300 Level' : '',
      interests: ['Software Engineering', 'Leadership'],
      skills: ['TypeScript'],
      location: 'Lagos',
      socialLinks: [],
      avatar: '',
    }),
  });
  if (!res.ok) throw new Error(`Profile patch failed for ${email}: ${res.status} ${await res.text()}`);

  res = await fetch(`${apiBase}/api/profile/onboarding/complete`, {
    method: 'POST',
    headers: { ...withCookies() },
  });
  if (!res.ok) throw new Error(`Onboarding complete failed for ${email}: ${res.status} ${await res.text()}`);

  res = await fetch(`${apiBase}/api/analytics/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withCookies() },
    body: JSON.stringify({
      eventName: 'onboarding_completed',
      isStudent,
      university,
      courseOfStudy,
      hasLocation: true,
      interestsCount: 2,
      stepIndex: 4,
      stepTitle: 'Connect your profiles',
    }),
  });
  if (!res.ok) throw new Error(`Analytics event failed for ${email}: ${res.status} ${await res.text()}`);
}

async function main() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 17);
  const studentEmail = `guildos.run.student+${stamp}@example.com`;
  const nonStudentEmail = `guildos.run.nonstudent+${stamp}@example.com`;

  await signupAndTrack({
    email: studentEmail,
    isStudent: true,
    university: 'University of Lagos',
    courseOfStudy: 'Computer Science',
  });

  await signupAndTrack({
    email: nonStudentEmail,
    isStudent: false,
    university: '',
    courseOfStudy: '',
  });

  const mongoUri = parseMongoUri();
  await mongoose.connect(mongoUri, { autoIndex: false });

  const collections = await mongoose.connection.db.listCollections().toArray();
  const names = new Set(collections.map((c) => c.name));
  const collectionName = names.has('onboardinganalytics')
    ? 'onboardinganalytics'
    : names.has('onboardinganalyticses')
      ? 'onboardinganalyticses'
      : 'onboardinganalytics';

  const rows = await mongoose.connection.db.collection(collectionName)
    .find({ eventName: 'onboarding_completed' })
    .sort({ createdAt: -1 })
    .limit(10)
    .project({ _id: 0, eventName: 1, isStudent: 1, university: 1, courseOfStudy: 1, createdAt: 1 })
    .toArray();

  const studentHit = rows.find((r) => r.isStudent === true && r.university === 'University of Lagos' && r.courseOfStudy === 'Computer Science');
  const nonStudentHit = rows.find((r) => r.isStudent === false);

  console.log('E2E_FLOW_OK');
  console.log('STUDENT_EMAIL=' + studentEmail);
  console.log('NONSTUDENT_EMAIL=' + nonStudentEmail);
  console.log('COLLECTION=' + collectionName);
  console.log('STUDENT_ROW_FOUND=' + Boolean(studentHit));
  console.log('NONSTUDENT_ROW_FOUND=' + Boolean(nonStudentHit));
  console.log('RECENT_ROWS=' + JSON.stringify(rows, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('E2E_FLOW_ERROR', err?.message ?? err);
  process.exit(1);
});
