/** Canonical domain model. Every provider must normalise into these shapes. */

export type ProviderId = 'jamendo' | 'archive';

export interface ArtistRef { id: string; name: string }
export interface AlbumRef { id: string; name: string }

export interface Track {
  /** Globally unique: `${provider}:${providerTrackId}` */
  id: string;
  provider: ProviderId;
  providerTrackId: string;
  title: string;
  artist: ArtistRef;
  album: AlbumRef | null;
  artwork: string | null;
  /** Seconds. 0 when the provider does not expose it. */
  duration: number;
  /** Direct, legally streamable URL. Null when the source is metadata-only. */
  streamUrl: string | null;
  /** True only when the rights holder explicitly allows offline copies. */
  downloadAllowed: boolean;
  licenseUrl: string | null;
  genres: string[];
  releaseDate: string | null;
}

export interface Artist {
  id: string;
  provider: ProviderId;
  providerArtistId: string;
  name: string;
  image: string | null;
  genres: string[];
  website: string | null;
}

export interface Album {
  id: string;
  provider: ProviderId;
  providerAlbumId: string;
  name: string;
  artist: ArtistRef;
  artwork: string | null;
  releaseDate: string | null;
  trackCount: number;
}

export interface ProviderPlaylist {
  id: string;
  provider: ProviderId;
  providerPlaylistId: string;
  name: string;
  artwork: string | null;
  trackCount: number;
}

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: ProviderPlaylist[];
}

/* ------------------------------ user data ------------------------------- */

export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LikedTrack { trackId: string; likedAt: number; track: Track }
export interface FollowedArtist { artistId: string; followedAt: number; artist: Artist }
export interface SavedAlbum { albumId: string; savedAt: number; album: Album }

export type HistoryEventType = 'play_started' | 'p25' | 'p50' | 'p75' | 'completed' | 'skipped';

export interface HistoryEvent {
  id: string;
  trackId: string;
  type: HistoryEventType;
  at: number;
  /** Seconds actually listened at the moment of the event. */
  listenedSeconds: number;
  percent: number;
  track: Track;
}

export interface SearchHistoryEntry { query: string; at: number }

export type ThemeMode = 'dark' | 'light' | 'system';
export type RepeatMode = 'off' | 'all' | 'one';

export interface Settings {
  theme: ThemeMode;
  autoplay: boolean;
  crossfadeSeconds: number;
  gapless: boolean;
  smartShuffle: boolean;
  volume: number;
  muted: boolean;
  historyEnabled: boolean;
  personalizedRecommendations: boolean;
  defaultProvider: ProviderId;
}

export interface Profile {
  id: string;
  displayName: string;
  email: string | null;
  /** "local" when no auth backend is configured. */
  source: 'local' | 'supabase';
}

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  playlists: Array<Playlist & { tracks: Track[] }>;
  liked: LikedTrack[];
  followedArtists: FollowedArtist[];
  savedAlbums: SavedAlbum[];
  history: HistoryEvent[];
  settings: Settings;
}

export interface ImportedRow {
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  provider_id?: string;
}
