import { describe, expect, it } from 'vitest';
import { computeStats, periodStart } from '@/services/stats';
import { makeHistory, makeTrack } from '@/test/factories';

const now = Date.UTC(2026, 0, 15, 12);

describe('computeStats', () => {
  it('counts one play per listening session, not per milestone', () => {
    const track = makeTrack({ id: 't1', duration: 200 });
    const history = makeHistory(track, ['play_started', 'p25', 'p50', 'completed'], now - 60_000);
    const stats = computeStats(history, 'all', now);
    expect(stats.tracksPlayed).toBe(1);
    expect(stats.uniqueTracks).toBe(1);
  });

  it('uses the highest milestone as listened time', () => {
    const track = makeTrack({ id: 't1', duration: 200 });
    const history = makeHistory(track, ['play_started', 'p50'], now - 60_000);
    expect(computeStats(history, 'all', now).listenedSeconds).toBe(100);
  });

  it('excludes events outside the requested period', () => {
    const track = makeTrack({ id: 't1', duration: 200 });
    const old = makeHistory(track, ['play_started', 'completed'], now - 40 * 86_400_000);
    expect(computeStats(old, '7d', now).tracksPlayed).toBe(0);
    expect(computeStats(old, 'all', now).tracksPlayed).toBe(1);
  });

  it('derives completion and skip rates', () => {
    const a = makeTrack({ id: 'a', duration: 100 });
    const b = makeTrack({ id: 'b', duration: 100, artistId: 'a2' });
    const history = [
      ...makeHistory(a, ['play_started', 'completed'], now - 1000),
      ...makeHistory(b, ['play_started', 'skipped'], now - 2000),
    ];
    const stats = computeStats(history, 'all', now);
    expect(stats.completionRate).toBeCloseTo(0.5);
    expect(stats.skipRate).toBeCloseTo(0.5);
  });

  it('bounds periods correctly', () => {
    expect(periodStart('all', now)).toBe(0);
    expect(periodStart('7d', now)).toBe(now - 7 * 86_400_000);
  });
});
