import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Album, Artist, Playlist, Track } from '@/types';
import { pluralize } from '@/utils/format';
import { Artwork } from './ui';

function PlayOverlay({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      className="absolute right-2 bottom-2 h-10 w-10 rounded-full bg-accent text-[rgb(20,24,23)] grid place-items-center
                 shadow-lg translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:opacity-100
                 focus-visible:translate-y-0 transition duration-200"
    >
      <Play className="h-4 w-4 fill-current" />
    </button>
  );
}

export function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <div className="group w-40 md:w-44 shrink-0 snap-start">
      <div className="relative">
        <Artwork src={track.artwork} alt={`Copertina di ${track.title}`} className="aspect-square w-full" />
        <PlayOverlay onClick={onPlay} label={`Riproduci ${track.title}`} />
      </div>
      <div className="mt-2.5 min-w-0">
        <div className="truncate text-sm">{track.title}</div>
        <Link
          to={`/artist/${encodeURIComponent(track.artist.id)}`}
          className="truncate block text-xs text-muted hover:text-txt hover:underline"
        >
          {track.artist.name}
        </Link>
      </div>
    </div>
  );
}

export function AlbumCard({ album }: { album: Album }) {
  return (
    <Link to={`/album/${encodeURIComponent(album.id)}`} className="group w-40 md:w-44 shrink-0 snap-start">
      <Artwork src={album.artwork} alt={`Copertina di ${album.name}`} className="aspect-square w-full" />
      <div className="mt-2.5 min-w-0">
        <div className="truncate text-sm">{album.name}</div>
        <div className="truncate text-xs text-muted">{album.artist.name}</div>
      </div>
    </Link>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link to={`/artist/${encodeURIComponent(artist.id)}`} className="group w-36 md:w-40 shrink-0 snap-start text-center">
      <Artwork src={artist.image} alt={artist.name} className="aspect-square w-full" rounded="rounded-full" />
      <div className="mt-2.5 truncate text-sm">{artist.name}</div>
      <div className="truncate text-xs text-muted">Artista</div>
    </Link>
  );
}

export function PlaylistCard({ playlist, trackCount, cover }: { playlist: Playlist; trackCount?: number; cover?: string | null }) {
  return (
    <Link to={`/playlist/${playlist.id}`} className="group w-40 md:w-44 shrink-0 snap-start">
      <Artwork src={cover ?? playlist.cover} alt={playlist.name} className="aspect-square w-full" />
      <div className="mt-2.5 min-w-0">
        <div className="truncate text-sm">{playlist.name}</div>
        <div className="truncate text-xs text-muted">
          {trackCount === undefined ? playlist.description || 'Playlist' : pluralize(trackCount, 'brano', 'brani')}
        </div>
      </div>
    </Link>
  );
}

export function Shelf({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="shelf-scroll">{children}</div>
    </section>
  );
}
