import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from './PlayerProvider';

export function PlayButton({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const player = usePlayer();
  const busy = player.buffering || player.status === 'loading';
  const isPlaying = player.status === 'playing';
  const dim = size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';

  return (
    <button
      onClick={player.toggle}
      disabled={!player.track}
      aria-label={isPlaying ? 'Metti in pausa' : 'Riproduci'}
      className={`${dim} rounded-full bg-accent text-[rgb(20,24,23)] grid place-items-center
                  hover:brightness-110 active:scale-95 transition disabled:opacity-40`}
    >
      {busy ? (
        <Loader2 className={size === 'lg' ? 'h-7 w-7 animate-spin' : 'h-4 w-4 animate-spin'} />
      ) : isPlaying ? (
        <Pause className={size === 'lg' ? 'h-7 w-7 fill-current' : 'h-4 w-4 fill-current'} />
      ) : (
        <Play className={size === 'lg' ? 'h-7 w-7 fill-current ml-1' : 'h-4 w-4 fill-current ml-0.5'} />
      )}
    </button>
  );
}

export function TransportControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const player = usePlayer();
  const iconSize = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';
  const btnSize = size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';

  const repeatLabel =
    player.queue.repeat === 'off' ? 'Ripetizione disattivata' : player.queue.repeat === 'all' ? 'Ripeti tutti' : 'Ripeti brano';

  return (
    <div className={`flex items-center ${size === 'lg' ? 'gap-4' : 'gap-2'}`}>
      <button
        className={`icon-btn ${btnSize} ${player.queue.shuffle ? 'text-accent' : ''}`}
        onClick={player.toggleShuffle}
        aria-pressed={player.queue.shuffle}
        aria-label="Riproduzione casuale"
      >
        <Shuffle className={iconSize} />
      </button>
      <button className={`icon-btn ${btnSize}`} onClick={player.previous} aria-label="Brano precedente">
        <SkipBack className={`${iconSize} fill-current`} />
      </button>
      <PlayButton size={size} />
      <button className={`icon-btn ${btnSize}`} onClick={player.next} aria-label="Brano successivo">
        <SkipForward className={`${iconSize} fill-current`} />
      </button>
      <button
        className={`icon-btn ${btnSize} ${player.queue.repeat !== 'off' ? 'text-accent' : ''}`}
        onClick={player.cycleRepeat}
        aria-label={repeatLabel}
        title={repeatLabel}
      >
        {player.queue.repeat === 'one' ? <Repeat1 className={iconSize} /> : <Repeat className={iconSize} />}
      </button>
    </div>
  );
}

export function VolumeControl() {
  const player = usePlayer();
  return (
    <div className="hidden lg:flex items-center gap-2 w-32">
      <button className="icon-btn h-8 w-8" onClick={player.toggleMute} aria-label={player.muted ? 'Riattiva audio' : 'Disattiva audio'}>
        <VolumeIcon muted={player.muted} volume={player.volume} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={player.muted ? 0 : player.volume}
        onChange={(e) => player.setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="flex-1 h-1 accent-[rgb(var(--accent))] cursor-pointer"
      />
    </div>
  );
}

function VolumeIcon({ muted, volume }: { muted: boolean; volume: number }) {
  const level = muted || volume === 0 ? 0 : volume < 0.5 ? 1 : 2;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      {level === 0 ? (
        <>
          <path d="m17 9 4 6M21 9l-4 6" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          {level === 2 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
        </>
      )}
    </svg>
  );
}
