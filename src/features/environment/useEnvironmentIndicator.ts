import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MapIndicatorMeta, MapValuesResponse } from '@/api/types';
import type { MapScopeState } from '@/features/map/useMapScope';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { presentationFor } from '@/features/socioeconomic/presentation';
import { yearForIndicator } from '@/features/socioeconomic/indicatorCategories';
import { INDICATOR_LAYERS, type IndicatorLayer } from './layers';
import { scheduleIdle } from '@/lib/idle';
import { prefetchEnvironment, useEnvironmentIndicators, useEnvironmentValues } from './queries';

interface Options {
  layer: IndicatorLayer | null;
  scope: MapScopeState;
  isDrilledDown: boolean;
  scopeReady: boolean;
  territoryReady: boolean;
  pageVisible: boolean;
}

// Desmatamento e Florestas: valores do recorte primeiro e, no Brasil, os
// municipais para o mosaico nacional. Nada roda com Fogo ou sem camada.
export function useEnvironmentIndicator({
  layer,
  scope,
  isDrilledDown,
  scopeReady,
  territoryReady,
  pageVisible,
}: Options) {
  const config = layer ? INDICATOR_LAYERS[layer] : null;
  const indicatorKey = config?.indicatorKey ?? '';
  const [requestedYear, setRequestedYear] = useState('latest');
  // Cada indicador tem a própria série; trocar de aba volta ao ano mais recente.
  useEffect(() => setRequestedYear('latest'), [indicatorKey]);

  const catalog = useEnvironmentIndicators(scope.level, Boolean(layer) && pageVisible);
  const current = catalog.data?.indicators.find((item) => item.key === indicatorKey);
  const year = yearForIndicator(current, requestedYear);
  const values = useEnvironmentValues(
    scope.level,
    scope.parent,
    indicatorKey,
    year,
    Boolean(current) && scopeReady && pageVisible,
  );
  const municipalEnabled =
    Boolean(current) && !isDrilledDown && territoryReady && pageVisible && Boolean(values.data);
  const municipalValues = useEnvironmentValues(
    'municipality',
    null,
    indicatorKey,
    year,
    municipalEnabled,
  );
  // A aba sob o cursor ou o dedo começa a vir antes do clique; com o mapa pronto,
  // a outra aba de dado chega com o navegador ocioso.
  const client = useQueryClient();
  const prefetchLayer = useCallback(
    (next: string) => {
      if (next === 'forest' || next === 'deforestation') void prefetchEnvironment(client, next);
    },
    [client],
  );
  useEffect(() => {
    if (!layer || !values.data || !pageVisible) return;
    return scheduleIdle(() => prefetchLayer(layer === 'forest' ? 'deforestation' : 'forest'), 1500);
  }, [layer, values.data, pageVisible, prefetchLayer]);
  // Sem dado ainda, uma apresentação vazia faz os territórios pulsarem como carga.
  const presentation = useMemo<TerritoryPresentation | undefined>(
    () =>
      !layer
        ? undefined
        : values.data
          ? presentationFor(values.data)
          : {
              key: `environment:${indicatorKey}:${year}`,
              colors: new Map(),
              values: new Set(),
              tooltips: new Map(),
            },
    [layer, values.data, indicatorKey, year],
  );
  const municipalPresentation = useMemo(
    () => (layer && municipalValues.data ? presentationFor(municipalValues.data) : undefined),
    [layer, municipalValues.data],
  );
  const indicator: MapIndicatorMeta | null =
    values.data?.indicator ??
    (current
      ? {
          key: current.key,
          name: current.name,
          unit: current.unit,
          decimalPlaces: current.decimalPlaces,
          year: year === 'latest' ? current.latestYear : Number(year),
          requestedYear: year,
          availableYears: current.availableYears,
        }
      : null);
  // A legenda passa da escala estadual para a municipal junto com o mosaico.
  const [published, setPublished] = useState<MapValuesResponse>();
  const onNationalPublished = useCallback(
    (shown: TerritoryPresentation | undefined) => {
      if (shown && shown === municipalPresentation && municipalValues.data)
        setPublished(municipalValues.data);
    },
    [municipalPresentation, municipalValues.data],
  );
  const legendData: MapValuesResponse | undefined =
    !isDrilledDown &&
    published?.indicator.key === indicatorKey &&
    published.indicator.year === municipalValues.data?.indicator.year &&
    published.indicator.requestedYear === year
      ? published
      : values.data;

  return {
    config,
    catalog,
    indicator,
    availableYears: current?.availableYears ?? [],
    year,
    setYear: setRequestedYear,
    values,
    municipalValues,
    presentation,
    municipalPresentation,
    onNationalPublished,
    legendData,
    prefetchLayer,
    loading: Boolean(layer) && (catalog.isPending || (Boolean(current) && values.isPending)),
    fetching: Boolean(layer) && (catalog.isFetching || values.isFetching),
    error: layer ? (catalog.error ?? values.error ?? municipalValues.error) : null,
  };
}
