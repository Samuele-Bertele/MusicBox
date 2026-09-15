import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Track } from '@/types';
import { useLibrary } from '@/services/LibraryProvider';
import { Modal } from './ui';

export function AddToPlaylistModal({
  tracks,
  open,
  onClose,
}: {
  tracks: Track[];
  open: boolean;
  onClose: () => void;
}) {
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const pl = await createPlaylist(name.trim());
    if (pl) await addToPlaylist(pl.id, tracks);
    setBusy(false);
    setName('');
    onClose();
  };

  return (
    <Modal open={open} title="Aggiungi a playlist" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className="field"
            placeholder="Nuova playlist"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            aria-label="Nome della nuova playlist"
          />
          <button className="btn-primary shrink-0" onClick={handleCreate} disabled={!name.trim() || busy}>
            <Plus className="h-4 w-4" />
            Crea
          </button>
        </div>

        {playlists.length > 0 && (
          <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                className="w-full text-left px-3 h-11 rounded-lg hover:bg-elevated transition-colors flex items-center justify-between"
                onClick={async () => {
                  await addToPlaylist(pl.id, tracks);
                  onClose();
                }}
              >
                <span className="truncate">{pl.name}</span>
                <Plus className="h-4 w-4 text-muted shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
