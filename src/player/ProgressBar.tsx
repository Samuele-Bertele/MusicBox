import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/utils/format';

export function ProgressBar({
  position,
  duration,
  onSeek,
  compact = false,
}: {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const value = dragging ?? position;
  const pct = duration > 0 ? Math.min(100, (value / duration) * 100) : 0;

  const fromEvent = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return 0;
    return ((clientX - rect.left) / rect.width) * duration;
  };

  useEffect(() => {
    if (dragging === null) return;
    const move = (e: PointerEvent) => setDragging(Math.max(0, Math.min(fromEvent(e.clientX), duration)));
    const up = (e: PointerEvent) => {
      onSeek(Math.max(0, Math.min(fromEvent(e.clientX), duration)));
      setDragging(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, duration]);

  return (
    <div className={`flex items-center gap-2 w-full ${compact ? '' : 'px-1'}`}>
      {!compact && <span className="text-[11px] text-muted tabular-nums w-10 text-right">{formatDuration(value)}</span>}
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Avanzamento del brano"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${formatDuration(value)} di ${formatDuration(duration)}`}
        className="group relative flex-1 h-6 flex items-center cursor-pointer touch-none"
        onPointerDown={(e) => {
          if (duration <= 0) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(Math.max(0, Math.min(fromEvent(e.clientX), duration)));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(position + 5, duration));
          if (e.key === 'ArrowLeft') onSeek(Math.max(position - 5, 0));
        }}
      >
        <div className="h-1 w-full rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-[width] duration-150" style={{ width: `${pct}%` }} />
        </div>
        <span
          className={`absolute h-3 w-3 rounded-full bg-accent -translate-x-1/2 transition-opacity
            ${dragging !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      {!compact && <span className="text-[11px] text-muted tabular-nums w-10">{formatDuration(duration)}</span>}
    </div>
  );
}
