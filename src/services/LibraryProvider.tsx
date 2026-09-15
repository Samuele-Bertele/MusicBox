import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Album, Artist, HistoryEvent, LikedTrack, Playlist, Profile, Settings, Track } from '@/types';
import { DEFAULT_SETTINGS, getStore, type DataStore } from '@/services/db';
import { getCurrentProfile, onAuthChange } from '@/services/auth';
import { setPrimaryProvider } from '@/services/providers';
import { useToast } from '@/hooks/useToast';

interface LibraryApi {
  ready: boolean;
  store: DataStore | null;
  profile: Profile | null;
  settings: Settings;
  playlists: Playlist[];
  liked: LikedTrack[];
  likedIds: Set<string>;
  followedIds: Set<string>;
  savedAlbumIds: Set<string>;
  history: HistoryEvent[];
  refreshProfile: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  refreshLiked: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  toggleLike: (track: Track) => Promise<void>;
  toggleFollow: (artist: Artist) => Promise<void>;
  toggleSaveAlbum: (album: Album) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  addToPlaylist: (playlistId: string, tracks: Track[]) => Promise<void>;
}

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const [store, setStore] = useState<DataStore | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [liked, setLiked] = useState<LikedTrack[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [savedAlbumIds, setSavedAlbumIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const mounted = useRef(true);

  const bootstrap = useCallback(async () => {
    const s = await getStore();
    const [nextSettings, nextPlaylists, nextLiked, follows, albums, hist, prof] = await Promise.all([
      s.getSettings(),
      s.listPlaylists(),
      s.listLiked(),
      s.listFollowedArtists(),
      s.listSavedAlbums(),
      s.listHistory(1000),
      getCurrentProfile(),
    ]);
    if (!mounted.current) return;
    setStore(s);
    setSettings(nextSettings);
    setPlaylists(nextPlaylists);
    setLiked(nextLiked);
    setFollowedIds(new Set(follows.map((f) => f.artistId)));
    setSavedAlbumIds(new Set(albums.map((a) => a.albumId)));
    setHistory(hist);
    setProfile(prof);
    setPrimaryProvider(nextSettings.defaultProvider);
    setReady(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void bootstrap();
    const off = onAuthChange(() => void bootstrap());
    return () => {
      mounted.current = false;
      off();
    };
  }, [bootstrap]);

  const refreshProfile = useCallback(async () => setProfile(await getCurrentProfile()), []);
  const refreshPlaylists = useCallback(async () => {
    if (store) setPlaylists(await store.listPlaylists());
  }, [store]);
  const refreshLiked = useCallback(async () => {
    if (store) setLiked(await store.listLiked());
  }, [store]);
  const refreshHistory = useCallback(async () => {
    if (store) setHistory(await store.listHistory(1000));
  }, [store]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!store) return;
      const next = await store.saveSettings(patch);
      setSettings(next);
      if (patch.defaultProvider) setPrimaryProvider(patch.defaultProvider);
    },
    [store],
  );

  const toggleLike = useCallback(
    async (track: Track) => {
      if (!store) return;
      const isLiked = liked.some((l) => l.trackId === track.id);
      if (isLiked) {
        await store.unlike(track.id);
        setLiked((prev) => prev.filter((l) => l.trackId !== track.id));
        push('Rimosso dai preferiti');
      } else {
        await store.like(track);
        setLiked((prev) => [{ trackId: track.id, likedAt: Date.now(), track }, ...prev]);
        push('Aggiunto ai preferiti', 'success');
      }
    },
    [store, liked, push],
  );

  const toggleFollow = useCallback(
    async (artist: Artist) => {
      if (!store) return;
      if (followedIds.has(artist.id)) {
        await store.unfollowArtist(artist.id);
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(artist.id);
          return next;
        });
        push(`Non segui più ${artist.name}`);
      } else {
        await store.followArtist(artist);
        setFollowedIds((prev) => new Set(prev).add(artist.id));
        push(`Segui ${artist.name}`, 'success');
      }
    },
    [store, followedIds, push],
  );

  const toggleSaveAlbum = useCallback(
    async (album: Album) => {
      if (!store) return;
      if (savedAlbumIds.has(album.id)) {
        await store.unsaveAlbum(album.id);
        setSavedAlbumIds((prev) => {
          const next = new Set(prev);
          next.delete(album.id);
          return next;
        });
        push('Album rimosso dalla libreria');
      } else {
        await store.saveAlbum(album);
        setSavedAlbumIds((prev) => new Set(prev).add(album.id));
        push('Album salvato', 'success');
      }
    },
    [store, savedAlbumIds, push],
  );

  const createPlaylist = useCallback(
    async (name: string, description?: string) => {
      if (!store) return null;
      const pl = await store.createPlaylist({ name, description });
      setPlaylists((prev) => [pl, ...prev]);
      push('Playlist creata', 'success');
      return pl;
    },
    [store, push],
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, tracks: Track[]) => {
      if (!store) return;
      await store.addTracksToPlaylist(playlistId, tracks);
      await refreshPlaylists();
      push(tracks.length > 1 ? `${tracks.length} brani aggiunti` : 'Brano aggiunto alla playlist', 'success');
    },
    [store, refreshPlaylists, push],
  );

  const value = useMemo<LibraryApi>(
    () => ({
      ready,
      store,
      profile,
      settings,
      playlists,
      liked,
      likedIds: new Set(liked.map((l) => l.trackId)),
      followedIds,
      savedAlbumIds,
      history,
      refreshProfile,
      refreshPlaylists,
      refreshLiked,
      refreshHistory,
      updateSettings,
      toggleLike,
      toggleFollow,
      toggleSaveAlbum,
      createPlaylist,
      addToPlaylist,
    }),
    [ready, store, profile, settings, playlists, liked, followedIds, savedAlbumIds, history, refreshProfile, refreshPlaylists, refreshLiked, refreshHistory, updateSettings, toggleLike, toggleFollow, toggleSaveAlbum, createPlaylist, addToPlaylist],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
