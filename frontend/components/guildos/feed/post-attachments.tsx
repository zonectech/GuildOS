'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Shared 5MB size guard used by both the file picker and clipboard-paste attach paths. */
export function acceptImageFile(file: File | null, setImage: (f: File | null) => void) {
  if (file && file.size > MAX_IMAGE_BYTES) {
    alert('Image must be 5MB or smaller.');
    return;
  }
  setImage(file);
}

export function ImagePreview({ image, setImage }: { image: File | null; setImage: (f: File | null) => void }) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!image) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (!preview) return null;
  return (
    <div className="relative inline-block">
      <img src={preview} alt="" className="max-h-56 rounded-2xl border border-slate-200 object-cover shadow-sm" />
      <button
        type="button"
        onClick={() => setImage(null)}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900/70 text-white backdrop-blur transition hover:bg-slate-900"
        aria-label="Remove image"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Icon-only attach button, meant to sit inline alongside other composer toolbar icons (e.g. the emoji picker). */
export function PhotoButton({ setImage }: { setImage: (f: File | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => acceptImageFile(e.target.files?.[0] ?? null, setImage)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label="Add photo"
        title="Add photo"
        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
      >
        <ImagePlus className="h-[18px] w-[18px]" />
      </button>
    </>
  );
}

/** All-in-one attach control (preview stacked above the button) -- kept for simpler composer usages. */
export function PostAttachments({ image, setImage }: { image: File | null; setImage: (f: File | null) => void }) {
  return (
    <div className="space-y-2">
      <ImagePreview image={image} setImage={setImage} />
      <PhotoButton setImage={setImage} />
    </div>
  );
}
