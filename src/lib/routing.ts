export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoadRoute {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
  fallback: boolean;
}

const routeCache = new Map<string, Promise<RoadRoute>>();

export async function getRoadRoute(start: Coordinates, end: Coordinates): Promise<RoadRoute> {
  const cacheKey = `${start.lat.toFixed(6)},${start.lng.toFixed(6)}:${end.lat.toFixed(6)},${end.lng.toFixed(6)}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  const promise = fetchOsrmRoute(start, end).catch(() => getFallbackRoute(start, end));
  routeCache.set(cacheKey, promise);
  return promise;
}

export async function getRoadDistance(start: Coordinates, end: Coordinates): Promise<number> {
  const route = await getRoadRoute(start, end);
  return route.distanceKm;
}

async function fetchOsrmRoute(start: Coordinates, end: Coordinates): Promise<RoadRoute> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`OSRM API Error: ${response.statusText}`);

    const data = await response.json();
    const route = data?.routes?.[0];
    if (data?.code !== 'Ok' || !route) throw new Error('No route found');

    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
      fallback: false,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getFallbackRoute(start: Coordinates, end: Coordinates): RoadRoute {
  const distanceKm = calculateHaversineDistance(start, end) * 1.3;
  return {
    distanceKm,
    durationMin: (distanceKm / 45) * 60,
    geometry: [
      [start.lat, start.lng],
      [end.lat, end.lng],
    ],
    fallback: true,
  };
}

function calculateHaversineDistance(start: Coordinates, end: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = (end.lat - start.lat) * (Math.PI / 180);
  const dLon = (end.lng - start.lng) * (Math.PI / 180);
  const lat1 = start.lat * (Math.PI / 180);
  const lat2 = end.lat * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
