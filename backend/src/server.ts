import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { config } from './config';
import { connectDatabase } from './db';
import { rateLimit } from './middleware/rate-limit';
import { authRouter } from './routes/auth.routes';
import { oauthRouter } from './routes/oauth.routes';
import { profileRouter } from './routes/profile.routes';
import { portfolioRouter } from './routes/portfolio.routes';
import { resumeRouter } from './routes/resume.routes';
import { certificatesRouter } from './routes/certificates.routes';
import { eventsRouter } from './routes/events.routes';
import { communitiesRouter } from './routes/communities.routes';
import { communityUploadRouter } from './routes/community-upload.routes';
import { membershipsRouter } from './routes/memberships.routes';
import { rolesRouter } from './routes/roles.routes';
import { usersRouter } from './routes/users.routes';
import { leadershipRouter } from './routes/leadership.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { reputationRouter } from './routes/reputation.routes';
import { cvRouter } from './routes/cv.routes';
import { opportunitiesRouter } from './routes/opportunities.routes';
import { recruiterRouter } from './routes/recruiter.routes';
import { feedRouter } from './routes/feed.routes';
import { followRouter } from './routes/follow.routes';
import { notificationRouter } from './routes/notification.routes';
import { verificationRouter } from './routes/verification.routes';
import { seedOpportunitiesIfEmpty } from './services/opportunity.service';
import { seedAdminIfConfigured } from './services/admin-seed.service';
import { startOpportunitySyncScheduler } from './services/opportunity-ingest.service';
import { startEventReminderScheduler } from './services/event-notification.service';
import { startEventFinalizeScheduler } from './services/event-scheduler';
import { healthRouter } from './routes/health.routes';
import { adminCommunitiesRouter } from './routes/admin.communities.routes';
import { adminRecruitersRouter } from './routes/admin.recruiters.routes';
import { adminAnalyticsRouter } from './routes/admin.analytics.routes';
import { adminUsersRouter } from './routes/admin.users.routes';
import { adminSeedRouter } from './routes/admin.seed.routes';
import './utils/email';

async function startServer() {
  console.log('[GuildOS] Starting backend...');
  await connectDatabase();

  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit);

  app.use((req, res, next) => {
    const startedAt = Date.now();
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    res.on('finish', () => {
      const duration = Date.now() - startedAt;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  app.get('/', (_req, res) => {
    res.json({ message: 'GuildOS security backend is running' });
  });

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/oauth', oauthRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/resume', resumeRouter);
  app.use('/api/certificates', certificatesRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/communities', communitiesRouter);
  app.use('/api/communities/upload', communityUploadRouter);
  app.use('/api/memberships', membershipsRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/reputation', reputationRouter);
  app.use('/api/cv', cvRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/recruiter', recruiterRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/follow', followRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/verification', verificationRouter);
  app.use('/api/admin/communities', adminCommunitiesRouter);
  app.use('/api/admin/recruiters', adminRecruitersRouter);
  app.use('/api/admin/analytics', adminAnalyticsRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/seed', adminSeedRouter);
  app.use('/api/leadership', leadershipRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.listen(config.port, () => {
    console.log(`Backend running on http://localhost:${config.port}`);
    console.log('[GuildOS] Database is connected and server is ready');
    startEventReminderScheduler();
    startEventFinalizeScheduler();
    void seedAdminIfConfigured();
    void seedOpportunitiesIfEmpty();
    startOpportunitySyncScheduler();
  });
}

void startServer().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});

