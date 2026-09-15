import { describe, expect, it } from 'vitest';
import { buildTasteProfile, rankTracks, scoreTrack, topGenres } from '@/services/taste';
import { makeHistory, makeLiked, makeTrack } from '@/test/factories';

const now = Date.UTC(2026, 0, 15);

describe('taste profile', () => {
  it('ranks the most completed genre first', () => {
    const jazz = makeTrack({ id: 'j', genres: ['jazz'] });
    const metal = makeTrack({ id: 'm', genres: ['metal'], artistId: 'a2' });
    const history = [
      ...makeHistory(jazz, ['play_started', 'p50', 'completed'], now - 1000),
      ...makeHistory(metal, ['play_started', 'skipped'], now - 2000),
    ];
    const profile = buildTasteProfile(history, [], now);
    expect(topGenres(profile, 1)).toEqual(['jazz']);
  });

  it('penalises skipped tracks and rewards liked ones', () => {
    const liked = makeTrack({ id: 'liked', genres: ['jazz'] });
    const skipped = makeTrack({ id: 'skipped', genres: ['jazz'], artistId: 'a2' });
    const history = [
      ...makeHistory(liked, ['play_started', 'completed'], now - 1000),
      ...makeHistory(skipped, ['play_started', 'skipped'], now - 1000),
      ...makeHistory(skipped, ['play_started', 'skipped'], now - 2000),
    ];
    const profile = buildTasteProfile(history, makeLiked([liked], now), now);
    expect(scoreTrack(liked, profile)).toBeGreaterThan(scoreTrack(skipped, profile));
  });

  it('sorts candidates by score', () => {
    const seed = makeTrack({ id: 'seed', genres: ['ambient'] });
    const profile = buildTasteProfile(makeHistory(seed, ['play_started', 'completed'], now), [], now);
    const candidates = [
      makeTrack({ id: 'c1', genres: ['metal'], artistId: 'zz' }),
      makeTrack({ id: 'c2', genres: ['ambient'], artistId: 'yy' }),
    ];
    expect(rankTracks(candidates, profile)[0].id).toBe('c2');
  });

  it('stays neutral with no history at all', () => {
    const profile = buildTasteProfile([], [], now);
    expect(scoreTrack(makeTrack({ id: 'x' }), profile)).toBe(0);
  });
});
