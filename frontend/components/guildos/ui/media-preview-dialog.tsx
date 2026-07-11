'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

type MediaPreviewDialogProps = {
  preview: { src: string; alt: string } | null;
  onClose: () => void;
};

export function MediaPreviewDialog({ preview, onClose }: MediaPreviewDialogProps) {
  useEffect(() => {
    if (!preview) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, preview]);

  if (!preview) return null;

  return (
    <div
      aria-label="Image preview"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close image preview"
        type="button"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={preview.src}
        alt={preview.alt}
        className="max-h-[90vh] w-auto max-w-[95vw] rounded-xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

