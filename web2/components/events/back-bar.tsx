'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Share2 } from 'lucide-react';
import { cameFromList, returnToList } from '@/lib/back';
import { useToast } from '@/components/ui/toast';

/**
 * The event page's top row: a back arrow and Share.
 * Back steps back to the list you came from (same scroll position), or goes to Events from a shared link.
 */
export function BackBar({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const back = () => {
    if (cameFromList() && window.history.length > 1) { returnToList(); router.back(); }
    else router.push('/events');
  };
  const share = async () => {
    const url = `${window.location.origin}/events/${slug}`;
    try { if (navigator.share) await navigator.share({ url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* dismissed */ }
  };
  return (
    <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-2 pt-2 sm:px-4 lg:px-6">
      <button type="button" onClick={back} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14.5px] font-semibold hover:bg-mist">
        <ArrowLeft size={18} />Events
      </button>
      <button type="button" onClick={() => void share()} aria-label="Share" className="grid size-10 place-items-center rounded-full hover:bg-mist"><Share2 size={18} /></button>
    </div>
  );
}
