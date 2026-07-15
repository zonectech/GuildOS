import 'dotenv/config';
import http from 'node:http';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { connectDatabase } from './db';
import { rateLimit } from './middleware/rate-limit';
import { sanitizeRequest, extraSecurityHeaders } from './middleware/security';
import helmet from 'helmet';
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
import { knowledgeRouter } from './routes/knowledge.routes';
import { followRouter } from './routes/follow.routes';
import { notificationRouter } from './routes/notification.routes';
import { verificationRouter } from './routes/verification.routes';
import { connectionRouter } from './routes/connection.routes';
import { communityAccessRouter, adminCommunityAccessRouter } from './routes/community-access.routes';
import { messageRouter } from './routes/message.routes';
import { assistantRouter } from './routes/assistant.routes';
import { seedOpportunitiesIfEmpty } from './services/opportunity.service';
import { seedAdminIfConfigured } from './services/admin-seed.service';
import { startOpportunitySyncScheduler } from './services/opportunity-ingest.service';
import { startEventReminderScheduler } from './services/event-notification.service';
import { startEventFinalizeScheduler } from './services/event-scheduler';
import { verifyPremiumPayment, expireLapsedPremium, reconcilePendingPayments } from './services/premium.service';
import { isRemoteStorage, publicUrl, localUploadsDir } from './services/storage.service';
import { isValidPaystackSignature, isValidFlutterwaveSignature } from './services/payment-gateway.service';
import { healthRouter } from './routes/health.routes';
import { adminCommunitiesRouter } from './routes/admin.communities.routes';
import { adminRecruitersRouter } from './routes/admin.recruiters.routes';
import { adminAnalyticsRouter } from './routes/admin.analytics.routes';
import { adminWatchtowerRouter } from './routes/admin.watchtower.routes';
import { adminUsersRouter } from './routes/admin.users.routes';
import { adminSeedRouter } from './routes/admin.seed.routes';
import { adminInactiveRouter } from './routes/admin.inactive.routes';
import { adminContentRouter } from './routes/admin.content.routes';
import { adminAuditRouter } from './routes/admin.audit.routes';
import { adminBroadcastRouter } from './routes/admin.broadcast.routes';
import { adminEventsRouter } from './routes/admin.events.routes';
import { adminSponsorshipRouter } from './routes/admin.sponsorship.routes';
import { initRealtime } from './realtime';
import './utils/email';

async function startServer() {
  console.log('[GuildOS] Starting backend...');

  if (config.isProduction) {
    const secret = config.jwtSecret;
    if (!process.env.JWT_SECRET || secret === 'dev-secret-change-me' || secret.length < 32) {
      throw new Error('JWT_SECRET must be set to a strong secret (32+ characters) in production.');
    }
  }

  await connectDatabase();

  const app = express();

  // Behind a proxy/load balancer in production so secure cookies and req.ip work.
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');

  // Gzip JSON responses — feed/community payloads shrink ~5-10x over the wire.
  app.use(compression());

  app.use(
    helmet({
      // API responses are JSON; /uploads sets its own strict CSP below.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Allow the frontend to load /uploads images from this origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );
  app.use(extraSecurityHeaders);
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  if (isRemoteStorage()) {
    // Images live in Cloudflare R2 — redirect to its CDN URL (free egress, no bytes through the app).
    app.get('/uploads/:key', (req, res) => res.redirect(302, publicUrl(req.params.key)));
  } else {
    app.use(
      '/uploads',
      express.static(localUploadsDir, {
        setHeaders: (res) => {
          // Neutralise any HTML/SVG payload that slipped through and stop MIME sniffing.
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
          res.setHeader('X-Content-Type-Options', 'nosniff');
        },
      }),
    );
  }
  // Paystack webhook must read the RAW body to verify the signature — mount before express.json().
  app.post('/api/payments/paystack/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    const raw = req.body as Buffer;
    if (!isValidPaystackSignature(raw, signature)) {
      return res.status(401).json({ error: 'invalid signature' });
    }
    try {
      const event = JSON.parse(raw.toString('utf8'));
      if (event?.event === 'charge.success' && event?.data?.reference) {
        await verifyPremiumPayment(event.data.reference);
      }
    } catch {
      /* ignore malformed webhook bodies */
    }
    return res.sendStatus(200);
  });

  // Flutterwave webhook — verified by the static `verif-hash` header (secret hash).
  app.post('/api/payments/flutterwave/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    const signature = req.headers['verif-hash'] as string | undefined;
    if (!isValidFlutterwaveSignature(signature)) {
      return res.status(401).json({ error: 'invalid signature' });
    }
    try {
      const raw = req.body as Buffer;
      const event = JSON.parse(raw.toString('utf8'));
      const reference = event?.data?.tx_ref as string | undefined;
      // verifyPremiumPayment re-checks the real status with Flutterwave before applying.
      if (reference) {
        await verifyPremiumPayment(reference);
      }
    } catch {
      /* ignore malformed webhook bodies */
    }
    return res.sendStatus(200);
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeRequest);
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
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/follow', followRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/verification', verificationRouter);
  app.use('/api/connections', connectionRouter);
  app.use('/api/community-access', communityAccessRouter);
  app.use('/api/admin/community-access', adminCommunityAccessRouter);
  app.use('/api/messages', messageRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/admin/communities', adminCommunitiesRouter);
  app.use('/api/admin/recruiters', adminRecruitersRouter);
  app.use('/api/admin/analytics', adminAnalyticsRouter);
  app.use('/api/admin/watchtower', adminWatchtowerRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/seed', adminSeedRouter);
  app.use('/api/admin/inactive', adminInactiveRouter);
  app.use('/api/admin/content', adminContentRouter);
  app.use('/api/admin/audit', adminAuditRouter);
  app.use('/api/admin/broadcast', adminBroadcastRouter);
  app.use('/api/admin/events', adminEventsRouter);
  app.use('/api/admin/sponsorship', adminSponsorshipRouter);
  app.use('/api/leadership', leadershipRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  const server = http.createServer(app);
  initRealtime(server);

  server.listen(config.port, () => {
    console.log(`Backend running on http://localhost:${config.port}`);
    console.log('[GuildOS] Database is connected and server is ready');
    startEventReminderScheduler();
    startEventFinalizeScheduler();
    void seedAdminIfConfigured();
    void seedOpportunitiesIfEmpty();
    startOpportunitySyncScheduler();
    // Downgrade communities whose premium has lapsed (every 6h + on boot).
    void expireLapsedPremium();
    setInterval(() => { void expireLapsedPremium(); }, 1000 * 60 * 60 * 6);
    // Recover payments stuck PENDING when a callback/webhook was missed (every 10 min + shortly after boot).
    setTimeout(() => { void reconcilePendingPayments(); }, 1000 * 30);
    setInterval(() => { void reconcilePendingPayments(); }, 1000 * 60 * 10);
  });
}

void startServer().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});

