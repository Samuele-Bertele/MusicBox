import { describe, expect, it } from 'vitest';
import { basicShuffle, smartShuffle } from '@/services/shuffle';
import { makeTrack } from '@/test/factories';

describe('smartShuffle', () => {
  it('keeps every track exactly once', () => {
    const tracks = Array.from({ length: 30 }, (_, i) => makeTrack({ id: `t${i}`, artistId: `a${i % 5}` }));
    const out = smartShuffle(tracks, { seed: 7 });
    expect(out).toHaveLength(tracks.length);
    expect(new Set(out.map((t) => t.id)).size).toBe(tracks.length);
  });

  it('spreads artists better than a plain shuffle', () => {
    const tracks = Array.from({ length: 40 }, (_, i) => makeTrack({ id: `t${i}`, artistId: `a${i % 4}` }));
    const adjacency = (list: ReturnType<typeof makeTrack>[]) =>
      list.reduce((acc, t, i) => acc + (i > 0 && list[i - 1].artist.id === t.artist.id ? 1 : 0), 0);

    expect(adjacency(smartShuffle(tracks, { seed: 1 }))).toBeLessThan(adjacency(basicShuffle(tracks, 1)));
  });

  it('demotes recently played tracks', () => {
    const tracks = Array.from({ length: 10 }, (_, i) => makeTrack({ id: `t${i}`, artistId: `a${i}` }));
    const out = smartShuffle(tracks, { seed: 3, recentTrackIds: ['t0', 't1'] });
    const positions = ['t0', 't1'].map((id) => out.findIndex((t) => t.id === id));
    expect(Math.min(...positions)).toBeGreaterThan(0);
  });

  it('returns short lists untouched', () => {
    const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    expect(smartShuffle(tracks).map((t) => t.id)).toEqual(['a', 'b']);
  });
});
