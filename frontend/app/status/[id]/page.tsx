'use client';

// Save as: app/status/[id]/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  readStatusStories,
  type StatusStory,
} from '../../../components/guildos/status/status-store';

import { StatusViewer } from '../../../components/guildos/status/status-viewer';

export default function StatusDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [stories, setStories] = useState<StatusStory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);

  const statusId = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    let alive = true;

    void readStatusStories()
      .then((items) => {
        if (!alive) return;
        const active = items.filter(
          (story) => !story.expiresAt || new Date(story.expiresAt).getTime() > Date.now(),
        );
        setStories(active);
        setMissing(!active.some((story) => story.id === statusId));
        setLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setStories([]);
        setMissing(true);
        setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [statusId]);

  // The status was deleted, expired, or the link is wrong.
  useEffect(() => {
    if (loaded && missing) {
      router.replace('/status');
    }
  }, [loaded, missing, router]);

  const handleViewed = useCallback((id: string) => {
    setStories((list) => list.map((story) => (story.id === id ? { ...story, viewed: true } : story)));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setStories((list) => list.filter((story) => story.id !== id));
  }, []);

  const handleClose = useCallback(() => {
    // Opened directly from a link: there is no page to go back to.
    if (window.history.length > 1) router.back();
    else router.replace('/status');
  }, [router]);

  if (!loaded || missing || !stories.length) {
    return null;
  }

  return (
    <StatusViewer
      stories={stories}
      initialStoryId={statusId}
      resume={false}
      onClose={handleClose}
      onViewed={handleViewed}
      onDeleted={handleDeleted}
    />
  );
}