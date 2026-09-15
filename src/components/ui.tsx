import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Loader2, Music4, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ShelfSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="shelf-scroll" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-40 shrink-0 space-y-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 justify-center text-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-elevated grid place-items-center text-muted">
        {icon ?? <Music4 className="h-6 w-6" />}
      </div>
      <h3 className="text-lg">{title}</h3>
      {description && <p className="text-sm text-muted max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-6" role="alert">
      <div className="h-14 w-14 rounded-2xl bg-elevated grid place-items-center text-accent">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm text-muted max-w-sm">{message}</p>
      {onRetry && (
        <button className="btn-outline" onClick={onRetry}>
          Riprova
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="surface-card w-full max-w-md p-5 animate-fade-up"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg">{title}</h2>
          <button className="icon-btn h-8 w-8" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Elimina',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>
            Annulla
          </button>
          <button className="btn bg-red-500/90 text-white hover:bg-red-500" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed z-[60] bottom-32 md:bottom-28 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto animate-fade-up px-4 py-2.5 rounded-full text-sm shadow-lg border backdrop-blur
            ${t.tone === 'error' ? 'bg-red-950/90 border-red-800 text-red-100' : t.tone === 'success' ? 'bg-elevated/95 border-accent/40 text-txt' : 'bg-elevated/95 border-line text-txt'}`}
          role="status"
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

export function Artwork({
  src,
  alt,
  className = '',
  rounded = 'rounded-lg',
}: {
  src: string | null;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-elevated ${rounded} ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      ) : (
        <div className="h-full w-full grid place-items-center text-muted">
          <Music4 className="h-1/3 w-1/3" />
        </div>
      )}
    </div>
  );
}
