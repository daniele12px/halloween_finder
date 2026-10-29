# 🎃 Halloween Finder

Una mappa gratuita che aiuta i bambini a trovare le case dove fare **dolcetto o scherzetto** la sera di Halloween.

Le famiglie che vogliono partecipare aggiungono la propria casa con un tocco, i bambini (con un adulto) aprono la mappa dal telefono e vedono dove suonare. Nato a Guidizzolo (MN) e pensato per essere copiato da qualsiasi comune, quartiere o condominio.

> Un progetto di [Dodicipixel](https://www.dodicipixel.com) per la comunità.

## Come funziona

- **Niente account, niente password.** Chi aggiunge una casa sceglie un soprannome divertente (non serve il cognome) e scrive via e numero civico: il sito mostra il punto sulla mappa e chi registra lo controlla (e lo sposta, se serve) prima di confermare. Il telefono ricorda da solo che quella casa è sua e permette di rimuoverla con un tocco. Alla fine compare un **codice casa** di 8 caratteri da annotare: serve a ritrovare e rimuovere la casa da un altro telefono. Chi ha sbagliato qualcosa rimuove la casa e la aggiunge di nuovo.
- **Mappa o elenco, con il conto delle case.** In alto un numero grande dice quante case sono aperte; con un tocco si passa dalla mappa all'elenco ordinato per via, con ricerca e navigatore.
- **Privacy prima di tutto.** Non vengono chiesti nomi, email o numeri di telefono. La posizione dei bambini ("Dove sono?") resta sul telefono e non viene mai inviata o salvata. La mappa e la ricerca degli indirizzi passano dal sito stesso, quindi nessun indirizzo IP arriva a servizi pubblicitari.
- **Segnalazioni per la sicurezza dei bambini.** Chiunque può segnalare in modo anonimo una casa (posizione sbagliata, casa che non partecipa, posto non sicuro). Dopo 3 segnalazioni da telefoni diversi la casa viene **nascosta** dalla mappa in attesa di un controllo. Il moderatore le vede in una pagina riservata (`/moderatore.html`, protetta da password) e decide se riammettere o eliminare la casa.
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
   public/manifest.json, functions/_lib/store.js (nome del comune, centro e
   raggio) e functions/api/houses.js. Nei file functions/tiles/[[path]].js e
   functions/api/geocode.js cambia anche l'indirizzo GitHub nello USER_AGENT con
   quello del mio fork.

3. Pubblicalo su Cloudflare Pages collegandolo al mio fork: nessun comando di build,
   cartella di output "public". Poi crea uno spazio dati KV e collegalo al progetto
   con il nome ESATTO "HOUSES_KV" (sia per produzione sia per anteprima).
   Aggiungi anche un segreto chiamato ADMIN_KEY: è la password del moderatore, una
   frase lunga e casuale di almeno 16 caratteri che generi tu e mostri a me una sola
   volta, perché io la salvi in un gestore di password. Poi rifai il deploy. Non aggiungere "pages_build_output_dir" al file wrangler.toml:
   altrimenti non potrei collegare lo spazio dati dal pannello.

4. Collauda il sito pubblicato: apri la mappa, aggiungi una casa di prova, controlla
   che compaia e che compaia il codice casa, poi rimuovila. Apri /moderatore.html e
   verifica che la password funzioni.

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
| `public/moderatore.html` | Pagina riservata al moderatore (non è linkata dall'app) |
| `functions/api/houses.js` | Elenco pubblico delle case e registrazione di una nuova casa |
| `functions/api/houses/[id].js` | Rimozione di una casa (serve il codice segreto del proprietario) |
| `functions/api/houses/[id]/manage.js` | Controllo del link personale di gestione |
| `functions/api/houses/[id]/report.js` | Segnalazione anonima di un problema; alla 3ª segnalazione la casa si nasconde |
| `functions/api/claim.js` | Ritrova la propria casa con il codice casa |
| `functions/api/admin/` | Elenco completo e azioni del moderatore (riammetti, nascondi, elimina), protette da `ADMIN_KEY` |
| `functions/api/geocode.js` | Da "Via Roma 18" al punto sulla mappa (servizio gratuito Nominatim di OpenStreetMap, solo dentro il comune, con cache) |
| `functions/tiles/[[path]].js` | Mappa OpenStreetMap servita dal nostro sito, con cache e limite alla zona del comune |
| `functions/_lib/store.js` | Archivio KV e impostazioni (nome del comune, centro, raggio, limiti) |

Le case sono salvate in Cloudflare KV, nello spazio con binding `HOUSES_KV`. Per provare tutto sul proprio computer:

```bash
npx wrangler pages dev public --kv HOUSES_KV
```

### Moderazione e segreti

La password del moderatore è il segreto `ADMIN_KEY` del progetto Cloudflare Pages, mai scritto nel codice. Per impostarla dal Terminale:

```bash
openssl rand -base64 24   # genera una password lunga: salvala in un gestore di password
npx wrangler pages secret put ADMIN_KEY --project-name NOME-DEL-PROGETTO
```

Senza `ADMIN_KEY` (almeno 12 caratteri) la pagina del moderatore resta bloccata e dice perché. Il codice casa non è salvato in chiaro: sul server resta solo la sua impronta.

### Limiti noti

- Le segnalazioni false sono possibili (basta cancellare i dati del browser per sembrare un altro telefono), ma la casa viene solo nascosta, mai cancellata: il moderatore può riammetterla. Nessuno ti avvisa quando c'è una segnalazione: guarda la pagina del moderatore, soprattutto nei giorni della festa.
- Non c'è un limite di tentativi sul codice casa né sulla password del moderatore: il codice ha circa 850 miliardi di combinazioni e la password dev'essere lunga, ma per un uso diverso da una festa di paese conviene aggiungere un limite di richieste in Cloudflare.

- L'intero elenco è in un'unica chiave KV: se due persone registrano una casa nello stesso istante, una delle due può andare persa e dovrà riprovare. Va bene per un comune o per un evento di una sera, non per carichi grandi.
- Non c'è un limite di richieste per utente; c'è solo un tetto massimo di 500 case e un raggio massimo dal centro del comune.
- Cancellare "dopo due settimane" significa 14 giorni dopo l'ultima modifica all'elenco (è la scadenza della chiave KV).

## Crediti e licenza

Mappe © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Libreria di mappe [Leaflet](https://leafletjs.com) (licenza BSD-2). Codice sotto licenza [MIT](LICENSE): puoi usarlo, copiarlo e modificarlo liberamente.
