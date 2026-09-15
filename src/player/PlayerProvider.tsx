import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { RepeatMode, Track } from '@/types';
import { providerFor } from '@/services/providers';
import { useLibrary } from '@/services/LibraryProvider';
import { useToast } from '@/hooks/useToast';
import { AudioEngine, type EngineStatus } from './AudioEngine';
import { currentTrack, initialQueueState, queueReducer, upNext, type QueueState } from './queue';

export interface PlayerApi {
  queue: QueueState;
  track: Track | null;
  upNext: Track[];
  status: EngineStatus;
  buffering: boolean;
  position: number;
  duration: number;
  error: string | null;
  volume: number;
  muted: boolean;
  playTracks: (tracks: Track[], startIndex?: number, contextLabel?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (tracks: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpTo: (index: number) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);
const engine = new AudioEngine();

const MILESTONES: Array<{ at: number; type: 'p25' | 'p50' | 'p75' }> = [
  { at: 25, type: 'p25' },
  { at: 50, type: 'p50' },
  { at: 75, type: 'p75' },
];

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { store, settings, liked, history, refreshHistory, updateSettings } = useLibrary();
  const { push } = useToast();

  const [queue, dispatch] = useReducer(queueReducer, initialQueueState);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const track = currentTrack(queue);
  const trackRef = useRef<Track | null>(null);
  const reachedRef = useRef<Set<string>>(new Set());
  const wantsPlayRef = useRef(false);
  const historyBufferRef = useRef(0);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [volume, setVolumeState] = useState(settings.volume);
  const [muted, setMutedState] = useState(settings.muted);

  const shuffleCtx = useMemo(
    () => ({
      recentTrackIds: history.slice(0, 40).map((h) => h.trackId),
      likedTrackIds: new Set(liked.map((l) => l.trackId)),
    }),
    [history, liked],
  );

  /* ----------------------------- engine wiring ---------------------------- */

  useEffect(() => {
    const offStatus = engine.on('status', setStatus);
    const offBuffer = engine.on('buffering', setBuffering);
    const offTime = engine.on('time', (p, d) => {
      setPosition(p);
      if (d) setDuration(d);
    });
    const offError = engine.on('error', (kind) => {
      setError(
        kind === 'source'
          ? 'Questo brano non è attualmente disponibile.'
          : kind === 'network'
            ? 'Il servizio musicale non risponde. Riprova tra qualche secondo.'
            : 'Riproduzione non riuscita. Riprova tra qualche secondo.',
      );
    });
    return () => {
      offStatus();
      offBuffer();
      offTime();
      offError();
    };
  }, []);

  useEffect(() => {
    setVolumeState(settings.volume);
    setMutedState(settings.muted);
  }, [settings.volume, settings.muted]);

  useEffect(() => {
    engine.setVolume(volume, muted);
  }, [volume, muted]);

  useEffect(() => {
    engine.setPreload(settings.gapless ? 'auto' : 'metadata');
  }, [settings.gapless]);

  /** Volume moves continuously; persist at most once per 600 ms. */
  const persistVolume = useCallback(
    (v: number, m: boolean) => {
      if (volumeTimer.current) clearTimeout(volumeTimer.current);
      volumeTimer.current = setTimeout(() => void updateSettings({ volume: v, muted: m }), 600);
    },
    [updateSettings],
  );

  /* --------------------------- history milestones ------------------------- */

  const log = useCallback(
    async (t: Track, type: 'play_started' | 'p25' | 'p50' | 'p75' | 'completed' | 'skipped', seconds: number, percent: number) => {
      if (!store || !settings.historyEnabled) return;
      await store.logHistory(t, type, seconds, percent);
      historyBufferRef.current++;
      // Refresh the in-memory history sparingly: recommendations do not need
      // to react to every single milestone.
      if (historyBufferRef.current >= 4 || type === 'completed') {
        historyBufferRef.current = 0;
        await refreshHistory();
      }
    },
    [store, settings.historyEnabled, refreshHistory],
  );

  useEffect(() => {
    if (!track || !duration) return;
    const percent = (position / duration) * 100;
    for (const m of MILESTONES) {
      const key = `${track.id}:${m.type}`;
      if (percent >= m.at && !reachedRef.current.has(key)) {
        reachedRef.current.add(key);
        void log(track, m.type, position, percent);
      }
    }
  }, [position, duration, track, log]);

  /* ------------------------------ track loading --------------------------- */

  useEffect(() => {
    let cancelled = false;
    const previous = trackRef.current;

    if (previous && previous.id !== track?.id && engine.duration > 0) {
      const percent = (engine.position / engine.duration) * 100;
      if (percent < 85) void log(previous, 'skipped', engine.position, percent);
    }

    trackRef.current = track;
    setError(null);
    setPosition(0);
    setDuration(track?.duration ?? 0);

    if (!track) {
      engine.pause();
      setStatus('idle');
      return;
    }

    (async () => {
      const provider = providerFor(track);
      if (!provider.canStream) {
        setError('Questa fonte fornisce solo informazioni sul brano, non la riproduzione.');
        return;
      }
      let url = track.streamUrl;
      if (!url) {
        try {
          url = await provider.getStreamUrl(track);
        } catch {
          url = null;
        }
      }
      if (cancelled) return;
      if (!url) {
        setError('Questo brano non è attualmente disponibile.');
        return;
      }
      reachedRef.current = new Set();
      await engine.load(url, wantsPlayRef.current);
      if (wantsPlayRef.current) void log(track, 'play_started', 0, 0);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  /* -------------------------------- ended --------------------------------- */

  const goNext = useCallback(
    (auto: boolean) => {
      if (auto && queue.repeat === 'one') {
        engine.seek(0);
        void engine.play();
        return;
      }
      // A manual skip mid-track gets a short fade so the cut is not abrupt.
      if (!auto && settings.crossfadeSeconds > 0 && status === 'playing') {
        void engine.fadeOut(Math.min(settings.crossfadeSeconds, 2)).then(() => dispatch({ type: 'next', auto }));
        return;
      }
      dispatch({ type: 'next', auto });
    },
    [queue.repeat, settings.crossfadeSeconds, status],
  );

  useEffect(() => {
    const off = engine.on('ended', () => {
      const t = trackRef.current;
      if (t) void log(t, 'completed', engine.duration, 100);
      if (!settings.autoplay) {
        setStatus('paused');
        return;
      }
      goNext(true);
    });
    return off;
  }, [goNext, log, settings.autoplay]);

  useEffect(() => {
    if (queue.ended && queue.items.length) {
      wantsPlayRef.current = false;
      engine.pause();
    }
  }, [queue.ended, queue.items.length]);

  /* ---------------------------- Media Session ----------------------------- */

  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    const artwork = track.artwork ? [{ src: track.artwork, sizes: '400x400', type: 'image/jpeg' }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist.name,
      album: track.album?.name ?? '',
      artwork,
    });
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void engine.play()],
      ['pause', () => engine.pause()],
      ['previoustrack', () => dispatch({ type: 'previous' })],
      ['nexttrack', () => goNext(false)],
      ['seekbackward', () => engine.seek(engine.position - 10)],
      ['seekforward', () => engine.seek(engine.position + 10)],
      ['seekto', (d) => typeof d.seekTime === 'number' && engine.seek(d.seekTime)],
      ['stop', () => engine.pause()],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* action unsupported by this browser — fallback is the in-app UI */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [track, goNext]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : status === 'paused' ? 'paused' : 'none';
    if (duration > 0 && Number.isFinite(duration) && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({ duration, position: Math.min(position, duration), playbackRate: 1 });
      } catch {
        /* Safari throws on out-of-range values; harmless */
      }
    }
  }, [status, position, duration]);

