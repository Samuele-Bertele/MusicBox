import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Album, Artist, ExportBundle, FollowedArtist, HistoryEvent, HistoryEventType,
  LikedTrack, Playlist, Profile, SavedAlbum, SearchHistoryEntry, Settings, Track,
} from '@/types';
import { bump } from '@/services/http/telemetry';
import { sanitizeText } from '@/utils/validation';
import { DEFAULT_SETTINGS, type DataStore, type PlaylistWithTracks } from './types';

const url = import.meta.env?.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

/**
 * The anon key is public by design; every table is guarded by RLS.
 *
 * The SDK is imported dynamically so the ~60 kB it costs is only downloaded
 * by people who actually configured Supabase — the default local-only setup
 * never pays for it.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (!loading) {
    loading = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
        return client;
      })
      .catch((err) => {
        console.warn('[supabase] SDK could not be loaded', err);
        return null;
      });
  }
  return loading;
}

export const isSupabaseConfigured = () => Boolean(url && anonKey);

interface Row<T> {
  data: T | null;
  error: { message: string } | null;
}

function unwrap<T>(res: Row<T>, fallback: T): T {
  if (res.error) {
    console.warn('[supabase]', res.error.message);
    return fallback;
  }
  return res.data ?? fallback;
}

/**
 * PostgreSQL store. Mirrors LocalStore exactly so the rest of the app cannot
 * tell them apart. Track payloads are stored as jsonb: the catalogue metadata
 * we are allowed to cache, and nothing else.
 */
