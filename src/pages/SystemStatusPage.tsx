import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getMonthTotals, getStats, resetStats, type DayStats } from '@/services/http/telemetry';
import { providers } from '@/services/providers';
import { useLibrary } from '@/services/LibraryProvider';
import { BarChart, StatTile } from '@/components/Charts';
import { relativeTime } from '@/utils/format';

/** Conservative published/observed free-tier ceilings, used only for display. */
const LIMITS = {
  jamendoMonthlyRequests: 500_000,
  supabaseRows: 500_000,
  localStorageBytes: 5 * 1024 * 1024,
};

export function SystemStatusPage() {
  const { store, playlists, liked, history } = useLibrary();
  const [rows, setRows] = useState<DayStats[]>([]);
  const [month, setMonth] = useState(getMonthTotals());
  const [storageBytes, setStorageBytes] = useState(0);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);

  const reload = () => {
    setRows(getStats());
    setMonth(getMonthTotals());
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) bytes += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    setStorageBytes(bytes * 2);
  };

  useEffect(() => {
    reload();
    if (navigator.storage?.estimate) {
      void navigator.storage.estimate().then((e) => setQuota({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    }
  }, []);

  const totalRequests = month.requests;
  const totalLookups = month.requests + month.cacheHits + month.dedupedHits;
  const hitRate = totalLookups ? (month.cacheHits + month.dedupedHits) / totalLookups : 0;
  const lastDay = rows[rows.length - 1];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl">Stato del sistema</h1>
          <p className="text-sm text-muted mt-1">Consumo del mese corrente, misurato sul dispositivo.</p>
        </div>
        <button className="btn-outline ml-auto h-9" onClick={reload}>
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Richieste API"
          value={totalRequests.toLocaleString('it-IT')}
          hint={`${((totalRequests / LIMITS.jamendoMonthlyRequests) * 100).toFixed(2)}% della soglia Jamendo`}
        />
        <StatTile label="Cache" value={`${Math.round(hitRate * 100)}%`} hint={`${month.cacheHits + month.dedupedHits} richieste evitate`} />
        <StatTile label="Errori di rete" value={String(month.errors)} hint={month.rateLimited ? `${month.rateLimited} rate limit` : 'Nessun rate limit'} />
        <StatTile label="Scritture database" value={String(month.dbWrites)} hint={`${month.dbReads} letture`} />
      </div>

      <section className="surface-card p-4 space-y-3">
        <h2 className="text-base">Richieste per giorno</h2>
        <BarChart data={rows.map((r) => ({ label: r.day.slice(5), value: r.requests }))} unit="richieste" labelEvery={5} />
        {lastDay && <p className="text-xs text-muted">Ultima attività registrata: {lastDay.day}</p>}
      </section>

      <section className="surface-card p-4 space-y-3">
        <h2 className="text-base">Archiviazione</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Line label="Motore dati" value={store?.kind === 'supabase' ? 'Supabase PostgreSQL' : 'IndexedDB (dispositivo)'} />
          <Line label="Playlist" value={String(playlists.length)} />
          <Line label="Brani preferiti" value={String(liked.length)} />
          <Line
            label="Eventi di cronologia"
            value={`${history.length}${store?.kind === 'supabase' ? ` / ${LIMITS.supabaseRows.toLocaleString('it-IT')} righe` : ''}`}
          />
          <Line label="Cache metadati" value={`${(storageBytes / 1024).toFixed(0)} kB di ${(LIMITS.localStorageBytes / 1024 / 1024).toFixed(0)} MB`} />
          {quota && (
            <Line
              label="Spazio del browser"
              value={`${(quota.usage / 1024 / 1024).toFixed(1)} MB usati su ${(quota.quota / 1024 / 1024).toFixed(0)} MB`}
            />
          )}
        </dl>
      </section>

      <section className="surface-card p-4 space-y-3">
        <h2 className="text-base">Cataloghi</h2>
        <div className="space-y-3">
          {Object.values(providers).map((p) => (
            <div key={p.id} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${p.isConfigured() ? 'bg-emerald-400' : 'bg-line'}`} />
              <div className="min-w-0">
                <p className="text-sm">{p.label}</p>
                <p className="text-xs text-muted leading-relaxed">{p.licenseNote}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card p-4 space-y-3">
        <h2 className="text-base">Sincronizzazione</h2>
        <p className="text-sm text-muted">
          {history[0] ? `Ultimo ascolto registrato ${relativeTime(history[0].at)}.` : 'Nessun ascolto ancora registrato.'}
        </p>
        <button
          className="btn-outline h-9"
          onClick={() => {
            resetStats();
            reload();
          }}
        >
          Azzera i contatori
        </button>
      </section>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </>
  );
}
