import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStore } from '@/services/db/local';
import { MemoryBackend } from '@/services/db/backend';
import { initialQueueState, queueReducer, currentTrack } from '@/player/queue';
import { buildTasteProfile, rankTracks } from '@/services/taste';
import { computeStats } from '@/services/stats';
import { makeTrack } from '@/test/factories';

/**
 * End-to-end flow without a browser: login -> search -> play -> like ->
 * playlist -> history -> recommendations. Mirrors the manual E2E script in
 * e2e/flow.spec.ts, which needs a real browser to run.
 */
describe('user journey', () => {
  let store: LocalStore;
  const catalogue = [
    makeTrack({ id: 'j1', genres: ['jazz'], artistId: 'miles', duration: 200 }),
    makeTrack({ id: 'j2', genres: ['jazz'], artistId: 'bill', duration: 180 }),
    makeTrack({ id: 'm1', genres: ['metal'], artistId: 'sleep', duration: 240 }),
  ];
  const search = (q: string) => catalogue.filter((t) => t.genres.includes(q));

  beforeEach(async () => {
    const backend = new MemoryBackend();
    await backend.open();
    store = new LocalStore(backend);
    await store.init();
  });

  it('carries a listening session from search to recommendations', async () => {
    await store.saveProfile({ id: 'u1', displayName: 'Samuele', email: null, source: 'local' });
    expect((await store.getProfile())?.displayName).toBe('Samuele');

    const results = search('jazz');
    expect(results).toHaveLength(2);
    await store.pushSearchHistory('jazz');

    let queue = queueReducer(initialQueueState, { type: 'set', tracks: results, contextLabel: 'Ricerca: jazz' });
    const playing = currentTrack(queue)!;
    expect(playing.id).toBe('j1');

    const now = Date.now();
    await store.logHistory(playing, 'play_started', 0, 0);
    await store.logHistory(playing, 'p50', 100, 50);
    await store.logHistory(playing, 'completed', 200, 100);

    await store.like(playing);
    expect(await store.isLiked('j1')).toBe(true);

    const playlist = await store.createPlaylist({ name: 'Jazz serale' });
    await store.addTracksToPlaylist(playlist.id, results);
    const saved = await store.getPlaylist(playlist.id);
    expect(saved?.tracks).toHaveLength(2);

    queue = queueReducer(queue, { type: 'set', tracks: saved!.tracks, contextLabel: saved!.name });
    queue = queueReducer(queue, { type: 'next' });
    expect(currentTrack(queue)?.id).toBe('j2');

    const history = await store.listHistory();
    expect(history.length).toBeGreaterThanOrEqual(3);

    const stats = computeStats(history, 'all', now + 1000);
    expect(stats.tracksPlayed).toBe(1);
    expect(stats.listenedSeconds).toBe(200);

    const profile = buildTasteProfile(history, await store.listLiked(), now + 1000);
    const ranked = rankTracks([catalogue[2], catalogue[1]], profile);
    expect(ranked[0].id).toBe('j2');
  });
});
