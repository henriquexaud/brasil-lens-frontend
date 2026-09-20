/** Composição e prioridade: mapa → camada atual → detalhes solicitados. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import {
  useContexts,
  useHydrography,
  useIndicators,
  useMapLayer,
  usePrefetchOverview,
  usePrefetchWeatherCurrent,
  useWeatherAlerts,
  useWeatherCurrent,
  useMunicipalityWeather,
} from '@/api/queries';
import type { DataContext, HydroQuery, MapQuery, MapScopeInput, SavedView, WeatherCity } from '@/api/types';
import { Select } from '@/components/Select';
import { ScopeHeader } from '@/components/ScopeHeader';
import { EmptyState, ErrorMessage, TopProgress } from '@/components/Feedback';
import { ControlPanel, LATEST_YEAR } from '@/features/controls/ControlPanel';
import { Legend } from '@/features/map/Legend';
import { MapView } from '@/features/map/MapView';
import { useMapScope } from '@/features/map/useMapScope';
import { SearchBox } from '@/features/search/SearchBox';
import { SavedViewsPanel } from '@/features/views/SavedViewsPanel';
import type { SearchResult } from '@/lib/searchIndex';
import { useDeferredReady } from '@/lib/useDeferredReady';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';

const HydrographyLayer = lazy(() =>
  import('@/features/map/HydrographyLayer').then((module) => ({
    default: module.HydrographyLayer,
  })),
);
const WeatherPanel = lazy(() =>
  import('@/features/weather/WeatherPanel').then((module) => ({ default: module.WeatherPanel })),
);
const WeatherLayer = lazy(() =>
  import('@/features/weather/WeatherLayer').then((module) => ({ default: module.WeatherLayer })),
);
const WeatherOptions = lazy(() =>
  import('@/features/weather/WeatherOptions').then((module) => ({
    default: module.WeatherOptions,
  })),
);
const WeatherLegend = lazy(() =>
  import('@/features/weather/WeatherLegend').then((module) => ({ default: module.WeatherLegend })),
);
const AlertsLayer = lazy(() =>
  import('@/features/weather/AlertsLayer').then((module) => ({ default: module.AlertsLayer })),
);
const TerritoryDetailPanel = lazy(() =>
  import('@/features/detail/TerritoryDetailPanel').then((module) => ({
    default: module.TerritoryDetailPanel,
  })),
);
const BrazilOverviewPanel = lazy(() =>
  import('@/features/detail/BrazilOverviewPanel').then((module) => ({
    default: module.BrazilOverviewPanel,
  })),
);
const WeatherStageBadge = lazy(() =>
  import('@/features/weather/WeatherStageBadge').then((module) => ({
    default: module.WeatherStageBadge,
  })),
);

export default function App() {
  const {
    scope,
    selectedCode,
    setSelectedCode,
    drillIntoState,
    applyScope,
    resetScope,
    isDrilledDown,
  } = useMapScope();
  const [indicatorKey, setIndicatorKey] = useState<string>(() => {
    const saved = loadSessionState();
    return typeof saved.indicatorKey === 'string' ? saved.indicatorKey : 'population';
  });
  const [year, setYear] = useState<string>(() => {
    const saved = loadSessionState();
    return typeof saved.year === 'string' ? saved.year : LATEST_YEAR;
  });
  const [context, setContext] = useState<DataContext>(() => {
    const saved = loadSessionState();
    if (
      saved.context === 'climate_environmental' ||
      saved.context === 'biodiversity' ||
      saved.context === 'sociopolitical'
    ) {
      return saved.context;
    }
    return 'sociopolitical';
  });
  const [showWeatherAlerts, setShowWeatherAlerts] = useState<boolean>(() => {
    const saved = loadSessionState();
    return typeof saved.showWeatherAlerts === 'boolean' ? saved.showWeatherAlerts : true;
  });
  const [showHydrography, setShowHydrography] = useState<boolean>(() => {
    const saved = loadSessionState();
    return typeof saved.showHydrography === 'boolean' ? saved.showHydrography : true;
  });
  const isClimate = context === 'climate_environmental';
  const client = useQueryClient();

  useEffect(() => {
    saveSessionState({ context });
  }, [context]);

  useEffect(() => {
    saveSessionState({ indicatorKey });
  }, [indicatorKey]);

  useEffect(() => {
    saveSessionState({ year });
  }, [year]);

  useEffect(() => {
    saveSessionState({ showWeatherAlerts });
  }, [showWeatherAlerts]);

  useEffect(() => {
    saveSessionState({ showHydrography });
  }, [showHydrography]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.activeElement?.closest('input, select, textarea, .search-slot')) return;
      if (selectedCode) setSelectedCode(null);
      else if (isDrilledDown) resetScope();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCode, isDrilledDown, setSelectedCode, resetScope]);

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      if (result.level === 'state') {
        if (isDrilledDown) resetScope();
        setSelectedCode(result.ibgeCode);
      } else if (result.parentCode) {
        drillIntoState(result.parentCode, result.parentName ?? result.name);
        setSelectedCode(result.ibgeCode);
      }
    },
    [isDrilledDown, resetScope, setSelectedCode, drillIntoState],
  );

  const contextsQuery = useContexts();
  const contexts = contextsQuery.data?.contexts ?? [];
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
  const collection = mapLayer.data;
  const statesOutlineLayer = useMapLayer({ level: 'state', year: LATEST_YEAR }, true);
  const selectedStateOutline = useMemo(() => {
    if (!isDrilledDown || !scope.parent) return null;
    return (
      statesOutlineLayer.data?.features.find(
        (feature) =>
          feature.properties.ibgeCode === scope.parent ||
          feature.properties.abbreviation === scope.parent,
      ) ?? null
    );
  }, [isDrilledDown, scope.parent, statesOutlineLayer.data]);
  const showsCurrentScope =
    collection?.scope.level === scope.level && (collection?.scope.parent ?? null) === scope.parent;
  const scopeReady = Boolean(showsCurrentScope && !mapLayer.isPlaceholderData);
  const backgroundReady = useDeferredReady(`${context}:${scope.level}:${scope.parent}`, scopeReady);
  const selectedFeature = showsCurrentScope
    ? collection?.features.find((feature) => feature.properties.ibgeCode === selectedCode)
    : undefined;

  const selectedWeather = useWeatherCurrent(selectedCode, isClimate && Boolean(selectedCode));
  const nationalWeather = useWeatherCurrent(null, isClimate && backgroundReady && !isDrilledDown);
  const forecastBusy = useIsFetching({ queryKey: ['weather', 'forecast'] });
  const municipalities = useMunicipalityWeather(
    scope.parent,
    isClimate && backgroundReady,
    selectedWeather.isFetching || forecastBusy > 0,
  );
  const alerts = useWeatherAlerts(isClimate && showWeatherAlerts);
  const hydroQuery: HydroQuery = useMemo(() => {
    if (isDrilledDown) {
      if (selectedCode && selectedCode.length === 7) {
        return { level: 'municipality', parent: selectedCode, includeWaterBodies: true };
      }
      return { level: 'state', parent: scope.parent, includeWaterBodies: true };
    }
    if (selectedCode && selectedCode.length === 2) {
      return { level: 'state', parent: selectedCode, includeWaterBodies: true };
    }
    return { level: 'country', includeWaterBodies: true };
  }, [isDrilledDown, scope.parent, selectedCode]);
  const hydrographyLayer = useHydrography(hydroQuery, isClimate && showHydrography);
  const prefetchOverview = usePrefetchOverview();
  const prefetchWeather = usePrefetchWeatherCurrent();

  const [userSelectedCities, setUserSelectedCities] = useState<Map<string, WeatherCity>>(() => new Map());

  // Limpa as cidades manuais ao trocar de estado ou voltar ao mapa nacional
  useEffect(() => {
    setUserSelectedCities(new Map());
  }, [scope.parent]);

  // Mantém no mapa qualquer município que for consultado/selecionado pelo usuário
  useEffect(() => {
    if (isDrilledDown && selectedWeather.data?.cities?.length) {
      setUserSelectedCities((prev) => {
        const next = new Map(prev);
        for (const c of selectedWeather.data?.cities ?? []) {
          next.set(c.id, c);
        }
        return next;
      });
    }
  }, [isDrilledDown, selectedWeather.data]);

  const weatherCities = useMemo(() => {
    const cities = isDrilledDown
      ? (municipalities.data?.pages.flatMap((page) => page.cities) ?? [])
      : (nationalWeather.data?.cities ?? []);
    const byId = new Map(cities.map((city) => [city.id, city]));
    if (isDrilledDown) {
      for (const c of userSelectedCities.values()) {
        byId.set(c.id, c);
      }
    }
    if (selectedCode) {
      for (const c of selectedWeather.data?.cities ?? []) {
        byId.set(c.id, c);
      }
    }
    return [...byId.values()];
  }, [
    isDrilledDown,
    municipalities.data,
    nationalWeather.data,
    userSelectedCities,
    selectedCode,
    selectedWeather.data,
  ]);
  const weatherByCode = useMemo(() => {
    const result = new Map<string, WeatherCity>(weatherCities.map((city) => [city.id, city]));
    for (const feature of collection?.features ?? []) {
      const abbreviation = feature.properties.abbreviation;
      const city = abbreviation ? result.get(abbreviation) : undefined;
      if (city) result.set(feature.properties.ibgeCode, city);
    }
    return result;
  }, [weatherCities, collection]);
  const onPreview = useCallback(
    (code: string) => {
      if (isClimate) {
        if (!weatherByCode.has(code)) prefetchWeather(code);
      } else prefetchOverview(code);
    },
    [isClimate, weatherByCode, prefetchWeather, prefetchOverview],
  );
  const city = selectedCode
    ? (weatherByCode.get(selectedCode) ?? selectedWeather.data?.cities[0])
    : undefined;

  const currentView: MapScopeInput = useMemo(
    () => ({ level: scope.level, parentCode: scope.parent, indicatorKey, year: effectiveYear }),
    [scope.level, scope.parent, indicatorKey, effectiveYear],
  );
  const applySavedView = useCallback(
    (view: SavedView, parentName: string | null) => {
      applyScope({ level: view.level, parent: view.parentCode, parentName });
      setIndicatorKey(view.indicatorKey);
      setYear(view.year);
    },
    [applyScope],
  );
  const failure =
    contextsQuery.error ?? (isClimate ? mapLayer.error : (indicatorsQuery.error ?? mapLayer.error));
  const currentWeather = selectedCode
    ? selectedWeather.data
    : isDrilledDown
      ? municipalities.data?.pages[0]
      : nationalWeather.data;
  const weatherLoading = isDrilledDown ? municipalities.isFetching : nationalWeather.isFetching;
  const weatherError = isDrilledDown ? municipalities.error : nationalWeather.error;
  const weatherOutdated = isDrilledDown
    ? municipalities.data?.pages.some((page) => page.status === 'stale')
    : nationalWeather.data?.status === 'stale';
  const weatherNotice = weatherOutdated
    ? 'Dados anteriores'
    : weatherError && weatherCities.length > 0
      ? 'Cobertura parcial'
      : undefined;

  return (
    <div className="app">
      {(mapLayer.isFetching ||
        (isClimate && hydrographyLayer.isFetching) ||
        (!isClimate && indicatorsQuery.isFetching) ||
        (isClimate && (municipalities.isFetching || selectedWeather.isFetching))) && (
        <TopProgress />
      )}
      {isClimate && isDrilledDown && (
        <Suspense fallback={null}>
          <WeatherStageBadge
            isFetching={municipalities.isFetching}
            stage={municipalities.stage}
            maxStages={municipalities.maxStages}
            isComplete={municipalities.isCoverageComplete}
            totalCities={municipalities.totalCoverageCities}
          />
        </Suspense>
      )}
      <MapView
        collection={collection}
        selectedCode={selectedCode}
        onSelect={setSelectedCode}
        onHover={backgroundReady ? onPreview : undefined}
        onDrillDown={drillIntoState}
        weatherByCode={isClimate ? weatherByCode : undefined}
        stateOutline={selectedStateOutline}
      >
        <Suspense fallback={null}>
          {isClimate && showHydrography && <HydrographyLayer collection={hydrographyLayer.data} />}
          {isClimate && showWeatherAlerts && <AlertsLayer collection={alerts.data} />}
          {isClimate && (
            <WeatherLayer cities={weatherCities} selectedId={city?.id} municipal={isDrilledDown} />
          )}
        </Suspense>
      </MapView>
      <SearchBox
        onSelect={handleSearchSelect}
        backgroundReady={backgroundReady}
        onPreview={onPreview}
      />
      <div className="panel-slot">
        <aside className="panel">
          <div className="panel-section context-section">
            {contexts.length > 1 && (
              <Select
                id="context"
                label="Contexto de dados"
                hideLabel
                value={context}
                options={contexts.map((item) => ({
                  value: item.key,
                  label:
                    item.indicatorCount > 0 || item.key === 'climate_environmental'
                      ? item.name
                      : `${item.name} (em breve)`,
                }))}
                onChange={(value) => setContext(value as DataContext)}
              />
            )}
            <ScopeHeader
              name={scope.parentName ?? 'Brasil'}
              onBack={isDrilledDown ? resetScope : undefined}
            />
          </div>
          {!isClimate && indicators.length > 0 && (
            <ControlPanel
              indicators={indicators}
              selectedIndicatorKey={indicatorKey}
              onIndicatorChange={setIndicatorKey}
              selectedYear={effectiveYear}
              onYearChange={setYear}
              resolvedYear={showsCurrentScope ? (collection?.indicator?.year ?? null) : null}
            />
          )}
          {failure && (
            <div className="panel-section">
              <ErrorMessage error={failure} />
            </div>
          )}
          {!isClimate && !failure && !indicatorsQuery.isPending && indicators.length === 0 && (
            <div className="panel-section">
              <EmptyState title="Dados em breve" />
            </div>
          )}
          {scopeReady && collection?.features.length === 0 && (
            <div className="panel-section">
              <EmptyState title="Nenhum território disponível neste recorte" />
            </div>
          )}
          <Suspense
            fallback={
              <div className="panel-section" role="status">
                Carregando…
              </div>
            }
          >
            {selectedCode ? (
              isClimate ? (
                <WeatherPanel
                  key={selectedCode}
                  code={selectedCode}
                  territory={selectedFeature?.properties}
                  city={city}
                  data={selectedWeather.data}
                  error={selectedWeather.error}
                  loading={selectedWeather.isPending}
                  onClose={() => setSelectedCode(null)}
                  onDrillDown={drillIntoState}
                />
              ) : (
                <TerritoryDetailPanel
                  key={selectedCode}
                  feature={selectedFeature}
                  indicator={collection?.indicator ?? null}
                  onClose={() => setSelectedCode(null)}
                  onDrillDown={drillIntoState}
                />
              )
            ) : (
              !isClimate &&
              !isDrilledDown && (
                <BrazilOverviewPanel
                  indicator={collection?.indicator ?? null}
                  selectedYear={effectiveYear}
                />
              )
            )}
          </Suspense>
          {isClimate && !selectedCode && weatherCities.length === 0 && (
            <p className="panel-section navigation-hint" role="status">
              {weatherError ? 'Clima indisponível no momento.' : 'Carregando clima…'}
            </p>
          )}
          <Suspense fallback={null}>
            {isClimate && (
              <WeatherOptions
                showAlerts={showWeatherAlerts}
                onToggleAlerts={setShowWeatherAlerts}
                showHydrography={showHydrography}
                onToggleHydrography={setShowHydrography}
                hydrographyLoading={hydrographyLayer.isFetching}
                code={selectedCode ?? scope.parent}
                current={currentWeather}
                error={weatherError}
                loading={weatherLoading || selectedWeather.isFetching}
                alertsData={alerts.data}
                alertsPending={alerts.isPending}
                onRefresh={() => {
                  void client.invalidateQueries({ queryKey: ['weather'] });
                }}
              />
            )}
          </Suspense>
          {!isClimate && indicators.length > 0 && (
            <SavedViewsPanel
              current={currentView}
              currentParentName={scope.parentName}
              indicators={indicators}
              onApply={applySavedView}
            />
          )}
        </aside>
      </div>
      {!failure && (
        <div className="legend-slot">
          <Suspense fallback={null}>
            {isClimate ? (
              <WeatherLegend notice={weatherNotice} />
            ) : (
              <Legend
                indicator={collection?.indicator ?? null}
                classification={collection?.classification ?? null}
                statistics={collection?.statistics ?? null}
              />
            )}
          </Suspense>
        </div>
      )}
    </div>
  );
}
