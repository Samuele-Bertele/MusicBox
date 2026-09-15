import type { ProviderId } from '@/types';

/**
 * Entity ids are namespaced as `provider:id`. The id part may itself contain
 * colons (Internet Archive paths), so only the first separator is split.
 */
export function splitEntityId(value: string): { provider: ProviderId; entityId: string } {
  const at = value.indexOf(':');
  if (at === -1) return { provider: 'jamendo', entityId: value };
  return { provider: value.slice(0, at) as ProviderId, entityId: value.slice(at + 1) };
}
