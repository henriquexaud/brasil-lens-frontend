import { useEffect, useMemo, useRef } from 'react';
import { geoJSON } from 'leaflet';
import { useMapLayer, useSelectedBoundary, useVisibleMunicipalities } from '@/api/queries';
import type { MapFeature, MapFeatureCollection } from '@/api/types';
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

/** Resolve malha visível, seleção e prontidão das camadas temáticas. */
export function useTerritoryMap({
  scope,
  isDrilledDown,
  viewport,
  selectedCode,
  pageVisible,
}: TerritoryMapInput) {
  const mapLayer = useMapLayer({ level: scope.level, parent: scope.parent });
  // Mesma malha da visão nacional: a consulta de geometria é compartilhada.
  const statesOutlineLayer = useMapLayer({ level: 'state' }, true);
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
  const selectedBoundary = useSelectedBoundary(selectedCode, true);
  const stateViewportKey = `municipality:${scope.parent}`;
  const viewportIsInState = isDrilledDown && viewport.scopeKey === stateViewportKey;
  const lastStateParentRef = useRef<string | null>(null);
  const lastCompleteMunicipalMapRef = useRef<MapFeatureCollection | undefined>(undefined);
  const accumulatedMunicipalitiesRef = useRef<Map<string, MapFeature>>(new Map());

  if (lastStateParentRef.current !== scope.parent) {
    lastStateParentRef.current = scope.parent;
    lastCompleteMunicipalMapRef.current = undefined;
    accumulatedMunicipalitiesRef.current.clear();
  }

  const isCurrentStateMesh =
    mapLayer.data?.scope.level === 'municipality' &&
    mapLayer.data.scope.parent === scope.parent &&
    (mapLayer.data.features.length ?? 0) > 0;

  if (isCurrentStateMesh && mapLayer.data) {
    lastCompleteMunicipalMapRef.current = mapLayer.data;
  }

  const hasCompleteMunicipalLayer =
    isCurrentStateMesh || Boolean(lastCompleteMunicipalMapRef.current);

  const visibleMunicipalities = useVisibleMunicipalities(
    // A malha municipal acompanha a janela visível apenas se a malha do estado ainda não estiver carregada.
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
    if (visibleMunicipalities.data?.features) {
      for (const f of visibleMunicipalities.data.features) {
        accumulatedMunicipalitiesRef.current.set(f.id, f);
      }
    }
  }, [visibleMunicipalities.data]);

  useEffect(() => {
    if (selectedBoundary.data?.features) {
      for (const f of selectedBoundary.data.features) {
        accumulatedMunicipalitiesRef.current.set(f.id, f);
      }
    }
  }, [selectedBoundary.data]);

  // O contorno do estado permite navegar imediatamente, antes dos lotes municipais.
  const municipalCollection = useMemo<MapFeatureCollection | undefined>(() => {
    if (!isDrilledDown || !selectedStateOutline) return undefined;
    const bounds = geoJSON(selectedStateOutline).getBounds();
    const completeMap = isCurrentStateMesh ? mapLayer.data : lastCompleteMunicipalMapRef.current;

    const baseFeatures =
      completeMap && completeMap.features.length > 0
        ? completeMap.features
        : (visibleMunicipalities.data?.features ?? [
            ...accumulatedMunicipalitiesRef.current.values(),
          ]);

    const byCode = new Map(baseFeatures.map((f) => [f.id, f]));
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
    isCurrentStateMesh,
    mapLayer.data,
    visibleMunicipalities.data,
    selectedBoundary.data,
    scope.parent,
  ]);
  const effectiveCompleteMap = isCurrentStateMesh
    ? mapLayer.data
    : lastCompleteMunicipalMapRef.current;

  const collection = isDrilledDown
    ? (effectiveCompleteMap ?? municipalCollection ?? statesOutlineLayer.data)
    : mapLayer.data;
  const showsCurrentScope =
    collection?.scope.level === scope.level && (collection?.scope.parent ?? null) === scope.parent;
  const scopeReady = Boolean(showsCurrentScope && !mapLayer.isPlaceholderData);
  // A prontidão territorial é deliberadamente independente de clima. Ela é
  // a barreira que impede camadas pesadas de aparecerem antes das fronteiras:
  // no país, a malha estadual; dentro de uma UF, o primeiro lote municipal
  // (ou o município selecionado, quando ele foi buscado diretamente).
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

  return {
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    closeMunicipalView,
    selectedBoundary,
    visibleMunicipalities,
    municipalCollection,
    collection,
    scopeReady,
    territoryReady,
    selectedFeature,
  };
}
