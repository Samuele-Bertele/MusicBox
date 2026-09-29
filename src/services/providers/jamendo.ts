import type { Album, Artist, ProviderPlaylist, SearchResults, Track } from '@/types';
import { JsonClient, RateLimiter, TtlCache } from '@/services/http/client';
import { ProviderError, type MusicProvider, type SearchOptions } from './types';

/**
 * Jamendo v3.0 read API.
 *
 * Why this is the primary provider:
 *  - every track is published by its own rights holder under a Creative
 *    Commons or Jamendo licence that explicitly permits streaming;
 *  - the API returns a direct, non-DRM, non-expiring MP3 URL (`audio`);
 *  - the read plan is free, needs no credit card and no server-side secret.
 *
 * The `client_id` is a PUBLIC identifier — the read API is designed to be
 * called straight from a browser — so shipping it in the bundle is correct,
 * not a leak. Write methods (which would need OAuth secrets) are never used.
 */

const BASE = 'https://api.jamendo.com/v3.0';
/** Jamendo's documented public id for testing only. */
const TEST_CLIENT_ID = 'b6747d04';
const IMAGE_SIZE = 400;

interface JamendoEnvelope<T> {
  headers: { status: string; code: number; error_message: string; warnings: string; results_count: number };
  results: T[];
}

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  album_id?: string;
  album_name?: string;
  album_image?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  license_ccurl?: string;
  shareurl?: string;
  releasedate?: string;
  musicinfo?: { tags?: { genres?: string[] } };
}

interface JamendoArtist {
  id: string;
  name: string;
  website?: string;
  image?: string;
  musicinfo?: { tags?: { genres?: string[] } };
}

interface JamendoAlbum {
  id: string;
  name: string;
  releasedate?: string;
  artist_id: string;
  artist_name: string;
  image?: string;
  tracks?: JamendoTrack[];
}

interface JamendoPlaylist {
  id: string;
  name: string;
  tracks?: unknown[];
}

const client = new JsonClient({
  // 2 req/s sustained, burst of 8: far below Jamendo's alert threshold and
  // enough to keep the UI instant.
  limiter: new RateLimiter(8, 2),
  cache: new TtlCache(500, 'mb.cache.jamendo'),
  defaultTtlMs: 30 * 60_000,
  retries: 2,
});

export class JamendoProvider implements MusicProvider {
  readonly id = 'jamendo' as const;
  readonly label = 'Jamendo';
  readonly canStream = true;
  readonly licenseNote =
    'Creative Commons / Jamendo licensed catalogue. Streaming is granted by the rights holders through the official API.';

  private readonly clientId: string;

  constructor(clientId?: string) {
    this.clientId = (clientId || '').trim() || TEST_CLIENT_ID;
  }

  isConfigured(): boolean {
    return true;
  }

  usesTestCredentials(): boolean {
    return this.clientId === TEST_CLIENT_ID;
  }

  private url(path: string, params: Record<string, string | number | undefined>): string {
    const q = new URLSearchParams({ client_id: this.clientId, format: 'json' });
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
    return `${BASE}${path}?${q.toString()}`;
  }

