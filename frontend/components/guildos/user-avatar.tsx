'use client';
import { useState } from 'react';
import { resolveAvatarUrl } from './community-list-api';
export function UserAvatar({ avatar, name, className = '' }: { avatar?: string; name: string; className?: string }) {
 const src = resolveAvatarUrl(avatar);
 const [failed, setFailed] = useState('');
 return src && failed !== src
  ? <img src={src} alt={name} onError={() => setFailed(src)} className={className + ' object-cover'} />
  : <span aria-label={name} className={className}>{(name || 'U').slice(0, 1).toUpperCase()}</span>;
}
