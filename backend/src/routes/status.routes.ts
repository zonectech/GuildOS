import mongoose from 'mongoose';
import { Router } from 'express';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth';

import { StatusStoryModel } from '../models/status.model';
import { StatusViewModel } from '../models/status-view.model';
import { UserModel } from '../models/user.model';
import { ContentReportModel } from '../models/content-report.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { hasApprovedCommunityAccess } from '../services/community-access-policy';
import { hasCommunityPermission } from '../services/community.service';
import {
  buildStatusAttachment,
  defaultCaptionFor,
  kindForAttachment,
} from '../services/status-attachment.service';

import {
  normalizeStatusStoryInput,
  sortStatusesByNewest,
} from '../utils/status-story';

export const statusRouter = Router();

const STATUS_MAX_LENGTH = 500;
const STATUS_TITLE_MAX_LENGTH = 80;
const MAX_VIEWERS_LISTED = 200;

function mapAttachment(attachment: any) {
  if (!attachment) {
    return null;
  }

  return {
    type: attachment.type,
    refId: attachment.refId ?? '',
    slug: attachment.slug ?? '',
    title: attachment.title ?? '',
    subtitle: attachment.subtitle ?? '',
    image: attachment.image ?? '',
    startsAt: attachment.startsAt
      ? new Date(attachment.startsAt).toISOString()
      : null,
    mode: attachment.mode ?? '',
    venue: attachment.venue ?? '',
    href: attachment.href ?? '',
    snapshot: attachment.snapshot ?? null,
  };
}

function mapStatus(
  status: any,
  viewed = false,
  currentUserId?: unknown,
) {
  const ownerId: string | null =
    (status.userId?._id ?? status.userId)?.toString?.() ?? null;

  // Posted on behalf of a community: show the community (live name/logo when populated,
  // else the snapshot taken at posting time) and group its stories under the community.
  const communityRef = status.communityId;
  const communityId: string | null = (communityRef?._id ?? communityRef)?.toString?.() ?? null;
  const community = communityId
    ? {
        id: communityId,
        slug: communityRef?.slug ?? '',
        name: communityRef?.name ?? status.authorName ?? 'Community',
        logo: communityRef?.logo ?? status.authorAvatar ?? '',
      }
    : null;

  return {
    id:
      status._id?.toString?.() ??
      status.id,

    userId: ownerId,

    community,

    /** Stories are grouped per person — or per community for community posts. */
    groupKey: community ? `community:${community.id}` : ownerId,

    isOwner: Boolean(
      currentUserId &&
        ownerId &&
        ownerId === String(currentUserId),
    ),

    name:
      community?.name ??
      status.userId?.fullName ??
      status.authorName ??
      'You',

    avatar:
      (community ? community.logo : status.userId?.profile?.avatar) ??
      status.authorAvatar ??
      '',

    label:
      status.title ??
      status.content ??
      'Update',

    description:
      status.content ??
      '',

    kind:
      status.kind ??
      'update',

    accent:
      status.accent ??
      'from-emerald-500 to-teal-500',

    attachment: mapAttachment(status.attachment),

    href: `/status/${encodeURIComponent(
      status._id?.toString?.() ??
        status.id ??
        'story',
    )}`,

    createdAt:
      status.createdAt
        ? new Date(status.createdAt).toISOString()
        : new Date().toISOString(),

    expiresAt:
      status.expiresAt
        ? new Date(status.expiresAt).toISOString()
        : undefined,

    viewed,
  };
}

/**
 * GET /status
 *
 * Returns currently active statuses (campus-wide, like the For You feed).
 * Statuses hidden by moderation are excluded.
 */
statusRouter.get(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const now = new Date();

      const statuses =
        await StatusStoryModel.find({
          expiresAt: { $gt: now },
          hiddenAt: null,
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('userId', 'fullName profile.avatar')
          .populate('communityId', 'name slug logo')
          .lean();

      if (!statuses.length) {
        return res.json({ statuses: [] });
      }

      /**
       * Find which statuses the current
       * user has already viewed.
       */
      const statusIds = statuses.map((status) => status._id);

      const views =
        req.userId
          ? await StatusViewModel.find({
              statusId: { $in: statusIds },
              viewerId: req.userId,
            })
              .select('statusId')
              .lean()
          : [];

      const viewedIds = new Set(
        views.map((view) => view.statusId.toString()),
      );

      const mapped = sortStatusesByNewest(statuses).map((status) =>
        mapStatus(
          status,
          viewedIds.has(status._id.toString()),
          req.userId,
        ),
      );

      return res.json({ statuses: mapped });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load status updates',
      });
    }
  },
);

