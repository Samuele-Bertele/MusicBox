import type { ProviderId, Track } from '@/types';
import { JamendoProvider } from './jamendo';
import { ArchiveProvider } from './archive';
import { ProviderError, type MusicProvider, type SearchOptions } from './types';

export { ProviderError };
export type { MusicProvider, SearchOptions };

const jamendo = new JamendoProvider(import.meta.env?.VITE_JAMENDO_CLIENT_ID);
const archive = new ArchiveProvider();

export const providers: Record<ProviderId, MusicProvider> = { jamendo, archive };

let primary: ProviderId = ((import.meta.env?.VITE_DEFAULT_PROVIDER as ProviderId) || 'jamendo') in providers
  ? ((import.meta.env?.VITE_DEFAULT_PROVIDER as ProviderId) || 'jamendo')
  : 'jamendo';

export function setPrimaryProvider(id: ProviderId) {
  if (providers[id]) primary = id;
}

export function getPrimaryProvider(): MusicProvider {
  return providers[primary];
}

export function providerFor(idOrTrack: ProviderId | Track): MusicProvider {
  const id = typeof idOrTrack === 'string' ? idOrTrack : idOrTrack.provider;
  return providers[id] ?? getPrimaryProvider();
}

export function usingJamendoTestKey(): boolean {
  return jamendo.usesTestCredentials();
}

/** Order in which providers are tried: primary first, then the others. */
export function providerChain(): MusicProvider[] {
  const rest = (Object.keys(providers) as ProviderId[]).filter((id) => id !== primary);
  return [providers[primary], ...rest.map((id) => providers[id])];
}

/**
 * Runs `fn` against the primary provider and falls back to the next one only
 * when the primary genuinely fails. A fallback NEVER substitutes a different
 * recording for the requested one — it only re-runs open-ended queries
 * (search, featured, recommendations) on another legal catalogue.
 */
export async function withFallback<T>(
  fn: (p: MusicProvider) => Promise<T>,
  isEmpty: (value: T) => boolean = () => false,
): Promise<{ value: T; provider: MusicProvider }> {
  let lastError: unknown;
  for (const provider of providerChain()) {
    if (!provider.isConfigured()) continue;
    try {
      const value = await fn(provider);
      if (!isEmpty(value)) return { value, provider };
      lastError = new ProviderError('No results', 'not_found', provider.id);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('all_providers_failed');
}
