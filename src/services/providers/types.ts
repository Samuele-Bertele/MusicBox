import type { Album, Artist, ProviderId, SearchResults, Track } from '@/types';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/**
 * Every music source implements this contract. The rest of the application
 * never imports a concrete provider: swapping catalogue = writing one file.
 */
export interface MusicProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** False for metadata-only catalogues — the UI must not offer playback. */
  readonly canStream: boolean;
  readonly licenseNote: string;

  isConfigured(): boolean;

  search(query: string, opts?: SearchOptions): Promise<SearchResults>;
  searchTracks(query: string, opts?: SearchOptions): Promise<Track[]>;
  searchArtists(query: string, opts?: SearchOptions): Promise<Artist[]>;
  searchAlbums(query: string, opts?: SearchOptions): Promise<Album[]>;
  autocomplete(prefix: string, opts?: SearchOptions): Promise<string[]>;

  getTrack(providerTrackId: string): Promise<Track | null>;
  getAlbum(providerAlbumId: string): Promise<{ album: Album; tracks: Track[] } | null>;
  getArtist(
    providerArtistId: string,
  ): Promise<{ artist: Artist; topTracks: Track[]; albums: Album[] } | null>;

  /** Editorial / popular content used to fill an empty Home. */
  getFeaturedTracks(opts?: SearchOptions): Promise<Track[]>;
  getTracksByGenre(genre: string, opts?: SearchOptions): Promise<Track[]>;
  getRecommendations(seed: { genres: string[]; artistIds: string[] }, opts?: SearchOptions): Promise<Track[]>;

  /** Re-resolves a possibly expired stream URL. */
  getStreamUrl(track: Track): Promise<string | null>;
  getArtwork(track: Track): string | null;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'rate_limit' | 'not_found' | 'network' | 'unavailable' | 'unknown',
    readonly provider: ProviderId,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
