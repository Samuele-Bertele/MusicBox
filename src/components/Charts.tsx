/**
 * Hand-rolled SVG charts. A charting library would add ~100 kB to the bundle
 * for two shapes; these render the same information in a few dozen lines and
 * inherit the theme tokens automatically.
 */

export function BarChart({
  data,
  height = 140,
  labelEvery = 7,
  unit = 'min',
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  labelEvery?: number;
  unit?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 2;
  const width = data.length * (8 + gap);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 18}`}
        width="100%"
        height={height + 18}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Grafico a barre: massimo ${max} ${unit}`}
      >
        {data.map((d, i) => {
          const h = (d.value / max) * height;
          return (
            <g key={d.label}>
              <rect
                x={i * (8 + gap)}
                y={height - h}
                width={8}
                height={Math.max(h, d.value > 0 ? 2 : 1)}
                rx={2}
                fill={d.value > 0 ? 'rgb(var(--accent))' : 'rgb(var(--line))'}
              >
                <title>{`${d.label}: ${d.value} ${unit}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={i * (8 + gap)} y={height + 13} fontSize="7" fill="rgb(var(--muted))">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function HourHeat({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="grid grid-cols-12 gap-1" role="img" aria-label="Distribuzione degli ascolti per ora del giorno">
      {values.map((v, hour) => (
        <div key={hour} className="space-y-1">
          <div
            className="h-8 rounded"
            style={{ backgroundColor: `rgb(var(--accent) / ${v === 0 ? 0.07 : 0.2 + (v / max) * 0.8})` }}
            title={`${String(hour).padStart(2, '0')}:00 — ${v} min`}
          />
          {hour % 3 === 0 && <div className="text-[9px] text-muted text-center">{hour}</div>}
        </div>
      ))}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
