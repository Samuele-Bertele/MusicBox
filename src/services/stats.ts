import type { HistoryEvent, Track } from '@/types';

export type StatsPeriod = 'today' | '7d' | '30d' | '6m' | '1y' | 'all';

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: 'Oggi',
  '7d': '7 giorni',
  '30d': '30 giorni',
  '6m': '6 mesi',
  '1y': '1 anno',
  all: 'Sempre',
};

export function periodStart(period: StatsPeriod, now = Date.now()): number {
  const day = 86_400_000;
  switch (period) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case '7d': return now - 7 * day;
    case '30d': return now - 30 * day;
    case '6m': return now - 182 * day;
    case '1y': return now - 365 * day;
    default: return 0;
  }
}

export interface RankedEntry<T> { key: string; label: string; count: number; seconds: number; item: T }

export interface StatsSummary {
  listenedSeconds: number;
  tracksPlayed: number;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  completionRate: number;
  skipRate: number;
  averageListenSeconds: number;
  streakDays: number;
  busiestDay: { day: string; seconds: number } | null;
  favouriteHour: number | null;
  topTracks: Array<RankedEntry<Track>>;
  topArtists: Array<RankedEntry<Track>>;
  topAlbums: Array<RankedEntry<Track>>;
  topGenres: Array<{ key: string; count: number }>;
  perDay: Array<{ day: string; minutes: number }>;
  perHour: number[];
}

/**
 * History is stored as milestone events (start / 25 / 50 / 75 / completed).
 * Listened seconds = the highest milestone reached per play, which is both
 * accurate enough and 20x cheaper than per-second tracking.
 */
function secondsPerPlay(events: HistoryEvent[]): Map<string, { seconds: number; track: Track; at: number }> {
  const byPlay = new Map<string, { seconds: number; track: Track; at: number }>();
  for (const e of events) {
    // Group events of the same track within a 15-minute window into one play.
    const bucket = `${e.trackId}:${Math.floor(e.at / 900_000)}`;
    const prev = byPlay.get(bucket);
    if (!prev || e.listenedSeconds > prev.seconds) {
      byPlay.set(bucket, { seconds: e.listenedSeconds, track: e.track, at: prev?.at ?? e.at });
    }
  }
  return byPlay;
}

function rank(map: Map<string, { label: string; count: number; seconds: number; item: Track }>, limit: number) {
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.seconds - a.seconds || b.count - a.count)
    .slice(0, limit);
}

export function computeStats(history: HistoryEvent[], period: StatsPeriod, now = Date.now()): StatsSummary {
  const from = periodStart(period, now);
  const events = history.filter((e) => e.at >= from);
  const plays = secondsPerPlay(events);

  const tracks = new Map<string, { label: string; count: number; seconds: number; item: Track }>();
  const artists = new Map<string, { label: string; count: number; seconds: number; item: Track }>();
  const albums = new Map<string, { label: string; count: number; seconds: number; item: Track }>();
  const genres = new Map<string, number>();
  const perDay = new Map<string, number>();
  const perHour = new Array(24).fill(0) as number[];
  const days = new Set<string>();

  let listenedSeconds = 0;
  for (const { seconds, track, at } of plays.values()) {
    listenedSeconds += seconds;

    const push = (
      map: Map<string, { label: string; count: number; seconds: number; item: Track }>,
      key: string,
      label: string,
    ) => {
      const row = map.get(key) ?? { label, count: 0, seconds: 0, item: track };
      row.count++;
      row.seconds += seconds;
      map.set(key, row);
    };

    push(tracks, track.id, track.title);
    push(artists, track.artist.id, track.artist.name);
    if (track.album) push(albums, track.album.id, track.album.name);
    for (const g of track.genres) genres.set(g.toLowerCase(), (genres.get(g.toLowerCase()) ?? 0) + 1);

    const d = new Date(at);
    const dayKey = d.toISOString().slice(0, 10);
    days.add(dayKey);
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + seconds / 60);
    perHour[d.getHours()] += seconds / 60;
  }

  const started = events.filter((e) => e.type === 'play_started').length;
  const completed = events.filter((e) => e.type === 'completed').length;
  const skipped = events.filter((e) => e.type === 'skipped').length;

  const sortedDays = [...days].sort();
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0 && key === new Date(now).toISOString().slice(0, 10)) {
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  const busiest = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const favouriteHour = perHour.some((v) => v > 0) ? perHour.indexOf(Math.max(...perHour)) : null;

  const dayRange = period === 'all' ? Math.max(1, sortedDays.length) : Math.max(1, Math.ceil((now - from) / 86_400_000));
  const daySeries: Array<{ day: string; minutes: number }> = [];
  for (let i = Math.min(dayRange, 60) - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    daySeries.push({ day: key, minutes: Math.round(perDay.get(key) ?? 0) });
  }

  return {
    listenedSeconds,
    tracksPlayed: plays.size,
    uniqueTracks: tracks.size,
    uniqueArtists: artists.size,
    uniqueAlbums: albums.size,
    completionRate: started ? completed / started : 0,
    skipRate: started ? skipped / started : 0,
    averageListenSeconds: plays.size ? listenedSeconds / plays.size : 0,
    streakDays: streak,
    busiestDay: busiest ? { day: busiest[0], seconds: Math.round(busiest[1] * 60) } : null,
    favouriteHour,
    topTracks: rank(tracks, 10),
    topArtists: rank(artists, 10),
    topAlbums: rank(albums, 10),
    topGenres: [...genres.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    perDay: daySeries,
    perHour: perHour.map((m) => Math.round(m)),
  };
}
