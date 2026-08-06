import { cx } from './cx';

type FilterPillsProps<T extends string> = {
  items: T[];
  active: T;
  onChange: (item: T) => void;
  getLabel?: (item: T) => string;
  className?: string;
};

export function FilterPills<T extends string>({ items, active, onChange, getLabel, className }: FilterPillsProps<T>) {
  if (items.length <= 1) return null;

  return (
    <div className={cx('-mx-1 flex gap-2 overflow-x-auto px-1 pb-1', className)} role="tablist" aria-label="Filter results">
      {items.map((item) => {
        const selected = active === item;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item)}
            className={cx(
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2',
              selected ? 'bg-slate-900 text-white' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
            )}
          >
            {getLabel ? getLabel(item) : item}
          </button>
        );
      })}
    </div>
  );
}

