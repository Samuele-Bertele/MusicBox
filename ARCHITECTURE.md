# Architettura

## Livelli

```
┌──────────────────────────────────────────────────────────┐
│  UI            pages/ · components/ · layouts/           │
├──────────────────────────────────────────────────────────┤
│  Application   player/ · LibraryProvider · hooks/        │
│                recommendations · taste · shuffle · stats │
├──────────────────────────────────────────────────────────┤
│  Provider      services/providers/  → MusicProvider      │
├──────────────────────────────────────────────────────────┤
│  Database      services/db/         → DataStore          │
├──────────────────────────────────────────────────────────┤
│  Transporto    services/http/  rate limit · cache · dedupe│
└──────────────────────────────────────────────────────────┘
```

Due sole interfacce reggono tutto il sistema: `MusicProvider` (da dove arriva
la musica) e `DataStore` (dove finiscono i dati dell'utente). Nessun componente
React importa mai un provider concreto o un client di database.

## Struttura

```
src/
├── components/       UI riutilizzabile (card, righe, menu, stati, grafici)
├── pages/            una schermata per file
├── layouts/          AppLayout: sidebar + topbar + outlet + player + nav
├── player/           AudioEngine, queue reducer, PlayerProvider, UI del player
├── services/
│   ├── providers/    types.ts (contratto) · jamendo.ts · archive.ts · index.ts
│   ├── db/           types.ts (contratto) · backend.ts · local.ts · supabase.ts
│   ├── http/         client.ts (rate limit, cache TTL, dedupe) · telemetry.ts
│   ├── taste.ts      profilo di gusto e scoring
│   ├── shuffle.ts    smart shuffle e shuffle base
│   ├── stats.ts      aggregazione della cronologia
│   ├── recommendations.ts   costruzione degli scaffali della Home
│   ├── auth.ts       Supabase Auth oppure profilo locale
│   └── LibraryProvider.tsx  stato condiviso della libreria
├── hooks/            toast, debounce, media query, scorciatoie da tastiera
├── types/            modello di dominio
├── utils/            formattazione, validazione, id
└── test/             factory condivise per i test
```

## Il contratto MusicProvider

```ts
interface MusicProvider {
  id, label, canStream, licenseNote, isConfigured()
  search() searchTracks() searchArtists() searchAlbums() autocomplete()
  getTrack() getAlbum() getArtist()
  getFeaturedTracks() getTracksByGenre() getRecommendations()
  getStreamUrl() getArtwork()
}
```

`canStream` è la parte importante. Un catalogo che offre solo metadati lo
dichiara `false`, e il player si rifiuta di provarci mostrando un messaggio
onesto invece di fingere. Aggiungere un provider significa scrivere un file in
`services/providers/` e registrarlo in `index.ts`: nient'altro cambia.

### Fallback fra provider

`withFallback()` riprova la stessa operazione sul catalogo successivo **solo**
per query aperte — ricerca, contenuti in evidenza, raccomandazioni. Non
sostituisce mai un brano specifico con un'altra registrazione: se il brano che
hai chiesto non c'è, l'app lo dice.

## Il contratto DataStore

Due implementazioni interscambiabili:

- **LocalStore** — IndexedDB attraverso un `KeyValueBackend`, con fallback in
  memoria per il navigazione privata e per i test. Zero setup, zero costi,
  singolo dispositivo.
- **SupabaseStore** — PostgreSQL con RLS. Stessi metodi, stesse firme.

`getStore()` sceglie Supabase se è configurato **e** c'è una sessione, altrimenti
IndexedDB. Un errore di Supabase degrada a locale invece di rompere l'app.

## Il player

```
Track cambia
   │
   ├─ il brano precedente era sotto l'85% ──► evento "skipped"
   ├─ risolve lo stream URL (ri-risolve se scaduto)
   ├─ AudioEngine.load(url, autoplay)
   ├─ evento "play_started"
   └─ aggiorna MediaSession (metadata + handler + positionState)

timeupdate (throttlato a 4 Hz)
   └─ supera 25% / 50% / 75% ──► un evento ciascuno, una volta sola

ended
   ├─ evento "completed"
   └─ repeat one ? seek(0) : dispatch next
```

**Perché un solo `<audio>` per tutta la vita dell'app.** Su Android il
permesso di riprodurre in background e i controlli da lock screen sono legati
all'elemento che ha ricevuto il gesto dell'utente. Ricrearlo a ogni brano li
perde. È anche il motivo per cui non esiste un crossfade vero con
sovrapposizione: servirebbe un secondo elemento, che nascerebbe senza quel
permesso.

**Il reducer della coda** (`player/queue.ts`) è una funzione pura senza
dipendenze da React: nove test lo coprono direttamente, inclusi i casi
scivolosi (rimuovere un brano prima di quello corrente, spostare quello
corrente, spegnere lo shuffle e ritrovare l'ordine originale).

## Cronologia a milestone

Registrare ogni secondo significherebbe ~200 scritture per brano. L'app scrive
al massimo 5 eventi: `play_started`, `p25`, `p50`, `p75`, `completed` (oppure
`skipped`). I secondi ascoltati si ricavano dalla milestone più alta
raggiunta, e le statistiche raggruppano gli eventi dello stesso brano entro
una finestra di 15 minuti in un unico ascolto. Precisione più che sufficiente,
consumo di database irrisorio.

## Raccomandazioni

```
score =  0.38 · similarità_generi
       + 0.30 · similarità_artista
       + 0.12 · frequenza_ascolto
       +        bonus_like          (0.25 brano · 0.12 artista)
       +        bonus_completamento (max 0.20)
       −        penalità_skip       (max 0.60)
       −        penalità_recente    (0.25)
```

I pesi degli eventi sono scalati per recency con emivita di 21 giorni:
l'ultimo mese decide, l'anno scorso suggerisce appena. I generi con peso più
alto diventano i tag della query al catalogo; i risultati vengono poi
riordinati con lo score e ripuliti dai brani già noti.

## Controllo dei costi

- Token bucket per provider (Jamendo 2 req/s, burst 8) — mai una raffica.
- Cache TTL persistita in `localStorage`: 30 min per le ricerche, 1 h per i
  contenuti editoriali, 6 h per i metadati dell'Archive.
- Deduplicazione: richieste identiche in volo condividono una sola fetch.
- Nessun polling, nessun `setInterval` verso la rete.
- `timeupdate` throttlato a 4 Hz, volume persistito con debounce di 600 ms.
- Cronologia locale limitata a 5.000 eventi, su Postgres 20.000 per utente.
- Liste lunghe paginate a 20-30 elementi, immagini `loading="lazy"`.
- Ogni richiesta, hit di cache ed errore viene contata in `telemetry.ts` e
  mostrata nella pagina Stato del sistema.

## Sicurezza

- Nessun segreto nel frontend. Le uniche variabili sono identificatori
  pubblici per progetto (client_id Jamendo, anon key Supabase).
- Row Level Security su tutte le tabelle: `auth.uid() = user_id`, in `using` e
  in `with check`.
- Chiavi primarie composite `(user_id, …)`: una riga senza proprietario non
  può nemmeno esistere.
- Input sanificati prima della persistenza (controlli, `<`, `>`, lunghezze).
- Nessun `dangerouslySetInnerHTML`, nessun `eval`, nessuna costruzione di HTML
  da stringhe.
- Link esterni con `rel="noreferrer noopener"`.
- Solo HTTPS in uscita.
- Il service worker non tocca mai l'audio.
