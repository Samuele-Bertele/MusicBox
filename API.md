# Cataloghi musicali

## Come sono stati valutati

Per ogni fonte considerata: ricerca, metadati, copertine, preview, **streaming
completo**, licenza, limiti, uso personale.

| Fonte | Ricerca | Metadati | Copertine | Streaming completo | Licenza | Verdetto |
|---|---|---|---|---|---|---|
| **Jamendo v3.0** | ✅ | ✅ | ✅ | ✅ MP3 diretto | CC + licenza Jamendo | **Provider principale** |
| **Internet Archive** (netlabels) | ✅ | ✅ | ✅ | ✅ MP3 diretto | Per item, dichiarata | **Fallback** |
| Spotify Web API | ✅ | ✅ | ✅ | ❌ solo preview 30 s | Proprietaria | Scartato: niente streaming |
| Deezer API | ✅ | ✅ | ✅ | ❌ solo preview 30 s | Proprietaria | Scartato: niente streaming |
| Last.fm | ✅ | ✅ | ⚠️ | ❌ mai | — | Scartato: solo metadati |
| MusicBrainz | ✅ | ✅ | via CAA | ❌ mai | Dati CC0 | Scartato: solo metadati |
| Free Music Archive | ⚠️ API pubblica dismessa | ✅ | ✅ | ⚠️ | CC | Scartato: API non affidabile |
| YouTube / youtube-dl | — | — | — | ❌ viola i ToS | — | **Escluso dal brief** |

Regola rispettata alla lettera: una fonte che fornisce solo metadati viene
usata solo per i metadati, e l'app non finge mai che offra streaming. Il campo
`canStream` del provider è la dichiarazione esplicita di questa distinzione.

---

## Jamendo (provider principale)

- Base: `https://api.jamendo.com/v3.0/`
- Autenticazione: `client_id` in query string. È un identificatore **pubblico**:
  l'API di lettura è pensata per essere chiamata dal browser. Non è un segreto
  e metterlo nel bundle è corretto.
- Piano: *read only*, gratuito, senza carta di credito.
- Soglia: Jamendo invia un avviso oltre 500.000 chiamate al mese e chiede di
  usare una cache. L'app ne fa dell'ordine di poche centinaia al mese per un
  uso quotidiano: siamo tre ordini di grandezza sotto.
- Limite per chiamata: `limit` massimo 200.
- Codice di errore 6 = rate limit; l'app lo traduce in un messaggio leggibile
  e non ritenta all'infinito.

Endpoint usati: `/tracks/`, `/artists/`, `/albums/`, `/albums/tracks/`,
`/artists/albums/`, `/playlists/`, `/autocomplete/`.

Campi rilevanti del brano: `audio` (URL MP3 diretto), `audiodownload_allowed`
(booleano: se è falso il download **non** va offerto), `license_ccurl`,
`album_image`, `musicinfo.tags.genres`.

**Obblighi dei termini d'uso, rispettati dall'app:** uso non commerciale;
credito all'artista e a Jamendo come fornitore; link diretto da ogni brano alla
sua pagina su jamendo.com (player a schermo intero e voce "Apri pagina
originale" nel menu di ogni brano); nessuna cache dell'audio e nessun accesso
offline; la parola "jamendo" non compare nel nome dell'app.

**Nessun metodo di scrittura viene usato**, quindi nessun OAuth, nessun secret,
nessun token da proteggere.

## Internet Archive (fallback)

- Ricerca: `https://archive.org/advancedsearch.php?...&output=json`
- Metadati: `https://archive.org/metadata/<identifier>`
- Stream: `https://archive.org/download/<identifier>/<file>`
- Nessuna chiave, nessuna quota pubblicata, CORS abilitato.

L'ambito è volutamente ristretto alla collezione **netlabels**: audio caricato
dalle etichette stesse per la distribuzione libera, con una `licenseurl` su
ogni item. L'Archive ospita anche materiale con diritti di streaming poco
chiari, e quel materiale non viene mai cercato.

Vengono considerati solo i file in formato `VBR MP3`, `128Kbps MP3`,
`64Kbps MP3`, `MP3`. `downloadAllowed` è sempre `false`: lo streaming è
consentito, la copia offline non viene assunta.

---

## Aggiungere un provider

1. Crea `src/services/providers/<nome>.ts` e implementa `MusicProvider`.
2. Normalizza tutto nei tipi di `src/types/index.ts` — id nella forma
   `provider:idEsterno`.
3. Dichiara `canStream` onestamente e compila `licenseNote`.
4. Registralo in `src/services/providers/index.ts` e aggiungi il suo id a
   `ProviderId`.

Non serve toccare nessun componente React.

### Errori

`ProviderError` classifica il guasto in `rate_limit`, `not_found`, `network`,
`unavailable`, `unknown`. La UI non mostra mai il messaggio tecnico: traduce in
"Questo brano non è attualmente disponibile", "Il servizio musicale non
risponde", "Riprova tra qualche secondo".

### Cache e limiti applicati dall'app

| Contenuto | TTL | Note |
|---|---|---|
| Ricerche | 30 min | Persistita in localStorage |
| Contenuti in evidenza / per genere | 60 min | Cambiano di rado |
| Metadati item Archive | 6 h | Immutabili in pratica |
| Autocomplete | 60 min | — |

Rate limit lato client: Jamendo 2 req/s (burst 8), Archive 1,5 req/s (burst 5).
Richieste identiche concorrenti condividono una sola chiamata di rete.
