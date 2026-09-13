'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, X } from 'lucide-react';
import { useLocaleStore } from '@/store/useLocaleStore';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';
import { discoverLogisticsPlaces } from '@/lib/logisticsPlaces';
import { getRoadRoute } from '@/lib/routing';
import type { LogisticsPlace, LogisticsPlaceCategory } from '@/lib/logisticsPlaces';
import type { Coordinates, RoadRoute } from '@/lib/routing';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-[var(--sf-bg-canvas)] text-xs text-[var(--sf-text-muted)]">Harita yükleniyor...</div>,
});

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DestinationPointType = LogisticsPlaceCategory;
type PointType = 'site' | DestinationPointType;
type LogisticsDistanceKey = 'distancePlant' | 'distanceDump' | 'distanceRebar';
type PointLabelKey = 'map.site' | 'map.plant' | 'map.dump' | 'map.rebar';
type SelectionId = '' | 'manual' | string;

const KONYA_CENTER: Coordinates = { lat: 37.8715, lng: 32.4846 };
const DESTINATION_KEYS: DestinationPointType[] = ['plant', 'dump', 'rebar'];
const POINT_CONFIG: Array<{ key: PointType; label: PointLabelKey; logisticsKey?: LogisticsDistanceKey }> = [
  { key: 'site', label: 'map.site' },
  { key: 'plant', label: 'map.plant', logisticsKey: 'distancePlant' },
  { key: 'dump', label: 'map.dump', logisticsKey: 'distanceDump' },
  { key: 'rebar', label: 'map.rebar', logisticsKey: 'distanceRebar' },
];

const emptyDestinations = <T,>(value: T): Record<DestinationPointType, T> => ({
  plant: value,
  dump: value,
  rebar: value,
  formwork: value,
  crushedStone: value,
});

