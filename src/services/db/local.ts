import type {
  Album, Artist, ExportBundle, FollowedArtist, HistoryEvent, HistoryEventType,
  LikedTrack, Playlist, Profile, SavedAlbum, SearchHistoryEntry, Settings, Track,
} from '@/types';
import { bump } from '@/services/http/telemetry';
import { uid } from '@/utils/id';
import { sanitizeText } from '@/utils/validation';
import { createBackend, type KeyValueBackend } from './backend';
import { DEFAULT_SETTINGS, type DataStore, type PlaylistWithTracks } from './types';

interface PlaylistTrackRow {
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: number;
  track: Track;
}

const HISTORY_CAP = 5000;
const SEARCH_CAP = 20;

/** IndexedDB-backed store. Zero cost, zero setup, single device. */
export class LocalStore implements DataStore {
  readonly kind = 'local' as const;
  private backend: KeyValueBackend | null = null;

  constructor(backend?: KeyValueBackend) {
    this.backend = backend ?? null;
  }

  async init() {
    if (!this.backend) this.backend = await createBackend();
  }

  private get be(): KeyValueBackend {
    if (!this.backend) throw new Error('store_not_initialised');
    return this.backend;
  }

  private read<T>(store: Parameters<KeyValueBackend['all']>[0]) {
    bump('dbReads');
    return this.be.all<T>(store);
  }

  private write(store: Parameters<KeyValueBackend['put']>[0], key: string, value: unknown) {
    bump('dbWrites');
    return this.be.put(store, key, value);
  }

  /* ------------------------------ playlists ----------------------------- */

