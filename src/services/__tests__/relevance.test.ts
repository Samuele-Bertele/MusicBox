import { describe, expect, it } from 'vitest';
import { filterArtists, splitByRelevance } from '@/utils/relevance';
import { makeTrack } from '@/test/factories';

const withNames = (id: string, title: string, artist: string) => ({
  ...makeTrack({ id, artistId: artist }),
  title,
  artist: { id: artist, name: artist },
});

describe('splitByRelevance', () => {
  it('keeps only tracks that contain every term the user typed', () => {
    const tracks = [
      withNames('a', 'Piano Sonata', 'Rossi'),
      withNames('b', 'Guitar Loop', 'Bianchi'),
      withNames('c', 'Soft Piano', 'Verdi'),
    ];
    const { matching, loose } = splitByRelevance(tracks, 'piano');
    expect(matching.map((t) => t.id)).toEqual(['a', 'c']);
    expect(loose.map((t) => t.id)).toEqual(['b']);
  });

  it('matches on the artist name too', () => {
    const tracks = [withNames('a', 'Untitled', 'Piano Collective'), withNames('b', 'Untitled', 'Drums Inc')];
    expect(splitByRelevance(tracks, 'piano').matching.map((t) => t.id)).toEqual(['a']);
  });

  it('ranks an exact title above a partial one', () => {
    const tracks = [withNames('a', 'Slow Piano Night', 'X'), withNames('b', 'Piano', 'Y')];
    expect(splitByRelevance(tracks, 'piano').matching[0].id).toBe('b');
  });

  it('requires all terms of a multi-word query', () => {
    const tracks = [withNames('a', 'Soft Piano', 'X'), withNames('b', 'Soft Piano Night', 'Y')];
    expect(splitByRelevance(tracks, 'piano night').matching.map((t) => t.id)).toEqual(['b']);
  });

  it('ignores accents and punctuation', () => {
    const tracks = [withNames('a', 'Café Sessions', 'X')];
    expect(splitByRelevance(tracks, 'cafe').matching).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    const tracks = [withNames('a', 'Anything', 'X')];
    expect(splitByRelevance(tracks, '  ').matching).toHaveLength(1);
  });
});

describe('filterArtists', () => {
  it('drops artists whose name does not contain the query', () => {
    const artists = [
      { id: '1', provider: 'jamendo' as const, providerArtistId: '1', name: 'Piano Trio', image: null, genres: [], website: null },
      { id: '2', provider: 'jamendo' as const, providerArtistId: '2', name: 'Drum Squad', image: null, genres: [], website: null },
    ];
    expect(filterArtists(artists, 'piano').map((a) => a.id)).toEqual(['1']);
  });
});
