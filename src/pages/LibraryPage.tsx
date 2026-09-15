import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Disc3, ListMusic, Plus, Users } from 'lucide-react';
import type { FollowedArtist, SavedAlbum } from '@/types';
import { useLibrary } from '@/services/LibraryProvider';
import { AlbumCard, ArtistCard, PlaylistCard } from '@/components/cards';
import { EmptyState } from '@/components/ui';

const TABS = [
  { key: '', label: 'Playlist' },
  { key: 'albums', label: 'Album' },
  { key: 'artists', label: 'Artisti' },
] as const;

export function LibraryPage() {
  const { tab = '' } = useParams();
  const navigate = useNavigate();
  const { playlists, store, createPlaylist } = useLibrary();
  const [albums, setAlbums] = useState<SavedAlbum[]>([]);
  const [artists, setArtists] = useState<FollowedArtist[]>([]);

  useEffect(() => {
    if (!store) return;
    void store.listSavedAlbums().then(setAlbums);
    void store.listFollowedArtists().then(setArtists);
  }, [store]);

  const newPlaylist = async () => {
    const pl = await createPlaylist(`Playlist ${playlists.length + 1}`);
    if (pl) navigate(`/playlist/${pl.id}`);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.key ? `/library/${t.key}` : '/library'}
            className={`h-9 px-4 rounded-full text-sm grid place-items-center transition-colors ${
              tab === t.key ? 'bg-accent text-[rgb(20,24,23)]' : 'bg-elevated text-muted hover:text-txt'
            }`}
          >
            {t.label}
          </Link>
        ))}
        {tab === '' && (
          <button className="btn-outline ml-auto" onClick={newPlaylist}>
            <Plus className="h-4 w-4" /> Nuova playlist
          </button>
        )}
      </div>

      {tab === '' &&
        (playlists.length === 0 ? (
          <EmptyState
            icon={<ListMusic className="h-6 w-6" />}
            title="Nessuna playlist"
            description="Raccogli i brani che ti piacciono in una playlist."
            action={
              <button className="btn-primary" onClick={newPlaylist}>
                Crea playlist
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {playlists.map((pl) => (
              <PlaylistCard key={pl.id} playlist={pl} />
            ))}
          </div>
        ))}

      {tab === 'albums' &&
        (albums.length === 0 ? (
          <EmptyState icon={<Disc3 className="h-6 w-6" />} title="Nessun album salvato" description="Apri un album e salvalo per ritrovarlo qui." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {albums.map((a) => (
              <AlbumCard key={a.albumId} album={a.album} />
            ))}
          </div>
        ))}

      {tab === 'artists' &&
        (artists.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Nessun artista seguito" description="Segui un artista per trovarlo qui." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-5">
            {artists.map((a) => (
              <ArtistCard key={a.artistId} artist={a.artist} />
            ))}
          </div>
        ))}
    </div>
  );
}