/**
 * GET /status/:id
 *
 * Returns one active status.
 */
statusRouter.get(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const status =
        await StatusStoryModel.findOne({
          _id: req.params.id,
          expiresAt: { $gt: new Date() },
          hiddenAt: null,
        })
          .populate('userId', 'fullName profile.avatar')
          .populate('communityId', 'name slug logo')
          .lean();

      if (!status) {
        return res.status(404).json({
          error: 'Status not found',
        });
      }

      let viewed = false;

      if (
        req.userId &&
        status.userId?._id?.toString() !== req.userId.toString()
      ) {
        const existingView =
          await StatusViewModel.exists({
            statusId: status._id,
            viewerId: req.userId,
          });

        viewed = Boolean(existingView);
      }

      return res.json({
        status: mapStatus(status, viewed, req.userId),
      });
    } catch (error) {
      return res.status(404).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load status',
      });
    }
  },
);

/**
 * GET /status/:id/views
 *
 * Owner only: who viewed this Status.
 */
statusRouter.get(
  '/:id/views',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const status =
        await StatusStoryModel.findOne({
          _id: req.params.id,
          userId: req.userId,
          expiresAt: { $gt: new Date() },
        })
          .select('_id')
          .lean();

      if (!status) {
        return res.status(404).json({
          error: 'Status not found or you are not the owner',
        });
      }

      const [count, views] = await Promise.all([
        StatusViewModel.countDocuments({ statusId: status._id }),
        StatusViewModel.find({ statusId: status._id })
          .sort({ viewedAt: -1 })
          .limit(MAX_VIEWERS_LISTED)
          .populate('viewerId', 'fullName profile.avatar')
          .lean(),
      ]);

      return res.json({
        count,
        viewers: views.map((view: any) => ({
          id: (view.viewerId?._id ?? view.viewerId)?.toString?.() ?? '',
          name: view.viewerId?.fullName ?? 'Unknown user',
          avatar: view.viewerId?.profile?.avatar ?? '',
          viewedAt: view.viewedAt
            ? new Date(view.viewedAt).toISOString()
            : new Date().toISOString(),
        })),
      });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load status viewers',
      });
    }
  },
);

/**
 * POST /status
 *
 * Create a new 24-hour Status.
 */
statusRouter.post(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const body = req.body as Record<string, unknown>;

      const author = await UserModel.findById(req.userId)
        .select('fullName profile.avatar')
        .lean();

      if (!author) {
        return res.status(401).json({ error: 'User not found' });
      }

      // "Post as community": only that community's leaders (COORDINATOR+) may.
      let community: { _id: mongoose.Types.ObjectId; name: string; logo?: string } | null = null;
      if (body.communityId) {
        if (!await hasApprovedCommunityAccess(req.userId)) return res.status(403).json({ error: 'Community Mode approval required', code: 'COMMUNITY_ACCESS_REQUIRED' });
        const communityId = String(body.communityId);
        if (!mongoose.Types.ObjectId.isValid(communityId)) {
          return res.status(400).json({ error: 'Community not found' });
        }
        const [found, membership] = await Promise.all([
          CommunityModel.findOne({ _id: communityId, archivedAt: null }).select('name logo').lean(),
          MembershipModel.findOne({ communityId, userId: req.userId }).select('role status').lean(),
        ]);
        if (!found) {
          return res.status(404).json({ error: 'Community not found' });
        }
        const activeLeader = membership
          && !['SUSPENDED', 'REMOVED', 'LEFT'].includes(String(membership.status))
          && hasCommunityPermission(membership.role, 'COORDINATOR');
        if (!activeLeader) {
          return res.status(403).json({ error: `Only ${found.name}'s leaders can post as the community` });
        }
        community = found;
      }

      /**
       * Event / ticket / certificate card. The client only says which one;
       * the server builds and validates it (ownership, visibility, ticket).
       */
      const attachment = await buildStatusAttachment(
        body.attachment,
        String(req.userId),
      );

      // No caption typed: use the default one for the attachment.
      const typedContent =
        typeof body.content === 'string' ? body.content.trim() : '';

      const content =
        typedContent ||
        (attachment ? defaultCaptionFor(attachment) : '');

      const title =
        typeof body.title === 'string' ? body.title : '';

      if (content.length > STATUS_MAX_LENGTH) {
        return res.status(400).json({
          error: `Status must be ${STATUS_MAX_LENGTH} characters or fewer`,
        });
      }

      if (title.trim().length > STATUS_TITLE_MAX_LENGTH) {
        return res.status(400).json({
          error: `Title must be ${STATUS_TITLE_MAX_LENGTH} characters or fewer`,
        });
      }

      const normalized = normalizeStatusStoryInput({
        authorName: community?.name ?? author.fullName,
        avatar: community ? community.logo : author.profile?.avatar,
        accent: typeof body.accent === 'string' ? body.accent : '',
        content,
        kind: attachment
          ? kindForAttachment(attachment)
          : typeof body.kind === 'string'
            ? body.kind
            : 'update',
        title,
      });

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const status = await StatusStoryModel.create({
        userId: req.userId,
        communityId: community?._id ?? null,
        authorName: normalized.authorName,
        authorAvatar: normalized.avatar,
        title: normalized.title,
        content: normalized.content,
        kind: normalized.kind,
        accent: normalized.accent,
        attachment,
        expiresAt,
      });

      return res.status(201).json({
        status: mapStatus(status.toObject(), false, req.userId),
      });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to share status update',
      });
    }
  },
);