  /* -------------------------------- actions -------------------------------- */

  const playTracks = useCallback(
    (tracks: Track[], startIndex = 0, contextLabel?: string) => {
      const playable = tracks.filter((t) => t.streamUrl || providerFor(t).canStream);
      if (!playable.length) {
        push('Nessun brano riproducibile in questa selezione.', 'error');
        return;
      }
      wantsPlayRef.current = true;
      const index = Math.max(0, Math.min(startIndex, playable.length - 1));
      dispatch({ type: 'set', tracks: playable, startIndex: index, contextLabel: contextLabel ?? null, shuffleCtx, smart: settings.smartShuffle });
      // Same track re-selected: the load effect will not re-run, so start here.
      if (trackRef.current?.id === playable[index]?.id) void engine.play();
    },
    [push, shuffleCtx, settings.smartShuffle],
  );

  const toggle = useCallback(() => {
    if (!track) return;
    if (status === 'playing') {
      wantsPlayRef.current = false;
      engine.pause();
    } else {
      wantsPlayRef.current = true;
      void engine.play();
      if (position === 0) void log(track, 'play_started', 0, 0);
    }
  }, [status, track, position, log]);

  const value = useMemo<PlayerApi>(
    () => ({
      queue,
      track,
      upNext: upNext(queue),
      status,
      buffering,
      position,
      duration: duration || track?.duration || 0,
      error,
      volume,
      muted,
      playTracks,
      toggle,
      next: () => {
        wantsPlayRef.current = true;
        goNext(false);
      },
      previous: () => {
        wantsPlayRef.current = true;
        if (engine.position > 4) engine.seek(0);
        else dispatch({ type: 'previous' });
      },
      seek: (s) => engine.seek(s),
      setVolume: (v) => {
        setVolumeState(v);
        persistVolume(v, muted);
      },
      toggleMute: () => {
        setMutedState((m) => {
          persistVolume(volume, !m);
          return !m;
        });
      },
      toggleShuffle: () => dispatch({ type: 'toggleShuffle', smart: settings.smartShuffle, ctx: shuffleCtx }),
      cycleRepeat: () => {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        dispatch({ type: 'setRepeat', mode: order[(order.indexOf(queue.repeat) + 1) % order.length] });
      },
      playNext: (tracks) => dispatch({ type: 'playNext', tracks }),
      addToQueue: (tracks) => dispatch({ type: 'append', tracks }),
      removeFromQueue: (index) => dispatch({ type: 'removeAt', index }),
      moveInQueue: (from, to) => dispatch({ type: 'move', from, to }),
      jumpTo: (index) => {
        wantsPlayRef.current = true;
        dispatch({ type: 'jumpTo', index });
      },
      clearQueue: () => {
        wantsPlayRef.current = false;
        dispatch({ type: 'clear' });
      },
    }),
    [queue, track, status, buffering, position, duration, error, volume, muted, settings.smartShuffle, shuffleCtx, playTracks, toggle, goNext, persistVolume],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
