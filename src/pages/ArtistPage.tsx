import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Shuffle, UserCheck, UserPlus } from 'lucide-react';
import type { Album, Artist, ProviderId, Track } from '@/types';
import { providerFor } from '@/services/providers';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { smartShuffle } from '@/services/shuffle';
import { TrackRow } from '@/components/TrackRow';
import { AlbumCard, Shelf } from '@/components/cards';
import { Artwork, ErrorState, LoadingState } from '@/components/ui';
import { splitEntityId } from '@/utils/entity';

export function ArtistPage() {
  const { id = '' } = useParams();
  const player = usePlayer();
  const { followedIds, toggleFollow } = useLibrary();
  const [data, setData] = useState<{ artist: Artist; topTracks: Track[]; albums: Album[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const { provider, entityId } = splitEntityId(decodeURIComponent(id));
    providerFor(provider as ProviderId)
      .getArtist(entityId)
      .then((res) => {
        if (cancelled) return;
        if (!res) setError('Artista non disponibile.');
        else setData(res);
      })
      .catch(() => !cancelled && setError('Il servizio musicale non risponde. Riprova tra qualche secondo.'));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (error) return <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />;
  if (!data) return <LoadingState />;

  const { artist, topTracks, albums } = data;
  const following = followedIds.has(artist.id);

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-end gap-5">
        <Artwork src={artist.image} alt={artist.name} className="h-40 w-40 shrink-0 shadow-xl" rounded="rounded-full" />
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-muted">Artista</p>
          <h1 className="break-words">{artist.name}</h1>
          {artist.genres.length > 0 && <p className="text-sm text-muted">{artist.genres.slice(0, 4).join(', ')}</p>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => player.playTracks(topTracks, 0, artist.name)} disabled={!topTracks.length}>
          <Play className="h-4 w-4 fill-current" /> Riproduci
        </button>
        <button className="btn-outline" onClick={() => player.playTracks(smartShuffle(topTracks), 0, artist.name)} disabled={!topTracks.length}>
          <Shuffle className="h-4 w-4" /> Casuale
        </button>
        <button className={`btn-outline ${following ? 'border-accent text-accent' : ''}`} onClick={() => void toggleFollow(artist)}>
          {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {following ? 'Segui già' : 'Segui'}
        </button>
        {artist.website && (
          <a className="btn-ghost" href={artist.website} target="_blank" rel="noreferrer noopener">
            Sito ufficiale
          </a>
        )}
      </div>

      {topTracks.length > 0 && (
        <section className="space-y-2">
          <h2>Brani più ascoltati</h2>
          <div>
            {topTracks.slice(0, 10).map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} tracks={topTracks} contextLabel={artist.name} />
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <Shelf title="Album ed EP">
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
