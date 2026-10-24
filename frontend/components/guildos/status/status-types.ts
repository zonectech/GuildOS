export type StatusKind = 'event' | 'update' | 'milestone';

export type GuildStatus = {
  id: string;
  name: string;
  avatar?: string;
  label?: string;
  description?: string;
  kind?: StatusKind;
  accent?: string;
  href?: string;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
  viewed?: boolean;
};
