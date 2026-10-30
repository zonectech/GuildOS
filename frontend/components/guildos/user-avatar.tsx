'use client';
import { useState } from 'react';
import { resolveAvatarUrl } from './api/community-list-api';
import { brandColor, initials } from './ui/initial-avatar';
export function UserAvatar({ avatar, name, className = '' }: { avatar?: string; name: string; className?: string }) {
 const src = resolveAvatarUrl(avatar);
 const [failed, setFailed] = useState('');
 // No photo: the same coloured monogram the feed and top bar show for this person.
 return src && failed !== src
  ? <img src={src} alt={name} onError={() => setFailed(src)} className={className + ' object-cover'} />
  : <span aria-label={name} className={className} style={{ backgroundColor: brandColor(name), color: '#fff', fontWeight: 600 }}>{initials(name)}</span>;
}
