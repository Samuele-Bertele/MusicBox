import type { Track } from '@/types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function basicShuffle<T>(items: T[], seed = Date.now()): T[] {
  const out = [...items];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface SmartShuffleContext {
  /** Track ids played recently, most recent first. */
  recentTrackIds?: string[];
  /** Track ids the user liked — mildly promoted. */
  likedTrackIds?: Set<string>;
  seed?: number;
}

/**
 * Diversity-aware shuffle.
 *
 * A plain Fisher–Yates happily plays four songs by the same artist in a row.
 * This picks greedily from a randomised pool, penalising whatever resembles
 * what just played: same artist, same album, same genre, recently heard.
 */
export function smartShuffle(tracks: Track[], ctx: SmartShuffleContext = {}): Track[] {
  if (tracks.length <= 2) return [...tracks];

  const rnd = mulberry32(ctx.seed ?? Date.now());
  const recent = new Set((ctx.recentTrackIds ?? []).slice(0, 20));
  const pool = [...tracks];
  const out: Track[] = [];

  const lastArtists: string[] = [];
  const lastAlbums: string[] = [];
  const lastGenres: string[] = [];

  while (pool.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const t = pool[i];
      let score = rnd() * 0.5;

      const artistDistance = lastArtists.indexOf(t.artist.id);
      if (artistDistance !== -1) score -= (3 - artistDistance) * 0.45;

      const albumDistance = t.album ? lastAlbums.indexOf(t.album.id) : -1;
      if (albumDistance !== -1) score -= (3 - albumDistance) * 0.25;

      if (t.genres.some((g) => lastGenres.includes(g.toLowerCase()))) score -= 0.15;
      if (recent.has(t.id)) score -= 0.4;
      if (ctx.likedTrackIds?.has(t.id)) score += 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const [picked] = pool.splice(bestIndex, 1);
    out.push(picked);

    lastArtists.unshift(picked.artist.id);
    lastArtists.length = Math.min(lastArtists.length, 3);
    if (picked.album) {
      lastAlbums.unshift(picked.album.id);
      lastAlbums.length = Math.min(lastAlbums.length, 3);
    }
    lastGenres.length = 0;
    lastGenres.push(...picked.genres.slice(0, 3).map((g) => g.toLowerCase()));
  }

  return out;
}