/**
 * POST /status/attachment-preview
 *
 * Builds (and validates) the card for an event, ticket or certificate so the
 * composer can show exactly what will be posted, plus the default caption.
 * NOTE: registered before the /:id routes.
 */
statusRouter.post(
  '/attachment-preview',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const attachment = await buildStatusAttachment(
        { type: req.body?.type, id: req.body?.id },
        String(req.userId),
      );

      if (!attachment) {
        return res.status(400).json({
          error: 'Choose an event, ticket or certificate',
        });
      }

      return res.json({
        attachment: mapAttachment(attachment),
        defaultCaption: defaultCaptionFor(attachment),
      });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load that item',
      });
    }
  },
);

/**
 * POST /status/:id/view
 *
 * Record a Status view.
 */
statusRouter.post(
  '/:id/view',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const status =
        await StatusStoryModel.findOne({
          _id: req.params.id,
          expiresAt: { $gt: new Date() },
          hiddenAt: null,
        }).lean();

      if (!status) {
        return res.status(404).json({
          error: 'Status not found',
        });
      }

      /**
       * Owner viewing their own Status
       * does not count as a view.
       */
      if (status.userId?.toString() === req.userId.toString()) {
        return res.json({ viewed: false });
      }

      await StatusViewModel.updateOne(
        {
          statusId: status._id,
          viewerId: req.userId,
        },
        {
          $set: { viewedAt: new Date() },
        },
        { upsert: true },
      );

      return res.json({ viewed: true });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to record status view',
      });
    }
  },
);

/**
 * POST /status/:id/report
 *
 * Report someone else's Status (one report per user, like feed posts).
 */
statusRouter.post(
  '/:id/report',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ error: 'Status not found' });
      }

      const status =
        await StatusStoryModel.findOne({
          _id: req.params.id,
          expiresAt: { $gt: new Date() },
          hiddenAt: null,
        })
          .select('userId')
          .lean();

      if (!status) {
        return res.status(404).json({ error: 'Status not found' });
      }

      if (status.userId?.toString() === req.userId.toString()) {
        return res.status(400).json({
          error: 'You cannot report your own status',
        });
      }

      const reason =
        typeof req.body?.reason === 'string'
          ? req.body.reason.trim().slice(0, 300)
          : '';

      try {
        await ContentReportModel.create({
          targetType: 'STATUS',
          targetId: status._id,
          reporterId: req.userId,
          reason,
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          return res.json({ reported: true, already: true });
        }
        throw error;
      }

      return res.json({ reported: true, already: false });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to submit report',
      });
    }
  },
);

/**
 * DELETE /status/:id
 *
 * Only the owner can delete their Status.
 */
statusRouter.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const status =
        await StatusStoryModel.findOne({
          _id: req.params.id,
          userId: req.userId,
        });

      if (!status) {
        return res.status(404).json({
          error: 'Status not found or you are not the owner',
        });
      }

      await StatusViewModel.deleteMany({
        statusId: status._id,
      });

      await status.deleteOne();

      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to delete status',
      });
    }
  },
);