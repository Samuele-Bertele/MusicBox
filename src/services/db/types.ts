import type {
  Album, Artist, ExportBundle, FollowedArtist, HistoryEvent, HistoryEventType,
  LikedTrack, Playlist, Profile, SavedAlbum, SearchHistoryEntry, Settings, Track,
} from '@/types';

export interface PlaylistWithTracks extends Playlist {
  tracks: Track[];
}

/**
 * The only database contract the application knows about.
 * Implemented by LocalStore (IndexedDB) and SupabaseStore (PostgreSQL + RLS).
 */
export interface DataStore {
  readonly kind: 'local' | 'supabase';
  init(): Promise<void>;

  /* playlists */
  listPlaylists(): Promise<Playlist[]>;
  getPlaylist(id: string): Promise<PlaylistWithTracks | null>;
  createPlaylist(input: { name: string; description?: string; cover?: string | null }): Promise<Playlist>;
  updatePlaylist(id: string, patch: Partial<Pick<Playlist, 'name' | 'description' | 'cover'>>): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  duplicatePlaylist(id: string): Promise<Playlist | null>;
  addTracksToPlaylist(id: string, tracks: Track[]): Promise<void>;
  removeTrackFromPlaylist(id: string, trackId: string): Promise<void>;
  reorderPlaylist(id: string, orderedTrackIds: string[]): Promise<void>;

  /* likes */
  listLiked(): Promise<LikedTrack[]>;
  isLiked(trackId: string): Promise<boolean>;
  like(track: Track): Promise<void>;
  unlike(trackId: string): Promise<void>;

  /* follows & saved albums */
  listFollowedArtists(): Promise<FollowedArtist[]>;
  followArtist(artist: Artist): Promise<void>;
  unfollowArtist(artistId: string): Promise<void>;
  listSavedAlbums(): Promise<SavedAlbum[]>;
  saveAlbum(album: Album): Promise<void>;
  unsaveAlbum(albumId: string): Promise<void>;

  /* history */
  logHistory(track: Track, type: HistoryEventType, listenedSeconds: number, percent: number): Promise<void>;
  listHistory(limit?: number): Promise<HistoryEvent[]>;
  clearHistory(): Promise<void>;

  /* search history */
  listSearchHistory(): Promise<SearchHistoryEntry[]>;
  pushSearchHistory(query: string): Promise<void>;
  clearSearchHistory(): Promise<void>;

  /* settings & profile */
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;

  /* data management */
  exportAll(): Promise<ExportBundle>;
  wipeAll(): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoplay: true,
  crossfadeSeconds: 0,
  gapless: true,
  smartShuffle: true,
  volume: 0.8,
  muted: false,
  historyEnabled: true,
  personalizedRecommendations: true,
  defaultProvider: 'jamendo',
};
