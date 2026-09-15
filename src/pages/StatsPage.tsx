import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { useLibrary } from '@/services/LibraryProvider';
import { computeStats, PERIOD_LABELS, type StatsPeriod } from '@/services/stats';
import { BarChart, HourHeat, StatTile } from '@/components/Charts';
import { Artwork, EmptyState } from '@/components/ui';
import { formatDuration, formatMinutes } from '@/utils/format';

const PERIODS = Object.keys(PERIOD_LABELS) as StatsPeriod[];

export function StatsPage() {
  const { history } = useLibrary();
  const [period, setPeriod] = useState<StatsPeriod>('30d');
  const stats = useMemo(() => computeStats(history, period), [history, period]);

  if (!history.length) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="Ancora nessun dato"
        description="Le statistiche si costruiscono mentre ascolti. Riproduci qualcosa e torna qui."
      />
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            className={`h-9 px-4 rounded-full text-sm transition-colors ${
              period === p ? 'bg-accent text-[rgb(20,24,23)]' : 'bg-elevated text-muted hover:text-txt'
            }`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Tempo di ascolto" value={formatMinutes(stats.listenedSeconds)} />
        <StatTile label="Riproduzioni" value={String(stats.tracksPlayed)} hint={`${stats.uniqueTracks} brani diversi`} />
        <StatTile label="Artisti" value={String(stats.uniqueArtists)} hint={`${stats.uniqueAlbums} album`} />
        <StatTile label="Giorni consecutivi" value={String(stats.streakDays)} />
        <StatTile label="Ascolto medio" value={formatDuration(stats.averageListenSeconds)} />
        <StatTile label="Brani completati" value={`${Math.round(stats.completionRate * 100)}%`} />
        <StatTile label="Saltati" value={`${Math.round(stats.skipRate * 100)}%`} />
        <StatTile
          label="Ora preferita"
          value={stats.favouriteHour === null ? '—' : `${String(stats.favouriteHour).padStart(2, '0')}:00`}
          hint={stats.busiestDay ? `Giorno più attivo: ${stats.busiestDay.day}` : undefined}
        />
      </div>

      <section className="surface-card p-4 space-y-3">
        <h2 className="text-base">Minuti al giorno</h2>
        <BarChart data={stats.perDay.map((d) => ({ label: d.day.slice(5), value: d.minutes }))} />
      </section>

      <section className="surface-card p-4 space-y-3">
        <h2 className="text-base">Quando ascolti</h2>
        <HourHeat values={stats.perHour} />
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <RankList title="Brani più ascoltati" rows={stats.topTracks.map((r) => ({ key: r.key, label: r.label, sub: r.item.artist.name, artwork: r.item.artwork, value: formatMinutes(r.seconds) }))} />
        <RankList title="Artisti più ascoltati" rows={stats.topArtists.map((r) => ({ key: r.key, label: r.label, sub: `${r.count} riproduzioni`, artwork: r.item.artwork, value: formatMinutes(r.seconds) }))} />
        <RankList title="Album più ascoltati" rows={stats.topAlbums.map((r) => ({ key: r.key, label: r.label, sub: r.item.artist.name, artwork: r.item.artwork, value: formatMinutes(r.seconds) }))} />
        <section className="space-y-3">
          <h2 className="text-base">Generi</h2>
          {stats.topGenres.length === 0 ? (
            <p className="text-sm text-muted">Il catalogo non ha fornito generi per questi brani.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topGenres.map((g) => (
                <span key={g.key} className="px-3 h-8 rounded-full bg-elevated text-sm grid place-items-center">
                  {g.key} <span className="text-muted ml-2 text-xs">{g.count}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RankList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; label: string; sub: string; artwork: string | null; value: string }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nessun dato per questo periodo.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-elevated/60">
              <span className="w-5 text-sm text-muted tabular-nums text-right">{i + 1}</span>
              <Artwork src={r.artwork} alt="" className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{r.label}</div>
                <div className="truncate text-xs text-muted">{r.sub}</div>
              </div>
              <span className="text-xs text-muted tabular-nums">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
