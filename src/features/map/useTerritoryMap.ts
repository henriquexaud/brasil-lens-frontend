import { useEffect, useMemo, useRef } from 'react';
import { geoJSON } from 'leaflet';
import { useMapLayer, useSelectedBoundary, useVisibleMunicipalities } from '@/api/queries';
import type { MapFeatureCollection } from '@/api/types';
import { DiscoveredMosaic } from './discoveredMosaic';
import { resolveSelectedStateOutline } from './stateBoundary';
import type { MapViewport } from './ViewportObserver';
import type { MapScopeState } from './useMapScope';

interface TerritoryMapInput {
  scope: MapScopeState;
  isDrilledDown: boolean;
  viewport: MapViewport;
  selectedCode: string | null;
  pageVisible: boolean;
}

export function useTerritoryMap({
  scope,
  isDrilledDown,
  viewport,
  selectedCode,
  pageVisible,
}: TerritoryMapInput) {
  const mapLayer = useMapLayer({ level: scope.level, parent: scope.parent });
  const statesOutlineLayer = useMapLayer({ level: 'state' });
  const selectedStateOutline = useMemo(() => {
    if (!isDrilledDown || !scope.parent) return null;
    if (mapLayer.data?.parentFeature) {
      return mapLayer.data.parentFeature;
    }
    return resolveSelectedStateOutline(
      isDrilledDown,
      scope.parent,
      statesOutlineLayer.data?.scope.lod === 'detail' ? statesOutlineLayer.data?.features : null,
      statesOutlineLayer.data?.features,
    );
  }, [isDrilledDown, scope.parent, mapLayer.data?.parentFeature, statesOutlineLayer.data]);
  const closeMunicipalView =
    isDrilledDown && viewport.zoom >= 8 && viewport.scopeKey === `municipality:${scope.parent}`;
  const selectedBoundary = useSelectedBoundary(selectedCode);
  const stateViewportKey = `municipality:${scope.parent}`;
  const viewportIsInState = isDrilledDown && viewport.scopeKey === stateViewportKey;
  const discoveredMosaicRef = useRef(new DiscoveredMosaic());
  const completeMapsRef = useRef(new Map<string, MapFeatureCollection>());
  const lastExploredStateRef = useRef<string | null>(null);
  if (isDrilledDown && scope.parent) lastExploredStateRef.current = scope.parent;

  const isCurrentStateMesh =
    mapLayer.data?.scope.level === 'municipality' &&
    mapLayer.data.scope.parent === scope.parent &&
    (mapLayer.data.features.length ?? 0) > 0;

  if (isCurrentStateMesh && mapLayer.data) {
    const previous = scope.parent ? completeMapsRef.current.get(scope.parent) : undefined;
    if (scope.parent && (mapLayer.data.scope.lod === 'detail' || previous?.scope.lod !== 'detail')) {
      completeMapsRef.current.set(scope.parent, mapLayer.data);
    }
    discoveredMosaicRef.current.addCollection(mapLayer.data, scope.parent);
  }

  const hasCompleteMunicipalLayer =
    isCurrentStateMesh || Boolean(scope.parent && completeMapsRef.current.has(scope.parent));

  const visibleMunicipalities = useVisibleMunicipalities(
    viewportIsInState ? viewport.bbox : undefined,
    isDrilledDown &&
      Boolean(selectedStateOutline) &&
      viewportIsInState &&
      pageVisible &&
      !hasCompleteMunicipalLayer,
    scope.parent,
    Boolean(viewport.moving) || selectedBoundary.isFetching,
  );

  useEffect(() => {
    if (isDrilledDown && visibleMunicipalities.data?.scope.parent === scope.parent) {
      discoveredMosaicRef.current.add(scope.parent, visibleMunicipalities.data.features, 2);
    }
  }, [isDrilledDown, scope.parent, visibleMunicipalities.data]);

  useEffect(() => {
    if (isDrilledDown) discoveredMosaicRef.current.add(scope.parent, selectedBoundary.data?.features, 3);
  }, [isDrilledDown, scope.parent, selectedBoundary.data]);

  const effectiveCompleteMap = scope.parent ? completeMapsRef.current.get(scope.parent) : undefined;
  const municipalCollection = useMemo<MapFeatureCollection | undefined>(() => {
    if (!isDrilledDown || !selectedStateOutline) return undefined;
    const bounds = geoJSON(selectedStateOutline).getBounds();

    const baseFeatures =
      effectiveCompleteMap && effectiveCompleteMap.features.length > 0
        ? effectiveCompleteMap.features
        : (visibleMunicipalities.data?.scope.parent === scope.parent
            ? visibleMunicipalities.data.features
            : discoveredMosaicRef.current.forState(scope.parent));

    const byCode = new Map(baseFeatures.map((f) => [f.id, f]));
    for (const f of discoveredMosaicRef.current.forState(scope.parent)) byCode.set(f.id, f);
    for (const f of selectedBoundary.data?.features ?? []) byCode.set(f.id, f);
    const features = [...byCode.values()];
    if (features.length === 0) return undefined;
    return {
      type: 'FeatureCollection',
      scope: {
        level: 'municipality',
        parent: scope.parent,
        lod: 'canonical',
        count: features.length,
      },
      bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      features,
    };
  }, [
    isDrilledDown,
    selectedStateOutline,
    effectiveCompleteMap,
    visibleMunicipalities.data,
    selectedBoundary.data,
    scope.parent,
  ]);

  const collection = isDrilledDown
    ? (municipalCollection ?? effectiveCompleteMap ?? statesOutlineLayer.data)
    : mapLayer.data;
  const showsCurrentScope =
    collection?.scope.level === scope.level && (collection?.scope.parent ?? null) === scope.parent;
  const scopeReady = Boolean(showsCurrentScope && !mapLayer.isPlaceholderData);
  const territoryReady = isDrilledDown
    ? Boolean(
        selectedStateOutline &&
        ((collection?.features.length ?? 0) > 0 ||
          (mapLayer.data?.features.length ?? 0) > 0 ||
          (visibleMunicipalities.data?.features.length ?? 0) > 0 ||
          (selectedBoundary.data?.features.length ?? 0) > 0),
      )
    : Boolean(statesOutlineLayer.data && showsCurrentScope);
  const selectedFeature =
    (showsCurrentScope
      ? collection?.features.find((feature) => feature.properties.ibgeCode === selectedCode)
      : undefined) ??
    (selectedCode && selectedCode.length === 2
      ? statesOutlineLayer.data?.features.find((f) => f.properties.ibgeCode === selectedCode)
      : undefined) ??
    (selectedCode
      ? (selectedBoundary.data?.features.find((f) => f.properties.ibgeCode === selectedCode) ??
        municipalCollection?.features.find((f) => f.properties.ibgeCode === selectedCode) ??
        mapLayer.data?.features.find((f) => f.properties.ibgeCode === selectedCode))
      : undefined);
  const discoveredMosaicVersion = discoveredMosaicRef.current.version;
  const discoveredMosaic = useMemo(
    () => (isDrilledDown || discoveredMosaicVersion === 0 ? [] : discoveredMosaicRef.current.all()),
    [isDrilledDown, discoveredMosaicVersion],
  );
  const discoveredMosaicVersions = useMemo(
    () =>
      discoveredMosaicVersion === 0
        ? new Map<string, number>()
        : discoveredMosaicRef.current.versions(),
    [discoveredMosaicVersion],
  );
  // A new Set on every render would restyle every polygon on the map.
  const completeStatesKey = [...completeMapsRef.current.keys()].join(',');
  const completeMosaicStates = useMemo(
    () => new Set(completeStatesKey ? completeStatesKey.split(',') : []),
    [completeStatesKey],
  );

  return {
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    closeMunicipalView,
    selectedBoundary,
    visibleMunicipalities,
    collection,
    scopeReady,
    territoryReady,
    selectedFeature,
    discoveredMosaic,
    discoveredMosaicVersion,
    discoveredMosaicVersions,
    revealMosaicState: !isDrilledDown ? lastExploredStateRef.current : null,
    completeMosaicStates,
  };
}
