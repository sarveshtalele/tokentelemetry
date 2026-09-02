import type { ReactNode } from 'react';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[620px] bg-surface shadow-[-16px_0_50px_rgba(15,23,42,.16)] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-surface z-10">
          <strong className="text-sm">{title}</strong>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-md hover:bg-surface-muted text-ink-soft">
            <IconClose />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </div>
  );
}
