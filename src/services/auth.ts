import type { Profile } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/services/db/supabase';
import { getStore, resetStore } from '@/services/db';
import { uid } from '@/utils/id';
import { isValidEmail, passwordProblem, sanitizeText } from '@/utils/validation';

export interface AuthResult {
  ok: boolean;
  message?: string;
  profile?: Profile;
}

const LOCAL_KEY = 'mb.local.profile';

/**
 * Two modes, one API:
 *  - Supabase Auth when VITE_SUPABASE_* are set (email + password, free tier)
 *  - a purely local profile otherwise, so the app is usable with zero signup.
 */
export const authMode = (): 'supabase' | 'local' => (isSupabaseConfigured() ? 'supabase' : 'local');

export async function getCurrentProfile(): Promise<Profile | null> {
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      const store = await getStore();
      return store.getProfile();
    }
    return null;
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export async function signInLocal(displayName: string): Promise<AuthResult> {
  const name = sanitizeText(displayName, 40) || 'Listener';
  const profile: Profile = { id: uid('user'), displayName: name, email: null, source: 'local' };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
  resetStore();
  const store = await getStore();
  await store.saveProfile(profile);
  return { ok: true, profile };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = await getSupabase();
  if (!sb) return signInLocal(email.split('@')[0] ?? 'Listener');
  if (!isValidEmail(email)) return { ok: false, message: 'Indirizzo email non valido.' };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: 'Email o password non corretti.' };
  resetStore();
  const store = await getStore();
  return { ok: true, profile: (await store.getProfile()) ?? undefined };
}

export async function signUp(email: string, password: string, displayName: string): Promise<AuthResult> {
  const sb = await getSupabase();
  if (!sb) return signInLocal(displayName || email.split('@')[0] || 'Listener');
  if (!isValidEmail(email)) return { ok: false, message: 'Indirizzo email non valido.' };
  const pwdIssue = passwordProblem(password);
  if (pwdIssue) return { ok: false, message: pwdIssue };
  const { error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: sanitizeText(displayName, 40) } },
  });
  if (error) return { ok: false, message: "Registrazione non riuscita. Riprova tra qualche secondo." };
  resetStore();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
  else localStorage.removeItem(LOCAL_KEY);
  resetStore();
}

export function onAuthChange(cb: () => void): () => void {
  if (!isSupabaseConfigured()) return () => undefined;
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  void getSupabase().then((sb) => {
    if (!sb || cancelled) return;
    const { data } = sb.auth.onAuthStateChange(() => {
      resetStore();
      cb();
    });
    unsubscribe = () => data.subscription.unsubscribe();
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
