import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Heart, ListMusic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayer } from './PlayerProvider';
import { useLibrary } from '@/services/LibraryProvider';
import { Artwork } from '@/components/ui';
import { ProgressBar } from './ProgressBar';
import { TransportControls } from './PlayerControls';
import { QueuePanel } from './QueuePanel';

export function FullPlayer({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const { likedIds, toggleLike } = useLibrary();
  const [queueOpen, setQueueOpen] = useState(false);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const track = player.track;
  const isLiked = track ? likedIds.has(track.id) : false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!track) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-bg flex flex-col animate-slide-up"
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      role="dialog"
      aria-label="Player a schermo intero"
      onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
      onTouchMove={(e) => {
        if (startY.current === null) return;
        setDragY(Math.max(0, e.touches[0].clientY - startY.current));
      }}
      onTouchEnd={() => {
        if (dragY > 120) onClose();
        setDragY(0);
        startY.current = null;
      }}
    >
      {/* The artwork is the loudest thing here: a soft bloom of its own colour. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {track.artwork && (
          <img src={track.artwork} alt="" className="h-full w-full object-cover scale-150 blur-3xl opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/80 to-bg" />
      </div>

      <header className="relative flex items-center justify-between px-4 h-14 shrink-0">
        <button className="icon-btn h-10 w-10" onClick={onClose} aria-label="Chiudi il player">
          <ChevronDown className="h-5 w-5" />
        </button>
        <p className="text-xs text-muted truncate max-w-[60%]">{player.queue.contextLabel ?? 'In riproduzione'}</p>
        <button className="icon-btn h-10 w-10" onClick={() => setQueueOpen(true)} aria-label="Coda di riproduzione">
          <ListMusic className="h-5 w-5" />
        </button>
      </header>

      <div className="relative flex-1 flex flex-col justify-center gap-8 px-6 pb-10 max-w-lg w-full mx-auto">
        <Artwork
          src={track.artwork}
          alt={`Copertina di ${track.title}`}
          className="w-full aspect-square shadow-2xl"
          rounded="rounded-2xl"
        />

        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl leading-tight truncate">{track.title}</h2>
            <Link
              to={`/artist/${encodeURIComponent(track.artist.id)}`}
              onClick={onClose}
              className="text-muted hover:text-txt truncate block mt-1"
            >
              {track.artist.name}
            </Link>
            {track.album && (
              <Link
                to={`/album/${encodeURIComponent(track.album.id)}`}
                onClick={onClose}
                className="text-xs text-muted/70 hover:text-txt truncate block mt-0.5"
              >
                {track.album.name}
              </Link>
            )}
          </div>
          <button
            className={`icon-btn h-11 w-11 ${isLiked ? 'text-accent' : ''}`}
            onClick={() => void toggleLike(track)}
            aria-label={isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          <ProgressBar position={player.position} duration={player.duration} onSeek={player.seek} />
          <div className="flex justify-center">
            <TransportControls size="lg" />
          </div>
          {player.error && <p className="text-center text-sm text-red-300">{player.error}</p>}
          {track.licenseUrl && (
            <a
              href={track.licenseUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="block text-center text-[11px] text-muted/70 hover:text-muted"
            >
              Licenza del brano
            </a>
          )}
        </div>
      </div>

      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
    </div>
  );
}
