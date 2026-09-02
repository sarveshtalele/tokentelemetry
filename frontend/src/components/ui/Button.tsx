import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
}

export function Button({ variant = 'default', className = '', ...props }: Props) {
  const base = 'border rounded-md px-3.5 py-2 text-sm font-semibold transition-colors';
  const variants: Record<string, string> = {
    default: 'border-line bg-white text-ink hover:border-slate-300 hover:bg-slate-50',
    primary: 'border-accent bg-accent text-white hover:bg-accent-strong',
    ghost: 'border-transparent bg-transparent text-ink hover:bg-surface-muted',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
