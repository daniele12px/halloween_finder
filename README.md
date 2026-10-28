# 🎃 Halloween Finder

Una mappa gratuita che aiuta i bambini a trovare le case dove fare **dolcetto o scherzetto** la sera di Halloween.

Le famiglie che vogliono partecipare aggiungono la propria casa con un tocco, i bambini (con un adulto) aprono la mappa dal telefono e vedono dove suonare. Nato a Guidizzolo (MN) e pensato per essere copiato da qualsiasi comune, quartiere o condominio.

> Un progetto di [Dodicipixel](https://www.dodicipixel.com) per la comunità.

## Come funziona

- **Niente account, niente password.** Chi aggiunge una casa sceglie un soprannome divertente (non serve il cognome), indica la via o tocca il punto sulla mappa. Il telefono ricorda da solo che quella casa è sua e permette di rimuoverla con un tocco.
- **Privacy prima di tutto.** Non vengono chiesti nomi, email o numeri di telefono. La posizione dei bambini ("Dove sono?") resta sul telefono e non viene mai inviata o salvata. La mappa passa dal sito stesso, quindi nessun indirizzo IP arriva a servizi pubblicitari.
- **Si pulisce da solo.** L'elenco delle case viene cancellato automaticamente circa due settimane dopo l'ultima modifica, e ognuno può togliere la propria casa quando vuole.
- **Gratis.** Gira sul piano gratuito di Cloudflare, di solito più che sufficiente per un comune.

## Lo voglio nel mio comune: fatti aiutare da un assistente AI

Non serve saper programmare. Ti servono un account [GitHub](https://github.com) e un account [Cloudflare](https://www.cloudflare.com) (entrambi gratuiti) e un assistente AI di ultima generazione (Claude, ChatGPT, Gemini o simili). Se l'assistente può lavorare su file e browser (per esempio Claude in modalità agente o Codex) farà lui quasi tutto; se è una semplice chat ti guiderà passo passo.

Copia questo testo, scrivi al posto dei puntini il tuo comune e incollalo nell'assistente:

```text
Voglio pubblicare per il mio comune il progetto open source "Halloween Finder":
https://github.com/daniele12px/halloween_finder

Il mio comune è: ........ (provincia: ........)

Non sono uno sviluppatore. Guidami con parole semplici, un passaggio alla volta, e
aspetta la mia conferma prima di passare al successivo. Se hai strumenti per lavorare
su file, GitHub e browser, fai tu tutto quello che puoi e chiedimi solo le cose che
posso fare solo io (accedere ai miei account, premere conferme).

Prima di iniziare leggi il README e il codice del repository, e controlla la
documentazione ufficiale aggiornata di Cloudflare Pages, perché i menu cambiano.

Cosa devi fare:

1. Crea una copia ("fork") del progetto sul mio account GitHub.

2. Adattalo al mio comune. Cerca nel codice "Guidizzolo" e cambia nome, titolo e
   testi. Trova su OpenStreetMap le coordinate del centro del mio comune e chiedimi
   conferma prima di usarle. Aggiorna centro, raggio massimo e elenco delle vie
   principali. I punti da toccare sono: public/index.html, public/app.js,
   public/manifest.json, functions/_lib/store.js, functions/api/houses.js e
   functions/api/reverse-geocode.js. Nel file functions/tiles/[[path]].js cambia
   anche l'indirizzo GitHub nello USER_AGENT con quello del mio fork.

3. Pubblicalo su Cloudflare Pages collegandolo al mio fork: nessun comando di build,
   cartella di output "public". Poi crea uno spazio dati KV e collegalo al progetto
   con il nome ESATTO "HOUSES_KV" (sia per produzione sia per anteprima), quindi
   rifai il deploy. Non aggiungere "pages_build_output_dir" al file wrangler.toml:
   altrimenti non potrei collegare lo spazio dati dal pannello.

4. Collauda il sito pubblicato: apri la mappa, aggiungi una casa di prova, controlla
   che compaia, poi rimuovila.

5. Dammi l'indirizzo del sito e un breve testo da condividere con le famiglie.

Regole: non chiedermi mai di scriverti password o token in chat; non inserire dati
personali di nessuno; usa solo servizi gratuiti (se Cloudflare mi chiede una carta di
pagamento, fermati e avvisami); non cambiare altro oltre a quanto indicato.
```

## Per chi sviluppa

Il progetto è un sito statico (cartella `public/`) più alcune funzioni Cloudflare Pages (cartella `functions/`). Non ci sono dipendenze da installare.

| Percorso | Cosa fa |
| --- | --- |
| `public/` | L'app: pagina, mappa (Leaflet, incluso in `vendor/`), stile, service worker |
| `functions/api/houses.js` | Elenco pubblico delle case e registrazione di una nuova casa |
| `functions/api/houses/[id].js` | Rimozione di una casa (serve il codice segreto del proprietario) |
| `functions/api/houses/[id]/manage.js` | Controllo del link personale di gestione |
| `functions/api/reverse-geocode.js` | Da coordinate a nome della via più vicina |
| `functions/tiles/[[path]].js` | Mappa OpenStreetMap servita dal nostro sito, con cache e limite alla zona del comune |
| `functions/_lib/store.js` | Archivio KV e impostazioni (centro, raggio, limiti) |

Le case sono salvate in Cloudflare KV, nello spazio con binding `HOUSES_KV`. Per provare tutto sul proprio computer:

```bash
npx wrangler pages dev public --kv HOUSES_KV
```

### Limiti noti

- L'intero elenco è in un'unica chiave KV: se due persone registrano una casa nello stesso istante, una delle due può andare persa e dovrà riprovare. Va bene per un comune o per un evento di una sera, non per carichi grandi.
- Non c'è un limite di richieste per utente; c'è solo un tetto massimo di 500 case e un raggio massimo dal centro del comune.
- Cancellare "dopo due settimane" significa 14 giorni dopo l'ultima modifica all'elenco (è la scadenza della chiave KV).

## Crediti e licenza

Mappe © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Libreria di mappe [Leaflet](https://leafletjs.com) (licenza BSD-2). Codice sotto licenza [MIT](LICENSE): puoi usarlo, copiarlo e modificarlo liberamente.
