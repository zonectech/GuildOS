import 'dotenv/config';
import http from 'node:http';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { MulterError } from 'multer';
import { config } from './config';
import { connectDatabase } from './db';
import { rateLimit } from './middleware/rate-limit';
import { UploadValidationError } from './middleware/upload';
import { sanitizeRequest, extraSecurityHeaders } from './middleware/security';
import helmet from 'helmet';
import { authRouter } from './routes/auth.routes';
import { oauthRouter } from './routes/oauth.routes';
import { profileRouter } from './routes/profile.routes';
import { credentialRouter } from './routes/external-credential.routes';
import { portfolioRouter } from './routes/portfolio.routes';
import { resumeRouter } from './routes/resume.routes';
import { certificatesRouter } from './routes/certificates.routes';
import { eventsRouter } from './routes/events.routes';
import { communitiesRouter } from './routes/communities.routes';
import { communityUploadRouter } from './routes/community-upload.routes';
import { membershipsRouter } from './routes/memberships.routes';
import { rolesRouter } from './routes/roles.routes';
import { usersRouter } from './routes/users.routes';
import { searchRouter } from './routes/search.routes';
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
import { docsRouter } from './routes/docs.routes';
import { seedOpportunitiesIfEmpty, closeExpiredOpportunities } from './services/opportunity.service';
import { seedAdminIfConfigured } from './services/admin-seed.service';
import { startOpportunitySyncScheduler } from './services/opportunity-ingest.service';
import { startEventReminderScheduler, remindAnticipators } from './services/event-notification.service';
import { startEventFinalizeScheduler } from './services/event-scheduler';
import { verifyPremiumPayment, expireLapsedPremium, reconcilePendingPayments } from './services/premium.service';
import { sendWeeklyDigests, remindFinishedLeaderSessions } from './services/weekly-digest.service';
import { sweepDisappearingMessages } from './services/messaging.service';
import { notifyStaleCvs } from './services/cv.service';
import { remindStaleSponsorshipInquiries } from './services/sponsorship.service';
import { repairAllCommunityEventCounts, repairAllEventRegistrationCounters } from './services/event/event-shared';
import { repairAllCommunityMemberCounts } from './services/community/community-membership.service';
import { verifyTicketPayment, reconcilePendingTicketPayments } from './services/event/event-ticket.service';
import { verifySponsorshipPayment, reconcilePendingSponsorshipPayments } from './services/sponsorship-payment.service';
import { applyTransferWebhook } from './services/community/community-wallet.service';
import { isRemoteStorage, publicUrl, localUploadsDir } from './services/storage.service';
import { isValidPaystackSignature, isValidFlutterwaveSignature, isValidFlutterwaveV4Signature } from './services/payment-gateway.service';
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
import { adminTicketsRouter } from './routes/admin.tickets.routes';
import { institutionsRouter, adminInstitutionsRouter } from './routes/institutions.routes';
import { seedCoreInstitutions } from './services/institution.service';
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
  await seedCoreInstitutions();

  const app = express();

  // Behind a proxy/load balancer in production so secure cookies and req.ip work.
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');

  // Gzip JSON responses �?feed/community payloads shrink ~5-10x over the wire.
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
    // Images live in Cloudflare R2 �?redirect to its CDN URL (free egress, no bytes through the app).
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
  // Paystack webhook must read the RAW body to verify the signature �?mount before express.json().
  app.post('/api/payments/paystack/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    const raw = req.body as Buffer;
    if (!isValidPaystackSignature(raw, signature)) {
      return res.status(401).json({ error: 'invalid signature' });
    }
    try {
      const event = JSON.parse(raw.toString('utf8'));
      if (event?.event === 'charge.success' && event?.data?.reference) {
        const reference = event.data.reference as string;
        // Reference prefix routes the payment type: TKT- = ticket, SPN- = sponsorship, else premium.
        if (reference.startsWith('TKT-')) await verifyTicketPayment(reference);
        else if (reference.startsWith('SPN-')) await verifySponsorshipPayment(reference);
        else await verifyPremiumPayment(reference);
      }
    } catch {
      /* ignore malformed webhook bodies */
    }
    return res.sendStatus(200);
  });

  // Flutterwave webhook — v3 sends the static secret hash in `verif-hash`; v4 sends
  // HMAC-SHA256(raw body, secret hash) base64 in `flutterwave-signature`. Accept either.
  app.post('/api/payments/flutterwave/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    const raw = req.body as Buffer;
    const v3Signature = req.headers['verif-hash'] as string | undefined;
    const v4Signature = req.headers['flutterwave-signature'] as string | undefined;
    if (!isValidFlutterwaveSignature(v3Signature) && !isValidFlutterwaveV4Signature(raw, v4Signature)) {
      return res.status(401).json({ error: 'invalid signature' });
    }
    try {
      const event = JSON.parse(raw.toString('utf8'));
      // v3 payloads carry data.tx_ref; v4 charge payloads carry data.reference (OUR reference).
      const reference = (event?.data?.tx_ref ?? event?.data?.reference) as string | undefined;
      const type = String(event?.type ?? event?.event ?? '');
      if (type.startsWith('transfer.')) {
        // Payout status update: settle the matching wallet payout by transfer reference.
        const transferRef = String(event?.data?.reference ?? event?.data?.id ?? '');
        const status = String(event?.data?.status ?? '');
        if (transferRef) await applyTransferWebhook(transferRef, status);
      } else if (reference) {
        // verifyPremiumPayment/verifyTicketPayment re-check the real status with Flutterwave before applying.
        if (reference.startsWith('TKT-')) await verifyTicketPayment(reference);
        else await verifyPremiumPayment(reference);
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
  app.use('/api/credentials', credentialRouter);
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/resume', resumeRouter);
  app.use('/api/certificates', certificatesRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/communities', communitiesRouter);
  app.use('/api/communities/upload', communityUploadRouter);
  app.use('/api/memberships', membershipsRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/reputation', reputationRouter);
  app.use('/api/cv', cvRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/recruiter', recruiterRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/docs', docsRouter);
  app.use('/api/follow', followRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/verification', verificationRouter);
  app.use('/api/connections', connectionRouter);
  app.use('/api/community-access', communityAccessRouter);
  app.use('/api/institutions', institutionsRouter);
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
  app.use('/api/admin/tickets', adminTicketsRouter);
  app.use('/api/admin/institutions', adminInstitutionsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Last-resort error handler: log the full error server-side (structured, greppable),
  // never leak stack traces to clients. Route handlers all have their own try/catch —
  // this catches middleware throws and anything they miss.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GuildOS ERROR] ${new Date().toISOString()} ${req.method} ${req.path} — ${message}`, err instanceof Error ? err.stack : '');
    if (res.headersSent) return;
    // Multer's fileFilter/limits errors (rejected file type, file too large) are thrown
    // from upload middleware BEFORE the route handler's own try/catch ever runs — they'd
    // otherwise be silently masked as a generic 500 with no clue what went wrong.
    // These messages are pre-written and safe to show verbatim (never internal detail).
    if (err instanceof UploadValidationError || err instanceof MulterError) {
      const friendly = err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5MB).' : message;
      return res.status(400).json({ error: friendly });
    }
    res.status(500).json({ error: 'Something went wrong on our side — please try again.' });
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
    // Close OPEN opportunities whose deadline has passed (every 6h + on boot).
    void closeExpiredOpportunities().catch(() => undefined);
    setInterval(() => { void closeExpiredOpportunities().catch(() => undefined); }, 1000 * 60 * 60 * 6);
    // Recover payments stuck PENDING when a callback/webhook was missed (every 10 min + shortly after boot).
    setTimeout(() => { void reconcilePendingPayments(); void reconcilePendingTicketPayments(); void reconcilePendingSponsorshipPayments(); }, 1000 * 30);
    setInterval(() => { void reconcilePendingPayments(); void reconcilePendingTicketPayments(); void reconcilePendingSponsorshipPayments(); }, 1000 * 60 * 10);
    // Weekly digest email (checked every 6h; the service itself guards the 7-day gap)
    // + founder nudge when a leadership session's year has clearly ended (daily).
    setTimeout(() => { void sendWeeklyDigests().catch(() => undefined); void remindFinishedLeaderSessions().catch(() => undefined); }, 1000 * 60);
    setInterval(() => { void sendWeeklyDigests().catch(() => undefined); }, 1000 * 60 * 60 * 6);
    setInterval(() => { void remindFinishedLeaderSessions().catch(() => undefined); }, 1000 * 60 * 60 * 24);
    // Disappearing messages: soft-delete anything past its conversation's window.
    setInterval(() => { void sweepDisappearingMessages().catch(() => undefined); }, 1000 * 60 * 15);
    // "Your CV is out of date" nudge (in-app bell only, no AI/email cost) — daily sweep,
    // each CV's own staleNotifiedAt dedupes it to once per 14 days (reset by a manual refresh).
    setTimeout(() => { void notifyStaleCvs().catch(() => undefined); }, 1000 * 90);
    setInterval(() => { void notifyStaleCvs().catch(() => undefined); }, 1000 * 60 * 60 * 24);
    // Sponsorship inquiries sitting in NEW for 72h+ — nudge the organizer (every 6h;
    // each inquiry's staleRemindedAt dedupes to a single reminder).
    setTimeout(() => { void remindStaleSponsorshipInquiries().catch(() => undefined); }, 1000 * 120);
    setInterval(() => { void remindStaleSponsorshipInquiries().catch(() => undefined); }, 1000 * 60 * 60 * 6);
    // "You saved this event and it starts soon" nudge for bookmarkers who never
    // registered (every 6h; each event's anticipatorsRemindedAt dedupes it).
    setTimeout(() => { void remindAnticipators().catch(() => undefined); }, 1000 * 150);
    setInterval(() => { void remindAnticipators().catch(() => undefined); }, 1000 * 60 * 60 * 6);
    // Self-heal community event counters (repairs legacy +1/-1 drift, e.g. "-1 events")
    // + member counts (same drift-prone bookkeeping) + per-event registration counters
    // (catches hand-seeded numbers like "120 registered" with zero real registrations).
    setTimeout(() => {
      void repairAllCommunityEventCounts().catch(() => undefined);
      void repairAllCommunityMemberCounts().catch(() => undefined);
      void repairAllEventRegistrationCounters().catch(() => undefined);
    }, 1000 * 20);
  });
}

// Process-level safety nets: log-and-continue for unhandled rejections (usually a
// missed .catch on a background task �?crashing would take the whole API down),
// log-and-exit for uncaught exceptions (state may be corrupt; the process manager
// should restart us).
process.on('unhandledRejection', (reason) => {
  console.error(`[GuildOS UNHANDLED REJECTION] ${new Date().toISOString()}`, reason);
});
process.on('uncaughtException', (error) => {
  console.error(`[GuildOS UNCAUGHT EXCEPTION] ${new Date().toISOString()}`, error);
  process.exit(1);
});

void startServer().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});

