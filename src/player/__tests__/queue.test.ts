import { describe, expect, it } from 'vitest';
import { currentTrack, initialQueueState, queueReducer, upNext, type QueueState } from '@/player/queue';
import { makeTrack } from '@/test/factories';

const tracks = Array.from({ length: 4 }, (_, i) => makeTrack({ id: `t${i}`, artistId: `a${i}` }));
const seeded = (partial: Partial<QueueState> = {}): QueueState => ({
  ...queueReducer(initialQueueState, { type: 'set', tracks }),
  ...partial,
});

describe('queueReducer', () => {
  it('sets a queue and points at the chosen track', () => {
    const state = queueReducer(initialQueueState, { type: 'set', tracks, startIndex: 2 });
    expect(currentTrack(state)?.id).toBe('t2');
    expect(upNext(state)).toHaveLength(1);
  });

  it('advances and stops at the end when repeat is off', () => {
    const state = queueReducer(seeded({ index: 3 }), { type: 'next' });
    expect(state.ended).toBe(true);
    expect(state.index).toBe(3);
  });

  it('wraps around with repeat all', () => {
    const state = queueReducer(seeded({ index: 3, repeat: 'all' }), { type: 'next' });
    expect(state.index).toBe(0);
    expect(state.ended).toBe(false);
  });

  it('does not advance on auto-next with repeat one', () => {
    const state = queueReducer(seeded({ index: 1, repeat: 'one' }), { type: 'next', auto: true });
    expect(state.index).toBe(1);
  });

  it('inserts play-next right after the current track', () => {
    const extra = makeTrack({ id: 'x' });
    const state = queueReducer(seeded({ index: 1 }), { type: 'playNext', tracks: [extra] });
    expect(state.items[2].id).toBe('x');
  });

  it('keeps the current track when removing an earlier one', () => {
    const state = queueReducer(seeded({ index: 2 }), { type: 'removeAt', index: 0 });
    expect(currentTrack(state)?.id).toBe('t2');
    expect(state.items).toHaveLength(3);
  });

  it('follows the current track when it is moved', () => {
    const state = queueReducer(seeded({ index: 0 }), { type: 'move', from: 0, to: 3 });
    expect(state.index).toBe(3);
    expect(currentTrack(state)?.id).toBe('t0');
  });

  it('restores the original order when shuffle is switched off', () => {
    const shuffled = queueReducer(seeded({ index: 0 }), { type: 'toggleShuffle' });
    expect(shuffled.shuffle).toBe(true);
    expect(currentTrack(shuffled)?.id).toBe('t0');

    const restored = queueReducer(shuffled, { type: 'toggleShuffle' });
    expect(restored.items.map((t) => t.id)).toEqual(['t0', 't1', 't2', 't3']);
  });

  it('clears everything but the playback modes', () => {
    const state = queueReducer(seeded({ repeat: 'all' }), { type: 'clear' });
    expect(state.items).toHaveLength(0);
    expect(state.repeat).toBe('all');
  });
});
