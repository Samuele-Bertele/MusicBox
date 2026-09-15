import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchResults } from '@/types';
import { getPrimaryProvider, withFallback } from '@/services/providers';
import { useDebounce } from '@/hooks/useDebounce';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { TrackRow } from '@/components/TrackRow';
import { AlbumCard, ArtistCard, Shelf } from '@/components/cards';
import { Artwork, EmptyState, ErrorState, RowsSkeleton } from '@/components/ui';

const EMPTY: SearchResults = { tracks: [], artists: [], albums: [], playlists: [] };

export function SearchPage() {
  const { store } = useLibrary();
  const player = usePlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounce(query, 350);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRecent = useCallback(async () => {
    if (store) setRecent((await store.listSearchHistory()).map((r) => r.query));
  }, [store]);

  useEffect(() => {
    void loadRecent();
    inputRef.current?.focus();
  }, [loadRecent]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults(null);
      setSuggestions([]);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    void getPrimaryProvider()
      .autocomplete(q, { signal: controller.signal, limit: 6 })
      .then(setSuggestions)
      .catch(() => setSuggestions([]));

    withFallback(
      (p) => p.search(q, { signal: controller.signal, limit: 30 }),
      (v) => v.tracks.length === 0 && v.artists.length === 0 && v.albums.length === 0,
    )
      .then(({ value }) => {
        if (controller.signal.aborted) return;
        setResults(value);
        void store?.pushSearchHistory(q).then(loadRecent);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResults(EMPTY);
        setError('Il servizio musicale non risponde. Riprova tra qualche secondo.');
      })
      .finally(() => !controller.signal.aborted && setLoading(false));

    return () => controller.abort();
  }, [debounced, store, loadRecent]);

  const topResult = results?.tracks[0] ?? null;

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          ref={inputRef}
          className="field pl-10 pr-10 h-12"
          placeholder="Cosa vuoi ascoltare?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cerca brani, artisti e album"
          type="search"
          autoComplete="off"
        />
        {query && (
          <button className="icon-btn absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setQuery('')} aria-label="Cancella la ricerca">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {suggestions.length > 0 && query.trim().length >= 2 && (
        <div className="flex flex-wrap gap-2 -mt-4">
          {suggestions.map((s) => (
            <button key={s} className="btn-outline h-8 px-3 text-xs" onClick={() => setQuery(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!query.trim() && (
        <>
          {recent.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2>Ricerche recenti</h2>
                <button
                  className="btn-ghost h-8 text-xs"
                  onClick={async () => {
                    await store?.clearSearchHistory();
                    setRecent([]);
                  }}
                >
                  Cancella cronologia
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button key={r} className="btn-outline h-9" onClick={() => setQuery(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Cerca nel catalogo"
            description="Brani, artisti e album da cataloghi liberamente ascoltabili. Bastano due lettere per iniziare."
          />
        </>
      )}

      {loading && !results && <RowsSkeleton />}

      {error && <ErrorState message={error} onRetry={() => setQuery((q) => `${q} `.trim())} />}

      {results && !error && (
        <div className="space-y-9">
          {results.tracks.length === 0 && results.artists.length === 0 && results.albums.length === 0 ? (
            <EmptyState title="Nessun risultato" description={`Nessuna corrispondenza per "${query.trim()}". Prova con un altro termine o un genere.`} />
          ) : (
            <>
              {topResult && (
                <section className="space-y-3">
                  <h2>Risultato principale</h2>
                  <button
                    className="surface-card w-full max-w-md p-4 flex items-center gap-4 text-left hover:bg-elevated transition-colors"
                    onClick={() => player.playTracks(results.tracks, 0, `Ricerca: ${query.trim()}`)}
                  >
                    <Artwork src={topResult.artwork} alt="" className="h-20 w-20 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-lg truncate">{topResult.title}</span>
                      <span className="block text-sm text-muted truncate">{topResult.artist.name}</span>
                    </span>
                  </button>
                </section>
              )}

              {results.tracks.length > 0 && (
                <section className="space-y-2">
                  <h2>Brani</h2>
                  <div>
                    {results.tracks.slice(0, 20).map((t, i) => (
                      <TrackRow key={t.id} track={t} index={i} tracks={results.tracks} contextLabel={`Ricerca: ${query.trim()}`} />
                    ))}
                  </div>
                </section>
              )}

              {results.artists.length > 0 && (
                <Shelf title="Artisti">
                  {results.artists.map((a) => (
                    <ArtistCard key={a.id} artist={a} />
                  ))}
                </Shelf>
              )}

              {results.albums.length > 0 && (
                <Shelf title="Album">
                  {results.albums.map((a) => (
                    <AlbumCard key={a.id} album={a} />
                  ))}
                </Shelf>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
