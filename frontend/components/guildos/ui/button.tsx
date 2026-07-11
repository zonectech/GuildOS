import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { UrlObject } from 'url';
import Link from 'next/link';
import { cx } from './cx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  asChild?: boolean;
  href?: string | UrlObject;
};

export function Button({ variant = 'secondary', size = 'md', className = '', children, asChild = false, href, ...props }: ButtonProps) {
  const variants = {
    primary: 'border border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'border border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700',
  };
  const sizes = {
    sm: 'min-h-9 rounded-lg px-3 text-xs',
    md: 'min-h-10 rounded-xl px-4 text-sm',
    lg: 'min-h-11 rounded-xl px-5 text-sm',
  };

  const classes = cx(
    'inline-flex items-center justify-center gap-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild && href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
