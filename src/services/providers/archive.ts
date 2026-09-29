import type { Album, Artist, SearchResults, Track } from '@/types';
import { JsonClient, RateLimiter, TtlCache } from '@/services/http/client';
import { ProviderError, type MusicProvider, type SearchOptions } from './types';

/**
 * Internet Archive — secondary provider / fallback.
 *
 * Scope is deliberately restricted to the `netlabels` collection: audio that
 * labels uploaded themselves for free distribution, with an explicit licence
 * on each item. No key, no signup, no quota, CORS enabled.
 *
 * Anything outside that collection is NOT searched, because the Archive also
 * hosts material whose streaming rights are unclear.
 */

const SEARCH = 'https://archive.org/advancedsearch.php';
const META = 'https://archive.org/metadata';
const DOWNLOAD = 'https://archive.org/download';
const COLLECTION = 'netlabels';
const AUDIO_FORMATS = ['VBR MP3', '128Kbps MP3', '64Kbps MP3', 'MP3'];

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  year?: string | number;
  subject?: string | string[];
  licenseurl?: string;
}

interface ArchiveFile {
  name: string;
  format?: string;
  length?: string;
  title?: string;
  track?: string | number;
  album?: string;
  artist?: string;
}

interface ArchiveMetadata {
  metadata?: { identifier: string; title?: string; creator?: string | string[]; date?: string; licenseurl?: string; subject?: string | string[] };
  files?: ArchiveFile[];
}

const client = new JsonClient({
  limiter: new RateLimiter(5, 1.5),
  cache: new TtlCache(300, 'mb.cache.archive'),
  defaultTtlMs: 60 * 60_000,
  retries: 2,
});

const first = (v: string | string[] | undefined, fallback: string) => (Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback));
const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? v.split(/[;,]/) : []);

