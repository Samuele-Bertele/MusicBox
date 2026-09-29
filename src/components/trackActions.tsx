import { Disc3, ExternalLink, Heart, ListPlus, Play, Plus, Trash2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Track } from '@/types';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { sourceUrlFor } from '@/utils/entity';
import type { MenuItem } from './ContextMenu';

interface Options {
  track: Track | null;
  /** Queue context when the track belongs to a list. */
  tracks?: Track[];
  contextLabel?: string;
  onAddToPlaylist: () => void;
  onRemove?: () => void;
  includePlay?: boolean;
}

/**
 * Single source of truth for the actions available on a track, so the row
 * menu and the full-screen player never drift apart.
 */
export function useTrackActions({ track, tracks, contextLabel, onAddToPlaylist, onRemove, includePlay = true }: Options): MenuItem[] {
  const navigate = useNavigate();
  const player = usePlayer();
  const { likedIds, toggleLike } = useLibrary();

  if (!track) return [];

  const isLiked = likedIds.has(track.id);
  const unavailable = !track.streamUrl;

  const play = () => {
    const list = tracks ?? [track];
    const at = Math.max(0, list.findIndex((t) => t.id === track.id));
    player.playTracks(list, at, contextLabel);
  };

  const items: MenuItem[] = [];
  if (includePlay) items.push({ label: 'Riproduci', icon: <Play />, onSelect: play, disabled: unavailable });

  items.push(
    { label: 'Riproduci dopo', icon: <ListPlus />, onSelect: () => player.playNext([track]), disabled: unavailable },
    { label: 'Aggiungi alla coda', icon: <Plus />, onSelect: () => player.addToQueue([track]), disabled: unavailable },
    { label: 'Aggiungi a playlist', icon: <ListPlus />, onSelect: onAddToPlaylist },
    { label: isLiked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti', icon: <Heart />, onSelect: () => void toggleLike(track) },
    { label: "Vai all'artista", icon: <User />, onSelect: () => navigate(`/artist/${encodeURIComponent(track.artist.id)}`) },
  );

  if (track.album) {
    items.push({ label: "Vai all'album", icon: <Disc3 />, onSelect: () => navigate(`/album/${encodeURIComponent(track.album!.id)}`) });
  }

  const original = sourceUrlFor(track);
  if (original) {
    items.push({
      label: 'Apri pagina originale',
      icon: <ExternalLink />,
      onSelect: () => window.open(original, '_blank', 'noopener,noreferrer'),
    });
  }

  if (onRemove) items.push({ label: 'Rimuovi', icon: <Trash2 />, onSelect: onRemove, danger: true });

  return items;
}
