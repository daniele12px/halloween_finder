const fs = require('fs');
const path = require('path');
const https = require('https');

const TILES_DIR = process.env.TILES_DIR || path.join(__dirname, '..', 'tiles_cache');

// Assicura che la cartella cache principale esista all'avvio
if (!fs.existsSync(TILES_DIR)) {
  fs.mkdirSync(TILES_DIR, { recursive: true });
}

/**
 * Gestore endpoint per le tessere della mappa (/tiles/:z/:x/:y.png)
 * Se la tessera è già su disco in tiles_cache, la serve all'istante.
 * Se la cartella o la tessera manca, la ricrea da sola scaricandola da OpenStreetMap.
 */
function handleTileRequest(req, res) {
  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);
  const y = parseInt(req.params.y, 10);

  // Validazione parametri
  if (isNaN(z) || isNaN(x) || isNaN(y) || z < 0 || z > 19) {
    return res.status(400).send('Parametri tessera non validi');
  }

  const tileSubDir = path.join(TILES_DIR, String(z), String(x));
  const tileFilePath = path.join(tileSubDir, `${y}.png`);

  // 1. Se la tessera è già in cache locale, servila immediatamente
  if (fs.existsSync(tileFilePath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return fs.createReadStream(tileFilePath).pipe(res);
  }

  // 2. Altrimenti scarica da OpenStreetMap e ricrea automaticamente le cartelle mancanti
  const osmUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const options = {
    headers: {
      'User-Agent': 'HalloweenFinder/1.0 (+https://github.com/daniele12px/halloween_finder)'
    }
  };

  https.get(osmUrl, options, (osmRes) => {
    if (osmRes.statusCode !== 200) {
      return res.status(osmRes.statusCode).send('Tessera non disponibile');
    }

    // Assicura che la sottocartella tiles_cache/z/x esista (la ricrea anche se cancellata a runtime)
    fs.mkdirSync(tileSubDir, { recursive: true });
    const fileStream = fs.createWriteStream(tileFilePath);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Scrive su disco e contemporaneamente invia al browser
    osmRes.pipe(fileStream);
    osmRes.pipe(res);
  }).on('error', (err) => {
    console.error('Errore download tessera OSM:', err);
    res.status(502).send('Errore recupero mappa');
  });
}

module.exports = {
  handleTileRequest,
  TILES_DIR
};
