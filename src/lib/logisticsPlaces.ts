import type { Coordinates } from './routing';

export type LogisticsPlaceCategory = 'plant' | 'dump' | 'rebar' | 'formwork' | 'crushedStone';

export interface LogisticsPlace {
  id: string;
  name: string;
  category: LogisticsPlaceCategory;
  coordinates: Coordinates;
  distanceKm: number;
  source: 'OpenStreetMap' | 'Curated';
  sourceUrl: string;
}

type CuratedLogisticsPlace = Omit<LogisticsPlace, 'distanceKm'>;

interface OverpassElement {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const discoveryCache = new Map<string, Promise<Record<LogisticsPlaceCategory, LogisticsPlace[]>>>();

// Browser-side Overpass discovery can be unavailable or incomplete. These Konya
// records keep the logistics workflow usable and are deliberately limited to
// facilities for which a facility/address-level coordinate could be verified.
const KONYA_CURATED_PLACES: CuratedLogisticsPlace[] = [
  { id: 'curated-plant-sancak', name: 'Sancak Hazır Beton', category: 'plant', coordinates: { lat: 37.94644, lng: 32.544078 }, source: 'Curated', sourceUrl: 'https://www.sancakbeton.com/tr/iletisim' },
  { id: 'curated-plant-emir', name: 'Emir Hazır Beton', category: 'plant', coordinates: { lat: 37.947451, lng: 32.542665 }, source: 'Curated', sourceUrl: 'https://emirbeton.com.tr/tr/medya~24' },
  { id: 'curated-plant-likit', name: 'Likit Hazır Beton', category: 'plant', coordinates: { lat: 37.94718, lng: 32.546667 }, source: 'Curated', sourceUrl: 'https://yandex.com.tr/maps/org/likit_hazir_beton/91835221424/' },
  { id: 'curated-plant-erdinc', name: 'Erdinç Hazır Beton', category: 'plant', coordinates: { lat: 37.946683, lng: 32.537763 }, source: 'Curated', sourceUrl: 'https://yandex.com.tr/maps/org/erdinc_hazir_beton/1016428836/' },

  { id: 'curated-dump-kasinhani', name: 'Kaşınhanı Entegre Katı Atık Tesisi', category: 'dump', coordinates: { lat: 37.7465468, lng: 32.6121863 }, source: 'Curated', sourceUrl: 'https://www.openstreetmap.org/way/1497887387' },
  { id: 'curated-dump-cihanbeyli', name: 'Cihanbeyli Katı Atık Tesisi', category: 'dump', coordinates: { lat: 38.6229606, lng: 32.882018 }, source: 'Curated', sourceUrl: 'https://www.openstreetmap.org/way/1497887967' },

  { id: 'curated-rebar-tekcan', name: 'Tekcan Metal', category: 'rebar', coordinates: { lat: 37.929223, lng: 32.558216 }, source: 'Curated', sourceUrl: 'https://tekcanmetal.com/' },
  { id: 'curated-rebar-mem', name: 'MEM Demir Çelik', category: 'rebar', coordinates: { lat: 37.920662, lng: 32.537041 }, source: 'Curated', sourceUrl: 'https://www.memdemir.com.tr/' },
  { id: 'curated-rebar-hilal', name: 'Hilal Demir', category: 'rebar', coordinates: { lat: 37.92228, lng: 32.562011 }, source: 'Curated', sourceUrl: 'https://hilaldemir.com.tr/' },

  { id: 'curated-formwork-altunkaynak', name: 'Altunkaynak İskele & Kalıp Ekipmanları', category: 'formwork', coordinates: { lat: 37.905961, lng: 32.54008 }, source: 'Curated', sourceUrl: 'https://yandex.com.tr/maps/org/altunkaynak_iskele_kalip_ekipmanlari/30559982873/' },
  { id: 'curated-formwork-canser', name: 'Canser Kalıp Sistemleri', category: 'formwork', coordinates: { lat: 37.932444, lng: 32.547903 }, source: 'Curated', sourceUrl: 'https://yandex.com.tr/maps/org/canser_sera_ve_kalip_sistemleri/215919459006/' },
  { id: 'curated-quarry-sille', name: 'Sille Taş Ocağı', category: 'crushedStone', coordinates: { lat: 37.9460986, lng: 32.4198809 }, source: 'Curated', sourceUrl: 'https://www.openstreetmap.org/way/360699824' },
  { id: 'curated-quarry-kozagac', name: 'Kozağaç Madencilik Taş Ocağı', category: 'crushedStone', coordinates: { lat: 37.715472, lng: 32.443033 }, source: 'Curated', sourceUrl: 'https://yandex.com.tr/maps/org/kozagac_madencilik/91060901129/' },
  { id: 'curated-quarry-mar', name: 'Mar İnşaat Kırmataş Tesisi', category: 'crushedStone', coordinates: { lat: 37.431309, lng: 32.732641 }, source: 'Curated', sourceUrl: 'https://yandex.com.tr/maps/org/mar_insaat_kirmatas/22930383766/' },
];

const emptyGroups = (): Record<LogisticsPlaceCategory, LogisticsPlace[]> => ({
  plant: [],
  dump: [],
  rebar: [],
  formwork: [],
  crushedStone: [],
});

function classifyPlace(tags: Record<string, string>): LogisticsPlaceCategory | null {
  const name = tags.name ?? '';
  if (tags.industrial === 'concrete' || tags.product === 'concrete' || /beton|concrete/i.test(name)) return 'plant';
  if (tags.amenity === 'waste_disposal' || tags.landuse === 'landfill' || /katı atık|atık (depolama|bertaraf)|hafriyat|döküm sahası|landfill/i.test(name)) return 'dump';
  if (/kalıp|iskele|formwork|scaffold/i.test(name)) return 'formwork';
  if (tags.landuse === 'quarry' || /taş ocağı|kırmataş|agrega|mıcır|quarry/i.test(name)) return 'crushedStone';
  if (/donatı|inşaat demiri|nervürlü demir|demir çelik|steel/i.test(name)) return 'rebar';
  return null;
}

function haversineDistanceKm(start: Coordinates, end: Coordinates): number {
  const earthRadiusKm = 6371;
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(end.lat - start.lat);
  const dLng = radians(end.lng - start.lng);
  const startLat = radians(start.lat);
  const endLat = radians(end.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function curatedGroups(center: Coordinates, radiusMeters: number): Record<LogisticsPlaceCategory, LogisticsPlace[]> {
  const groups = emptyGroups();
  KONYA_CURATED_PLACES.forEach((place) => {
    const distanceKm = haversineDistanceKm(center, place.coordinates);
    if (distanceKm * 1000 > radiusMeters) return;
    groups[place.category].push({ ...place, distanceKm });
  });
  return groups;
}

function mergeGroups(
  center: Coordinates,
  radiusMeters: number,
  discovered: Record<LogisticsPlaceCategory, LogisticsPlace[]>,
): Record<LogisticsPlaceCategory, LogisticsPlace[]> {
  const merged = curatedGroups(center, radiusMeters);
  (Object.keys(merged) as LogisticsPlaceCategory[]).forEach((category) => {
    const seen = new Set(merged[category].map((place) => `${place.name.toLocaleLowerCase('tr-TR')}:${place.coordinates.lat.toFixed(3)}:${place.coordinates.lng.toFixed(3)}`));
    discovered[category].forEach((place) => {
      const key = `${place.name.toLocaleLowerCase('tr-TR')}:${place.coordinates.lat.toFixed(3)}:${place.coordinates.lng.toFixed(3)}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged[category].push(place);
    });
    merged[category].sort((left, right) => left.distanceKm - right.distanceKm || left.name.localeCompare(right.name, 'tr-TR'));
  });
  return merged;
}

function buildQuery(center: Coordinates, radiusMeters: number): string {
  const around = `(around:${Math.round(radiusMeters)},${center.lat},${center.lng})`;
  return `[out:json][timeout:25];
(
  nwr${around}["name"]["industrial"="concrete"];
  nwr${around}["name"]["product"="concrete"];
  nwr${around}["name"~"beton|concrete",i];
  nwr${around}["name"]["amenity"="waste_disposal"];
  nwr${around}["name"]["landuse"="landfill"];
  nwr${around}["name"~"katı atık|atık depolama|atık bertaraf|hafriyat|döküm sahası|landfill",i];
  nwr${around}["name"~"donatı|inşaat demiri|nervürlü demir|demir çelik|steel",i];
  nwr${around}["name"~"kalıp|iskele|formwork|scaffold",i];
  nwr${around}["name"]["landuse"="quarry"];
  nwr${around}["name"~"taş ocağı|kırmataş|agrega|mıcır|quarry",i];
);
out center tags;`;
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const payload = await response.json() as { elements?: OverpassElement[] };
      return payload.elements ?? [];
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Konum verisi alınamadı');
}

export async function discoverLogisticsPlaces(
  center: Coordinates,
  radiusMeters = 80000,
): Promise<Record<LogisticsPlaceCategory, LogisticsPlace[]>> {
  const cacheKey = `${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${Math.round(radiusMeters / 1000)}`;
  const cached = discoveryCache.get(cacheKey);
  if (cached) return cached;

  const liveRequest = fetchOverpass(buildQuery(center, radiusMeters)).then((elements) => {
    const groups = emptyGroups();
    const seen = new Set<string>();
    elements.forEach((element) => {
      const tags = element.tags ?? {};
      const name = tags.name?.trim();
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      const category = classifyPlace(tags);
      if (!name || category == null || lat == null || lng == null) return;
      const normalized = `${category}:${name.toLocaleLowerCase('tr-TR')}:${lat.toFixed(4)}:${lng.toFixed(4)}`;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      const coordinates = { lat, lng };
      groups[category].push({
        id: `${element.type}-${element.id}`,
        name,
        category,
        coordinates,
        distanceKm: haversineDistanceKm(center, coordinates),
        source: 'OpenStreetMap',
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      });
    });
    (Object.keys(groups) as LogisticsPlaceCategory[]).forEach((category) => {
      groups[category].sort((left, right) => left.distanceKm - right.distanceKm || left.name.localeCompare(right.name, 'tr-TR'));
    });
    return mergeGroups(center, radiusMeters, groups);
  }).catch(() => mergeGroups(center, radiusMeters, emptyGroups()));

  // Do not make the user wait for overloaded public Overpass endpoints. The
  // curated list is shown quickly; a later call can still use the completed
  // live+curated result from the cache.
  const quickFallback = new Promise<Record<LogisticsPlaceCategory, LogisticsPlace[]>>((resolve) => {
    globalThis.setTimeout(() => resolve(mergeGroups(center, radiusMeters, emptyGroups())), 1200);
  });
  const request = Promise.race([liveRequest, quickFallback]);
  void liveRequest.then((result) => discoveryCache.set(cacheKey, Promise.resolve(result)));

  discoveryCache.set(cacheKey, request);
  return request;
}
