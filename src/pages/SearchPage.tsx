import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { Album, Artist, Track } from '@/types';
import { getPrimaryProvider } from '@/services/providers';
import { useDebounce } from '@/hooks/useDebounce';
import { useLibrary } from '@/services/LibraryProvider';
import { usePlayer } from '@/player/PlayerProvider';
import { filterAlbums, filterArtists, splitByRelevance } from '@/utils/relevance';
import { TrackRow } from '@/components/TrackRow';
import { AlbumCard, ArtistCard, Shelf } from '@/components/cards';
import { Artwork, EmptyState, ErrorState, RowsSkeleton } from '@/components/ui';

export function SearchPage() {
  const { store } = useLibrary();
  const player = usePlayer();

  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loose, setLoose] = useState<Track[]>([]);
  const [showLoose, setShowLoose] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
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
      setTracks(null);
      setLoose([]);
      setArtists([]);
      setAlbums([]);
      setSuggestions([]);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    setError(null);
    setShowLoose(false);
    const provider = getPrimaryProvider();

    // Tracks first and on their own: they are what the page is for, and
    // waiting for artists and albums would triple the time to first result.
    provider
      .searchTracks(q, { signal, limit: 40 })
      .then((found) => {
        if (signal.aborted) return;
        const { matching, loose: rest } = splitByRelevance(found, q);
        setTracks(matching);
        setLoose(rest);
        void store?.pushSearchHistory(q).then(loadRecent);

        // Secondary sections load afterwards, without blocking the list.
        void provider
          .searchArtists(q, { signal, limit: 10 })
          .then((rows) => !signal.aborted && setArtists(filterArtists(rows, q)))
          .catch(() => undefined);
        void provider
          .searchAlbums(q, { signal, limit: 10 })
          .then((rows) => !signal.aborted && setAlbums(filterAlbums(rows, q)))
          .catch(() => undefined);
        void provider
          .autocomplete(q, { signal, limit: 6 })
          .then((rows) => !signal.aborted && setSuggestions(rows))
          .catch(() => undefined);
      })
      .catch(() => {
        if (signal.aborted) return;
        setTracks([]);
        setError('Il servizio musicale non risponde. Riprova tra qualche secondo.');
      })
      .finally(() => !signal.aborted && setLoading(false));

    return () => controller.abort();
  }, [debounced, store, loadRecent]);

  const topResult = tracks?.[0] ?? null;
  const trimmed = query.trim();

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

      {suggestions.length > 0 && trimmed.length >= 2 && (
        <div className="flex flex-wrap gap-2 -mt-4">
          {suggestions.map((s) => (
            <button key={s} className="btn-outline h-8 px-3 text-xs" onClick={() => setQuery(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!trimmed && (
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
            description="Il catalogo è musica indipendente con licenza aperta: cerca per genere, strumento o atmosfera più che per titoli commerciali."
          />
        </>
      )}

      {loading && tracks === null && <RowsSkeleton />}

      {error && <ErrorState message={error} onRetry={() => setQuery((q) => `${q} `.trim())} />}

      {tracks && !error && (
        <div className="space-y-9">
          {tracks.length === 0 ? (
            <>
              <EmptyState
                title={`Nessuna corrispondenza per "${trimmed}"`}
                description="Il catalogo contiene musica pubblicata con licenza aperta, quindi i brani delle etichette commerciali non ci sono. Prova con un genere, uno strumento o un'atmosfera."
              />
              {loose.length > 0 && (
                <section className="space-y-2">
                  <button className="btn-ghost h-9" onClick={() => setShowLoose((v) => !v)} aria-expanded={showLoose}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showLoose ? 'rotate-180' : ''}`} />
                    {showLoose ? 'Nascondi' : `Mostra ${loose.length} risultati vagamente correlati`}
                  </button>
                  {showLoose && (
                    <div>
                      {loose.map((t, i) => (
                        <TrackRow key={t.id} track={t} index={i} tracks={loose} contextLabel={`Ricerca: ${trimmed}`} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              {topResult && (
                <section className="space-y-3">
                  <h2>Risultato principale</h2>
                  <button
                    className="surface-card w-full max-w-md p-4 flex items-center gap-4 text-left hover:bg-elevated transition-colors"
                    onClick={() => player.playTracks(tracks, 0, `Ricerca: ${trimmed}`)}
                  >
                    <Artwork src={topResult.artwork} alt="" className="h-20 w-20 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-lg truncate">{topResult.title}</span>
                      <span className="block text-sm text-muted truncate">{topResult.artist.name}</span>
                    </span>
                  </button>
                </section>
              )}

              <section className="space-y-2">
                <h2>Brani</h2>
                <div>
                  {tracks.slice(0, 25).map((t, i) => (
                    <TrackRow key={t.id} track={t} index={i} tracks={tracks} contextLabel={`Ricerca: ${trimmed}`} />
                  ))}
                </div>
              </section>

              {artists.length > 0 && (
                <Shelf title="Artisti">
                  {artists.map((a) => (
                    <ArtistCard key={a.id} artist={a} />
                  ))}
                </Shelf>
              )}

              {albums.length > 0 && (
                <Shelf title="Album">
                  {albums.map((a) => (
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
