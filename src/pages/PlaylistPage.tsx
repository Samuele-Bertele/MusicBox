import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDownAZ, Copy, ListMusic, Pencil, Play, Search, Shuffle, Trash2 } from 'lucide-react';
import type { Track } from '@/types';
import type { PlaylistWithTracks } from '@/services/db';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { useToast } from '@/hooks/useToast';
import { smartShuffle } from '@/services/shuffle';
import { TrackRow } from '@/components/TrackRow';
import { ConfirmDialog, EmptyState, LoadingState, Modal, Artwork } from '@/components/ui';
import { formatMinutes, pluralize } from '@/utils/format';

export function PlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { store, refreshPlaylists } = useLibrary();
  const player = usePlayer();
  const { push } = useToast();

  const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const pl = await store.getPlaylist(id);
    setPlaylist(pl);
    if (pl) setDraft({ name: pl.name, description: pl.description });
    setLoading(false);
  }, [store, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tracks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return playlist?.tracks ?? [];
    return (playlist?.tracks ?? []).filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.name.toLowerCase().includes(q),
    );
  }, [playlist, filter]);

  if (loading) return <LoadingState />;
  if (!playlist) {
    return (
      <EmptyState
        title="Playlist non trovata"
        description="Potrebbe essere stata eliminata."
        action={
          <button className="btn-outline" onClick={() => navigate('/library')}>
            Vai alla libreria
          </button>
        }
      />
    );
  }

  const totalSeconds = playlist.tracks.reduce((acc, t) => acc + t.duration, 0);
  const cover = playlist.cover ?? playlist.tracks[0]?.artwork ?? null;

  const sortAlphabetically = async () => {
    if (!store) return;
    const sorted = [...playlist.tracks].sort((a, b) => a.title.localeCompare(b.title));
    await store.reorderPlaylist(playlist.id, sorted.map((t) => t.id));
    await load();
    push('Playlist ordinata per titolo');
  };

  const move = async (track: Track, delta: number) => {
    if (!store) return;
    const ids = playlist.tracks.map((t) => t.id);
    const from = ids.indexOf(track.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await store.reorderPlaylist(playlist.id, ids);
    await load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-end gap-5">
        {cover ? (
          <Artwork src={cover} alt="" className="h-40 w-40 shrink-0 shadow-xl" rounded="rounded-xl" />
        ) : (
          <div className="h-40 w-40 rounded-xl bg-elevated grid place-items-center shrink-0">
            <ListMusic className="h-12 w-12 text-muted" />
          </div>
        )}
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-muted">Playlist</p>
          <h1 className="break-words">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-muted">{playlist.description}</p>}
          <p className="text-sm text-muted">
            {pluralize(playlist.tracks.length, 'brano', 'brani')} · {formatMinutes(totalSeconds)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => player.playTracks(playlist.tracks, 0, playlist.name)} disabled={!playlist.tracks.length}>
          <Play className="h-4 w-4 fill-current" /> Riproduci
        </button>
        <button
          className="btn-outline"
          onClick={() => player.playTracks(smartShuffle(playlist.tracks), 0, playlist.name)}
          disabled={!playlist.tracks.length}
        >
          <Shuffle className="h-4 w-4" /> Casuale
        </button>
        <button className="btn-ghost" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Modifica
        </button>
        <button className="btn-ghost" onClick={sortAlphabetically} disabled={!playlist.tracks.length}>
          <ArrowDownAZ className="h-4 w-4" /> Ordina
        </button>
        <button
          className="btn-ghost"
          onClick={async () => {
            const copy = await store?.duplicatePlaylist(playlist.id);
            await refreshPlaylists();
            if (copy) navigate(`/playlist/${copy.id}`);
          }}
        >
          <Copy className="h-4 w-4" /> Duplica
        </button>
        <button className="btn-ghost text-red-400 hover:text-red-300" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" /> Elimina
        </button>

        {playlist.tracks.length > 4 && (
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              className="field pl-9 h-10 w-48"
              placeholder="Cerca nella playlist"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Cerca nella playlist"
            />
          </div>
        )}
      </div>

      {playlist.tracks.length === 0 ? (
        <EmptyState
          icon={<ListMusic className="h-6 w-6" />}
          title="Playlist vuota"
          description="Cerca un brano e aggiungilo da qui con il menu delle tre puntine."
          action={
            <button className="btn-primary" onClick={() => navigate('/search')}>
              Cerca musica
            </button>
          }
        />
      ) : (
        <div>
          {tracks.map((t, i) => (
            <div key={t.id} className="group/row relative">
              <TrackRow
                track={t}
                index={i}
                tracks={tracks}
                contextLabel={playlist.name}
                onRemove={async () => {
                  await store?.removeTrackFromPlaylist(playlist.id, t.id);
                  await load();
                  push('Brano rimosso dalla playlist');
                }}
              />
              {!filter && (
                <div className="absolute right-2 -top-1 hidden group-hover/row:flex gap-0.5">
                  <button className="icon-btn h-6 w-6 bg-surface" onClick={() => move(t, -1)} aria-label="Sposta su">
                    ↑
                  </button>
                  <button className="icon-btn h-6 w-6 bg-surface" onClick={() => move(t, 1)} aria-label="Sposta giù">
                    ↓
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editOpen}
        title="Modifica playlist"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditOpen(false)}>
              Annulla
            </button>
            <button
              className="btn-primary"
              onClick={async () => {
                await store?.updatePlaylist(playlist.id, draft);
                await refreshPlaylists();
                await load();
                setEditOpen(false);
                push('Playlist aggiornata', 'success');
              }}
            >
              Salva
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Nome</span>
            <input className="field" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">Descrizione</span>
            <textarea
              className="field h-24 py-2 resize-none"
              value={draft.description}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminare la playlist?"
        message={`"${playlist.name}" verrà eliminata definitivamente. I brani restano disponibili nel catalogo.`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await store?.deletePlaylist(playlist.id);
          await refreshPlaylists();
          setConfirmOpen(false);
          push('Playlist eliminata');
          navigate('/library');
        }}
      />
    </div>
  );
}
