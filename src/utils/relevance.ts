import type { Album, Artist, Track } from '@/types';

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const queryTerms = (query: string): string[] => normalize(query).split(' ').filter(Boolean);

function score(haystacks: { title: string; artist: string; album: string }, query: string, terms: string[]): number {
  const q = normalize(query);
  let total = 0;

  if (haystacks.title === q) total += 10;
  else if (haystacks.title.startsWith(q)) total += 6;
  else if (haystacks.title.includes(q)) total += 4;

  if (haystacks.artist === q) total += 8;
  else if (haystacks.artist.includes(q)) total += 3;

  if (haystacks.album.includes(q)) total += 1;

  const all = `${haystacks.title} ${haystacks.artist} ${haystacks.album}`;
  total += terms.filter((t) => all.includes(t)).length;
  return total;
}

/**
 * The catalogue's own search is broad: it matches tags and descriptions too,
 * so a query can come back with tracks that share nothing visible with what
 * was typed. This splits the results into what actually matches every word
 * the user wrote and what only matches loosely, so the UI can be honest about
 * the difference instead of presenting noise as an answer.
 */
export function splitByRelevance(tracks: Track[], query: string): { matching: Track[]; loose: Track[] } {
  const terms = queryTerms(query);
  if (!terms.length) return { matching: tracks, loose: [] };

  const matching: Array<{ track: Track; score: number }> = [];
  const loose: Track[] = [];

  for (const track of tracks) {
    const fields = {
      title: normalize(track.title),
      artist: normalize(track.artist.name),
      album: normalize(track.album?.name ?? ''),
    };
    const all = `${fields.title} ${fields.artist} ${fields.album}`;
    if (terms.every((t) => all.includes(t))) matching.push({ track, score: score(fields, query, terms) });
    else loose.push(track);
  }

  return { matching: matching.sort((a, b) => b.score - a.score).map((r) => r.track), loose };
}

export function filterArtists(artists: Artist[], query: string): Artist[] {
  const terms = queryTerms(query);
  if (!terms.length) return artists;
  return artists.filter((a) => {
    const name = normalize(a.name);
    return terms.every((t) => name.includes(t));
  });
}

export function filterAlbums(albums: Album[], query: string): Album[] {
  const terms = queryTerms(query);
  if (!terms.length) return albums;
  return albums.filter((a) => {
    const all = `${normalize(a.name)} ${normalize(a.artist.name)}`;
    return terms.every((t) => all.includes(t));
  });
}
