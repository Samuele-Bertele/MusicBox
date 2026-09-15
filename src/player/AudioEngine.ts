export type EngineStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface EngineEvents {
  status: (status: EngineStatus) => void;
  time: (position: number, duration: number) => void;
  ended: () => void;
  error: (kind: 'source' | 'network' | 'decode' | 'unknown') => void;
  buffering: (isBuffering: boolean) => void;
}

/**
 * Thin wrapper around a single HTMLAudioElement.
 *
 * One element for the whole app life: browsers only grant background /
 * lock-screen playback to an element that keeps its user-gesture blessing,
 * and recreating it on every track would lose that on Android.
 */
export class AudioEngine {
  private el: HTMLAudioElement | null = null;
  private listeners = new Map<keyof EngineEvents, Set<(...args: never[]) => void>>();
  private lastTick = 0;

  private ensure(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = 'metadata';
    el.crossOrigin = 'anonymous';

    el.addEventListener('playing', () => {
      this.emit('buffering', false);
      this.emit('status', 'playing');
    });
    el.addEventListener('pause', () => this.emit('status', el.ended ? 'idle' : 'paused'));
    el.addEventListener('waiting', () => this.emit('buffering', true));
    el.addEventListener('canplay', () => this.emit('buffering', false));
    el.addEventListener('loadstart', () => this.emit('status', 'loading'));
    el.addEventListener('ended', () => this.emit('ended'));
    el.addEventListener('error', () => {
      const code = el.error?.code;
      this.emit('status', 'error');
      this.emit(
        'error',
        code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? 'source'
          : code === MediaError.MEDIA_ERR_NETWORK ? 'network'
          : code === MediaError.MEDIA_ERR_DECODE ? 'decode'
          : 'unknown',
      );
    });
    el.addEventListener('timeupdate', () => {
      // Throttle to ~4 Hz: enough for a smooth bar, cheap on battery.
      const now = performance.now();
      if (now - this.lastTick < 240) return;
      this.lastTick = now;
      this.emit('time', el.currentTime, Number.isFinite(el.duration) ? el.duration : 0);
    });
    el.addEventListener('durationchange', () => this.emit('time', el.currentTime, Number.isFinite(el.duration) ? el.duration : 0));

    this.el = el;
    return el;
  }

  on<K extends keyof EngineEvents>(event: K, cb: EngineEvents[K]): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const handler = cb as (...args: never[]) => void;
    set.add(handler);
    return () => set!.delete(handler);
  }

  private emit<K extends keyof EngineEvents>(event: K, ...args: Parameters<EngineEvents[K]>) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of [...set]) (cb as (...a: Parameters<EngineEvents[K]>) => void)(...args);
  }

  async load(url: string, autoplay: boolean): Promise<void> {
    const el = this.ensure();
    if (el.src !== url) {
      el.src = url;
      el.load();
    }
    if (autoplay) await this.play();
  }

  async play(): Promise<void> {
    const el = this.ensure();
    try {
      await el.play();
    } catch (err) {
      // Autoplay policy rejection is not an error worth surfacing.
      if ((err as DOMException)?.name !== 'NotAllowedError') this.emit('error', 'unknown');
      this.emit('status', 'paused');
    }
  }

  pause() {
    this.el?.pause();
  }

  seek(seconds: number) {
    const el = this.ensure();
    if (Number.isFinite(el.duration)) el.currentTime = Math.max(0, Math.min(seconds, el.duration));
    else el.currentTime = Math.max(0, seconds);
    this.emit('time', el.currentTime, Number.isFinite(el.duration) ? el.duration : 0);
  }

  /**
   * `auto` asks the browser to buffer the whole file, which removes most of
   * the gap between tracks. A single <audio> element cannot do true gapless
   * or overlapping playback — that would need two elements, and the second
   * one loses the user-gesture blessing Android needs for background audio.
   */
  setPreload(mode: 'metadata' | 'auto') {
    this.ensure().preload = mode;
  }

  setVolume(volume: number, muted: boolean) {
    const el = this.ensure();
    el.volume = Math.max(0, Math.min(1, volume));
    el.muted = muted;
  }

  /** Linear fade used for crossfade-on-track-change; no Web Audio graph needed. */
  async fadeOut(seconds: number): Promise<void> {
    const el = this.el;
    if (!el || seconds <= 0) return;
    const start = el.volume;
    const steps = Math.max(1, Math.round(seconds * 20));
    for (let i = 1; i <= steps; i++) {
      el.volume = Math.max(0, start * (1 - i / steps));
      await new Promise((r) => setTimeout(r, (seconds * 1000) / steps));
    }
    el.volume = start;
  }

  get position(): number {
    return this.el?.currentTime ?? 0;
  }

  get duration(): number {
    const d = this.el?.duration ?? 0;
    return Number.isFinite(d) ? d : 0;
  }

  get element(): HTMLAudioElement | null {
    return this.el;
  }

  destroy() {
    this.el?.pause();
    this.el?.removeAttribute('src');
    this.el = null;
  }
}
