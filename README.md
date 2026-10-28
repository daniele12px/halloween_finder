# 🎃 Halloween Finder — Mappa Comunitaria "Dolcetto o Scherzetto"

**Halloween Finder** è un'applicazione web interattiva, leggera e progettata nel pieno rispetto della privacy (GDPR by design) che permette alle famiglie e ai cittadini di un comune di segnalare sulla mappa le abitazioni che distribuiscono caramelle durante la serata di Halloween.

---

## 🌟 Cosa fa l'applicazione

### 👧 Per le famiglie e i bambini
- **Mappa interattiva ad alto contrasto**: mostra con icone chiare le case con dolcetti disponibili (`🎃 Dolcetti Pronti`) e quelle che li hanno terminati (`👻 Dolcetti Finiti`), pensata per essere leggibile anche al buio da smartphone.
- **Indicazioni per celiaci**: evidenzia le case che offrono anche dolcetti senza glutine (`🌾`).
- **Posizione GPS 100% locale ("Dove sono?")**: il pulsante per localizzarsi sulla mappa calcola la posizione esclusivamente all'interno del browser del telefono. Le coordinate GPS dei bambini **non vengono mai inviate né salvate sul server**.
- **Mappe con cache locale**: le tessere geografiche di OpenStreetMap vengono memorizzate localmente nella cartella `tiles_cache/` (ricreata in automatico se assente), riducendo le chiamate esterne e velocizzando il caricamento.

### 🏡 Per chi apre la propria casa ai dolcetti
- **Registrazione rapida senza account**: non servono email, numeri di telefono, cognomi reali né password da ricordare. Basta scegliere un soprannome di fantasia (es. *"Il Castello dei Fantasmi"*) e indicare la via o toccare il punto sulla mappa.
- **Gestione immediata dello stato**: il dispositivo che registra la casa salva automaticamente un token casuale nel browser (`localStorage`), permettendo con un solo tocco di impostare *"Dolcetti Finiti 👻"* o rimuovere la casa dalla mappa a fine serata.
- **Link di gestione condivisibile**: subito dopo la registrazione viene generato un link segreto di gestione salvabile su WhatsApp o via email per controllare la propria casa anche da un altro dispositivo.
- **Zero manutenzione e pulizia automatica (GDPR)**: le registrazioni scadono e vengono cancellate automaticamente dopo 14 giorni, così nessun indirizzo resta archiviato dopo Halloween.

---

## 🚀 Installazione e avvio in locale

### Prerequisiti
- **Node.js** (versione 18 o superiore) e **npm**.

### Passaggi
```bash
# 1. Installa le dipendenze del progetto
npm install

# 2. Crea il file di configurazione locale copiando il modello di esempio
cp .env.example .env

# 3. Apri il file .env e imposta due valori segreti a tua scelta per ADMIN_KEY e SALT

# 4. Avvia il server
npm start
```

L'applicazione sarà disponibile all'indirizzo **`http://localhost:3000`** e partirà con un **database vuoto**.

Per eseguire la suite di test automatici (che utilizza un database isolato in memoria senza toccare il database locale):
```bash
npm test
```

---

## 🧪 Dati finti di esempio (Demo)

Il progetto parte sempre con un database vuoto e non contiene dati reali.
Se desideri provare l'interfaccia con **5 case dimostrative completamente inventate** (definite nel file `demo/demo_houses.json`), puoi caricarle eseguendo:

```bash
npm run seed:demo
```

Per svuotare il database ed eliminare tutte le case di prova (o per ripulire il database al termine della festa di Halloween):

```bash
npm run purge
```

---

## 🗺️ Come configurare l'app per un altro Comune

L'applicazione è pensata per essere riutilizzata facilmente da qualsiasi comune, comitato genitori o associazione. Tutte le impostazioni geografiche e di sicurezza si controllano tramite il file `.env` (o le variabili d'ambiente del servizio di hosting):

| Variabile | Descrizione | Valore predefinito |
| :--- | :--- | :--- |
| `PORT` | Porta HTTP su cui si avvia il server Node.js | `3000` |
| `TOWN_NAME` | Nome del comune mostrato e usato per il geofencing | `Guidizzolo` |
| `TOWN_PROVINCE` | Sigla della provincia | `MN` |
| `TOWN_REGION` | Nome della regione | `Lombardia` |
| `CENTER_LAT` | Latitudine del centro della mappa all'apertura | `45.3188` |
| `CENTER_LNG` | Longitudine del centro della mappa all'apertura | `10.5828` |
| `MAX_RADIUS_KM` | Raggio massimo (in km dal centro) entro cui sono accettate le case | `8.0` |
| `ADMIN_KEY` | Password di amministrazione (obbligatoria in produzione) | *(da impostare)* |
| `SALT` | Valore segreto per l'hashing crittografico (obbligatorio in produzione) | *(da impostare)* |

> **Nota di sicurezza per la produzione:** se `NODE_ENV=production` e `ADMIN_KEY` o `SALT` mancano (oppure contengono ancora i valori segnaposto di `.env.example`), il server rifiuta di avviarsi per evitare l'uso di credenziali note.

Se vuoi pre-scaricare in anticipo nella cartella `tiles_cache/` le tessere della mappa della zona configurata:
```bash
npm run precache
```

---

## ☁️ Come pubblicare l'applicazione online

### Opzione A: Render (Server Node.js + SQLite completo)
1. Pubblica il repository sul tuo account GitHub.
2. Accedi a [Render.com](https://render.com) e clicca su **New +** -> **Web Service** (oppure **Blueprint** per leggere automaticamente `render.yaml`).
3. Collega il repository GitHub e verifica i parametri:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Nella scheda **Environment**, assicurati di impostare:
   - `NODE_ENV` = `production`
   - `ADMIN_KEY` = *(una password segreta scelta da te)*
   - `SALT` = *(una stringa casuale segreta scelta da te)*
   - Eventuali variabili del tuo comune (`TOWN_NAME`, `CENTER_LAT`, `CENTER_LNG`, `MAX_RADIUS_KM`).
5. Avvia il deploy: Render fornirà un indirizzo HTTPS pubblico pronto da condividere.

### Opzione B: Cloudflare Pages (Frontend statico + Pages Functions)
Il progetto include la cartella `functions/` e il file `wrangler.toml` per l'esecuzione su **Cloudflare Pages**:
1. Accedi alla dashboard di [Cloudflare](https://dash.cloudflare.com/) e vai in **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
2. Seleziona il repository GitHub e imposta:
   - **Build command**: *(lascia vuoto)*
   - **Build output directory**: `public`
3. Per la persistenza condivisa su rete edge, crea un namespace **Workers KV** dalla dashboard Cloudflare e collegalo nelle impostazioni del progetto Pages (**Settings** -> **Functions** -> **KV namespace bindings**) con il nome variabile `HOUSES_KV`.

---

## 📄 Licenza

Questo progetto è distribuito con licenza [MIT](./LICENSE).

Un progetto di Dodicipixel per la comunità
