import { useEffect, useMemo, useRef } from 'react';
import { geoJSON } from 'leaflet';
import {
  useIndicators,
  useMapLayer,
  useSelectedBoundary,
  useVisibleMunicipalities,
} from '@/api/queries';
import type {
  DataContext,
  MapFeature,
  MapFeatureCollection,
  MapIndicatorMeta,
  MapQuery,
} from '@/api/types';
import { LATEST_YEAR } from '@/features/controls/ControlPanel';
import { resolveSelectedStateOutline } from './stateBoundary';
import type { MapViewport } from './ViewportObserver';
import type { MapScopeState } from './useMapScope';
import { useDeferredReady } from '@/lib/useDeferredReady';

interface TerritoryMapInput {
  scope: MapScopeState;
  context: DataContext;
  isClimate: boolean;
  indicatorKey: string;
  year: string;
  isDrilledDown: boolean;
  viewport: MapViewport;
  selectedCode: string | null;
  pageVisible: boolean;
}

/** Resolve catálogo, malha visível, seleção e barreira para as camadas temáticas. */
export function useTerritoryMap({
  scope,
  context,
  isClimate,
  indicatorKey,
  year,
  isDrilledDown,
  viewport,
  selectedCode,
  pageVisible,
}: TerritoryMapInput) {
  const indicatorsQuery = useIndicators(scope.level, context, !isClimate);
  const indicators = indicatorsQuery.data?.indicators ?? [];
  const currentIndicator = indicators.find((indicator) => indicator.key === indicatorKey);
  const effectiveYear = useMemo(() => {
    if (year === LATEST_YEAR) return year;
    const years = currentIndicator?.availableYears ?? [];
    if (indicatorsQuery.isPlaceholderData || years.length === 0) return year;
    return years.includes(Number(year)) ? year : LATEST_YEAR;
  }, [year, currentIndicator, indicatorsQuery.isPlaceholderData]);
  const mapQuery: MapQuery = useMemo(
    () => ({
      level: scope.level,
      parent: scope.parent,
      indicator: isClimate ? undefined : indicatorKey,
      year: isClimate ? LATEST_YEAR : effectiveYear,
    }),
    [scope.level, scope.parent, indicatorKey, effectiveYear, isClimate],
  );
  // O indicador padrão é conhecido: mapa e catálogo podem começar juntos.
  const mapLayer = useMapLayer(
    mapQuery,
    isClimate ||
      indicators.length > 0 ||
      (context === 'sociopolitical' && indicatorsQuery.isPending),
  );
  // Mesma malha da visão nacional: a consulta de geometria é compartilhada.
  const statesOutlineLayer = useMapLayer({ level: 'state', year: LATEST_YEAR }, true);
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
  const selectedBoundary = useSelectedBoundary(selectedCode, isClimate);
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
    isClimate &&
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
  const climateMunicipalCollection = useMemo<MapFeatureCollection | undefined>(() => {
    if (!isClimate || !isDrilledDown || !selectedStateOutline) return undefined;
    const bounds = geoJSON(selectedStateOutline).getBounds();
    const completeMap = isCurrentStateMesh
      ? mapLayer.data
      : lastCompleteMunicipalMapRef.current;

    const baseFeatures =
      completeMap && completeMap.features.length > 0
        ? completeMap.features
        : (visibleMunicipalities.data?.features ?? [...accumulatedMunicipalitiesRef.current.values()]);

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
      indicator: null,
      statistics: null,
      classification: null,
    };
  }, [
    isClimate,
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

  const collection =
    isClimate && isDrilledDown
      ? (effectiveCompleteMap ?? climateMunicipalCollection ?? statesOutlineLayer.data)
      : (mapLayer.data ?? (isDrilledDown ? effectiveCompleteMap : undefined));
  const showsCurrentIndicator = isClimate || collection?.indicator?.key === indicatorKey;
  const showsCurrentScope =
    collection?.scope.level === scope.level &&
    (collection?.scope.parent ?? null) === scope.parent &&
    showsCurrentIndicator;
  const scopeReady = Boolean(showsCurrentScope && (isClimate || !mapLayer.isPlaceholderData));
  const currentIndicatorMeta = useMemo<MapIndicatorMeta | null>(() => {
    if (!currentIndicator) return null;
    return {
      key: currentIndicator.key,
      name: currentIndicator.name,
      unit: currentIndicator.unit,
      decimalPlaces: currentIndicator.decimalPlaces,
      year:
        collection?.indicator?.key === indicatorKey
          ? collection.indicator.year
          : (currentIndicator.latestYear ?? (Number(effectiveYear) || null)),
      requestedYear: effectiveYear,
      availableYears: currentIndicator.availableYears,
    };
  }, [currentIndicator, collection?.indicator, indicatorKey, effectiveYear]);
  const backgroundReady =
    useDeferredReady(`${context}:${scope.level}:${scope.parent}`, scopeReady) && pageVisible;
  // A prontidão territorial é deliberadamente independente de clima. Ela é
  // a barreira que impede camadas pesadas de aparecerem antes das fronteiras:
  // no país, a malha estadual; dentro de uma UF, o primeiro lote municipal
  // (ou o município selecionado, quando ele foi buscado diretamente).
  const territoryReady = isClimate
    ? isDrilledDown
      ? Boolean(
          selectedStateOutline &&
          ((collection?.features.length ?? 0) > 0 ||
            (mapLayer.data?.features.length ?? 0) > 0 ||
            (visibleMunicipalities.data?.features.length ?? 0) > 0 ||
            (selectedBoundary.data?.features.length ?? 0) > 0),
        )
      : Boolean(statesOutlineLayer.data && showsCurrentScope)
    : scopeReady;
  const selectedFeature =
    (showsCurrentScope
      ? collection?.features.find((feature) => feature.properties.ibgeCode === selectedCode)
      : undefined) ??
    (selectedCode && selectedCode.length === 2
      ? statesOutlineLayer.data?.features.find((f) => f.properties.ibgeCode === selectedCode)
      : undefined) ??
    (selectedCode
      ? (selectedBoundary.data?.features.find((f) => f.properties.ibgeCode === selectedCode) ??
        climateMunicipalCollection?.features.find((f) => f.properties.ibgeCode === selectedCode) ??
        (mapLayer.data?.indicator?.key === indicatorKey
          ? mapLayer.data?.features.find((f) => f.properties.ibgeCode === selectedCode)
          : undefined))
      : undefined);

  return {
    indicatorsQuery,
    indicators,
    effectiveYear,
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    closeMunicipalView,
    selectedBoundary,
    visibleMunicipalities,
    climateMunicipalCollection,
    collection,
    showsCurrentScope,
    scopeReady,
    currentIndicatorMeta,
    backgroundReady,
    territoryReady,
    selectedFeature,
  };
}
