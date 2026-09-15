import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, Play, Shuffle } from 'lucide-react';
import type { Album, ProviderId, Track } from '@/types';
import { providerFor } from '@/services/providers';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { smartShuffle } from '@/services/shuffle';
import { TrackRow } from '@/components/TrackRow';
import { Artwork, ErrorState, LoadingState } from '@/components/ui';
import { formatDate, formatMinutes, pluralize } from '@/utils/format';
import { splitEntityId } from '@/utils/entity';

export function AlbumPage() {
  const { id = '' } = useParams();
  const player = usePlayer();
  const { savedAlbumIds, toggleSaveAlbum } = useLibrary();
  const [data, setData] = useState<{ album: Album; tracks: Track[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const { provider, entityId } = splitEntityId(decodeURIComponent(id));
    providerFor(provider as ProviderId)
      .getAlbum(entityId)
      .then((res) => {
        if (cancelled) return;
        if (!res) setError('Album non disponibile.');
        else setData(res);
      })
      .catch(() => !cancelled && setError('Il servizio musicale non risponde. Riprova tra qualche secondo.'));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (error) return <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />;
  if (!data) return <LoadingState />;

  const { album, tracks } = data;
  const saved = savedAlbumIds.has(album.id);
  const totalSeconds = tracks.reduce((acc, t) => acc + t.duration, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-end gap-5">
        <Artwork src={album.artwork} alt={`Copertina di ${album.name}`} className="h-44 w-44 shrink-0 shadow-xl" rounded="rounded-xl" />
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-muted">Album</p>
          <h1 className="break-words">{album.name}</h1>
          <p className="text-sm text-muted">
            <Link to={`/artist/${encodeURIComponent(album.artist.id)}`} className="text-txt hover:underline">
              {album.artist.name}
            </Link>
            {album.releaseDate && ` · ${formatDate(album.releaseDate)}`} · {pluralize(tracks.length, 'brano', 'brani')} ·{' '}
            {formatMinutes(totalSeconds)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => player.playTracks(tracks, 0, `Album · ${album.name}`)} disabled={!tracks.length}>
          <Play className="h-4 w-4 fill-current" /> Riproduci
        </button>
        <button className="btn-outline" onClick={() => player.playTracks(smartShuffle(tracks), 0, `Album · ${album.name}`)} disabled={!tracks.length}>
          <Shuffle className="h-4 w-4" /> Casuale
        </button>
        <button className={`btn-ghost ${saved ? 'text-accent' : ''}`} onClick={() => void toggleSaveAlbum(album)}>
          <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          {saved ? 'Salvato' : 'Salva'}
        </button>
      </div>

      <div>
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} tracks={tracks} contextLabel={`Album · ${album.name}`} showArtwork={false} showAlbum={false} />
        ))}
      </div>
    </div>
  );
}
