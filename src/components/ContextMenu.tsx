import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function useContextMenu() {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  return {
    anchor,
    open: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => {
      e.preventDefault?.();
      setAnchor({ x: e.clientX, y: e.clientY });
    },
    close: () => setAnchor(null),
  };
}

export function ContextMenu({
  anchor,
  items,
  onClose,
}: {
  anchor: { x: number; y: number } | null;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!anchor) return;
    const el = ref.current;
    const width = el?.offsetWidth ?? 220;
    const height = el?.offsetHeight ?? 240;
    setPos({
      x: Math.min(anchor.x, window.innerWidth - width - 12),
      y: Math.min(anchor.y, window.innerHeight - height - 12),
    });
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[70] min-w-[13rem] surface-card bg-elevated p-1.5 shadow-2xl animate-fade-up"
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          disabled={item.disabled}
          className={`w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-left transition-colors
            disabled:opacity-40 disabled:pointer-events-none
            ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-txt hover:bg-surface'}`}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
