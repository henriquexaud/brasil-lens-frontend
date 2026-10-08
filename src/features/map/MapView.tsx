import 'leaflet/dist/leaflet.css';

import { latLngBounds, geoJSON, type PathOptions, type PolylineOptions } from 'leaflet';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { GeoJSON, MapContainer, Pane, TileLayer, useMap } from 'react-leaflet';

import type {
  BoundingBox,
  MapFeature,
  MapFeatureCollection,
  WeatherCity,
  FireMunicipality,
} from '@/api/types';

import { TerritoryLayer } from './TerritoryLayer';
import { DiscoveredMosaicLayer } from './DiscoveredMosaicLayer';
import { NationalMunicipalLayer, type NationalMosaic } from './NationalMunicipalLayer';
import { ViewportObserver, type MapViewport } from './ViewportObserver';
import { WheelGestures } from './WheelGestures';
import { RendererSync } from './RendererSync';
import type { FireMode } from '@/features/fire/fireDensity';
import { scopeInsets } from './viewport';
import type { TerritoryPresentation } from './TerritoryPresentation';

const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

interface MapViewMemory {
  scopeKey: string;
  center: [number, number];
  zoom: number;
}

// Cada contexto monta o próprio MapView. A última vista fica guardada para o
// mapa seguinte nascer no mesmo lugar: sem isso, toda troca de contexto
// recomeçava do Brasil inteiro e voava de novo até o recorte.
let lastView: MapViewMemory | null = null;

function RememberView({ scopeKey }: { scopeKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (scopeKey === 'initial') return;
    const remember = () => {
      const center = map.getCenter();
      lastView = { scopeKey, center: [center.lat, center.lng], zoom: map.getZoom() };
    };
    map.on('moveend', remember);
    return () => {
      map.off('moveend', remember);
    };
  }, [map, scopeKey]);
  return null;
}

const STATE_HALO_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: 'var(--map-selection-halo, #ffffff)',
  weight: 4.2,
  opacity: 0.75,
  className: 'state-selected-halo',
};

const STATE_OUTLINE_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: 'var(--map-state-outline, rgba(71, 85, 105, 0.85))',
  weight: 1.8,
  opacity: 0.95,
  className: 'state-selected-outline',
};

