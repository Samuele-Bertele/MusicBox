import type { ProviderId, Track } from '@/types';

/**
 * Entity ids are namespaced as `provider:id`. The id part may itself contain
 * colons (Internet Archive paths), so only the first separator is split.
 */
export function splitEntityId(value: string): { provider: ProviderId; entityId: string } {
  const at = value.indexOf(':');
  if (at === -1) return { provider: 'jamendo', entityId: value };
  return { provider: value.slice(0, at) as ProviderId, entityId: value.slice(at + 1) };
}

/** Backlink to the track on its catalogue — required by the Jamendo API terms. */
export function sourceUrlFor(track: Track): string | null {
  if (track.sourceUrl) return track.sourceUrl;
  if (track.provider === 'jamendo') return `https://www.jamendo.com/track/${track.providerTrackId}`;
  if (track.provider === 'archive') return `https://archive.org/details/${track.providerTrackId.split('/')[0]}`;
  return null;
}
