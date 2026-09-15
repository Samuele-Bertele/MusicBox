import { ArrowDown, ArrowUp, ListPlus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { usePlayer } from './PlayerProvider';
import { useLibrary } from '@/services/LibraryProvider';
import { Artwork, EmptyState } from '@/components/ui';
import { formatDuration } from '@/utils/format';

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const { createPlaylist, addToPlaylist } = useLibrary();
  const [saving, setSaving] = useState(false);

  const saveAsPlaylist = async () => {
    if (!player.queue.items.length || saving) return;
    setSaving(true);
    const pl = await createPlaylist(player.queue.contextLabel ?? 'Coda salvata');
    if (pl) await addToPlaylist(pl.id, player.queue.items);
    setSaving(false);
  };

  return (
    <aside
      className="fixed md:absolute inset-0 md:inset-auto md:right-4 md:bottom-24 z-50 md:w-96 md:max-h-[70vh] md:rounded-xl
                 bg-surface md:border md:border-line flex flex-col animate-slide-up md:animate-fade-up"
      aria-label="Coda di riproduzione"
    >
      <header className="flex items-center justify-between px-4 h-14 border-b border-line/60 shrink-0">
        <h2 className="text-base">In coda</h2>
        <div className="flex items-center gap-1">
          <button className="icon-btn h-9 w-9" onClick={saveAsPlaylist} aria-label="Salva la coda come playlist" disabled={saving}>
            <Save className="h-4 w-4" />
          </button>
          <button className="icon-btn h-9 w-9" onClick={player.clearQueue} aria-label="Svuota la coda">
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="icon-btn h-9 w-9" onClick={onClose} aria-label="Chiudi la coda">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {player.queue.items.length === 0 ? (
          <EmptyState
            icon={<ListPlus className="h-6 w-6" />}
            title="La coda è vuota"
            description="Scegli un brano o un album: quello che riprodurrai comparirà qui."
          />
        ) : (
          <>
            {player.track && (
              <>
                <p className="px-2 py-2 text-xs text-muted">Ora in riproduzione</p>
                <QueueRow index={player.queue.index} current />
              </>
            )}
            {player.upNext.length > 0 && <p className="px-2 pt-4 pb-2 text-xs text-muted">A seguire</p>}
            {player.upNext.map((_, i) => (
              <QueueRow key={`${player.queue.items[player.queue.index + 1 + i].id}-${i}`} index={player.queue.index + 1 + i} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

function QueueRow({ index, current = false }: { index: number; current?: boolean }) {
  const player = usePlayer();
  const track = player.queue.items[index];
  if (!track) return null;

  return (
    <div className={`group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-elevated/70 ${current ? 'bg-elevated/50' : ''}`}>
      <button className="flex items-center gap-3 min-w-0 flex-1 text-left" onClick={() => player.jumpTo(index)}>
        <Artwork src={track.artwork} alt="" className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <div className={`truncate text-sm ${current ? 'text-accent' : ''}`}>{track.title}</div>
          <div className="truncate text-xs text-muted">{track.artist.name}</div>
        </div>
      </button>
      <span className="text-xs text-muted tabular-nums">{formatDuration(track.duration)}</span>
      <div className="flex md:opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="icon-btn h-8 w-8" onClick={() => player.moveInQueue(index, index - 1)} disabled={index <= 0} aria-label="Sposta su">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          className="icon-btn h-8 w-8"
          onClick={() => player.moveInQueue(index, index + 1)}
          disabled={index >= player.queue.items.length - 1}
          aria-label="Sposta giù"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button className="icon-btn h-8 w-8" onClick={() => player.removeFromQueue(index)} aria-label="Rimuovi dalla coda">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
