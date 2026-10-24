'use client';

import { Building2 } from 'lucide-react';
import { SelectMenu } from '../ui/select-menu';

type PickerCommunity = { _id: string; slug: string; name: string };

/**
 * "Which community am I managing?" for dashboard pages. With one community there's nothing to
 * choose, so it shows the name instead of a one-option dropdown.
 */
export function CommunityPicker({
  communities,
  value,
  onChange,
  valueKey = 'id',
}: {
  communities: PickerCommunity[];
  value: string;
  onChange: (value: string) => void;
  /** Some pages key by slug, others by id. */
  valueKey?: 'id' | 'slug';
}) {
  const keyOf = (c: PickerCommunity) => (valueKey === 'slug' ? c.slug : c._id);
  if (communities.length <= 1) {
    const only = communities[0];
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Building2 className="h-4 w-4 text-indigo-500" /> {only ? only.name : 'No communities yet'}
      </span>
    );
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">Community</span>
      <SelectMenu
        aria-label="Community"
        className="w-60"
        size="sm"
        value={value}
        onChange={onChange}
        options={communities.map((c) => ({ value: keyOf(c), label: c.name }))}
      />
    </label>
  );
}
