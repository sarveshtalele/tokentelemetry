import { useState, type ReactNode } from 'react';

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-ink text-white text-[11px] px-2 py-1 z-20">
          {label}
        </span>
      )}
    </span>
  );
}
