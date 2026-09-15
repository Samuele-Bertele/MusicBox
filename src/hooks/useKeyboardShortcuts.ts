import { useEffect } from 'react';
import { usePlayer } from '@/player/PlayerProvider';

const isTypingTarget = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
};

/** Desktop shortcuts. Never fire while the user is typing. */
export function useKeyboardShortcuts() {
  const player = usePlayer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          player.toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          player.seek(Math.min(player.position + 5, player.duration || player.position + 5));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.seek(Math.max(player.position - 5, 0));
          break;
        case 'n':
        case 'N':
          player.next();
          break;
        case 'p':
        case 'P':
          player.previous();
          break;
        case 'm':
        case 'M':
          player.toggleMute();
          break;
        case 's':
        case 'S':
          player.toggleShuffle();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);
}
