import { useState, type ReactNode } from 'react';

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[260px] whitespace-normal text-center leading-snug rounded-md bg-slate-900 dark:bg-slate-700 text-white text-[11px] px-2.5 py-1.5 z-20 shadow-lg">
          {label}
        </span>
      )}
    </span>
  );
}
