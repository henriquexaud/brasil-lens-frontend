import 'leaflet/dist/leaflet.css';

import { latLngBounds, geoJSON, type PathOptions, type PolylineOptions } from 'leaflet';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
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
import { ViewportObserver, type MapViewport } from './ViewportObserver';
import { WheelGestures } from './WheelGestures';
import { RendererSync } from './RendererSync';
import type { FireMode } from '@/features/fire/fireDensity';
import { scopeInsets } from './viewport';

const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

const STATE_HALO_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: '#ffffff',
  weight: 4.2,
  opacity: 0.75,
  className: 'state-selected-halo',
};

const STATE_OUTLINE_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: 'rgba(71, 85, 105, 0.85)',
  weight: 1.8,
  opacity: 0.95,
  className: 'state-selected-outline',
};

interface Props {
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
}: {
  bbox: BoundingBox | undefined;
  scopeKey: string;
  selectedFeature?: MapFeature;
  locationTarget?: Props['locationTarget'];
}) {
  const map = useMap();

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

    fit(true);
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
  locationTarget,
}: Props) {
  const scopeKey = collection
    ? `${collection.scope.level}:${collection.scope.parent ?? 'root'}`
    : 'initial';

  return (
    <MapContainer
      center={BRAZIL_CENTER}
      zoom={BRAZIL_ZOOM}
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
      {onViewportChange && <ViewportObserver onChange={onViewportChange} scopeKey={scopeKey} />}
      <Pane name="territory-hover" style={{ zIndex: 470, pointerEvents: 'none' }} />
      <Pane name="territory-selection" style={{ zIndex: 480, pointerEvents: 'none' }} />
      {collection && (
        <>
          <TerritoryLayer
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
          <FitToScope
            bbox={collection.bbox}
            scopeKey={scopeKey}
            selectedFeature={
              collection.scope.level === 'municipality'
                ? collection.features.find((f) => f.id === selectedCode)
                : undefined
            }
            locationTarget={locationTarget}
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
