/**
 * Tiny, dependency-free usage counters. Everything lives in localStorage and
 * is aggregated per UTC day, so the System Status page can estimate free-tier
 * consumption without a single extra network or database call.
 */
export interface DayStats {
  day: string;
  requests: number;
  cacheHits: number;
  dedupedHits: number;
  errors: number;
  rateLimited: number;
  dbWrites: number;
  dbReads: number;
}

const KEY = 'mb.telemetry.v1';
const KEEP_DAYS = 45;

const today = () => new Date().toISOString().slice(0, 10);

function read(): DayStats[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DayStats[]) : [];
  } catch {
    return [];
  }
}

function write(rows: DayStats[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-KEEP_DAYS)));
  } catch {
    /* storage full or unavailable — telemetry must never break playback */
  }
}

export function bump(field: Exclude<keyof DayStats, 'day'>, by = 1) {
  const rows = read();
  const day = today();
  let row = rows.find((r) => r.day === day);
  if (!row) {
    row = { day, requests: 0, cacheHits: 0, dedupedHits: 0, errors: 0, rateLimited: 0, dbWrites: 0, dbReads: 0 };
    rows.push(row);
  }
  row[field] += by;
  write(rows);
}

export function getStats(): DayStats[] {
  return read();
}

export function getMonthTotals(): DayStats {
  const month = today().slice(0, 7);
  const base: DayStats = { day: month, requests: 0, cacheHits: 0, dedupedHits: 0, errors: 0, rateLimited: 0, dbWrites: 0, dbReads: 0 };
  for (const r of read()) {
    if (!r.day.startsWith(month)) continue;
    base.requests += r.requests;
    base.cacheHits += r.cacheHits;
    base.dedupedHits += r.dedupedHits;
    base.errors += r.errors;
    base.rateLimited += r.rateLimited;
    base.dbWrites += r.dbWrites;
    base.dbReads += r.dbReads;
  }
  return base;
}

export function resetStats() {
  write([]);
}