export default function MapModal({ isOpen, onClose }: MapModalProps) {
  const { t } = useLocaleStore();
  const { setLogistics } = useRetainingWallStore();
  const discoveryJobRef = useRef(0);
  const [points, setPoints] = useState<Record<PointType, Coordinates | null>>({ site: null, ...emptyDestinations<Coordinates | null>(null) });
  const [routes, setRoutes] = useState<Record<DestinationPointType, RoadRoute | null>>(emptyDestinations<RoadRoute | null>(null));
  const [loading, setLoading] = useState<Record<DestinationPointType, boolean>>(emptyDestinations(false));
  const [places, setPlaces] = useState<Record<DestinationPointType, LogisticsPlace[]>>(emptyDestinations<LogisticsPlace[]>([]));
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Record<DestinationPointType, SelectionId>>(emptyDestinations<SelectionId>(''));
  const [selectedPlaceNames, setSelectedPlaceNames] = useState<Record<DestinationPointType, string | null>>(emptyDestinations<string | null>(null));
  const [activeMarkerType, setActiveMarkerType] = useState<PointType>('site');
  const [isApplying, setIsApplying] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const jobId = discoveryJobRef.current + 1;
    discoveryJobRef.current = jobId;
    void Promise.resolve().then(() => {
      if (discoveryJobRef.current !== jobId) return;
      setIsDiscovering(true);
      setDiscoveryWarning(null);
    });
    void discoverLogisticsPlaces(KONYA_CENTER, 100000)
      .then((result) => {
        if (discoveryJobRef.current === jobId) setPlaces(result);
      })
      .catch(() => {
        if (discoveryJobRef.current === jobId) setDiscoveryWarning('Konya tesis listesi alınamadı. Haritadan serbest seçim yapabilirsiniz.');
      })
      .finally(() => {
        if (discoveryJobRef.current === jobId) setIsDiscovering(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchRoute = async (key: DestinationPointType, destination: Coordinates, site: Coordinates) => {
    setLoading((previous) => ({ ...previous, [key]: true }));
    try {
      const route = await getRoadRoute(site, destination);
      setRoutes((previous) => ({ ...previous, [key]: route }));
    } finally {
      setLoading((previous) => ({ ...previous, [key]: false }));
    }
  };

  const selectDestination = (place: LogisticsPlace, site = points.site) => {
    setPoints((previous) => ({ ...previous, [place.category]: place.coordinates }));
    setSelectedPlaceIds((previous) => ({ ...previous, [place.category]: place.id }));
    setSelectedPlaceNames((previous) => ({ ...previous, [place.category]: place.name }));
    setActiveMarkerType(place.category);
    if (site) void fetchRoute(place.category, place.coordinates, site);
  };

  const discoverAndAutofill = async (site: Coordinates) => {
    const jobId = discoveryJobRef.current + 1;
    discoveryJobRef.current = jobId;
    setPoints({ site, ...emptyDestinations<Coordinates | null>(null) });
    setRoutes(emptyDestinations<RoadRoute | null>(null));
    setSelectedPlaceIds(emptyDestinations<SelectionId>(''));
    setSelectedPlaceNames(emptyDestinations<string | null>(null));
    setActiveMarkerType('plant');
    setIsDiscovering(true);
    setDiscoveryWarning(null);
    try {
      const result = await discoverLogisticsPlaces(site, 80000);
      if (discoveryJobRef.current !== jobId) return;
      setPlaces(result);
      const nextPoints: Record<PointType, Coordinates | null> = { site, ...emptyDestinations<Coordinates | null>(null) };
      const nextIds = emptyDestinations<SelectionId>('');
      const nextNames = emptyDestinations<string | null>(null);
      DESTINATION_KEYS.forEach((category) => {
        const nearest = result[category][0];
        if (!nearest) return;
        nextPoints[category] = nearest.coordinates;
        nextIds[category] = nearest.id;
        nextNames[category] = nearest.name;
      });
      setPoints(nextPoints);
      setSelectedPlaceIds(nextIds);
      setSelectedPlaceNames(nextNames);
      DESTINATION_KEYS.forEach((category) => {
        const destination = nextPoints[category];
        if (destination) void fetchRoute(category, destination, site);
      });
      if (!DESTINATION_KEYS.some((category) => result[category].length > 0)) {
        setDiscoveryWarning('Şantiye yakınında kayıtlı tesis bulunamadı. Haritadan serbest seçim yapabilirsiniz.');
      }
    } catch {
      if (discoveryJobRef.current === jobId) setDiscoveryWarning('Yakındaki tesisler alınamadı. Haritadan serbest seçim yapabilirsiniz.');
    } finally {
      if (discoveryJobRef.current === jobId) setIsDiscovering(false);
    }
  };

  const handleSetPoint = (key: PointType) => (coordinates: Coordinates) => {
    if (key === 'site') {
      void discoverAndAutofill(coordinates);
      return;
    }
    setPoints((previous) => ({ ...previous, [key]: coordinates }));
    setSelectedPlaceIds((previous) => ({ ...previous, [key]: 'manual' }));
    setSelectedPlaceNames((previous) => ({ ...previous, [key]: 'Haritadan serbest seçim' }));
    if (points.site) void fetchRoute(key, coordinates, points.site);
  };

  const handlePlaceSelect = (category: DestinationPointType, id: SelectionId) => {
    if (id === 'manual') {
      setSelectedPlaceIds((previous) => ({ ...previous, [category]: 'manual' }));
      setSelectedPlaceNames((previous) => ({ ...previous, [category]: 'Haritadan serbest seçim' }));
      setActiveMarkerType(category);
      return;
    }
    const place = places[category].find((candidate) => candidate.id === id);
    if (place) selectDestination(place);
  };

  const formatDistance = (route: RoadRoute | null) => {
    if (!route) return null;
    const minutes = route.durationMin;
    return {
      km: route.distanceKm.toFixed(1),
      duration: minutes >= 60 ? `${Math.floor(minutes / 60)}sa ${Math.round(minutes % 60)}dk` : `${Math.round(minutes)}dk`,
      fallback: route.fallback,
    };
  };

  const handleApply = () => {
    setIsApplying(true);
    const update: Partial<Record<LogisticsDistanceKey, number>> = {};
    POINT_CONFIG.forEach((config) => {
      if (!config.logisticsKey || config.key === 'site') return;
      const route = routes[config.key];
      if (route) update[config.logisticsKey] = Number(route.distanceKm.toFixed(1));
    });
    if (Object.keys(update).length > 0) setLogistics(update);
    setIsApplying(false);
    onClose();
  };

  const canApply = Boolean(points.site && DESTINATION_KEYS.some((key) => routes[key]));
  const allCandidates = DESTINATION_KEYS.flatMap((category) => places[category]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--sf-bg-overlay)] p-0 backdrop-blur-sm sm:p-4">
      <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-[var(--sf-text-primary)] shadow-2xl sm:h-[min(88dvh,800px)] sm:max-w-6xl sm:rounded-xl sm:border">
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--sf-border-default)] bg-[var(--sf-bg-toolbar)] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--sf-text-primary)]"><MapPin className="size-4 shrink-0 text-[var(--sf-action-primary)]" /><span className="truncate">{t('map.title')} · Konya</span></h2>
          <button type="button" onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-secondary)] transition-colors hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]" aria-label="Haritayı kapat"><X className="size-5" /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col-reverse overflow-hidden md:flex-row">
          <aside className="flex max-h-[52dvh] w-full shrink-0 flex-col overflow-hidden border-t border-[var(--sf-border-default)] bg-[var(--sf-bg-sidebar)] md:max-h-none md:w-80 md:border-r md:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <div className="mb-3 rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-2.5 text-xs leading-relaxed text-[var(--sf-text-secondary)]">
                Önce <strong className="text-[var(--sf-text-primary)]">Şantiye</strong> konumunu seçin. En yakın kayıtlı noktalar otomatik atanır; listeden değiştirebilir veya haritadan serbest seçim yapabilirsiniz.
              </div>
              {isDiscovering && <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--sf-status-info)]"><Loader2 className="size-3 animate-spin" />Konya tesisleri taranıyor…</p>}
              {discoveryWarning && <p className="mb-2 rounded border border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] px-2 py-1.5 text-xs text-[var(--sf-status-warning)]">{discoveryWarning}</p>}

              <div className="space-y-2">
                {POINT_CONFIG.map((config, index) => {
                  const point = points[config.key];
                  const routeKey = config.key === 'site' ? null : config.key;
                  const distance = routeKey ? formatDistance(routes[routeKey]) : null;
                  const isLoading = routeKey ? loading[routeKey] : false;
                  const isActive = activeMarkerType === config.key;
                  return (
                    <div key={config.key} className={`rounded-lg border p-2 transition-colors ${isActive ? 'border-[var(--sf-border-active)] bg-[var(--sf-bg-selected)] text-[var(--sf-text-primary)]' : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] text-[var(--sf-text-secondary)]'}`}>
                      <button type="button" onClick={() => setActiveMarkerType(config.key)} className="flex min-h-8 w-full items-start justify-between gap-2 text-left text-xs font-semibold leading-snug">
                        <span>{index + 1}. {t(config.label)}</span>
                        {isLoading ? <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-[var(--sf-status-info)]" /> : point ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--sf-status-success)]" /> : null}
                      </button>
                      {routeKey && (
                        <>
                          <select value={selectedPlaceIds[routeKey]} onChange={(event) => handlePlaceSelect(routeKey, event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-2 text-xs text-[var(--sf-text-primary)] outline-none focus:border-[var(--sf-border-focus)]">
                            <option value="">Konum seçin</option>
                            <option value="manual">Haritadan serbest seç</option>
                            {places[routeKey].map((place) => <option key={place.id} value={place.id}>{place.name} · {place.distanceKm.toFixed(1)} km</option>)}
                          </select>
                          {selectedPlaceNames[routeKey] && <span className="mt-1 block truncate text-xs text-[var(--sf-text-secondary)]" title={selectedPlaceNames[routeKey] ?? undefined}>{selectedPlaceNames[routeKey]}</span>}
                        </>
                      )}
                      {distance && <span className={`mt-1 block text-xs ${distance.fallback ? 'text-[var(--sf-status-warning)]' : 'text-[var(--sf-text-secondary)]'}`}>{distance.fallback && <AlertTriangle className="mr-0.5 inline size-3" />}{distance.km} km · {distance.duration}</span>}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--sf-text-muted)]">Tesis önerileri canlı OpenStreetMap kayıtlarıyla doğrulanmış Konya yedek listesinden birleştirilir. Seçimi proje için doğrulayın; gerekirse serbest seçim kullanın.</p>
            </div>

            <div className="shrink-0 border-t border-[var(--sf-border-default)] bg-[var(--sf-bg-sidebar)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-3">
              <button type="button" onClick={handleApply} disabled={!canApply || isApplying} className="min-h-10 w-full rounded-md bg-[var(--sf-control-primary-bg)] px-3 text-sm font-semibold text-[var(--sf-text-on-accent)] transition-colors hover:bg-[var(--sf-control-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--sf-bg-disabled)] disabled:text-[var(--sf-text-disabled)]">{isApplying ? t('map.computing') : t('map.apply')}</button>
            </div>
          </aside>

          <div className="relative min-h-[32dvh] min-w-0 flex-1 bg-[var(--sf-bg-canvas)] md:min-h-0">
            <MapComponent points={points} routes={routes} candidates={allCandidates} onSetPoint={handleSetPoint} onSelectCandidate={selectDestination} activeMarkerType={activeMarkerType} />
          </div>
        </div>
      </div>
    </div>
  );
}
