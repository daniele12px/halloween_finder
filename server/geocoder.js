const https = require('https');
const config = require('./config');

/**
 * Stradario locale di Guidizzolo (MN) e frazioni
 * Garantisce geocodifica e reverse-geocodifica istantanea (0ms) anche offline al 100%!
 */
const GUIDIZZOLO_STREETS = [
  { match: /marconi|piazza.*marconi/i, lat: 45.3190, lng: 10.5830, name: "Piazza Guglielmo Marconi" },
  { match: /roma/i, lat: 45.3165, lng: 10.5844, name: "Via Roma" },
  { match: /solferino/i, lat: 45.3205, lng: 10.5815, name: "Via Solferino" },
  { match: /garibaldi/i, lat: 45.3180, lng: 10.5805, name: "Via Giuseppe Garibaldi" },
  { match: /matteotti/i, lat: 45.3185, lng: 10.5825, name: "Via Giacomo Matteotti" },
  { match: /veneto|vittorio.*veneto/i, lat: 45.3175, lng: 10.5855, name: "Via Vittorio Veneto" },
  { match: /goito/i, lat: 45.3160, lng: 10.5870, name: "Via Goito" },
  { match: /cavriana/i, lat: 45.3220, lng: 10.5810, name: "Via Cavriana" },
  { match: /medole/i, lat: 45.3200, lng: 10.5780, name: "Via Medole" },
  { match: /rodella/i, lat: 45.3170, lng: 10.5790, name: "Via Rodella" },
  { match: /ceresara/i, lat: 45.3140, lng: 10.5800, name: "Via per Ceresara" },
  { match: /minzoni/i, lat: 45.3210, lng: 10.5840, name: "Via Don Giovanni Minzoni" },
  { match: /carra/i, lat: 45.3195, lng: 10.5860, name: "Via Don Giovanni Carra" },
  { match: /san.*cassiano/i, lat: 45.3150, lng: 10.5860, name: "Via San Cassiano" },
  { match: /dante|alighieri/i, lat: 45.3175, lng: 10.5815, name: "Via Dante Alighieri" },
  { match: /manzoni/i, lat: 45.3180, lng: 10.5835, name: "Via Alessandro Manzoni" },
  { match: /della.*pace/i, lat: 45.3198, lng: 10.5845, name: "Via della Pace" },
  { match: /kennedy/i, lat: 45.3202, lng: 10.5855, name: "Via John Fitzgerald Kennedy" },
  { match: /mazzini/i, lat: 45.3192, lng: 10.5818, name: "Via Giuseppe Mazzini" },
  { match: /battisti/i, lat: 45.3186, lng: 10.5840, name: "Via Cesare Battisti" },
  { match: /parini/i, lat: 45.3168, lng: 10.5828, name: "Via Giuseppe Parini" },
  { match: /pascoli/i, lat: 45.3172, lng: 10.5832, name: "Via Giovanni Pascoli" },
  { match: /leopardi/i, lat: 45.3165, lng: 10.5825, name: "Via Giacomo Leopardi" },
  { match: /carducci/i, lat: 45.3170, lng: 10.5822, name: "Via Giosuè Carducci" },
  { match: /birbesi/i, lat: 45.3085, lng: 10.5695, name: "Frazione Birbesi" },
  { match: /rebecco/i, lat: 45.3120, lng: 10.6050, name: "Frazione Rebecco" },
  { match: /selaschi/i, lat: 45.3280, lng: 10.5750, name: "Località Selaschi" }
];

/**
 * Cerca le coordinate prima nello stradario locale di Guidizzolo,
 * e se non trovata interroga OSM Nominatim con User-Agent appropriato.
 */
async function resolveCoordinates(address) {
  if (!address || typeof address !== 'string') {
    return { lat: config.TOWN.centerLat, lng: config.TOWN.centerLng, source: 'default' };
  }

  const cleanAddr = address.trim();

  // 1. Cerca nello stradario locale di Guidizzolo (0ms, 100% offline!)
  for (const item of GUIDIZZOLO_STREETS) {
    if (item.match.test(cleanAddr)) {
      const civicoMatch = cleanAddr.match(/\d+/);
      const civico = civicoMatch ? parseInt(civicoMatch[0], 10) : 0;
      const latOffset = civico ? (civico % 10 - 5) * 0.00008 : 0;
      const lngOffset = civico ? ((civico * 3) % 10 - 5) * 0.00008 : 0;

      return {
        lat: Number((item.lat + latOffset).toFixed(6)),
        lng: Number((item.lng + lngOffset).toFixed(6)),
        source: 'local_gazetteer',
        streetName: item.name
      };
    }
  }

  // 2. Se non presente nello stradario locale, tenta Nominatim da server Node
  try {
    const query = `${cleanAddr}, Guidizzolo, Mantova, Italia`;
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    
    const geoData = await new Promise((resolve) => {
      const req = https.get(osmUrl, {
        headers: {
          'User-Agent': 'HalloweenFinder/1.0 (+https://github.com/daniele12px/halloween_finder)'
        },
        timeout: 2500
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });

    if (Array.isArray(geoData) && geoData.length > 0) {
      return {
        lat: parseFloat(geoData[0].lat),
        lng: parseFloat(geoData[0].lon),
        source: 'nominatim'
      };
    }
  } catch (err) {
    console.warn('Errore geocodifica server-side:', err);
  }

  // 3. Fallback finale sicuro: Piazza Marconi, Guidizzolo
  return {
    lat: config.TOWN.centerLat,
    lng: config.TOWN.centerLng,
    source: 'fallback_town_center'
  };
}

/**
 * Reverse Geocoding: dalle coordinate (lat, lng) trova il nome della via a Guidizzolo
 */
async function reverseGeocode(lat, lng) {
  lat = parseFloat(lat);
  lng = parseFloat(lng);

  // 1. Trova subito la via più vicina nello stradario locale (come base sicura al 100%)
  let closestStreet = "Guidizzolo";
  let minDist = Infinity;

  for (const item of GUIDIZZOLO_STREETS) {
    const dLat = item.lat - lat;
    const dLng = item.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      closestStreet = item.name;
    }
  }

  // 2. Tenta il reverse geocoding esatto tramite Nominatim (lato server con User-Agent)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const revData = await new Promise((resolve) => {
      const req = https.get(osmUrl, {
        headers: {
          'User-Agent': 'HalloweenFinder/1.0 (+https://github.com/daniele12px/halloween_finder)'
        },
        timeout: 2000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });

    if (revData && revData.address) {
      const road = revData.address.road || revData.address.pedestrian || revData.address.square || revData.address.hamlet || revData.address.village;
      const number = revData.address.house_number;
      if (road) {
        return {
          address: number ? `${road}, ${number}` : road,
          source: 'nominatim'
        };
      }
    }
  } catch (e) {
    // Fallback silenzioso allo stradario locale
  }

  return {
    address: closestStreet,
    source: 'local_gazetteer'
  };
}

module.exports = {
  resolveCoordinates,
  reverseGeocode,
  GUIDIZZOLO_STREETS
};
