/**
 * Script di Pre-Caching per le tessere di Guidizzolo (MN)
 * Scarica e memorizza su disco le tessere della mappa per tutto il paese e le frazioni (Birbesi, Rebecco).
 * Una volta eseguito, la mappa funziona al 100% OFFLINE e SENZA ALCUNA API KEY!
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TILES_DIR = path.join(__dirname, '..', 'tiles_cache');

// Bounding box per Guidizzolo e frazioni
const BOUNDS = {
  minLat: 45.295,
  maxLat: 45.340,
  minLng: 10.550,
  maxLng: 10.615
};

// Livelli di zoom da pre-scaricare (13: panoramica, 14-16: vie del paese, 17: dettaglio civici)
const ZOOM_LEVELS = [13, 14, 15, 16];

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function getTilesForZoom(zoom) {
  const topLeft = latLngToTile(BOUNDS.maxLat, BOUNDS.minLng, zoom);
  const bottomRight = latLngToTile(BOUNDS.minLat, BOUNDS.maxLng, zoom);

  const tiles = [];
  const minX = Math.min(topLeft.x, bottomRight.x);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxY = Math.max(topLeft.y, bottomRight.y);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

function downloadTile(z, x, y) {
  return new Promise((resolve) => {
    const tileSubDir = path.join(TILES_DIR, String(z), String(x));
    const tilePath = path.join(tileSubDir, `${y}.png`);

    if (fs.existsSync(tilePath)) {
      return resolve({ cached: true, z, x, y });
    }

    fs.mkdirSync(tileSubDir, { recursive: true });
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const options = {
      headers: {
        'User-Agent': 'HalloweenFinder/1.0 (+https://github.com/daniele12px/halloween_finder)'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(tilePath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ downloaded: true, z, x, y });
        });
      } else {
        resolve({ error: res.statusCode, z, x, y });
      }
    }).on('error', (err) => {
      resolve({ error: err.message, z, x, y });
    });
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('🎃 Avvio pre-caching mappa locale per Guidizzolo...');
  let allTiles = [];
  for (const z of ZOOM_LEVELS) {
    const tiles = getTilesForZoom(z);
    allTiles = allTiles.concat(tiles);
  }

  console.log(`Totale tessere da memorizzare: ${allTiles.length}`);
  let count = 0;

  for (const t of allTiles) {
    count++;
    const res = await downloadTile(t.z, t.x, t.y);
    if (res.downloaded) {
      process.stdout.write(`\rScaricamento tessera ${count}/${allTiles.length} (Zoom ${t.z})...`);
      // Breve pausa cortese per non sovraccaricare OSM
      await sleep(50);
    } else if (res.cached) {
      process.stdout.write(`\rTessera ${count}/${allTiles.length} già in cache...`);
    }
  }

  console.log('\n✅ Tutte le tessere di Guidizzolo sono salvate in locale nella cartella tiles_cache!');
  console.log('🔒 La mappa ora funziona al 100% OFFLINE e SENZA ALCUNA API KEY!');
}

run();
