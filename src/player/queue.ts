import type { RepeatMode, Track } from '@/types';
import { smartShuffle, basicShuffle, type SmartShuffleContext } from '@/services/shuffle';

export interface QueueState {
  /** Current play order. */
  items: Track[];
  /** Order before shuffling, restored when shuffle is turned off. */
  original: Track[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Source label shown in the queue panel ("Album · Nome"). */
  contextLabel: string | null;
  /** True when the queue reached its end with repeat off. */
  ended: boolean;
}

export const initialQueueState: QueueState = {
  items: [],
  original: [],
  index: -1,
  shuffle: false,
  repeat: 'off',
  contextLabel: null,
  ended: false,
};

export type QueueAction =
  | { type: 'set'; tracks: Track[]; startIndex?: number; contextLabel?: string | null; shuffleCtx?: SmartShuffleContext; smart?: boolean }
  | { type: 'playNext'; tracks: Track[] }
  | { type: 'append'; tracks: Track[] }
  | { type: 'removeAt'; index: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'jumpTo'; index: number }
  | { type: 'next'; auto?: boolean }
  | { type: 'previous' }
  | { type: 'clear' }
  | { type: 'setRepeat'; mode: RepeatMode }
  | { type: 'toggleShuffle'; smart?: boolean; ctx?: SmartShuffleContext };

const clampIndex = (i: number, len: number) => (len === 0 ? -1 : Math.max(0, Math.min(i, len - 1)));

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'set': {
      const original = [...action.tracks];
      const start = clampIndex(action.startIndex ?? 0, original.length);
      if (!state.shuffle || original.length < 2) {
        return { ...state, items: original, original, index: start, contextLabel: action.contextLabel ?? null, ended: false };
      }
      const head = original[start];
      const rest = original.filter((_, i) => i !== start);
      const shuffled = action.smart === false ? basicShuffle(rest) : smartShuffle(rest, action.shuffleCtx ?? {});
      return { ...state, items: head ? [head, ...shuffled] : shuffled, original, index: head ? 0 : -1, contextLabel: action.contextLabel ?? null, ended: false };
    }

    case 'playNext': {
      if (!action.tracks.length) return state;
      const items = [...state.items];
      const at = state.index < 0 ? 0 : state.index + 1;
      items.splice(at, 0, ...action.tracks);
      return { ...state, items, original: state.shuffle ? state.original : items, index: state.index < 0 ? 0 : state.index, ended: false };
    }

    case 'append': {
      if (!action.tracks.length) return state;
      const items = [...state.items, ...action.tracks];
      return {
        ...state,
        items,
        original: state.shuffle ? [...state.original, ...action.tracks] : items,
        index: state.index < 0 ? 0 : state.index,
        ended: false,
      };
    }

    case 'removeAt': {
      if (action.index < 0 || action.index >= state.items.length) return state;
      const removed = state.items[action.index];
      const items = state.items.filter((_, i) => i !== action.index);
      let index = state.index;
      if (action.index < state.index) index -= 1;
      else if (action.index === state.index) index = clampIndex(state.index, items.length);
      const original = state.original.filter((t) => t.id !== removed.id);
      return { ...state, items, original, index, ended: false };
    }

    case 'move': {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.items.length || to >= state.items.length) return state;
      const items = [...state.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      let index = state.index;
      if (from === state.index) index = to;
      else if (from < state.index && to >= state.index) index -= 1;
      else if (from > state.index && to <= state.index) index += 1;
      return { ...state, items, index, ended: false };
    }

    case 'jumpTo':
      return { ...state, index: clampIndex(action.index, state.items.length), ended: false };

    case 'next': {
      if (!state.items.length) return { ...state, index: -1, ended: true };
      if (action.auto && state.repeat === 'one') return { ...state, ended: false };
      const next = state.index + 1;
      if (next >= state.items.length) {
        if (state.repeat === 'all') return { ...state, index: 0, ended: false };
        return { ...state, ended: true };
      }
      return { ...state, index: next, ended: false };
    }

    case 'previous': {
      if (!state.items.length) return state;
      if (state.index <= 0) return { ...state, index: state.repeat === 'all' ? state.items.length - 1 : 0, ended: false };
      return { ...state, index: state.index - 1, ended: false };
    }

    case 'clear':
      return { ...initialQueueState, shuffle: state.shuffle, repeat: state.repeat };

    case 'setRepeat':
      return { ...state, repeat: action.mode, ended: false };

    case 'toggleShuffle': {
      const shuffle = !state.shuffle;
      if (!state.items.length) return { ...state, shuffle };
      const current = state.items[state.index];

      if (shuffle) {
        const rest = state.items.filter((_, i) => i !== state.index);
        const shuffled = action.smart === false ? basicShuffle(rest) : smartShuffle(rest, action.ctx ?? {});
        return { ...state, shuffle, original: [...state.items], items: current ? [current, ...shuffled] : shuffled, index: current ? 0 : -1 };
      }

      const restored = state.original.length ? state.original : state.items;
      const index = current ? restored.findIndex((t) => t.id === current.id) : -1;
      return { ...state, shuffle, items: [...restored], index: index >= 0 ? index : clampIndex(state.index, restored.length) };
    }

    default:
      return state;
  }
}

export const currentTrack = (state: QueueState): Track | null => state.items[state.index] ?? null;
export const upNext = (state: QueueState): Track[] => state.items.slice(state.index + 1);
