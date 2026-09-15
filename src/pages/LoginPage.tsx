import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authMode, signIn, signInLocal, signUp } from '@/services/auth';
import { useLibrary } from '@/services/LibraryProvider';

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useLibrary();
  const mode = authMode();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result =
      mode === 'local'
        ? await signInLocal(name || 'Listener')
        : tab === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password, name);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message ?? 'Accesso non riuscito. Riprova.');
      return;
    }
    if (mode === 'supabase' && tab === 'signup' && !result.profile) {
      setMessage('Account creato. Controlla la posta per confermare, poi accedi.');
      setTab('signin');
      return;
    }
    await refreshProfile();
    navigate('/', { replace: true });
    window.location.reload();
  };

  return (
    <div className="min-h-full grid place-items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl tracking-[-0.04em]">musicbox</h1>
          <p className="text-sm text-muted leading-relaxed">
            Il tuo lettore musicale personale, costruito su cataloghi liberamente ascoltabili.
          </p>
        </div>

        {mode === 'supabase' && (
          <div className="flex gap-1 p-1 rounded-full bg-elevated w-fit">
            {(['signin', 'signup'] as const).map((t) => (
              <button
                key={t}
                className={`h-8 px-4 rounded-full text-sm transition-colors ${tab === t ? 'bg-surface text-txt' : 'text-muted'}`}
                onClick={() => setTab(t)}
              >
                {t === 'signin' ? 'Accedi' : 'Registrati'}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {(mode === 'local' || tab === 'signup') && (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted">Come ti chiami</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />
            </label>
          )}

          {mode === 'supabase' && (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">Email</span>
                <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">Password</span>
                <input
                  className="field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                />
              </label>
            </>
          )}

          {message && <p className="text-sm text-accent">{message}</p>}

          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'local' ? 'Entra' : tab === 'signin' ? 'Accedi' : 'Crea account'}
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          {mode === 'local'
            ? 'Nessun account richiesto: la libreria resta su questo dispositivo. Collega Supabase nelle variabili d’ambiente per sincronizzarla.'
            : 'La libreria è protetta da Row Level Security: solo il tuo account può leggerla e scriverla.'}
        </p>
      </div>
    </div>
  );
}
