import type { HistoryEvent, HistoryEventType, LikedTrack, Track } from '@/types';

export function makeTrack(overrides: {
  id: string;
  artistId?: string;
  albumId?: string;
  genres?: string[];
  duration?: number;
  streamUrl?: string | null;
}): Track {
  return {
    id: overrides.id,
    provider: 'jamendo',
    providerTrackId: overrides.id,
    title: `Track ${overrides.id}`,
    artist: { id: overrides.artistId ?? 'a1', name: `Artist ${overrides.artistId ?? 'a1'}` },
    album: { id: overrides.albumId ?? 'al1', name: 'Album' },
    artwork: null,
    duration: overrides.duration ?? 180,
    streamUrl: overrides.streamUrl === undefined ? `https://example.test/${overrides.id}.mp3` : overrides.streamUrl,
    downloadAllowed: false,
    licenseUrl: null,
    genres: overrides.genres ?? [],
    releaseDate: null,
  };
}

const PERCENT: Record<HistoryEventType, number> = {
  play_started: 0,
  p25: 25,
  p50: 50,
  p75: 75,
  completed: 100,
  skipped: 10,
};

export function makeHistory(track: Track, types: HistoryEventType[], at: number): HistoryEvent[] {
  return types.map((type, i) => ({
    id: `${track.id}-${type}-${at}`,
    trackId: track.id,
    type,
    at: at + i,
    listenedSeconds: Math.round((PERCENT[type] / 100) * track.duration),
    percent: PERCENT[type],
    track,
  }));
}

export function makeLiked(tracks: Track[], at: number): LikedTrack[] {
  return tracks.map((track) => ({ trackId: track.id, likedAt: at, track }));
}
