import type { HistoryEvent, LikedTrack, Track } from '@/types';

export interface TasteProfile {
  genres: Map<string, number>;
  artists: Map<string, number>;
  /** trackId -> number of times playback started */
  plays: Map<string, number>;
  completions: Map<string, number>;
  skips: Map<string, number>;
  likedTrackIds: Set<string>;
  likedArtistIds: Set<string>;
  recentTrackIds: string[];
  totalPlays: number;
}

const EVENT_WEIGHT: Record<HistoryEvent['type'], number> = {
  play_started: 0.4,
  p25: 0.6,
  p50: 1,
  p75: 1.4,
  completed: 2,
  skipped: -1.2,
};

/** Half-life of 21 days: last month shapes recommendations, last year nudges. */
function recency(at: number, now: number): number {
  const days = Math.max(0, (now - at) / 86_400_000);
  return Math.pow(0.5, days / 21);
}

function addWeight(map: Map<string, number>, key: string, weight: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + weight);
}

export function buildTasteProfile(history: HistoryEvent[], liked: LikedTrack[], now = Date.now()): TasteProfile {
  const profile: TasteProfile = {
    genres: new Map(),
    artists: new Map(),
    plays: new Map(),
    completions: new Map(),
    skips: new Map(),
    likedTrackIds: new Set(liked.map((l) => l.trackId)),
    likedArtistIds: new Set(liked.map((l) => l.track.artist.id)),
    recentTrackIds: [],
    totalPlays: 0,
  };

  const seenRecent = new Set<string>();
  for (const event of [...history].sort((a, b) => b.at - a.at)) {
    if (!seenRecent.has(event.trackId) && profile.recentTrackIds.length < 60) {
      seenRecent.add(event.trackId);
      profile.recentTrackIds.push(event.trackId);
    }
    const weight = EVENT_WEIGHT[event.type] * recency(event.at, now);
    addWeight(profile.artists, event.track.artist.id, weight);
    for (const genre of event.track.genres) addWeight(profile.genres, genre.toLowerCase(), weight * 0.8);

    if (event.type === 'play_started') {
      profile.plays.set(event.trackId, (profile.plays.get(event.trackId) ?? 0) + 1);
      profile.totalPlays++;
    }
    if (event.type === 'completed') profile.completions.set(event.trackId, (profile.completions.get(event.trackId) ?? 0) + 1);
    if (event.type === 'skipped') profile.skips.set(event.trackId, (profile.skips.get(event.trackId) ?? 0) + 1);
  }

  // Explicit likes are the strongest signal available.
  for (const l of liked) {
    const weight = 2.5 * recency(l.likedAt, now);
    addWeight(profile.artists, l.track.artist.id, weight);
    for (const genre of l.track.genres) addWeight(profile.genres, genre.toLowerCase(), weight * 0.8);
  }

  return profile;
}

function normalised(map: Map<string, number>): Map<string, number> {
  const max = Math.max(1e-6, ...[...map.values()].map((v) => Math.abs(v)));
  return new Map([...map.entries()].map(([k, v]) => [k, v / max]));
}

export function topGenres(profile: TasteProfile, n = 5): string[] {
  return [...profile.genres.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function topArtistIds(profile: TasteProfile, n = 5): string[] {
  return [...profile.artists.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Recommendation score, in [-1, ~1.4].
 *
 *   genre_similarity + artist_similarity + listening_frequency
 * + like_bonus + completion_bonus - skip_penalty
 */
export function scoreTrack(track: Track, profile: TasteProfile): number {
  const genres = normalised(profile.genres);
  const artists = normalised(profile.artists);

  const genreScores = track.genres.map((g) => genres.get(g.toLowerCase()) ?? 0);
  const genreSimilarity = genreScores.length ? Math.max(...genreScores) : 0;
  const artistSimilarity = artists.get(track.artist.id) ?? 0;

  const plays = profile.plays.get(track.id) ?? 0;
  const frequency = profile.totalPlays ? Math.min(1, plays / Math.max(3, profile.totalPlays * 0.1)) : 0;

  const likeBonus = profile.likedTrackIds.has(track.id) ? 0.25 : profile.likedArtistIds.has(track.artist.id) ? 0.12 : 0;
  const completionBonus = Math.min(0.2, (profile.completions.get(track.id) ?? 0) * 0.07);
  const skipPenalty = Math.min(0.6, (profile.skips.get(track.id) ?? 0) * 0.2);
  const recentPenalty = profile.recentTrackIds.slice(0, 15).includes(track.id) ? 0.25 : 0;

  return (
    0.38 * genreSimilarity +
    0.3 * artistSimilarity +
    0.12 * frequency +
    likeBonus +
    completionBonus -
    skipPenalty -
    recentPenalty
  );
}

export function rankTracks(tracks: Track[], profile: TasteProfile): Track[] {
  return [...tracks]
    .map((track) => ({ track, score: scoreTrack(track, profile) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.track);
}
