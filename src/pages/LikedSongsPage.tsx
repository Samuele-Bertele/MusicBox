import { useMemo, useState } from 'react';
import { Heart, Play, Search, Shuffle } from 'lucide-react';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { smartShuffle } from '@/services/shuffle';
import { TrackRow } from '@/components/TrackRow';
import { EmptyState } from '@/components/ui';
import { formatMinutes, pluralize } from '@/utils/format';

type SortKey = 'recent' | 'title' | 'artist' | 'duration';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent', label: 'Aggiunti di recente' },
  { key: 'title', label: 'Titolo' },
  { key: 'artist', label: 'Artista' },
  { key: 'duration', label: 'Durata' },
];

export function LikedSongsPage() {
  const { liked } = useLibrary();
  const player = usePlayer();
  const [sort, setSort] = useState<SortKey>('recent');
  const [filter, setFilter] = useState('');

  const tracks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = liked.filter(
      (l) => !q || l.track.title.toLowerCase().includes(q) || l.track.artist.name.toLowerCase().includes(q),
    );
    const sorted = [...rows].sort((a, b) => {
      switch (sort) {
        case 'title': return a.track.title.localeCompare(b.track.title);
        case 'artist': return a.track.artist.name.localeCompare(b.track.artist.name);
        case 'duration': return b.track.duration - a.track.duration;
        default: return b.likedAt - a.likedAt;
      }
    });
    return sorted.map((l) => l.track);
  }, [liked, sort, filter]);

  const totalSeconds = liked.reduce((acc, l) => acc + l.track.duration, 0);

  if (!liked.length) {
    return (
      <EmptyState
        icon={<Heart className="h-6 w-6" />}
        title="Nessun brano preferito"
        description="Tocca il cuore accanto a un brano: lo ritrovi qui, pronto da riprodurre."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-end gap-5">
        <div className="h-40 w-40 rounded-xl bg-gradient-to-br from-accent/70 to-accent/10 grid place-items-center shrink-0 shadow-xl">
          <Heart className="h-14 w-14 text-[rgb(20,24,23)] fill-current" />
        </div>
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-muted">Playlist automatica</p>
          <h1>Preferiti</h1>
          <p className="text-sm text-muted">
            {pluralize(liked.length, 'brano', 'brani')} · {formatMinutes(totalSeconds)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => player.playTracks(tracks, 0, 'Preferiti')} disabled={!tracks.length}>
          <Play className="h-4 w-4 fill-current" /> Riproduci
        </button>
        <button
          className="btn-outline"
          onClick={() => player.playTracks(smartShuffle(tracks), 0, 'Preferiti')}
          disabled={!tracks.length}
        >
          <Shuffle className="h-4 w-4" /> Casuale
        </button>

        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            className="field pl-9 h-10 w-48"
            placeholder="Filtra"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtra i preferiti"
          />
        </div>
        <select className="field h-10 w-48" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordina">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {tracks.length === 0 ? (
        <EmptyState title="Nessuna corrispondenza" description="Prova con un altro titolo o artista." />
      ) : (
        <div>
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} tracks={tracks} contextLabel="Preferiti" />
          ))}
        </div>
      )}
    </div>
  );
}
