'use client';

import { useEffect, useState } from 'react';

import { HomeStatusStrip } from '../home-status-strip';
import { readStatusStories, type StatusStory } from './status-store';
import type { AuthUser } from '../auth-api';

type HomeStatusProps = {
  user: AuthUser | null;
  avatar?: string;
  people: unknown[];
};

/**
 * Home-facing Status integration.
 *
 * Status data and composition live here instead of inside the Home page.
 * Home only provides the current user.
 */
export function HomeStatus({ user, avatar }: HomeStatusProps) {
  const [stories, setStories] = useState<StatusStory[]>([]);

  useEffect(() => {
    let active = true;

    void readStatusStories()
      .then((items) => {
        if (active) {
          setStories(items);
        }
      })
      .catch(() => {
        if (active) {
          setStories([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const ownStatus = stories.find(
    (story) => story.userId === user?.id && !story.community,
  );

  const communityStories = stories.filter(
    (story) => story.userId !== user?.id || Boolean(story.community),
  );

  return (
    <HomeStatusStrip
      currentUser={{
        id: user?.id ?? '',
        name: user?.fullName || 'You',
        avatar: avatar || undefined,
        status: ownStatus,
      }}
      stories={communityStories}
    />
  );
}