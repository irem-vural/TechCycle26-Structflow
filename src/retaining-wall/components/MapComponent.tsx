'use client';

import React, { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { LogisticsPlace, LogisticsPlaceCategory } from '@/lib/logisticsPlaces';
import type { Coordinates, RoadRoute } from '@/lib/routing';

type DestinationPointType = LogisticsPlaceCategory;
type PointType = 'site' | DestinationPointType;
type LeafletDefaultIconPrototype = L.Icon.Default & { _getIconUrl?: unknown };

const KONYA_CENTER: [number, number] = [37.8715, 32.4846];
const DESTINATION_KEYS: DestinationPointType[] = ['plant', 'dump', 'rebar'];
const LABEL_KEYS = {
  site: 'map.site',
  plant: 'map.plant',
  dump: 'map.dump',
  rebar: 'map.rebar',
  formwork: 'map.formwork',
  crushedStone: 'map.crushedStone',
} as const;

delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function makeIcon(color: string) {
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36"><path fill="${color}" stroke="white" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 8.28 12 24 12 24S24 20.28 24 12C24 5.37 18.63 0 12 0z"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`);
  return new L.Icon({ iconUrl: `data:image/svg+xml,${svg}`, iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] });
}

const ROUTE_COLORS: Record<DestinationPointType, string> = {
  plant: '#3b82f6',
  dump: '#ef4444',
  rebar: '#f59e0b',
  formwork: '#8b5cf6',
  crushedStone: '#06b6d4',
};
const ICONS: Record<PointType, L.Icon> = {
  site: makeIcon('#10b981'),
  plant: makeIcon(ROUTE_COLORS.plant),
  dump: makeIcon(ROUTE_COLORS.dump),
  rebar: makeIcon(ROUTE_COLORS.rebar),
  formwork: makeIcon(ROUTE_COLORS.formwork),
  crushedStone: makeIcon(ROUTE_COLORS.crushedStone),
};

export interface MapComponentProps {
  points: Record<PointType, Coordinates | null>;
  routes: Record<DestinationPointType, RoadRoute | null>;
  candidates: LogisticsPlace[];
  onSetPoint: (type: PointType) => (coordinates: Coordinates) => void;
  onSelectCandidate: (place: LogisticsPlace) => void;
  activeMarkerType: PointType;
}

function MapEvents({ onMapClick }: { onMapClick: (event: L.LeafletMouseEvent) => void }) {
  useMapEvents({ click: onMapClick });
  return null;
}

function ResponsiveMap({ site }: { site: Coordinates | null }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const refresh = () => window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
    observer?.observe(container);
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    refresh();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
    };
  }, [map]);

  useEffect(() => {
    if (site) map.flyTo([site.lat, site.lng], Math.max(map.getZoom(), 11), { duration: 0.5 });
  }, [map, site]);

  return null;
}

export default function MapComponent({ points, routes, candidates, onSetPoint, onSelectCandidate, activeMarkerType }: MapComponentProps) {
  const { t } = useLocaleStore();
  const handleMapClick = (event: L.LeafletMouseEvent) => onSetPoint(activeMarkerType)({ lat: event.latlng.lat, lng: event.latlng.lng });

  return (
    <div className="relative z-0 h-full w-full overflow-hidden">
      <MapContainer center={KONYA_CENTER} zoom={11} style={{ width: '100%', height: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents onMapClick={handleMapClick} />
        <ResponsiveMap site={points.site} />

        {candidates.map((place) => {
          const active = activeMarkerType === place.category;
          return (
            <CircleMarker
              key={`${place.category}-${place.id}`}
              center={[place.coordinates.lat, place.coordinates.lng]}
              radius={active ? 6 : 4}
              pathOptions={{ color: ROUTE_COLORS[place.category], fillColor: ROUTE_COLORS[place.category], fillOpacity: active ? 0.75 : 0.28, opacity: active ? 0.9 : 0.45, weight: 1 }}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => onSelectCandidate(place) }}
            >
              <Popup><strong>{place.name}</strong><br />{t(LABEL_KEYS[place.category])}<br /><span className="text-xs">{place.distanceKm.toFixed(1)} km · {place.source === 'OpenStreetMap' ? 'OpenStreetMap' : 'Doğrulanmış Konya listesi'}</span></Popup>
            </CircleMarker>
          );
        })}

        {(Object.keys(points) as PointType[]).map((key) => {
          const point = points[key];
          if (!point) return null;
          return <Marker key={key} position={[point.lat, point.lng]} icon={ICONS[key]}><Popup>{t(LABEL_KEYS[key])}</Popup></Marker>;
        })}

        {DESTINATION_KEYS.map((key) => {
          const route = routes[key];
          if (!route || route.geometry.length < 2) return null;
          return <Polyline key={key} positions={route.geometry as [number, number][]} color={ROUTE_COLORS[key]} weight={route.fallback ? 2 : 3} dashArray={route.fallback ? '6 8' : undefined} opacity={0.85} />;
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 right-3 z-[400] hidden max-w-[220px] space-y-1.5 rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] px-3 py-2 text-xs font-semibold text-[var(--sf-text-secondary)] shadow-lg backdrop-blur sm:block">
        {DESTINATION_KEYS.map((key) => <div key={key} className="flex items-start gap-1.5 leading-snug"><span className="mt-1 h-1.5 w-3 shrink-0 rounded-full" style={{ background: ROUTE_COLORS[key] }} /><span>{t(LABEL_KEYS[key])}</span></div>)}
      </div>
    </div>
  );
}
