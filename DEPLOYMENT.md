# Pubblicazione

Obiettivo: aprire un URL dal telefono e ascoltare musica, senza spendere
niente e senza inserire una carta di credito.

Tempo richiesto: **circa 10 minuti.**

---

## Passo 1 — Il client_id di Jamendo (2 minuti, consigliato)

1. Vai su <https://devportal.jamendo.com> e registrati (email e password, niente carta).
2. Crea un'applicazione: nome `musicbox`, descrizione "lettore musicale personale".
3. Copia il **Client ID**. Resta sul piano *read only*: è quello che serve.

Senza questo passo l'app funziona lo stesso, ma usa l'id pubblico di test che
Jamendo condivide fra tutti gli sviluppatori: prima o poi incontrerai il rate
limit.

## Passo 2 — Metti il codice su GitHub

```bash
git init
git add .
git commit -m "musicbox"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/musicbox.git
git push -u origin main
```

Il file `.gitignore` esclude già `.env` e `node_modules`.

## Passo 3 — Pubblica su Cloudflare Pages (5 minuti)

Cloudflare Pages è la scelta consigliata: niente carta di credito, banda
illimitata, build gratuite, HTTPS e dominio `*.pages.dev` inclusi.

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages**
   → **Connect to Git**.
2. Autorizza GitHub e scegli il repository `musicbox`.
3. Configurazione della build:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables** → aggiungi `VITE_JAMENDO_CLIENT_ID` con il valore
   del passo 1.
5. **Save and Deploy**.

Dopo un paio di minuti hai `https://musicbox-xxx.pages.dev`. Ogni `git push`
ripubblica da solo.

### Indispensabile: il routing SPA

L'app usa percorsi come `/search` e `/album/jamendo:123`. Senza questa regola,
ricaricare una pagina diversa dalla Home dà 404. Il file è già nel progetto:

```
public/_redirects
```
```
/*    /index.html   200
```

> Su **Netlify** vale lo stesso file. Su **Vercel** serve invece
> `vercel.json` con un rewrite `"/(.*)" → "/index.html"` — incluso anch'esso.

## Passo 4 — Installa la PWA sul Galaxy S24

1. Apri l'URL in **Chrome** su Android.
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").
3. L'icona compare fra le app. Si apre a schermo intero, senza barra del browser.

I controlli multimediali Android (notifica, lock screen, tasti delle cuffie)
funzionano non appena avvii una riproduzione con un tap.

---

## Opzionale — Supabase per sincronizzare fra dispositivi

Serve solo se vuoi ritrovare playlist e preferiti anche su un altro
dispositivo. Senza, tutto funziona in locale.

1. <https://supabase.com> → nuovo progetto, piano **Free** (niente carta).
2. **SQL Editor** → incolla ed esegui tutto `supabase/schema.sql`.
3. **Authentication** → **Providers** → Email abilitato. Per uso personale
   conviene disattivare *Confirm email*, così l'accesso è immediato.
4. **Project Settings** → **API** → copia *Project URL* e *anon public key*.
5. Aggiungi su Cloudflare Pages:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Redeploy.

La anon key è pubblica per progettazione: tutte le tabelle hanno Row Level
Security, quindi una sessione vede solo le proprie righe. La chiave
`service_role` non va **mai** messa nel frontend.

Il piano gratuito mette in pausa i progetti inattivi da una settimana: basta
riaprire la dashboard per riattivarlo. Se la usi ogni giorno non succede.

---

## Verifica prima di considerarlo fatto

```bash
npm run build      # deve completare senza errori
npm test           # 37 test verdi
npm run preview    # controlla dist/ in locale
```

Dopo il deploy, sul telefono:

- [ ] L'URL si apre in HTTPS
- [ ] Login riuscito
- [ ] La Home mostra contenuti
- [ ] La ricerca restituisce risultati
- [ ] Un brano parte e la barra avanza
- [ ] La musica continua cambiando pagina
- [ ] La notifica Android mostra titolo e copertina
- [ ] Pausa e avanti funzionano dal lock screen
- [ ] Like, playlist e cronologia si salvano
- [ ] Ricaricando `/search` non compare un 404
- [ ] La PWA si installa

## Se qualcosa va storto

| Sintomo | Causa | Rimedio |
|---|---|---|
| 404 ricaricando una sottopagina | Manca la regola SPA | Verifica `public/_redirects` o `vercel.json` |
| La Home resta vuota | Rate limit dell'id di test | Imposta `VITE_JAMENDO_CLIENT_ID` e ripubblica |
| Build fallita su "process is not defined" | Variabile senza prefisso `VITE_` | Rinominala |
| Nessun controllo su lock screen | Sito in HTTP o riproduzione non avviata da un tap | Usa HTTPS, avvia con un tap |
| Supabase: "not_authenticated" | Sessione scaduta | Esci e rientra; l'app intanto usa lo store locale |
