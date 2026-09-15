import { useMemo } from 'react';
import { Clock, Play } from 'lucide-react';
import type { Track } from '@/types';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { TrackRow } from '@/components/TrackRow';
import { EmptyState } from '@/components/ui';
import { relativeTime } from '@/utils/format';

export function RecentPage() {
  const { history } = useLibrary();
  const player = usePlayer();

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ track: Track; at: number }> = [];
    for (const e of history) {
      if (seen.has(e.trackId)) continue;
      seen.add(e.trackId);
      out.push({ track: e.track, at: e.at });
      if (out.length >= 100) break;
    }
    return out;
  }, [history]);

  if (!rows.length) {
    return (
      <EmptyState
        icon={<Clock className="h-6 w-6" />}
        title="Nessun ascolto registrato"
        description="Appena riproduci qualcosa lo trovi qui. Puoi disattivare la cronologia dalle impostazioni."
      />
    );
  }

  const tracks = rows.map((r) => r.track);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl">Ascoltati di recente</h1>
        <button className="btn-primary ml-auto" onClick={() => player.playTracks(tracks, 0, 'Ascoltati di recente')}>
          <Play className="h-4 w-4 fill-current" /> Riproduci
        </button>
      </div>

      <div>
        {rows.map((row, i) => (
          <div key={row.track.id} className="relative">
            <TrackRow track={row.track} index={i} tracks={tracks} contextLabel="Ascoltati di recente" />
            <span className="hidden lg:block absolute right-28 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">
              {relativeTime(row.at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
