import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ListMusic, Maximize2 } from 'lucide-react';
import { usePlayer } from './PlayerProvider';
import { useLibrary } from '@/services/LibraryProvider';
import { Artwork } from '@/components/ui';
import { ProgressBar } from './ProgressBar';
import { QueuePanel } from './QueuePanel';
import { TransportControls, VolumeControl, PlayButton } from './PlayerControls';
import { FullPlayer } from './FullPlayer';

export function Player() {
  const player = usePlayer();
  const { likedIds, toggleLike } = useLibrary();
  const [queueOpen, setQueueOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);

  const track = player.track;
  const isLiked = track ? likedIds.has(track.id) : false;

  return (
    <>
      {/* Mobile mini player — sits above the bottom navigation */}
      <div className="md:hidden fixed bottom-[57px] inset-x-0 z-40 px-2 pb-1 safe-bottom">
        {track && (
          <div className="surface-card bg-elevated/95 backdrop-blur-lg overflow-hidden">
            {player.error && <p className="px-3 pt-2 text-[11px] text-red-300">{player.error}</p>}
            <div className="flex items-center gap-3 p-2">
              <button className="flex items-center gap-3 min-w-0 flex-1 text-left" onClick={() => setFullOpen(true)} aria-label="Apri il player">
                <Artwork src={track.artwork} alt="" className="h-11 w-11 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm">{track.title}</div>
                  <div className="truncate text-xs text-muted">{track.artist.name}</div>
                </div>
              </button>
              <button
                className={`icon-btn h-9 w-9 ${isLiked ? 'text-accent' : ''}`}
                onClick={() => track && void toggleLike(track)}
                aria-label={isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <PlayButton />
            </div>
            <div className="h-[3px] bg-line">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${player.duration ? (player.position / player.duration) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Desktop bottom bar */}
      <footer className="hidden md:flex relative items-center gap-4 h-20 px-4 border-t border-line/60 bg-surface/95 backdrop-blur-md">
        <div className="flex items-center gap-3 w-[22rem] min-w-0">
          {track ? (
            <>
              <Artwork src={track.artwork} alt="" className="h-14 w-14 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-sm">{track.title}</div>
                <Link
                  to={`/artist/${encodeURIComponent(track.artist.id)}`}
                  className="truncate block text-xs text-muted hover:text-txt hover:underline"
                >
                  {track.artist.name}
                </Link>
              </div>
              <button
                className={`icon-btn h-9 w-9 shrink-0 ${isLiked ? 'text-accent' : ''}`}
                onClick={() => void toggleLike(track)}
                aria-label={isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">Scegli un brano per iniziare</p>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 max-w-2xl mx-auto">
          <TransportControls />
          <ProgressBar position={player.position} duration={player.duration} onSeek={player.seek} />
          {player.error && <p className="text-[11px] text-red-300 -mt-1">{player.error}</p>}
        </div>

        <div className="flex items-center gap-1 w-[22rem] justify-end">
          <button
            className={`icon-btn h-9 w-9 ${queueOpen ? 'text-accent' : ''}`}
            onClick={() => setQueueOpen((v) => !v)}
            aria-label="Coda di riproduzione"
            aria-expanded={queueOpen}
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button className="icon-btn h-9 w-9" onClick={() => setFullOpen(true)} aria-label="Player a schermo intero" disabled={!track}>
            <Maximize2 className="h-4 w-4" />
          </button>
          <VolumeControl />
        </div>

        {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      </footer>

      {fullOpen && <FullPlayer onClose={() => setFullOpen(false)} />}
    </>
  );
}
