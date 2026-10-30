import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MapIndicatorMeta, MapValuesResponse } from '@/api/types';
import type { MapScopeState } from '@/features/map/useMapScope';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { presentationFor } from '@/features/socioeconomic/presentation';
import { yearForIndicator } from '@/features/socioeconomic/indicatorCategories';
import { INDICATOR_LAYERS, type IndicatorLayer } from './layers';
import { scheduleIdle } from '@/lib/idle';
import {
  prefetchEnvironment,
  useAlertValues,
  useEnvironmentIndicators,
  useEnvironmentValues,
} from './queries';

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

  // Os alertas do DETER não estão no catálogo: a API monta os valores com a janela mais recente.
  const alerts = layer === 'alerts';
  const catalog = useEnvironmentIndicators(scope.level, Boolean(layer) && !alerts && pageVisible);
  const current = catalog.data?.indicators.find((item) => item.key === indicatorKey);
  const year = yearForIndicator(current, requestedYear);
  const stored = useEnvironmentValues(
    scope.level,
    scope.parent,
    indicatorKey,
    year,
    Boolean(current) && scopeReady && pageVisible,
  );
  const alertValues = useAlertValues(
    scope.level,
    scope.parent,
    alerts && scopeReady && pageVisible,
  );
  const values = alerts ? alertValues : stored;
  const municipalEnabled =
    (alerts || Boolean(current)) &&
    !isDrilledDown &&
    territoryReady &&
    pageVisible &&
    Boolean(values.data);
  const storedMunicipal = useEnvironmentValues(
    'municipality',
    null,
    indicatorKey,
    year,
    municipalEnabled && !alerts,
  );
  const alertMunicipal = useAlertValues('municipality', null, municipalEnabled && alerts);
  const municipalValues = alerts ? alertMunicipal : storedMunicipal;
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
    if (!layer || alerts || !values.data || !pageVisible) return;
    return scheduleIdle(() => prefetchLayer(layer === 'forest' ? 'deforestation' : 'forest'), 1500);
  }, [layer, alerts, values.data, pageVisible, prefetchLayer]);
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
    loading:
      Boolean(layer) &&
      (alerts ? values.isPending : catalog.isPending || (Boolean(current) && values.isPending)),
    fetching: Boolean(layer) && (catalog.isFetching || values.isFetching),
    error: layer ? (catalog.error ?? values.error ?? municipalValues.error) : null,
  };
}