export class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;
  private uid = '';

  constructor(private readonly sb: SupabaseClient) {}

  async init() {
    const { data } = await this.sb.auth.getUser();
    this.uid = data.user?.id ?? '';
    if (!this.uid) throw new Error('not_authenticated');
  }

  private async upsertTracks(tracks: Track[]) {
    if (!tracks.length) return;
    bump('dbWrites', tracks.length);
    await this.sb.from('tracks').upsert(
      tracks.map((t) => ({ user_id: this.uid, id: t.id, payload: t, updated_at: new Date().toISOString() })),
      { onConflict: 'user_id,id' },
    );
  }

  /* ------------------------------ playlists ----------------------------- */

  async listPlaylists(): Promise<Playlist[]> {
    bump('dbReads');
    const res = await this.sb.from('playlists').select('*').eq('user_id', this.uid).order('updated_at', { ascending: false });
    return unwrap<Array<Record<string, unknown>>>(res as never, []).map(mapPlaylist);
  }

  async getPlaylist(id: string): Promise<PlaylistWithTracks | null> {
    bump('dbReads', 2);
    const meta = await this.sb.from('playlists').select('*').eq('user_id', this.uid).eq('id', id).maybeSingle();
    if (!meta.data) return null;
    const rows = await this.sb
      .from('playlist_tracks')
      .select('position, track_id, tracks(payload)')
      .eq('user_id', this.uid)
      .eq('playlist_id', id)
      .order('position');
    const tracks = (rows.data ?? [])
      .map((r) => (r as unknown as { tracks?: { payload: Track } }).tracks?.payload)
      .filter((t): t is Track => Boolean(t));
    return { ...mapPlaylist(meta.data as Record<string, unknown>), tracks };
  }

  async createPlaylist(input: { name: string; description?: string; cover?: string | null }): Promise<Playlist> {
    bump('dbWrites');
    const res = await this.sb
      .from('playlists')
      .insert({
        user_id: this.uid,
        name: sanitizeText(input.name, 80) || 'New playlist',
        description: sanitizeText(input.description ?? '', 300),
        cover: input.cover ?? null,
      })
      .select()
      .single();
    if (res.error) throw new Error(res.error.message);
    return mapPlaylist(res.data as Record<string, unknown>);
  }

  async updatePlaylist(id: string, patch: Partial<Pick<Playlist, 'name' | 'description' | 'cover'>>) {
    bump('dbWrites');
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = sanitizeText(patch.name, 80);
    if (patch.description !== undefined) payload.description = sanitizeText(patch.description, 300);
    if (patch.cover !== undefined) payload.cover = patch.cover;
    await this.sb.from('playlists').update(payload).eq('user_id', this.uid).eq('id', id);
  }

  async deletePlaylist(id: string) {
    bump('dbWrites');
    await this.sb.from('playlists').delete().eq('user_id', this.uid).eq('id', id);
  }

  async duplicatePlaylist(id: string) {
    const src = await this.getPlaylist(id);
    if (!src) return null;
    const copy = await this.createPlaylist({ name: `${src.name} (copy)`, description: src.description, cover: src.cover });
    await this.addTracksToPlaylist(copy.id, src.tracks);
    return copy;
  }

  async addTracksToPlaylist(id: string, tracks: Track[]) {
    if (!tracks.length) return;
    await this.upsertTracks(tracks);
    const current = await this.getPlaylist(id);
    const known = new Set(current?.tracks.map((t) => t.id) ?? []);
    let position = current?.tracks.length ?? 0;
    const rows = tracks
      .filter((t) => !known.has(t.id))
      .map((t) => ({ user_id: this.uid, playlist_id: id, track_id: t.id, position: position++ }));
    if (!rows.length) return;
    bump('dbWrites', rows.length);
    await this.sb.from('playlist_tracks').upsert(rows, { onConflict: 'playlist_id,track_id' });
    await this.updatePlaylist(id, {});
  }

  async removeTrackFromPlaylist(id: string, trackId: string) {
    bump('dbWrites');
    await this.sb.from('playlist_tracks').delete().eq('user_id', this.uid).eq('playlist_id', id).eq('track_id', trackId);
    const remaining = await this.getPlaylist(id);
    if (remaining) await this.reorderPlaylist(id, remaining.tracks.map((t) => t.id));
  }

  async reorderPlaylist(id: string, orderedTrackIds: string[]) {
    if (!orderedTrackIds.length) return;
    bump('dbWrites', orderedTrackIds.length);
    await this.sb.from('playlist_tracks').upsert(
      orderedTrackIds.map((trackId, position) => ({ user_id: this.uid, playlist_id: id, track_id: trackId, position })),
      { onConflict: 'playlist_id,track_id' },
    );
    await this.updatePlaylist(id, {});
  }

  /* -------------------------------- likes ------------------------------- */

  async listLiked(): Promise<LikedTrack[]> {
    bump('dbReads');
    const res = await this.sb
      .from('liked_tracks')
      .select('track_id, liked_at, tracks(payload)')
      .eq('user_id', this.uid)
      .order('liked_at', { ascending: false });
    return (res.data ?? [])
      .map((r) => {
        const row = r as unknown as { track_id: string; liked_at: string; tracks?: { payload: Track } };
        return row.tracks?.payload ? { trackId: row.track_id, likedAt: Date.parse(row.liked_at), track: row.tracks.payload } : null;
      })
      .filter((r): r is LikedTrack => Boolean(r));
  }

  async isLiked(trackId: string) {
    bump('dbReads');
    const res = await this.sb.from('liked_tracks').select('track_id').eq('user_id', this.uid).eq('track_id', trackId).maybeSingle();
    return Boolean(res.data);
  }

  async like(track: Track) {
    await this.upsertTracks([track]);
    bump('dbWrites');
    await this.sb.from('liked_tracks').upsert({ user_id: this.uid, track_id: track.id }, { onConflict: 'user_id,track_id' });
  }

  async unlike(trackId: string) {
    bump('dbWrites');
    await this.sb.from('liked_tracks').delete().eq('user_id', this.uid).eq('track_id', trackId);
  }

  /* -------------------------- follows / albums -------------------------- */

  async listFollowedArtists(): Promise<FollowedArtist[]> {
    bump('dbReads');
    const res = await this.sb.from('followed_artists').select('*').eq('user_id', this.uid).order('followed_at', { ascending: false });
    return (res.data ?? []).map((r) => {
      const row = r as unknown as { artist_id: string; followed_at: string; payload: Artist };
      return { artistId: row.artist_id, followedAt: Date.parse(row.followed_at), artist: row.payload };
    });
  }
  async followArtist(artist: Artist) {
    bump('dbWrites');
    await this.sb.from('followed_artists').upsert({ user_id: this.uid, artist_id: artist.id, payload: artist }, { onConflict: 'user_id,artist_id' });
  }
  async unfollowArtist(artistId: string) {
    bump('dbWrites');
    await this.sb.from('followed_artists').delete().eq('user_id', this.uid).eq('artist_id', artistId);
  }
  async listSavedAlbums(): Promise<SavedAlbum[]> {
    bump('dbReads');
    const res = await this.sb.from('saved_albums').select('*').eq('user_id', this.uid).order('saved_at', { ascending: false });
    return (res.data ?? []).map((r) => {
      const row = r as unknown as { album_id: string; saved_at: string; payload: Album };
      return { albumId: row.album_id, savedAt: Date.parse(row.saved_at), album: row.payload };
    });
  }
  async saveAlbum(album: Album) {
    bump('dbWrites');
    await this.sb.from('saved_albums').upsert({ user_id: this.uid, album_id: album.id, payload: album }, { onConflict: 'user_id,album_id' });
  }
  async unsaveAlbum(albumId: string) {
    bump('dbWrites');
    await this.sb.from('saved_albums').delete().eq('user_id', this.uid).eq('album_id', albumId);
  }

  /* ------------------------------- history ------------------------------ */

  async logHistory(track: Track, type: HistoryEventType, listenedSeconds: number, percent: number) {
    const settings = await this.getSettings();
    if (!settings.historyEnabled) return;
    await this.upsertTracks([track]);
    bump('dbWrites');
    await this.sb.from('listening_history').insert({
      user_id: this.uid,
      track_id: track.id,
      event_type: type,
      listened_seconds: Math.round(listenedSeconds),
      percent: Math.round(percent),
    });
  }

  async listHistory(limit = 500): Promise<HistoryEvent[]> {
    bump('dbReads');
    const res = await this.sb
      .from('listening_history')
      .select('id, track_id, event_type, created_at, listened_seconds, percent, tracks(payload)')
      .eq('user_id', this.uid)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (res.data ?? [])
      .map((r) => {
        const row = r as unknown as {
          id: string; track_id: string; event_type: HistoryEventType; created_at: string;
          listened_seconds: number; percent: number; tracks?: { payload: Track };
        };
        if (!row.tracks?.payload) return null;
        return {
          id: row.id,
          trackId: row.track_id,
          type: row.event_type,
          at: Date.parse(row.created_at),
          listenedSeconds: row.listened_seconds,
          percent: row.percent,
          track: row.tracks.payload,
        };
      })
      .filter((r): r is HistoryEvent => Boolean(r));
  }

  async clearHistory() {
    bump('dbWrites');
    await this.sb.from('listening_history').delete().eq('user_id', this.uid);
  }

  /* --------------------------- search history --------------------------- */

  async listSearchHistory(): Promise<SearchHistoryEntry[]> {
    bump('dbReads');
    const res = await this.sb.from('search_history').select('*').eq('user_id', this.uid).order('searched_at', { ascending: false }).limit(20);
    return (res.data ?? []).map((r) => {
      const row = r as unknown as { query: string; searched_at: string };
      return { query: row.query, at: Date.parse(row.searched_at) };
    });
  }
  async pushSearchHistory(query: string) {
    const q = sanitizeText(query, 80);
    if (!q) return;
    bump('dbWrites');
    await this.sb
      .from('search_history')
      .upsert({ user_id: this.uid, query: q, searched_at: new Date().toISOString() }, { onConflict: 'user_id,query' });
  }
  async clearSearchHistory() {
    bump('dbWrites');
    await this.sb.from('search_history').delete().eq('user_id', this.uid);
  }

  /* -------------------------- settings & profile ------------------------ */

  async getSettings(): Promise<Settings> {
    bump('dbReads');
    const res = await this.sb.from('user_settings').select('settings').eq('user_id', this.uid).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...((res.data as { settings?: Partial<Settings> } | null)?.settings ?? {}) };
  }
  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.getSettings()), ...patch };
    bump('dbWrites');
    await this.sb.from('user_settings').upsert({ user_id: this.uid, settings: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return next;
  }
  async getProfile(): Promise<Profile | null> {
    bump('dbReads');
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return null;
    const res = await this.sb.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle();
    return {
      id: data.user.id,
      displayName: (res.data as { display_name?: string } | null)?.display_name || data.user.email?.split('@')[0] || 'Listener',
      email: data.user.email ?? null,
      source: 'supabase',
    };
  }
  async saveProfile(profile: Profile) {
    bump('dbWrites');
    await this.sb.from('profiles').upsert({ id: this.uid, display_name: sanitizeText(profile.displayName, 60) }, { onConflict: 'id' });
  }

  /* ---------------------------- data management ------------------------- */

  async exportAll(): Promise<ExportBundle> {
    const playlists = await this.listPlaylists();
    const withTracks = await Promise.all(playlists.map(async (p) => ({ ...p, tracks: (await this.getPlaylist(p.id))?.tracks ?? [] })));
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      playlists: withTracks,
      liked: await this.listLiked(),
      followedArtists: await this.listFollowedArtists(),
      savedAlbums: await this.listSavedAlbums(),
      history: await this.listHistory(2000),
      settings: await this.getSettings(),
    };
  }

  async wipeAll() {
    for (const table of ['playlist_tracks', 'playlists', 'liked_tracks', 'followed_artists', 'saved_albums', 'listening_history', 'search_history', 'tracks'] as const) {
      bump('dbWrites');
      await this.sb.from(table).delete().eq('user_id', this.uid);
    }
  }
}

function mapPlaylist(row: Record<string, unknown>): Playlist {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    cover: (row.cover as string | null) ?? null,
    createdAt: Date.parse(String(row.created_at ?? '')) || Date.now(),
    updatedAt: Date.parse(String(row.updated_at ?? '')) || Date.now(),
  };
}
