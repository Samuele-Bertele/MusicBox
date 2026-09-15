# musicbox

Lettore musicale personale — web app + PWA installabile su Android — costruito
esclusivamente su cataloghi che concedono **esplicitamente** lo streaming.

Costo di esercizio: **0 €/mese, 0 €/anno**, senza carta di credito e senza
trial che scadono. Vedi [COSTS.md](./COSTS.md).

---

## Leggi prima questo

L'app fa tutto quello che ti aspetti da un lettore musicale moderno: ricerca,
player persistente, coda, playlist, preferiti, cronologia, statistiche,
raccomandazioni, controlli multimediali Android, installazione come PWA.

**Quello che non può fare è avere il catalogo di Spotify.** Non esiste, oggi,
nessuna API gratuita e legale che permetta lo streaming di musica commerciale
sotto licenza delle major. Le opzioni erano tre:

| Strada | Verdetto |
|---|---|
| Spotify Web API | Fornisce metadati e preview da 30 s. Lo streaming completo richiede l'SDK con account Premium dell'utente e non è ridistribuibile. Escluso dal brief. |
| YouTube / scraping / endpoint privati | Violerebbe i ToS e, nel caso del DRM, la legge. Escluso esplicitamente dal brief. |
| Cataloghi con licenza aperta | Streaming completo, legale, gratuito. **Scelto.** |

Il catalogo quindi è musica indipendente, Creative Commons e netlabel: circa
600.000 brani su Jamendo più le collezioni netlabel dell'Internet Archive. È
musica vera, ben registrata, con generi e artisti — ma non ci troverai
Kendrick Lamar. Questo è un limite del diritto d'autore, non dell'app: il
livello `MusicProvider` è astratto proprio perché il giorno in cui avrai
accesso a un catalogo diverso si sostituisce un file solo.

---

## Avvio rapido

```bash
npm install
npm run dev          # http://localhost:5173
```

Non serve configurare niente: l'app parte, cerca, riproduce e salva la
libreria in locale. Le variabili d'ambiente servono solo a migliorare le cose.

```bash
cp .env.example .env        # opzionale
```

| Variabile | Serve a | Se manca |
|---|---|---|
| `VITE_JAMENDO_CLIENT_ID` | Il tuo id gratuito Jamendo | Usa l'id pubblico di test, molto limitato |
| `VITE_DEFAULT_PROVIDER` | Catalogo di partenza | `jamendo` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Sincronizzazione fra dispositivi | Tutto resta in IndexedDB su questo dispositivo |

Prendi il client_id su <https://devportal.jamendo.com> — account gratuito,
niente carta, piano "read only". Ci vogliono due minuti e vale la pena farlo:
l'id di test è condiviso da tutti gli sviluppatori che provano l'API.

### Script

```bash
npm run dev        # sviluppo
npm run build      # type-check + build di produzione in dist/
npm run preview    # serve dist/ in locale
npm test           # 37 test unitari e di integrazione
```

---

## Stack e perché

| Scelta | Motivo |
|---|---|
| React 18 + TypeScript + Vite | Build veloce, tipi su tutto il dominio, zero configurazione |
| Tailwind CSS 3 | Nessun CSS morto nel bundle, token di tema in variabili CSS |
| React Router 7 | Il player sta nel layout, fuori da `<Outlet />`: navigare non lo smonta mai |
| IndexedDB | Database gratuito, offline, senza account e senza limiti di righe |
| Supabase (opzionale) | Postgres + Auth gratuiti quando vuoi sincronizzare |
| Nessuna libreria di grafici | I due grafici sono ~80 righe di SVG invece di 100 kB di dipendenza |
| Nessuna libreria di stato | `useReducer` + context bastano; il reducer della coda è testabile da solo |

Bundle iniziale: **~99 kB gzip**. L'SDK Supabase (59 kB gzip) viene scaricato
solo da chi lo configura davvero.

---

## Funzionalità

**Player** — play/pausa, precedente/successivo, seek preciso, volume, mute,
shuffle, ripeti off/tutti/uno, coda completa, riproduci dopo, aggiungi in coda,
riordina, salva la coda come playlist. Il player sopravvive alla navigazione e
continua in background.

**Android** — Media Session API: titolo, artista e copertina nella notifica,
controlli da lock screen e da cuffie, `setPositionState` per la barra di
avanzamento del sistema. Ogni handler non supportato dal browser degrada senza
rompere nulla.

**Libreria** — preferiti con ricerca, ordinamento e filtro; playlist con
rinomina, descrizione, riordino, duplicazione, ordinamento e ricerca interna;
album salvati; artisti seguiti; playlist automatiche (Preferiti, Recenti, Più
ascoltati).

**Cronologia e statistiche** — eventi a milestone (avvio, 25%, 50%, 75%,
completato, saltato) invece del tracciamento al secondo: stesse statistiche,
un ventesimo delle scritture. Dashboard con minuti ascoltati, brani, artisti,
album, generi, top, streak, giorno più attivo, ora preferita, durata media, su
sei periodi.

**Raccomandazioni** — motore locale, nessuna AI a pagamento. Costruisce un
profilo di gusto pesato per recency (emivita 21 giorni) da generi, artisti,
completamenti, skip, like e frequenza, poi assegna uno score ai candidati del
catalogo.

**Smart shuffle** — non è `Math.random()`: sceglie in modo greedy penalizzando
lo stesso artista, lo stesso album, lo stesso genere e i brani appena
ascoltati. C'è un test che verifica che disperda gli artisti meglio di un
Fisher–Yates.

**PWA** — manifest, icone, service worker, installabile, funziona con rete
lenta. Lo stream audio **non** viene mai messo in cache: sarebbe una copia
offline, che non tutti i titolari di diritti concedono.

---

## Documentazione

- [ARCHITECTURE.md](./ARCHITECTURE.md) — livelli, flusso dei dati, decisioni
- [API.md](./API.md) — provider musicali, licenze, limiti, contratto `MusicProvider`
- [DEPLOYMENT.md](./DEPLOYMENT.md) — pubblicazione gratuita passo per passo
- [COSTS.md](./COSTS.md) — tabella servizio/piano/costo/limite/utilizzo
- [supabase/schema.sql](./supabase/schema.sql) — schema, indici, RLS, trigger

---

## Risoluzione dei problemi

**"Il servizio musicale non risponde"** — Jamendo è momentaneamente giù o hai
superato il rate limit dell'id di test. Registra un client_id tuo.

**Un brano non parte** — il catalogo ha ritirato il file. L'app lo segnala e
passa oltre: `getStreamUrl()` prova a ri-risolvere l'URL prima di arrendersi.

**Niente controlli sul lock screen Android** — servono HTTPS (in produzione
c'è sempre) e una riproduzione avviata da un tap. Chrome su Android li mostra;
alcuni browser alternativi no.

**La PWA non si installa** — serve HTTPS e una visita precedente. Su Chrome
Android: menu ⋮ → "Installa app".

**La libreria è sparita** — in modalità locale i dati stanno in IndexedDB di
quel browser: cancellare i dati del sito li cancella. Impostazioni → Dati →
Esporta, oppure configura Supabase.

---

## Licenze

Il codice è tuo. La musica no: ogni brano resta sotto la licenza del suo
autore, linkata dal player a schermo intero. L'app non aggira DRM, non scarica
contenuti protetti, non usa endpoint non documentati e non condivide account.
