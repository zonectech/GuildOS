import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  icon?: ReactNode;
  containerClassName?: string;
};

export function SearchField({ icon, className, containerClassName, ...props }: SearchFieldProps) {
  return (
    <div className={cx('relative flex-1 sm:flex-none', containerClassName)}>
      {icon ? <div className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500">{icon}</div> : null}
      <input
        {...props}
        type="search"
        className={cx(
          'guild-field w-full rounded-xl border py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64',
          !icon && 'pl-3',
          className,
        )}
      />
    </div>
  );
}

