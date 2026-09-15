import type { DataStore } from './types';
import { LocalStore } from './local';
import { getSupabase, isSupabaseConfigured } from './supabase';

export type { DataStore, PlaylistWithTracks } from './types';
export { DEFAULT_SETTINGS } from './types';
export { isSupabaseConfigured, getSupabase };

let current: DataStore | null = null;
let pending: Promise<DataStore> | null = null;

/**
 * Picks the best available store:
 *  1. Supabase when configured AND a session exists (multi-device sync)
 *  2. IndexedDB otherwise (always works, no signup, no cost)
 * A Supabase failure degrades to local instead of breaking the app.
 */
export async function getStore(): Promise<DataStore> {
  if (current) return current;
  if (pending) return pending;

  pending = (async () => {
    const sb = await getSupabase();
    if (sb) {
      try {
        const { data } = await sb.auth.getSession();
        if (data.session) {
          const { SupabaseStore } = await import('./supabase');
          const store = new SupabaseStore(sb);
          await store.init();
          current = store;
          return store;
        }
      } catch (err) {
        console.warn('[store] supabase unavailable, using local storage', err);
      }
    }
    const local = new LocalStore();
    await local.init();
    current = local;
    return local;
  })();

  return pending;
}

/** Forces re-resolution after login/logout. */
export function resetStore() {
  current = null;
  pending = null;
}
