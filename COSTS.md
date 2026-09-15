# Costi

## Garanzia costo zero

| Servizio | Piano | Costo | Limite del piano | Utilizzo stimato (uso quotidiano) |
|---|---|---|---|---|
| **Jamendo API** | Read only | **0 €** | Avviso oltre 500.000 chiamate/mese | ~300–900 chiamate/mese (< 0,2%) |
| **Internet Archive** | Pubblico | **0 €** | Nessuna quota pubblicata | Solo come fallback |
| **Cloudflare Pages** | Free | **0 €** | 500 build/mese, banda illimitata | ~10 build/mese |
| **Supabase** *(opzionale)* | Free | **0 €** | 500 MB database, 50.000 utenti attivi | < 5 MB, 1 utente |
| **Supabase Auth** *(opzionale)* | Free | **0 €** | Incluso | 1 account |
| **IndexedDB** (predefinito) | Browser | **0 €** | Quota del dispositivo (centinaia di MB) | ~2–10 MB |
| **Storage / CDN** | Incluso in Pages | **0 €** | — | ~700 kB di asset statici |
| **Dominio** | `*.pages.dev` | **0 €** | — | Nessun acquisto |
| **Analytics** | `telemetry.ts`, in locale | **0 €** | localStorage | ~20 kB |
| **Email** | Supabase Auth | **0 €** | Limiti del piano free | Solo alla registrazione |
| **Backend** | Nessuno | **0 €** | — | L'app è interamente client-side |

> **COSTO MENSILE = 0 €**
> **COSTO ANNUALE = 0 €**

Nessun trial che si converte in abbonamento. Nessuna carta di credito
richiesta per la configurazione consigliata (Cloudflare Pages + Jamendo +
IndexedDB).

## Come viene mantenuto zero

**Il percorso predefinito non ha backend.** Senza Supabase l'app è un sito
statico più IndexedDB: non esiste niente da scalare e quindi niente da pagare.

**Le chiamate API sono poche per progetto, non per caso.** Token bucket, cache
TTL persistita, deduplicazione delle richieste in volo, nessun polling. Una
sessione di ascolto di un'ora costa qualche decina di chiamate, non centinaia.

**Il database scrive poco per progetto.** La cronologia usa 5 eventi per brano
invece di uno al secondo: circa il 97% di scritture in meno. Il volume viene
salvato con debounce. Le liste sono paginate. Niente query senza indice.

**I limiti sono visibili.** La pagina *Stato del sistema* mostra richieste del
mese, tasso di cache, errori, rate limit, letture e scritture, spazio occupato
e percentuale della soglia Jamendo. Se qualcosa si avvicina a un limite, lo
vedi prima che diventi un problema.

## Cosa succede se superi un limite

| Limite | Effetto | Reazione dell'app |
|---|---|---|
| Rate limit Jamendo | Codice 6 | Messaggio leggibile, backoff esponenziale, cache che copre il grosso |
| Pausa progetto Supabase (7 giorni inattivo) | Database sospeso | `getStore()` degrada a IndexedDB, l'app continua |
| Quota IndexedDB piena | Scrittura rifiutata | Cronologia potata a 5.000 eventi, cache TTL sacrificabile |
| Build Cloudflare esaurite | Deploy in coda | Nessun effetto sull'app già pubblicata |

## Cosa è stato escluso per non pagare

| Funzione | Perché costerebbe | Alternativa adottata |
|---|---|---|
| Raccomandazioni con LLM | API a pagamento | Motore di scoring locale |
| Storage di copertine proprie | Bucket a pagamento | Copertine servite dal catalogo |
| Analytics di prodotto | Piani a consumo | Contatori locali in localStorage |
| Push notification | Serve un backend | Media Session, che è nativa e gratuita |
| Dominio personalizzato | ~10 €/anno | Sottodominio `pages.dev` |
| Selettore di qualità audio | Nessun catalogo gratuito espone più profili | Qualità pubblicata dal catalogo, dichiarato nelle impostazioni |
