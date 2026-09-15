import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Heart, Shuffle } from 'lucide-react';
import type { Track } from '@/types';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { getPersonalShelves, type Shelf as ShelfData } from '@/services/recommendations';
import { smartShuffle } from '@/services/shuffle';
import { Shelf, TrackCard, PlaylistCard } from '@/components/cards';
import { ErrorState, ShelfSkeleton, Artwork } from '@/components/ui';

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 19) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function HomePage() {
  const { history, liked, playlists, settings, profile } = useLibrary();
  const player = usePlayer();
  const [shelves, setShelves] = useState<ShelfData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setShelves(null);
    getPersonalShelves({ history, liked, personalized: settings.personalizedRecommendations })
      .then((res) => !cancelled && setShelves(res.shelves))
      .catch(() => !cancelled && setError('Il servizio musicale non risponde. Riprova tra qualche secondo.'));
    return () => {
      cancelled = true;
    };
    // History changes constantly during playback; recompute only on mount and
    // on explicit reload to keep the Home stable and the API calls low.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, settings.personalizedRecommendations]);

  const recentTracks = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const e of history) {
      if (seen.has(e.trackId)) continue;
      seen.add(e.trackId);
      out.push(e.track);
      if (out.length >= 12) break;
    }
    return out;
  }, [history]);

  const mostPlayed = useMemo(() => {
    const counts = new Map<string, { track: Track; n: number }>();
    for (const e of history) {
      if (e.type !== 'play_started') continue;
      const row = counts.get(e.trackId) ?? { track: e.track, n: 0 };
      row.n++;
      counts.set(e.trackId, row);
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 12).map((r) => r.track);
  }, [history]);

  const weeklyMix = useMemo(() => {
    const pool = shelves?.find((s) => s.id === 'for-you')?.tracks ?? shelves?.[0]?.tracks ?? [];
    return smartShuffle(pool, { likedTrackIds: new Set(liked.map((l) => l.trackId)), seed: 1 }).slice(0, 20);
  }, [shelves, liked]);

  return (
    <div className="space-y-9 max-w-7xl">
      <section className="animate-fade-up">
        <h1 className="text-3xl md:text-4xl">
          {greeting()}
          {profile?.displayName ? `, ${profile.displayName}` : ''}
        </h1>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickCard to="/liked" title="Preferiti" subtitle={`${liked.length} brani`} icon={<Heart className="h-5 w-5" />} artwork={liked[0]?.track.artwork ?? null} />
        <QuickCard to="/recent" title="Ascoltati di recente" subtitle={`${recentTracks.length} brani`} icon={<Clock className="h-5 w-5" />} artwork={recentTracks[0]?.artwork ?? null} />
        <button
          className="surface-card flex items-center gap-3 p-2 pr-4 hover:bg-elevated transition-colors text-left"
          onClick={() => weeklyMix.length && player.playTracks(weeklyMix, 0, 'Mix della settimana')}
          disabled={!weeklyMix.length}
        >
          <span className="h-14 w-14 rounded-lg bg-accent/15 text-accent grid place-items-center shrink-0">
            <Shuffle className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">Mix della settimana</span>
            <span className="block truncate text-xs text-muted">{weeklyMix.length} brani scelti per te</span>
          </span>
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {recentTracks.length > 0 && (
        <Shelf title="Riprendi da dove eri" subtitle="Gli ultimi brani che hai ascoltato">
          {recentTracks.map((t, i) => (
            <TrackCard key={t.id} track={t} onPlay={() => player.playTracks(recentTracks, i, 'Ascoltati di recente')} />
          ))}
        </Shelf>
      )}

      {playlists.length > 0 && (
        <Shelf title="Le tue playlist">
          {playlists.slice(0, 12).map((pl) => (
            <PlaylistCard key={pl.id} playlist={pl} />
          ))}
        </Shelf>
      )}

      {shelves === null && !error ? (
        <div className="space-y-9">
          <section className="space-y-3">
            <div className="h-6 w-48 skeleton rounded" />
            <ShelfSkeleton />
          </section>
          <section className="space-y-3">
            <div className="h-6 w-40 skeleton rounded" />
            <ShelfSkeleton />
          </section>
        </div>
      ) : (
        shelves?.map((shelf) => (
          <Shelf key={shelf.id} title={shelf.title} subtitle={shelf.subtitle}>
            {shelf.tracks.map((t, i) => (
              <TrackCard key={t.id} track={t} onPlay={() => player.playTracks(shelf.tracks, i, shelf.title)} />
            ))}
          </Shelf>
        ))
      )}

      {mostPlayed.length > 0 && (
        <Shelf title="I più ascoltati" subtitle="In base alla tua cronologia">
          {mostPlayed.map((t, i) => (
            <TrackCard key={t.id} track={t} onPlay={() => player.playTracks(mostPlayed, i, 'I più ascoltati')} />
          ))}
        </Shelf>
      )}
    </div>
  );
}

function QuickCard({
  to,
  title,
  subtitle,
  icon,
  artwork,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  artwork: string | null;
}) {
  return (
    <Link to={to} className="surface-card flex items-center gap-3 p-2 pr-4 hover:bg-elevated transition-colors">
      {artwork ? (
        <Artwork src={artwork} alt="" className="h-14 w-14 shrink-0" />
      ) : (
        <span className="h-14 w-14 rounded-lg bg-accent/15 text-accent grid place-items-center shrink-0">{icon}</span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
    </Link>
  );
}