interface Props {
  onNationalMosaicPublished?: (presentation: TerritoryPresentation | undefined) => void;
  presentation?: TerritoryPresentation;
  collection?: MapFeatureCollection;
  selectedCode?: string | null;
  onSelect?: (ibgeCode: string) => void;
  onDrillDown?: (ibgeCode: string, name: string) => void;
  children?: ReactNode;
  weatherByCode?: Map<string, WeatherCity>;
  fireByCode?: Map<string, FireMunicipality>;
  fireMode?: FireMode;
  fireHours?: number;
  rainMode?: boolean;
  climateMode?: boolean;
  dataLoading?: boolean;
  onViewportChange?: (viewport: MapViewport) => void;
  stateOutline?: MapFeature | null;
  discoveredMosaic?: MapFeature[];
  discoveredMosaicVersion?: number;
  discoveredMosaicVersions?: Map<string, number>;
  completeMosaicStates?: Set<string>;
  exploredWeatherByCode?: Map<string, WeatherCity>;
  exploredFireByCode?: Map<string, FireMunicipality>;
  nationalMosaic?: NationalMosaic;
  nationalMosaicPaused?: boolean;
  locationTarget?: {
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null;
}

function FitToScope({
  bbox,
  scopeKey,
  selectedFeature,
  locationTarget,
  restored,
}: {
  bbox: BoundingBox | undefined;
  scopeKey: string;
  selectedFeature?: MapFeature;
  locationTarget?: Props['locationTarget'];
  restored: MapViewMemory | null;
}) {
  const map = useMap();
  // O que estava selecionado quando o mapa montou: distingue o primeiro
  // enquadramento dos seguintes sem depender de quantas vezes o efeito rodou.
  const mounted = useRef({ selectedId: selectedFeature?.id, located: locationTarget?.requestedAt });

  useEffect(() => {
    if (!bbox) return;
    const [west, south, east, north] = bbox;
    const bounds = selectedFeature
      ? geoJSON(selectedFeature).getBounds()
      : latLngBounds([south, west], [north, east]);

    const fit = (animate: boolean) => {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const insets = scopeInsets(map);
      if (locationTarget) {
        if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          map.setView([locationTarget.latitude, locationTarget.longitude], 10, { animate: false });
        } else {
          map.flyTo([locationTarget.latitude, locationTarget.longitude], 10, {
            duration: 1.2,
            easeLinearity: 0.25,
          });
        }
        return;
      }
      if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        map.fitBounds(bounds, { ...insets, maxZoom: 10, animate: false });
        return;
      }
      map.flyToBounds(bounds, { ...insets, maxZoom: 10, duration: 0.6, easeLinearity: 0.15 });
    };

    // Vista restaurada do contexto anterior, no mesmo recorte e com a mesma
    // seleção: o mapa já está onde o usuário deixou.
    const center = map.getCenter();
    const keepsRestoredView =
      restored !== null &&
      restored.scopeKey === scopeKey &&
      mounted.current.selectedId === selectedFeature?.id &&
      mounted.current.located === locationTarget?.requestedAt &&
      Math.abs(map.getZoom() - restored.zoom) <= 0.25 &&
      Math.abs(center.lat - restored.center[0]) < 1e-6 &&
      Math.abs(center.lng - restored.center[1]) < 1e-6;
    if (!keepsRestoredView) fit(true);
    const onResize = () => fit(false);
    map.on('resize', onResize);
    return () => {
      map.off('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, scopeKey, selectedFeature?.id, locationTarget?.requestedAt]);

  return null;
}

export function MapView({
  onNationalMosaicPublished,
  presentation,
  collection,
  selectedCode = null,
  onSelect = () => {},
  onDrillDown,
  children,
  weatherByCode,
  fireByCode,
  fireMode,
  fireHours,
  rainMode,
  climateMode,
  dataLoading = false,
  onViewportChange,
  stateOutline,
  discoveredMosaic = [],
  discoveredMosaicVersion = 0,
  discoveredMosaicVersions = new Map<string, number>(),
  completeMosaicStates = new Set<string>(),
  exploredWeatherByCode,
  exploredFireByCode,
  nationalMosaic,
  nationalMosaicPaused = false,
  locationTarget,
}: Props) {
  const scopeKey = collection
    ? `${collection.scope.level}:${collection.scope.parent ?? 'root'}`
    : 'initial';
  const restored = useRef(lastView).current;

  return (
    <MapContainer
      center={restored?.center ?? BRAZIL_CENTER}
      zoom={restored?.zoom ?? BRAZIL_ZOOM}
      className="map-container"
      minZoom={3}
      maxZoom={12}
      zoomSnap={0.25}
      zoomDelta={0.25}
      scrollWheelZoom={false}
      inertia={true}
      inertiaDeceleration={3000}
      inertiaMaxSpeed={2000}
      zoomControl={false}
      attributionControl
      doubleClickZoom={false}
    >
      {}
      <Pane
        name="basemap"
        style={{
          zIndex: 200,
          pointerEvents: 'none',
        }}
      >
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={9}
          opacity={0.32}
          attribution='<a href="https://www.esri.com/">Esri</a>, USGS, NOAA'
        />
      </Pane>
      <WheelGestures />
      <RendererSync />
      <RememberView scopeKey={scopeKey} />
      {onViewportChange && <ViewportObserver onChange={onViewportChange} scopeKey={scopeKey} />}
      <Pane name="territory-hover" style={{ zIndex: 470, pointerEvents: 'none' }} />
      <Pane name="territory-selection" style={{ zIndex: 480, pointerEvents: 'none' }} />
      {collection && (
        <>
          <TerritoryLayer
            presentation={presentation}
            collection={collection}
            onSelect={onSelect}
            onDrillDown={onDrillDown}
            selectedCode={selectedCode}
            weatherByCode={weatherByCode}
            fireByCode={fireByCode}
            fireMode={fireMode}
            fireHours={fireHours}
            rainMode={rainMode}
            climateMode={climateMode}
            loading={dataLoading}
            discoveredStateCodes={completeMosaicStates}
          />
          <DiscoveredMosaicLayer
            features={discoveredMosaic}
            version={discoveredMosaicVersion}
            versions={discoveredMosaicVersions}
            visible={collection.scope.level === 'state'}
            completeStates={completeMosaicStates}
            weatherByCode={exploredWeatherByCode}
            fireByCode={exploredFireByCode}
            fireMode={fireMode}
            rainMode={rainMode}
            climateMode={climateMode}
          />
          <NationalMunicipalLayer
            onPublished={onNationalMosaicPublished}
            data={nationalMosaic}
            visible={
              collection.scope.level === 'state' &&
              Boolean(presentation || fireMode || rainMode || climateMode)
            }
            paused={nationalMosaicPaused}
            fireMode={fireMode}
            rainMode={rainMode}
            climateMode={climateMode}
          />
          <FitToScope
            bbox={collection.bbox}
            scopeKey={scopeKey}
            selectedFeature={
              collection.scope.level === 'municipality'
                ? collection.features.find((f) => f.id === selectedCode)
                : undefined
            }
            locationTarget={locationTarget}
            restored={restored}
          />
        </>
      )}
      {stateOutline && (
        <Pane name="state-outline" style={{ zIndex: 430, pointerEvents: 'none' }}>
          <GeoJSON
            key={`state-outline-${stateOutline.id ?? stateOutline.properties.ibgeCode}:halo`}
            data={stateOutline}
            interactive={false}
            style={STATE_HALO_STYLE as PathOptions}
          />
          <GeoJSON
            key={`state-outline-${stateOutline.id ?? stateOutline.properties.ibgeCode}:stroke`}
            data={stateOutline}
            interactive={false}
            style={STATE_OUTLINE_STYLE as PathOptions}
          />
        </Pane>
      )}
      {children}
    </MapContainer>
  );
}