  async listPlaylists(): Promise<Playlist[]> {
    const rows = await this.read<Playlist>('playlists');
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getPlaylist(id: string): Promise<PlaylistWithTracks | null> {
    const pl = await this.be.get<Playlist>('playlists', id);
    if (!pl) return null;
    const rows = (await this.read<PlaylistTrackRow>('playlist_tracks')).filter((r) => r.playlistId === id);
    rows.sort((a, b) => a.position - b.position);
    return { ...pl, tracks: rows.map((r) => r.track) };
  }

  async createPlaylist(input: { name: string; description?: string; cover?: string | null }): Promise<Playlist> {
    const now = Date.now();
    const pl: Playlist = {
      id: uid('pl'),
      name: sanitizeText(input.name, 80) || 'New playlist',
      description: sanitizeText(input.description ?? '', 300),
      cover: input.cover ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.write('playlists', pl.id, pl);
    return pl;
  }

  async updatePlaylist(id: string, patch: Partial<Pick<Playlist, 'name' | 'description' | 'cover'>>) {
    const pl = await this.be.get<Playlist>('playlists', id);
    if (!pl) return;
    const next: Playlist = {
      ...pl,
      name: patch.name !== undefined ? sanitizeText(patch.name, 80) || pl.name : pl.name,
      description: patch.description !== undefined ? sanitizeText(patch.description, 300) : pl.description,
      cover: patch.cover !== undefined ? patch.cover : pl.cover,
      updatedAt: Date.now(),
    };
    await this.write('playlists', id, next);
  }

  async deletePlaylist(id: string) {
    const rows = await this.read<PlaylistTrackRow>('playlist_tracks');
    for (const r of rows) if (r.playlistId === id) await this.be.del('playlist_tracks', `${id}:${r.trackId}`);
    await this.be.del('playlists', id);
    bump('dbWrites');
  }

  async duplicatePlaylist(id: string) {
    const src = await this.getPlaylist(id);
    if (!src) return null;
    const copy = await this.createPlaylist({ name: `${src.name} (copy)`, description: src.description, cover: src.cover });
    await this.addTracksToPlaylist(copy.id, src.tracks);
    return copy;
  }

  async addTracksToPlaylist(id: string, tracks: Track[]) {
    const existing = (await this.read<PlaylistTrackRow>('playlist_tracks')).filter((r) => r.playlistId === id);
    const known = new Set(existing.map((r) => r.trackId));
    let position = existing.length;
    const rows: Array<[string, unknown]> = [];
    for (const track of tracks) {
      if (known.has(track.id)) continue;
      known.add(track.id);
      rows.push([`${id}:${track.id}`, { playlistId: id, trackId: track.id, position: position++, addedAt: Date.now(), track }]);
    }
    if (rows.length) {
      bump('dbWrites', rows.length);
      await this.be.putMany('playlist_tracks', rows);
    }
    await this.updatePlaylist(id, {});
  }

  async removeTrackFromPlaylist(id: string, trackId: string) {
    await this.be.del('playlist_tracks', `${id}:${trackId}`);
    bump('dbWrites');
    const remaining = (await this.read<PlaylistTrackRow>('playlist_tracks'))
      .filter((r) => r.playlistId === id)
      .sort((a, b) => a.position - b.position);
    await this.reorderPlaylist(id, remaining.map((r) => r.trackId));
  }

  async reorderPlaylist(id: string, orderedTrackIds: string[]) {
    const rows = (await this.read<PlaylistTrackRow>('playlist_tracks')).filter((r) => r.playlistId === id);
    const byId = new Map(rows.map((r) => [r.trackId, r]));
    const updates: Array<[string, unknown]> = [];
    orderedTrackIds.forEach((trackId, index) => {
      const row = byId.get(trackId);
      if (row) updates.push([`${id}:${trackId}`, { ...row, position: index }]);
    });
    if (updates.length) {
      bump('dbWrites', updates.length);
      await this.be.putMany('playlist_tracks', updates);
    }
    await this.updatePlaylist(id, {});
  }

  /* -------------------------------- likes ------------------------------- */

  async listLiked(): Promise<LikedTrack[]> {
    const rows = await this.read<LikedTrack>('liked_tracks');
    return rows.sort((a, b) => b.likedAt - a.likedAt);
  }
  async isLiked(trackId: string) {
    return Boolean(await this.be.get('liked_tracks', trackId));
  }
  async like(track: Track) {
    await this.write('liked_tracks', track.id, { trackId: track.id, likedAt: Date.now(), track });
  }
  async unlike(trackId: string) {
    bump('dbWrites');
    await this.be.del('liked_tracks', trackId);
  }

  /* -------------------------- follows / albums -------------------------- */

  async listFollowedArtists(): Promise<FollowedArtist[]> {
    return (await this.read<FollowedArtist>('followed_artists')).sort((a, b) => b.followedAt - a.followedAt);
  }
  async followArtist(artist: Artist) {
    await this.write('followed_artists', artist.id, { artistId: artist.id, followedAt: Date.now(), artist });
  }
  async unfollowArtist(artistId: string) {
    bump('dbWrites');
    await this.be.del('followed_artists', artistId);
  }
  async listSavedAlbums(): Promise<SavedAlbum[]> {
    return (await this.read<SavedAlbum>('saved_albums')).sort((a, b) => b.savedAt - a.savedAt);
  }
  async saveAlbum(album: Album) {
    await this.write('saved_albums', album.id, { albumId: album.id, savedAt: Date.now(), album });
  }
  async unsaveAlbum(albumId: string) {
    bump('dbWrites');
    await this.be.del('saved_albums', albumId);
  }

  /* ------------------------------- history ------------------------------ */

  async logHistory(track: Track, type: HistoryEventType, listenedSeconds: number, percent: number) {
    const settings = await this.getSettings();
    if (!settings.historyEnabled) return;
    const event: HistoryEvent = {
      id: uid('ev'),
      trackId: track.id,
      type,
      at: Date.now(),
      listenedSeconds: Math.round(listenedSeconds),
      percent: Math.round(percent),
      track,
    };
    await this.write('listening_history', event.id, event);
    const all = await this.read<HistoryEvent>('listening_history');
    if (all.length > HISTORY_CAP) {
      const excess = all.sort((a, b) => a.at - b.at).slice(0, all.length - HISTORY_CAP);
      for (const e of excess) await this.be.del('listening_history', e.id);
    }
  }

  async listHistory(limit = 500): Promise<HistoryEvent[]> {
    const rows = await this.read<HistoryEvent>('listening_history');
    return rows.sort((a, b) => b.at - a.at).slice(0, limit);
  }

  async clearHistory() {
    bump('dbWrites');
    await this.be.clear('listening_history');
  }

  /* --------------------------- search history --------------------------- */

  async listSearchHistory(): Promise<SearchHistoryEntry[]> {
    return (await this.read<SearchHistoryEntry>('search_history')).sort((a, b) => b.at - a.at).slice(0, SEARCH_CAP);
  }
  async pushSearchHistory(query: string) {
    const q = sanitizeText(query, 80);
    if (!q) return;
    await this.write('search_history', q.toLowerCase(), { query: q, at: Date.now() });
    const rows = await this.listSearchHistory();
    const all = await this.read<SearchHistoryEntry>('search_history');
    if (all.length > SEARCH_CAP) {
      const keep = new Set(rows.map((r) => r.query.toLowerCase()));
      for (const r of all) if (!keep.has(r.query.toLowerCase())) await this.be.del('search_history', r.query.toLowerCase());
    }
  }
  async clearSearchHistory() {
    bump('dbWrites');
    await this.be.clear('search_history');
  }

  /* -------------------------- settings & profile ------------------------ */

  async getSettings(): Promise<Settings> {
    const stored = await this.be.get<Partial<Settings>>('kv', 'settings');
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }
  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.getSettings()), ...patch };
    await this.write('kv', 'settings', next);
    return next;
  }
  async getProfile(): Promise<Profile | null> {
    return (await this.be.get<Profile>('kv', 'profile')) ?? null;
  }
  async saveProfile(profile: Profile) {
    await this.write('kv', 'profile', profile);
  }

  /* ---------------------------- data management ------------------------- */

  async exportAll(): Promise<ExportBundle> {
    const playlists = await this.listPlaylists();
    const withTracks = await Promise.all(
      playlists.map(async (p) => ({ ...p, tracks: (await this.getPlaylist(p.id))?.tracks ?? [] })),
    );
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      playlists: withTracks,
      liked: await this.listLiked(),
      followedArtists: await this.listFollowedArtists(),
      savedAlbums: await this.listSavedAlbums(),
      history: await this.listHistory(HISTORY_CAP),
      settings: await this.getSettings(),
    };
  }

  async wipeAll() {
    for (const s of ['playlists', 'playlist_tracks', 'liked_tracks', 'followed_artists', 'saved_albums', 'listening_history', 'search_history', 'kv'] as const) {
      await this.be.clear(s);
    }
  }
}
