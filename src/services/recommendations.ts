import type { HistoryEvent, LikedTrack, Track } from '@/types';
import { getPrimaryProvider, providerFor, withFallback } from '@/services/providers';
import { buildTasteProfile, rankTracks, topArtistIds, topGenres, type TasteProfile } from './taste';

export interface Shelf {
  id: string;
  title: string;
  subtitle?: string;
  tracks: Track[];
}

const dedupe = (tracks: Track[]) => {
  const seen = new Set<string>();
  return tracks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
};

const playable = (tracks: Track[]) => tracks.filter((t) => Boolean(t.streamUrl));

/** Content for a brand-new library: nothing personal to work with yet. */
export async function getGenericShelves(): Promise<Shelf[]> {
  const featured = await withFallback(
    (p) => p.getFeaturedTracks({ limit: 20 }),
    (v) => v.length === 0,
  ).catch(() => null);

  const shelves: Shelf[] = [];
  if (featured) {
    shelves.push({
      id: 'featured',
      title: 'Popolari questa settimana',
      subtitle: featured.provider.label,
      tracks: playable(featured.value),
    });
  }

  const seedGenres = ['electronic', 'rock', 'jazz'];
  const byGenre = await Promise.all(
    seedGenres.map((g) =>
      getPrimaryProvider()
        .getTracksByGenre(g, { limit: 16 })
        .then((tracks) => ({ g, tracks: playable(tracks) }))
        .catch(() => ({ g, tracks: [] as Track[] })),
    ),
  );
  for (const { g, tracks } of byGenre) {
    if (tracks.length) shelves.push({ id: `genre-${g}`, title: `Da esplorare: ${g}`, tracks });
  }
  return shelves;
}

export interface PersonalShelvesInput {
  history: HistoryEvent[];
  liked: LikedTrack[];
  personalized: boolean;
}

export async function getPersonalShelves({ history, liked, personalized }: PersonalShelvesInput): Promise<{ shelves: Shelf[]; profile: TasteProfile }> {
  const profile = buildTasteProfile(history, liked);
  if (!personalized || (history.length === 0 && liked.length === 0)) {
    return { shelves: await getGenericShelves(), profile };
  }

  const genres = topGenres(profile, 4);
  const artistIds = topArtistIds(profile, 4);
  const shelves: Shelf[] = [];

  const recommended = await withFallback(
    (p) => p.getRecommendations({ genres, artistIds }, { limit: 30 }),
    (v) => v.length === 0,
  ).catch(() => null);

  if (recommended) {
    const known = new Set([...profile.recentTrackIds, ...profile.likedTrackIds]);
    const fresh = rankTracks(playable(dedupe(recommended.value)).filter((t) => !known.has(t.id)), profile);
    if (fresh.length) {
      shelves.push({ id: 'for-you', title: 'Consigliati per te', subtitle: genres.slice(0, 3).join(' · '), tracks: fresh.slice(0, 20) });
      shelves.push({ id: 'discover', title: 'Nuove scoperte', subtitle: 'Artisti che non hai ancora ascoltato', tracks: fresh.slice(20, 40).length ? fresh.slice(20, 40) : fresh.slice(0, 12).reverse() });
    }
  }

  // "Because you like X" — one shelf seeded on the single strongest artist.
  const topArtistTrack = liked[0]?.track ?? history[0]?.track;
  if (topArtistTrack) {
    const provider = providerFor(topArtistTrack);
    const seedGenre = topArtistTrack.genres[0] ?? genres[0];
    if (seedGenre) {
      const similar = await provider.getTracksByGenre(seedGenre, { limit: 16 }).catch(() => [] as Track[]);
      const filtered = playable(similar).filter((t) => t.id !== topArtistTrack.id);
      if (filtered.length) {
        shelves.push({
          id: 'because-you-like',
          title: `Perché ascolti ${topArtistTrack.artist.name}`,
          tracks: rankTracks(filtered, profile).slice(0, 16),
        });
      }
    }
  }

  if (shelves.length < 2) {
    const generic = await getGenericShelves();
    shelves.push(...generic.filter((g) => !shelves.some((s) => s.id === g.id)));
  }

  return { shelves, profile };
}

/** "Similar to this" used on the track context menu and album pages. */
export async function getSimilarTracks(track: Track, profile: TasteProfile, limit = 20): Promise<Track[]> {
  const genre = track.genres[0];
  const provider = providerFor(track);
  const pool = genre
    ? await provider.getTracksByGenre(genre, { limit: limit * 2 }).catch(() => [] as Track[])
    : await provider.searchTracks(track.artist.name, { limit: limit * 2 }).catch(() => [] as Track[]);
  return rankTracks(playable(pool).filter((t) => t.id !== track.id), profile).slice(0, limit);
}

/** A weekly, deterministic mix — the "Discover Weekly" equivalent. */
export function weeklyMixSeed(now = Date.now()): number {
  const d = new Date(now);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() * 100 + week;
}
