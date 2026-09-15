import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc3, Heart, ListPlus, MoreHorizontal, Play, Plus, Trash2, User } from 'lucide-react';
import type { Track } from '@/types';
import { formatDuration } from '@/utils/format';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { ContextMenu, useContextMenu, type MenuItem } from './ContextMenu';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { Artwork } from './ui';

interface Props {
  track: Track;
  index?: number;
  tracks?: Track[];
  contextLabel?: string;
  showArtwork?: boolean;
  showAlbum?: boolean;
  onRemove?: () => void;
}

export function TrackRow({ track, index, tracks, contextLabel, showArtwork = true, showAlbum = true, onRemove }: Props) {
  const navigate = useNavigate();
  const player = usePlayer();
  const { likedIds, toggleLike } = useLibrary();
  const menu = useContextMenu();
  const [addOpen, setAddOpen] = useState(false);

  const isCurrent = player.track?.id === track.id;
  const isLiked = likedIds.has(track.id);
  const unavailable = !track.streamUrl;

  const play = () => {
    const list = tracks ?? [track];
    const at = Math.max(0, list.findIndex((t) => t.id === track.id));
    player.playTracks(list, at, contextLabel);
  };

  const items: MenuItem[] = [
    { label: 'Riproduci', icon: <Play />, onSelect: play, disabled: unavailable },
    { label: 'Riproduci dopo', icon: <ListPlus />, onSelect: () => player.playNext([track]), disabled: unavailable },
    { label: 'Aggiungi alla coda', icon: <Plus />, onSelect: () => player.addToQueue([track]), disabled: unavailable },
    { label: 'Aggiungi a playlist', icon: <ListPlus />, onSelect: () => setAddOpen(true) },
    { label: isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti', icon: <Heart />, onSelect: () => void toggleLike(track) },
    { label: "Vai all'artista", icon: <User />, onSelect: () => navigate(`/artist/${encodeURIComponent(track.artist.id)}`) },
  ];
  if (track.album) {
    items.push({ label: "Vai all'album", icon: <Disc3 />, onSelect: () => navigate(`/album/${encodeURIComponent(track.album!.id)}`) });
  }
  if (onRemove) items.push({ label: 'Rimuovi', icon: <Trash2 />, onSelect: onRemove, danger: true });

  return (
    <>
      <div
        className={`group grid grid-cols-[auto_1fr_auto] md:grid-cols-[2rem_1fr_minmax(0,14rem)_auto_auto] items-center gap-3 px-2 py-1.5 rounded-lg
          transition-colors hover:bg-elevated/70 ${isCurrent ? 'bg-elevated/50' : ''} ${unavailable ? 'opacity-55' : ''}`}
        onContextMenu={menu.open}
        onDoubleClick={play}
      >
        <div className="hidden md:grid place-items-center w-8 text-sm text-muted tabular-nums">
          <span className="group-hover:hidden">{isCurrent ? <PlayingBars /> : (index ?? 0) + 1}</span>
          <button className="hidden group-hover:grid place-items-center icon-btn h-8 w-8" onClick={play} aria-label={`Riproduci ${track.title}`}>
            <Play className="h-4 w-4 fill-current" />
          </button>
        </div>

        <button className="flex items-center gap-3 min-w-0 text-left" onClick={play} aria-label={`Riproduci ${track.title} di ${track.artist.name}`}>
          {showArtwork && <Artwork src={track.artwork} alt="" className="h-11 w-11 shrink-0" />}
          <div className="min-w-0">
            <div className={`truncate text-sm ${isCurrent ? 'text-accent' : 'text-txt'}`}>{track.title}</div>
            <div className="truncate text-xs text-muted">{track.artist.name}</div>
          </div>
        </button>

        {showAlbum && (
          <button
            className="hidden md:block truncate text-sm text-muted hover:text-txt hover:underline text-left"
            onClick={() => track.album && navigate(`/album/${encodeURIComponent(track.album.id)}`)}
            disabled={!track.album}
          >
            {track.album?.name ?? '—'}
          </button>
        )}

        <button
          className={`icon-btn h-9 w-9 ${isLiked ? 'text-accent opacity-100' : 'md:opacity-0 group-hover:opacity-100'}`}
          onClick={() => void toggleLike(track)}
          aria-label={isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          aria-pressed={isLiked}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        <div className="flex items-center gap-1">
          <span className="hidden md:inline text-xs text-muted tabular-nums w-10 text-right">{formatDuration(track.duration)}</span>
          <button
            className="icon-btn h-9 w-9"
            onClick={(e) => menu.open(e)}
            aria-label={`Altre azioni per ${track.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ContextMenu anchor={menu.anchor} items={items} onClose={menu.close} />
      <AddToPlaylistModal tracks={[track]} open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function PlayingBars() {
  return (
    <span className="flex items-end gap-[2px] h-3.5" aria-label="In riproduzione">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-accent rounded-full"
          style={{ height: '100%', animation: `eq 900ms ${i * 140}ms ease-in-out infinite alternate` }}
        />
      ))}
      <style>{`@keyframes eq { from { transform: scaleY(.25) } to { transform: scaleY(1) } }`}</style>
    </span>
  );
}