  private async call<T>(path: string, params: Record<string, string | number | undefined>, opts?: SearchOptions & { ttlMs?: number }) {
    try {
      const data = await client.get<JamendoEnvelope<T>>(this.url(path, params), {
        signal: opts?.signal,
        ttlMs: opts?.ttlMs,
      });
      if (data.headers?.code === 6) throw new ProviderError('Jamendo rate limit reached', 'rate_limit', this.id);
      if (data.headers?.status === 'failed') {
        throw new ProviderError(data.headers.error_message || 'Jamendo request failed', 'unknown', this.id);
      }
      return data.results ?? [];
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.message === 'rate_limit') {
        throw new ProviderError('Jamendo rate limit reached', 'rate_limit', this.id);
      }
      throw new ProviderError('Jamendo is not responding', 'network', this.id);
    }
  }

  toTrack = (t: JamendoTrack): Track => ({
    id: `jamendo:${t.id}`,
    provider: this.id,
    providerTrackId: t.id,
    title: t.name,
    artist: { id: `jamendo:${t.artist_id}`, name: t.artist_name },
    album: t.album_id ? { id: `jamendo:${t.album_id}`, name: t.album_name ?? '' } : null,
    artwork: t.album_image || t.image || null,
    duration: Number(t.duration) || 0,
    streamUrl: t.audio || null,
    downloadAllowed: Boolean(t.audiodownload_allowed && t.audiodownload),
    licenseUrl: t.license_ccurl || null,
    sourceUrl: t.shareurl || `https://www.jamendo.com/track/${t.id}`,
    genres: t.musicinfo?.tags?.genres ?? [],
    releaseDate: t.releasedate || null,
  });

  private toArtist = (a: JamendoArtist): Artist => ({
    id: `jamendo:${a.id}`,
    provider: this.id,
    providerArtistId: a.id,
    name: a.name,
    image: a.image || null,
    genres: a.musicinfo?.tags?.genres ?? [],
    website: a.website || null,
  });

  private toAlbum = (a: JamendoAlbum): Album => ({
    id: `jamendo:${a.id}`,
    provider: this.id,
    providerAlbumId: a.id,
    name: a.name,
    artist: { id: `jamendo:${a.artist_id}`, name: a.artist_name },
    artwork: a.image || null,
    releaseDate: a.releasedate || null,
    trackCount: a.tracks?.length ?? 0,
  });

  private trackParams(opts?: SearchOptions) {
    return {
      limit: Math.min(opts?.limit ?? 20, 200),
      offset: opts?.offset ?? 0,
      include: 'musicinfo licenses',
      audioformat: 'mp32',
      imagesize: IMAGE_SIZE,
    };
  }

  async searchTracks(query: string, opts?: SearchOptions): Promise<Track[]> {
    const rows = await this.call<JamendoTrack>('/tracks/', { ...this.trackParams(opts), search: query, order: 'popularity_total' }, opts);
    return rows.map(this.toTrack);
  }

  async searchArtists(query: string, opts?: SearchOptions): Promise<Artist[]> {
    const rows = await this.call<JamendoArtist>(
      '/artists/',
      { namesearch: query, limit: Math.min(opts?.limit ?? 12, 200), offset: opts?.offset ?? 0, imagesize: IMAGE_SIZE },
      opts,
    );
    return rows.map(this.toArtist);
  }

  async searchAlbums(query: string, opts?: SearchOptions): Promise<Album[]> {
    const rows = await this.call<JamendoAlbum>(
      '/albums/',
      { namesearch: query, limit: Math.min(opts?.limit ?? 12, 200), offset: opts?.offset ?? 0, imagesize: IMAGE_SIZE },
      opts,
    );
    return rows.map(this.toAlbum);
  }

  async searchPlaylists(query: string, opts?: SearchOptions): Promise<ProviderPlaylist[]> {
    const rows = await this.call<JamendoPlaylist>('/playlists/', { namesearch: query, limit: Math.min(opts?.limit ?? 8, 200) }, opts);
    return rows.map((p) => ({
      id: `jamendo:${p.id}`,
      provider: this.id,
      providerPlaylistId: p.id,
      name: p.name,
      artwork: null,
      trackCount: p.tracks?.length ?? 0,
    }));
  }

  async search(query: string, opts?: SearchOptions): Promise<SearchResults> {
    const [tracks, artists, albums, playlists] = await Promise.all([
      this.searchTracks(query, { ...opts, limit: opts?.limit ?? 30 }),
      this.searchArtists(query, { ...opts, limit: 10 }).catch(() => []),
      this.searchAlbums(query, { ...opts, limit: 10 }).catch(() => []),
      this.searchPlaylists(query, { ...opts, limit: 8 }).catch(() => []),
    ]);
    return { tracks, artists, albums, playlists };
  }

  async autocomplete(prefix: string, opts?: SearchOptions): Promise<string[]> {
    if (prefix.trim().length < 2) return [];
    try {
      const raw = await client.get<{ results: Record<string, Array<{ match?: string } | string>> }>(
        this.url('/autocomplete/', { prefix, limit: opts?.limit ?? 6, matchcount: 1, entity: 'tracks artists' }),
        { signal: opts?.signal, ttlMs: 60 * 60_000 },
      );
      const out: string[] = [];
      for (const bucket of Object.values(raw.results ?? {})) {
        for (const item of bucket ?? []) out.push(typeof item === 'string' ? item : (item.match ?? ''));
      }
      return [...new Set(out.filter(Boolean))].slice(0, opts?.limit ?? 6);
    } catch {
      return [];
    }
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    const rows = await this.call<JamendoTrack>('/tracks/', { ...this.trackParams({ limit: 1 }), id: providerTrackId });
    return rows[0] ? this.toTrack(rows[0]) : null;
  }

  async getAlbum(providerAlbumId: string) {
    const rows = await this.call<JamendoAlbum>('/albums/tracks/', {
      id: providerAlbumId,
      limit: 1,
      audioformat: 'mp32',
      imagesize: IMAGE_SIZE,
    });
    const row = rows[0];
    if (!row) return null;
    const tracks = (row.tracks ?? []).map((t) =>
      this.toTrack({ ...t, artist_id: row.artist_id, artist_name: row.artist_name, album_id: row.id, album_name: row.name, album_image: row.image }),
    );
    return { album: { ...this.toAlbum(row), trackCount: tracks.length }, tracks };
  }

  async getArtist(providerArtistId: string) {
    const [artistRows, trackRows, albumRows] = await Promise.all([
      this.call<JamendoArtist>('/artists/', { id: providerArtistId, imagesize: IMAGE_SIZE }),
      this.call<JamendoTrack>('/tracks/', { ...this.trackParams({ limit: 20 }), artist_id: providerArtistId, order: 'popularity_total' }),
      // /artists/albums/ nests the albums inside an artist envelope.
      this.call<JamendoArtist & { albums?: JamendoAlbum[] }>('/artists/albums/', {
        id: providerArtistId,
        imagesize: IMAGE_SIZE,
        limit: 1,
      }).catch(() => []),
    ]);
    const raw = artistRows[0];
    if (!raw) return null;
    const albums = albumRows[0]?.albums ?? [];
    return {
      artist: this.toArtist(raw),
      topTracks: trackRows.map(this.toTrack),
      albums: albums.map((a) => this.toAlbum({ ...a, artist_id: raw.id, artist_name: raw.name })),
    };
  }

  async getFeaturedTracks(opts?: SearchOptions): Promise<Track[]> {
    const rows = await this.call<JamendoTrack>(
      '/tracks/',
      { ...this.trackParams({ limit: opts?.limit ?? 20, offset: opts?.offset }), order: 'popularity_week' },
      { ...opts, ttlMs: 60 * 60_000 },
    );
    return rows.map(this.toTrack);
  }

  async getTracksByGenre(genre: string, opts?: SearchOptions): Promise<Track[]> {
    const rows = await this.call<JamendoTrack>(
      '/tracks/',
      { ...this.trackParams(opts), fuzzytags: genre, order: 'popularity_month' },
      { ...opts, ttlMs: 60 * 60_000 },
    );
    return rows.map(this.toTrack);
  }

  async getRecommendations(seed: { genres: string[]; artistIds: string[] }, opts?: SearchOptions): Promise<Track[]> {
    const tags = seed.genres.slice(0, 3).join(' ');
    if (!tags) return this.getFeaturedTracks(opts);
    const rows = await this.call<JamendoTrack>(
      '/tracks/',
      { ...this.trackParams(opts), fuzzytags: tags, order: 'popularity_month' },
      { ...opts, ttlMs: 30 * 60_000 },
    );
    return rows.map(this.toTrack);
  }

  async getStreamUrl(track: Track): Promise<string | null> {
    if (track.streamUrl) return track.streamUrl;
    const fresh = await this.getTrack(track.providerTrackId);
    return fresh?.streamUrl ?? null;
  }

  getArtwork(track: Track): string | null {
    return track.artwork;
  }
}
