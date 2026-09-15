import { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import type { ImportedRow, ProviderId, ThemeMode } from '@/types';
import { useLibrary } from '@/services/LibraryProvider';
import { useToast } from '@/hooks/useToast';
import { authMode, signOut } from '@/services/auth';
import { providers, getPrimaryProvider, usingJamendoTestKey } from '@/services/providers';
import { ConfirmDialog } from '@/components/ui';
import { sanitizeText } from '@/utils/validation';
import { useNavigate } from 'react-router-dom';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5 space-y-4">
      <div>
        <h2 className="text-base">{title}</h2>
        {description && <p className="text-xs text-muted mt-1">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, store, profile, refreshPlaylists, refreshLiked, refreshHistory } = useLibrary();
  const { push } = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<null | 'history' | 'account'>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const download = (filename: string, content: string, type = 'application/json') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHistory = async () => {
    if (!store) return;
    const history = await store.listHistory(5000);
    const csv = [
      'played_at,track,artist,album,event,listened_seconds,percent',
      ...history.map((h) =>
        [new Date(h.at).toISOString(), h.track.title, h.track.artist.name, h.track.album?.name ?? '', h.type, h.listenedSeconds, h.percent]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    download('musicbox-cronologia.csv', csv, 'text/csv');
  };

  const importPlaylist = async (file: File) => {
    if (!store) return;
    const text = await file.text();
    let rows: ImportedRow[] = [];
    try {
      rows = file.name.endsWith('.json') ? (JSON.parse(text) as ImportedRow[]) : parseCsv(text);
    } catch {
      push('File non leggibile. Servono un JSON o un CSV con titolo e artista.', 'error');
      return;
    }
    if (!Array.isArray(rows) || !rows.length) {
      push('Nessuna riga valida nel file.', 'error');
      return;
    }

    const provider = getPrimaryProvider();
    const playlist = await store.createPlaylist({ name: sanitizeText(file.name.replace(/\.[^.]+$/, ''), 80) || 'Playlist importata' });
    let matched = 0;
    // The file gives metadata only: each row is matched against the catalogue,
    // nothing is downloaded and nothing unmatched is invented.
    for (const row of rows.slice(0, 100)) {
      const query = `${row.title ?? ''} ${row.artist ?? ''}`.trim();
      if (!query) continue;
      const found = await provider.searchTracks(query, { limit: 1 }).catch(() => []);
      if (found[0]) {
        await store.addTracksToPlaylist(playlist.id, [found[0]]);
        matched++;
      }
    }
    await refreshPlaylists();
    push(`Importate ${matched} corrispondenze su ${rows.length} righe.`, matched ? 'success' : 'error');
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Section title="Account">
        <Row label="Nome visualizzato">
          <div className="flex gap-2">
            <input className="field w-48 h-9" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
            <button
              className="btn-outline h-9"
              onClick={async () => {
                if (!store || !profile) return;
                await store.saveProfile({ ...profile, displayName });
                push('Nome aggiornato', 'success');
              }}
            >
              Salva
            </button>
          </div>
        </Row>
        <Row label="Tipo di account" hint={authMode() === 'local' ? 'Dati salvati su questo dispositivo' : 'Sincronizzato con Supabase'}>
          <span className="text-sm text-muted">{store?.kind === 'supabase' ? 'Supabase' : 'Locale'}</span>
        </Row>
        <Row label="Esci dall'account">
          <button
            className="btn-outline h-9"
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
              window.location.reload();
            }}
          >
            Esci
          </button>
        </Row>
      </Section>

      <Section title="Aspetto">
        <Row label="Tema">
          <select
            className="field h-9 w-40"
            value={settings.theme}
            onChange={(e) => void updateSettings({ theme: e.target.value as ThemeMode })}
            aria-label="Tema"
          >
            <option value="dark">Scuro</option>
            <option value="light">Chiaro</option>
            <option value="system">Come il sistema</option>
          </select>
        </Row>
      </Section>

      <Section title="Riproduzione">
        <Row label="Riproduzione automatica" hint="Passa al brano successivo quando finisce">
          <Toggle checked={settings.autoplay} onChange={(v) => void updateSettings({ autoplay: v })} label="Riproduzione automatica" />
        </Row>
        <Row label="Smart shuffle" hint="Evita di ripetere lo stesso artista o album di fila">
          <Toggle checked={settings.smartShuffle} onChange={(v) => void updateSettings({ smartShuffle: v })} label="Smart shuffle" />
        </Row>
        <Row label="Riduci le pause fra i brani" hint="Bufferizza l'intero brano invece dei soli metadati: più dati, meno silenzio">
          <Toggle checked={settings.gapless} onChange={(v) => void updateSettings({ gapless: v })} label="Gapless" />
        </Row>
        <Row label="Dissolvenza al cambio brano" hint="Sfuma l'audio quando salti manualmente, invece di tagliarlo di netto">
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={settings.crossfadeSeconds}
            onChange={(e) => void updateSettings({ crossfadeSeconds: Number(e.target.value) })}
            className="w-36 accent-[rgb(var(--accent))]"
            aria-label="Dissolvenza al cambio brano"
          />
        </Row>
      </Section>

      <Section title="Audio e catalogo">
        <Row label="Volume" hint={`${Math.round(settings.volume * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => void updateSettings({ volume: Number(e.target.value) })}
            className="w-36 accent-[rgb(var(--accent))]"
            aria-label="Volume"
          />
        </Row>
        <Row label="Catalogo principale" hint={getPrimaryProvider().licenseNote}>
          <select
            className="field h-9 w-56"
            value={settings.defaultProvider}
            onChange={(e) => void updateSettings({ defaultProvider: e.target.value as ProviderId })}
            aria-label="Catalogo principale"
          >
            {Object.values(providers).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>
        {usingJamendoTestKey() && (
          <p className="text-xs text-accent leading-relaxed">
            Stai usando il client_id pubblico di prova di Jamendo, molto limitato. Registra un id gratuito su devportal.jamendo.com e
            impostalo in VITE_JAMENDO_CLIENT_ID.
          </p>
        )}
        <p className="text-xs text-muted leading-relaxed">
          La qualità audio è quella pubblicata dal catalogo (MP3 VBR). Nessun provider gratuito espone più profili di qualità, quindi non
          c'è nulla da scegliere qui.
        </p>
      </Section>

      <Section title="Privacy">
        <Row label="Registra la cronologia" hint="Serve a statistiche e consigli">
          <Toggle checked={settings.historyEnabled} onChange={(v) => void updateSettings({ historyEnabled: v })} label="Cronologia" />
        </Row>
        <Row label="Consigli personalizzati" hint="Se disattivato la Home mostra solo contenuti generici">
          <Toggle
            checked={settings.personalizedRecommendations}
            onChange={(v) => void updateSettings({ personalizedRecommendations: v })}
            label="Consigli personalizzati"
          />
        </Row>
      </Section>

      <Section title="Dati" description="Tutto resta tuo: esporta quando vuoi, cancella quando vuoi.">
        <Row label="Esporta libreria e playlist">
          <button
            className="btn-outline h-9"
            onClick={async () => {
              if (!store) return;
              download('musicbox-libreria.json', JSON.stringify(await store.exportAll(), null, 2));
            }}
          >
            <Download className="h-4 w-4" /> JSON
          </button>
        </Row>
        <Row label="Esporta cronologia di ascolto">
          <button className="btn-outline h-9" onClick={exportHistory}>
            <Download className="h-4 w-4" /> CSV
          </button>
        </Row>
        <Row label="Importa playlist" hint="JSON o CSV con le colonne title, artist, album">
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importPlaylist(file);
                e.target.value = '';
              }}
            />
            <button className="btn-outline h-9" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Scegli file
            </button>
          </>
        </Row>
        <Row label="Cancella la cronologia">
          <button className="btn-outline h-9 text-red-400 border-red-500/40" onClick={() => setConfirm('history')}>
            <Trash2 className="h-4 w-4" /> Cancella
          </button>
        </Row>
        <Row label="Elimina tutti i dati" hint="Playlist, preferiti, cronologia e impostazioni">
          <button className="btn-outline h-9 text-red-400 border-red-500/40" onClick={() => setConfirm('account')}>
            <Trash2 className="h-4 w-4" /> Elimina
          </button>
        </Row>
      </Section>

      <Section title="Informazioni">
        <p className="text-xs text-muted leading-relaxed">
          musicbox riproduce solo cataloghi che concedono esplicitamente lo streaming: Jamendo (Creative Commons e licenze Jamendo) e le
          netlabel dell'Internet Archive. Nessun DRM viene aggirato, nessun contenuto viene scaricato da servizi che non lo consentono.
          Ogni brano rimanda alla propria licenza dal player a schermo intero.
        </p>
      </Section>

      <ConfirmDialog
        open={confirm === 'history'}
        title="Cancellare la cronologia?"
        message="Statistiche e consigli personalizzati ripartiranno da zero."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await store?.clearHistory();
          await refreshHistory();
          setConfirm(null);
          push('Cronologia cancellata');
        }}
      />

      <ConfirmDialog
        open={confirm === 'account'}
        title="Eliminare tutti i dati?"
        message="Playlist, preferiti, artisti seguiti, cronologia e impostazioni verranno eliminati definitivamente."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await store?.wipeAll();
          await Promise.all([refreshPlaylists(), refreshLiked(), refreshHistory()]);
          setConfirm(null);
          push('Dati eliminati');
          navigate('/');
        }}
      />
    </div>
  );
}

function parseCsv(text: string): ImportedRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)/g)?.filter((_, i) => i % 2 === 0) ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    });
    return { title: row.title ?? '', artist: row.artist ?? '', album: row.album, cover: row.cover, provider_id: row.provider_id };
  });
}