/** Archive lengths come as "213.45" or "3:33". */
export function parseLength(raw?: string): number {
  if (!raw) return 0;
  if (raw.includes(':')) {
    return raw
      .split(':')
      .map(Number)
      .reduce((acc, n) => acc * 60 + (Number.isFinite(n) ? n : 0), 0);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export class ArchiveProvider implements MusicProvider {
  readonly id = 'archive' as const;
  readonly label = 'Internet Archive (netlabels)';
  readonly canStream = true;
  readonly licenseNote =
    'Netlabel releases published on the Internet Archive for free distribution. Each item carries its own licence URL.';

  isConfigured(): boolean {
    return true;
  }

  private async docs(query: string, opts?: SearchOptions): Promise<ArchiveDoc[]> {
    const q = `${query ? `(${query}) AND ` : ''}mediatype:(audio) AND collection:(${COLLECTION})`;
    const params = new URLSearchParams({ q, rows: String(Math.min(opts?.limit ?? 20, 50)), page: String(Math.floor((opts?.offset ?? 0) / (opts?.limit ?? 20)) + 1), output: 'json' });
    for (const f of ['identifier', 'title', 'creator', 'year', 'subject', 'licenseurl']) params.append('fl[]', f);
    try {
      const data = await client.get<{ response?: { docs?: ArchiveDoc[] } }>(`${SEARCH}?${params.toString()}`, { signal: opts?.signal });
      return data.response?.docs ?? [];
    } catch {
      throw new ProviderError('Internet Archive is not responding', 'network', this.id);
    }
  }

  private async item(identifier: string, signal?: AbortSignal): Promise<ArchiveMetadata> {
    try {
      return await client.get<ArchiveMetadata>(`${META}/${encodeURIComponent(identifier)}`, { signal, ttlMs: 6 * 60 * 60_000 });
    } catch {
      throw new ProviderError('Internet Archive is not responding', 'network', this.id);
    }
  }

  private filesToTracks(meta: ArchiveMetadata): Track[] {
    const id = meta.metadata?.identifier;
    if (!id) return [];
    const artist = first(meta.metadata?.creator, 'Unknown artist');
    const albumName = meta.metadata?.title ?? id;
    const license = meta.metadata?.licenseurl ?? null;
    const genres = asList(meta.metadata?.subject).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 6);
    const cover = `${DOWNLOAD}/${encodeURIComponent(id)}/__ia_thumb.jpg`;

    return (meta.files ?? [])
      .filter((f) => AUDIO_FORMATS.includes(f.format ?? ''))
      .filter((f, i, arr) => arr.findIndex((o) => (o.title ?? o.name) === (f.title ?? f.name)) === i)
      .map((f) => ({
        id: `archive:${id}/${f.name}`,
        provider: this.id,
        providerTrackId: `${id}/${f.name}`,
        title: f.title || f.name.replace(/\.[^.]+$/, ''),
        artist: { id: `archive:${artist}`, name: f.artist || artist },
        album: { id: `archive:${id}`, name: f.album || albumName },
        artwork: cover,
        duration: parseLength(f.length),
        streamUrl: `${DOWNLOAD}/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}`,
        downloadAllowed: false,
        licenseUrl: license,
        sourceUrl: `https://archive.org/details/${encodeURIComponent(id)}`,
        genres,
        releaseDate: meta.metadata?.date ?? null,
      }));
  }

  async searchTracks(query: string, opts?: SearchOptions): Promise<Track[]> {
    const docs = await this.docs(query, { ...opts, limit: Math.min(opts?.limit ?? 6, 8) });
    const metas = await Promise.all(docs.map((d) => this.item(d.identifier, opts?.signal).catch(() => null)));
    return metas.flatMap((m) => (m ? this.filesToTracks(m).slice(0, 4) : [])).slice(0, opts?.limit ?? 20);
  }

  async searchArtists(query: string, opts?: SearchOptions): Promise<Artist[]> {
    const docs = await this.docs(query, opts);
    const seen = new Map<string, Artist>();
    for (const d of docs) {
      const name = first(d.creator, '');
      if (!name || seen.has(name)) continue;
      seen.set(name, {
        id: `archive:${name}`,
        provider: this.id,
        providerArtistId: name,
        name,
        image: `${DOWNLOAD}/${encodeURIComponent(d.identifier)}/__ia_thumb.jpg`,
        genres: asList(d.subject).slice(0, 4),
        website: null,
      });
    }
    return [...seen.values()].slice(0, opts?.limit ?? 10);
  }

  async searchAlbums(query: string, opts?: SearchOptions): Promise<Album[]> {
    const docs = await this.docs(query, opts);
    return docs.map((d) => ({
      id: `archive:${d.identifier}`,
      provider: this.id,
      providerAlbumId: d.identifier,
      name: d.title ?? d.identifier,
      artist: { id: `archive:${first(d.creator, 'Unknown artist')}`, name: first(d.creator, 'Unknown artist') },
      artwork: `${DOWNLOAD}/${encodeURIComponent(d.identifier)}/__ia_thumb.jpg`,
      releaseDate: d.year ? String(d.year) : null,
      trackCount: 0,
    }));
  }

  async search(query: string, opts?: SearchOptions): Promise<SearchResults> {
    const [tracks, artists, albums] = await Promise.all([
      this.searchTracks(query, { ...opts, limit: 20 }),
      this.searchArtists(query, { ...opts, limit: 8 }).catch(() => []),
      this.searchAlbums(query, { ...opts, limit: 10 }).catch(() => []),
    ]);
    return { tracks, artists, albums, playlists: [] };
  }

  async autocomplete(): Promise<string[]> {
    return [];
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    const [identifier] = providerTrackId.split('/');
    const meta = await this.item(identifier);
    return this.filesToTracks(meta).find((t) => t.providerTrackId === providerTrackId) ?? null;
  }

  async getAlbum(providerAlbumId: string) {
    const meta = await this.item(providerAlbumId);
    if (!meta.metadata) return null;
    const tracks = this.filesToTracks(meta);
    return {
      album: {
        id: `archive:${providerAlbumId}`,
        provider: this.id,
        providerAlbumId,
        name: meta.metadata.title ?? providerAlbumId,
        artist: { id: `archive:${first(meta.metadata.creator, 'Unknown artist')}`, name: first(meta.metadata.creator, 'Unknown artist') },
        artwork: `${DOWNLOAD}/${encodeURIComponent(providerAlbumId)}/__ia_thumb.jpg`,
        releaseDate: meta.metadata.date ?? null,
        trackCount: tracks.length,
      },
      tracks,
    };
  }

  async getArtist(providerArtistId: string) {
    const albums = await this.searchAlbums(`creator:("${providerArtistId}")`, { limit: 12 });
    const topTracks = await this.searchTracks(`creator:("${providerArtistId}")`, { limit: 10 });
    return {
      artist: {
        id: `archive:${providerArtistId}`,
        provider: this.id,
        providerArtistId,
        name: providerArtistId,
        image: albums[0]?.artwork ?? null,
        genres: [],
        website: null,
      },
      topTracks,
      albums,
    };
  }

  getFeaturedTracks(opts?: SearchOptions): Promise<Track[]> {
    return this.searchTracks('', opts);
  }

  getTracksByGenre(genre: string, opts?: SearchOptions): Promise<Track[]> {
    return this.searchTracks(`subject:(${genre})`, opts);
  }

  getRecommendations(seed: { genres: string[]; artistIds: string[] }, opts?: SearchOptions): Promise<Track[]> {
    const genre = seed.genres[0];
    return genre ? this.getTracksByGenre(genre, opts) : this.getFeaturedTracks(opts);
  }

  async getStreamUrl(track: Track): Promise<string | null> {
    return track.streamUrl;
  }

  getArtwork(track: Track): string | null {
    return track.artwork;
  }
}
