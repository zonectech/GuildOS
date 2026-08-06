'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { resolveEventImageUrl } from '../event-api';

/** Flyer/photo slideshow: arrows + dots + thumbnails, click to preview full-screen. */
export function EventGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = images[Math.min(index, images.length - 1)];
  const go = (dir: number) => setIndex((i) => (i + dir + images.length) % images.length);

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Flyers & photos</h2>
      <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950">
        <img
          src={resolveEventImageUrl(current)}
          alt={`${title} — image ${index + 1} of ${images.length}`}
          onClick={() => setLightbox(true)}
          className="mx-auto max-h-[26rem] w-full cursor-zoom-in object-contain"
        />
        {images.length > 1 ? (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 dark:text-slate-300 shadow hover:bg-white dark:hover:bg-slate-800" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-700 dark:text-slate-300 shadow hover:bg-white dark:hover:bg-slate-800" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-white dark:bg-slate-900' : 'w-2 bg-white/60'}`} aria-label={`Go to image ${i + 1}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={img} onClick={() => setIndex(i)} className={`shrink-0 overflow-hidden rounded-xl border-2 ${i === index ? 'border-indigo-500' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={resolveEventImageUrl(img)} alt={`Thumbnail ${i + 1}`} className="h-16 w-16 object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close preview"><X className="h-5 w-5" /></button>
          {images.length > 1 ? (
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button>
          ) : null}
          <img src={resolveEventImageUrl(current)} alt={`${title} preview`} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-auto max-w-[92vw] rounded-xl object-contain" />
          {images.length > 1 ? (
            <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next image"><ChevronRight className="h-6 w-6" /></button>
          ) : null}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">{index + 1} / {images.length}</p>
        </div>
      ) : null}
    </section>
  );
}
