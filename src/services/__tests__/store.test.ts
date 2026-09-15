import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStore } from '@/services/db/local';
import { MemoryBackend } from '@/services/db/backend';
import { makeTrack } from '@/test/factories';

let store: LocalStore;

beforeEach(async () => {
  const backend = new MemoryBackend();
  await backend.open();
  store = new LocalStore(backend);
  await store.init();
});

describe('LocalStore — playlists', () => {
  it('creates, renames and deletes a playlist', async () => {
    const pl = await store.createPlaylist({ name: 'Serata' });
    expect((await store.listPlaylists())).toHaveLength(1);

    await store.updatePlaylist(pl.id, { name: 'Serata lunga' });
    expect((await store.getPlaylist(pl.id))?.name).toBe('Serata lunga');

    await store.deletePlaylist(pl.id);
    expect(await store.listPlaylists()).toHaveLength(0);
  });

  it('adds tracks once and keeps their order', async () => {
    const pl = await store.createPlaylist({ name: 'Mix' });
    const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    await store.addTracksToPlaylist(pl.id, tracks);
    await store.addTracksToPlaylist(pl.id, [tracks[0]]);

    expect((await store.getPlaylist(pl.id))?.tracks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('reorders and removes tracks, keeping positions contiguous', async () => {
    const pl = await store.createPlaylist({ name: 'Mix' });
    await store.addTracksToPlaylist(pl.id, [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })]);

    await store.reorderPlaylist(pl.id, ['c', 'a', 'b']);
    expect((await store.getPlaylist(pl.id))?.tracks.map((t) => t.id)).toEqual(['c', 'a', 'b']);

    await store.removeTrackFromPlaylist(pl.id, 'a');
    expect((await store.getPlaylist(pl.id))?.tracks.map((t) => t.id)).toEqual(['c', 'b']);
  });

  it('duplicates a playlist with its tracks', async () => {
    const pl = await store.createPlaylist({ name: 'Originale' });
    await store.addTracksToPlaylist(pl.id, [makeTrack({ id: 'a' })]);

    const copy = await store.duplicatePlaylist(pl.id);
    expect(copy?.name).toBe('Originale (copy)');
    expect((await store.getPlaylist(copy!.id))?.tracks).toHaveLength(1);
  });

  it('strips markup from user supplied names', async () => {
    const pl = await store.createPlaylist({ name: '<script>alert(1)</script>' });
    expect(pl.name).not.toContain('<');
  });
});

describe('LocalStore — likes, follows and history', () => {
  it('likes and unlikes a track', async () => {
    const track = makeTrack({ id: 'a' });
    await store.like(track);
    expect(await store.isLiked('a')).toBe(true);
    expect(await store.listLiked()).toHaveLength(1);

    await store.unlike('a');
    expect(await store.isLiked('a')).toBe(false);
  });

  it('records history events when enabled and skips them when not', async () => {
    const track = makeTrack({ id: 'a', duration: 100 });
    await store.logHistory(track, 'play_started', 0, 0);
    expect(await store.listHistory()).toHaveLength(1);

    await store.saveSettings({ historyEnabled: false });
    await store.logHistory(track, 'completed', 100, 100);
    expect(await store.listHistory()).toHaveLength(1);
  });

  it('deduplicates search history by query', async () => {
    await store.pushSearchHistory('jazz');
    await store.pushSearchHistory('Jazz');
    expect(await store.listSearchHistory()).toHaveLength(1);
  });

  it('exports and wipes everything', async () => {
    const pl = await store.createPlaylist({ name: 'Mix' });
    await store.addTracksToPlaylist(pl.id, [makeTrack({ id: 'a' })]);
    await store.like(makeTrack({ id: 'b' }));

    const bundle = await store.exportAll();
    expect(bundle.playlists[0].tracks).toHaveLength(1);
    expect(bundle.liked).toHaveLength(1);

    await store.wipeAll();
    expect(await store.listPlaylists()).toHaveLength(0);
    expect(await store.listLiked()).toHaveLength(0);
  });
});
