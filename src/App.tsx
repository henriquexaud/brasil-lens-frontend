/** Composição e prioridade: mapa → camada atual → detalhes solicitados. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { clearSourcePauses, requestForcedWeatherRefresh } from '@/api/client';
import {
  weatherCurrentOptions,
  useNationalWeather,
  useFireHotspots,
  useFireSummary,
  useViewportWeather,
  useHydrography,
  useWeatherAlerts,
  useWeatherCurrent,
  useMunicipalityWeather,
  useUserStateWeather,
  FIRE_HOTSPOT_HOURS,
} from '@/api/queries';
import type {
  FireHotspotQuery,
  FireMunicipality,
  FollowedMunicipality,
  HydroQuery,
  WeatherCity,
} from '@/api/types';
import { ScopeHeader } from '@/components/ScopeHeader';
import { EmptyState, ErrorMessage, TopProgress } from '@/components/Feedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MapView } from '@/features/map/MapView';
import type { MapViewport } from '@/features/map/ViewportObserver';
import { fireMode, hydroZoom } from '@/features/fire/fireDensity';
import { useMapScope } from '@/features/map/useMapScope';
import { WeatherThematicSwitch } from '@/features/weather/WeatherThematicSwitch';
import { useTerritoryMap } from '@/features/map/useTerritoryMap';
import { SearchBox, type SearchResult } from '@/features/search/SearchBox';
import { FollowedMunicipalitiesPanel } from '@/features/follow/FollowedMunicipalitiesPanel';
import type { FollowTarget } from '@/features/follow/useFollowedMunicipalities';
import type { LocatedMunicipality } from '@/features/search/LocationButton';
import { usePageVisible } from '@/lib/usePageVisible';
import { useDeferredReady } from '@/lib/useDeferredReady';
import { useWeatherMapData } from '@/features/weather/useWeatherMapData';
import { useAppPreferences } from '@/app/useAppPreferences';

const HydrographyLayer = lazy(() =>
  import('@/features/map/HydrographyLayer').then((module) => ({
    default: module.HydrographyLayer,
  })),
);
const FireLegend = lazy(() =>
  import('@/features/fire/FireLegend').then((m) => ({ default: m.FireLegend })),
);
const FireOverview = lazy(() =>
  import('@/features/fire/FireOverview').then((m) => ({ default: m.FireOverview })),
);
const RainLegend = lazy(() =>
  import('@/features/rainfall/RainLegend').then((m) => ({ default: m.RainLegend })),
);
const RainOverview = lazy(() =>
  import('@/features/rainfall/RainOverview').then((m) => ({ default: m.RainOverview })),
);
const ClimateOverview = lazy(() =>
  import('@/features/weather/ClimateOverview').then((m) => ({ default: m.ClimateOverview })),
);
const FireHotspotsLayer = lazy(() =>
  import('@/features/fire/FireHotspotsLayer').then((module) => ({
    default: module.FireHotspotsLayer,
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
export default function App() {
  const { scope, selectedCode, setSelectedCode, drillIntoState, resetScope, isDrilledDown } =
    useMapScope();
  const {
    showWeatherAlerts,
    setShowWeatherAlerts,
    showHydrography,
    setShowHydrography,
    showClimate,
    showFireHotspots,
    showRainfall,
    weatherLayerActive,
    handleToggleClimate,
    handleToggleFireHotspots,
    handleToggleRainfall,
  } = useAppPreferences();

  const [viewport, setViewport] = useState<MapViewport>({ zoom: 4 });
  const activeFireMode = fireMode(viewport.zoom);
  const [locationTarget, setLocationTarget] = useState<{
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null>(null);
  const hydroDetail = hydroZoom(viewport.zoom);
  const [fireMapError, setFireMapError] = useState(false);
  const [mobilePeek, setMobilePeek] = useState(false);
  useEffect(() => {
    setFireMapError(false);
  }, [scope.level, scope.parent, showFireHotspots]);
  useEffect(() => {
    if (selectedCode) {
      setMobilePeek(false);
    }
  }, [selectedCode]);
  const pageVisible = usePageVisible();
  const client = useQueryClient();

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
      setLocationTarget(null);
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

  const handleLocated = useCallback(
    ({ territory, latitude, longitude }: LocatedMunicipality) => {
      if (!territory.parent) return;
      drillIntoState(territory.parent.ibgeCode, territory.parent.name);
      setSelectedCode(territory.ibgeCode);
      setLocationTarget({ code: territory.ibgeCode, latitude, longitude, requestedAt: Date.now() });
    },
    [drillIntoState, setSelectedCode],
  );
  const {
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
  } = useTerritoryMap({
    scope,
    isDrilledDown,
    viewport,
    selectedCode,
    pageVisible,
  });

  // A camada temática ativa só começa depois de a base territorial estar pronta.
  const fireHotspotQuery: FireHotspotQuery = useMemo(
    () => ({
      level: isDrilledDown && scope.parent ? 'state' : 'country',
      parent: isDrilledDown && scope.parent ? scope.parent : undefined,
      hours: FIRE_HOTSPOT_HOURS,
    }),
    [isDrilledDown, scope.parent],
  );
  const fireLayerRequested = showFireHotspots && territoryReady && pageVisible;
  const fireHotspotsLayer = useFireHotspots(fireHotspotQuery, fireLayerRequested);
  const fireLayerSettled = Boolean(fireHotspotsLayer.data || fireHotspotsLayer.error);
  // As camadas temáticas são exclusivas também na rede: com focos ativos nada
  // de clima é consultado, e com clima ou chuva o INPE não é consultado.
  const weatherStageReady = weatherLayerActive && territoryReady && pageVisible;

  const fireSummaryWanted = fireLayerRequested && Boolean(fireHotspotsLayer.data);
  const fireSummaryDeferred = useDeferredReady(
    `fire-summary:${scope.parent ?? 'BR'}:${fireHotspotsLayer.data?.metadata.windowEnd ?? 'none'}`,
    fireSummaryWanted,
  );
  // Longe, o resumo é a própria camada (a coropleta): sai assim que a janela é
  // conhecida. De perto, espera a ociosidade para não disputar com os pontos.
  const fireSummaryReady =
    activeFireMode === 'territorial' ? fireSummaryWanted : fireSummaryDeferred;
  const fireSummary = useFireSummary(
    fireHotspotQuery,
    fireHotspotsLayer.data?.metadata.windowEnd,
    fireSummaryReady,
  );

  const selectedWeather = useWeatherCurrent(
    selectedCode,
    weatherStageReady && Boolean(selectedCode),
  );
  const nationalWeather = useNationalWeather(
    weatherStageReady && !isDrilledDown,
    selectedWeather.isFetching || Boolean(viewport.moving),
  );
  useEffect(() => {
    // Selecionar uma UF mostra a sua capital: a leitura das capitais já serve,
    // sem nova ida à rede. A média do estado não é essa leitura.
    const data = nationalWeather.capitals;
    if (!data) return;
    const updatedAt = Date.parse(data.fetchedAt);
    for (const state of statesOutlineLayer.data?.features ?? []) {
      const city = data.cities.find((item) => item.id === state.properties.abbreviation);
      const key = weatherCurrentOptions(state.id).queryKey;
      if (city && (client.getQueryState(key)?.dataUpdatedAt ?? 0) < updatedAt) {
        client.setQueryData(key, { ...data, cities: [city], nextOffset: null }, { updatedAt });
      }
    }
  }, [client, nationalWeather.capitals, statesOutlineLayer.data]);
  const forecastBusy = useIsFetching({ queryKey: ['weather', 'forecast'] });
  const viewportWeatherBusy = useIsFetching({ queryKey: ['weather', 'viewport'] });
  // Pausa de requisições de tela (viewport) apenas durante movimento do mapa ou seleção explícita
  const pauseNearbyWeather =
    selectedWeather.isFetching || forecastBusy > 0 || Boolean(viewport.moving);

  // Prioridade para requisições ativas do usuário e visão municipal aproximada:
  // pausa lotes de fundo do estado completo quando o usuário estiver focado nas cidades da tela,
  // ou durante fetches prioritários e movimento do mapa.
  const pauseMunicipalBatching =
    closeMunicipalView || pauseNearbyWeather || viewportWeatherBusy > 0;

  const stateWeather = useUserStateWeather(scope.parent, weatherStageReady && isDrilledDown);
  // Lotes municipais são o caminho alternativo ao clima do estado inteiro e só
  // começam se `/weather/state` falhar: quando ele responde, já cobre todos os
  // municípios, e um lote disparado junto seria uma consulta à Open-Meteo
  // descartada pela tela.
  const municipalBatchingEnabled =
    weatherStageReady && !stateWeather.data && stateWeather.isError && !stateWeather.isFetching;
  const municipalities = useMunicipalityWeather(
    scope.parent,
    municipalBatchingEnabled,
    pauseMunicipalBatching,
  );
  const nearbyWeather = useViewportWeather(
    viewport.bbox,
    isDrilledDown ? scope.parent : undefined,
    viewport.zoom,
    weatherStageReady && closeMunicipalView,
    pauseNearbyWeather,
  );
  const currentWeather = selectedCode
    ? selectedWeather.data
    : isDrilledDown
      ? (stateWeather.data ??
        (closeMunicipalView ? nearbyWeather.data : municipalities.data?.pages[0]))
      : nationalWeather.data;
  const climateBaseReady =
    weatherStageReady &&
    (isDrilledDown
      ? Boolean(
          stateWeather.data ||
          municipalities.data ||
          nearbyWeather.data ||
          (selectedCode ? selectedWeather.data : undefined),
        ) ||
        stateWeather.isError ||
        municipalities.isError ||
        nearbyWeather.isError ||
        selectedWeather.isError
      : Boolean(nationalWeather.data) || nationalWeather.isError);
  // Avisos e hidrografia aguardam o primeiro lote da camada temática ativa.
  const layerBaseReady = weatherLayerActive
    ? climateBaseReady
    : showFireHotspots
      ? fireLayerRequested && fireLayerSettled
      : territoryReady;
  const alerts = useWeatherAlerts(showWeatherAlerts && layerBaseReady);
  const fireByCode = useMemo(
    () =>
      new Map(
        [...(fireSummary.data?.municipalities ?? []), ...(fireSummary.data?.states ?? [])].map(
          (item) => [item.ibgeCode, item],
        ),
      ),
    [fireSummary.data],
  );
  // As camadas opcionais aguardam o primeiro lote, não todos os municípios.
  const primarySettled =
    layerBaseReady &&
    !viewport.moving &&
    !selectedWeather.isFetching &&
    !alerts.isFetching &&
    !fireHotspotsLayer.isFetching &&
    !fireSummary.isFetching;
  const hydroReady = useDeferredReady(
    `hydro:${scope.parent}:${hydroDetail}:${viewport.bbox}`,
    showHydrography && primarySettled,
  );
  const hydroQuery: HydroQuery = useMemo(
    () => ({
      level: hydroDetail < 6 ? 'country' : hydroDetail < 10 ? 'state' : 'municipality',
      parent: isDrilledDown ? scope.parent : undefined,
      zoom: hydroDetail,
      bbox: viewport.bbox,
      includeWaterBodies: true,
      includeRivers: true,
    }),
    [hydroDetail, isDrilledDown, scope.parent, viewport.bbox],
  );
  const hydrographyLayer = useHydrography(hydroQuery, hydroReady);
  const hydroCollection = hydrographyLayer.data;
  const selectFireCity = useCallback(
    (city: FireMunicipality) => {
      const parent = city.ibgeCode.slice(0, 2);
      const state = statesOutlineLayer.data?.features.find((f) => f.properties.ibgeCode === parent);
      drillIntoState(parent, state?.properties.name ?? city.state);
      setSelectedCode(city.ibgeCode);
    },
    [statesOutlineLayer.data, drillIntoState, setSelectedCode],
  );
  const selectWeatherCity = useCallback(
    (city: WeatherCity) => {
      if (city.id.length === 2) {
        const state = statesOutlineLayer.data?.features.find(
          (f) => f.properties.abbreviation === city.id || f.properties.ibgeCode === city.id,
        );
        if (state) {
          drillIntoState(state.properties.ibgeCode, state.properties.name);
        } else {
          drillIntoState(city.id, city.name);
        }
      } else {
        const parent = city.id.slice(0, 2);
        if (!isDrilledDown || scope.parent !== parent) {
          const state = statesOutlineLayer.data?.features.find(
            (f) => f.properties.ibgeCode === parent,
          );
          drillIntoState(parent, state?.properties.name ?? city.stateAbbreviation ?? parent);
        }
        setSelectedCode(city.id);
      }
    },
    [statesOutlineLayer.data, drillIntoState, isDrilledDown, scope.parent, setSelectedCode],
  );
  const selectMapTerritory = useCallback(
    (code: string) => {
      setLocationTarget(null);
      if (code.length === 7 && code.slice(0, 2) !== scope.parent) {
        const summary = fireByCode.get(code);
        if (summary) {
          selectFireCity(summary);
          return;
        }
        const parent = code.slice(0, 2);
        const state = statesOutlineLayer.data?.features.find(
          (f) => f.properties.ibgeCode === parent,
        );
        drillIntoState(parent, state?.properties.name ?? parent);
      }
      setSelectedCode(code);
    },
    [
      scope.parent,
      fireByCode,
      selectFireCity,
      statesOutlineLayer.data,
      drillIntoState,
      setSelectedCode,
    ],
  );

  const {
    weatherCities,
    knownWeather,
    weatherByCode,
    maxRainfall,
    minTemperature,
    maxTemperature,
  } = useWeatherMapData({
    scope,
    isDrilledDown,
    closeMunicipalView,
    selectedCode,
    stateWeather,
    municipalities,
    nearbyWeather,
    nationalWeather,
    selectedWeather,
    currentWeather,
    collection,
  });
  // Enquanto a leitura chega, um município usa a do mapa; uma UF espera pela
  // da capital (o mapa tem a média do estado).
  const city = selectedCode
    ? (selectedWeather.data?.cities[0] ??
      (selectedCode.length === 7 ? weatherByCode.get(selectedCode) : undefined))
    : undefined;

  const failure = isDrilledDown ? visibleMunicipalities.error : mapLayer.error;
  // Consultas desligadas guardam o último erro: só conta o da camada na tela.
  // Com o estado inteiro carregado, os lotes (desligados) não entram; sem ele,
  // vale o lote que falhou ou, antes de qualquer lote, o próprio estado.
  const weatherError = !weatherLayerActive
    ? null
    : isDrilledDown
      ? closeMunicipalView
        ? nearbyWeather.error
        : stateWeather.data
          ? null
          : (municipalities.error ?? (municipalities.data ? null : stateWeather.error))
      : nationalWeather.error;
  const fireError = !showFireHotspots
    ? null
    : (fireHotspotsLayer.error ??
      fireSummary.error ??
      (activeFireMode === 'points' && fireMapError
        ? 'O mapa de focos do INPE não carregou. Tente novamente em instantes.'
        : null));
  const weatherOutdated = isDrilledDown
    ? closeMunicipalView
      ? nearbyWeather.data?.status === 'stale'
      : stateWeather.data?.status === 'stale' ||
        municipalities.data?.pages.some((page) => page.status === 'stale')
    : nationalWeather.data?.status === 'stale';
  const weatherNotice = weatherOutdated
    ? 'Dados anteriores'
    : weatherError && weatherCities.length > 0
      ? 'Cobertura parcial'
      : undefined;

  // Identifica se há requisições ativas ou mais páginas na fila em segundo plano na visualização atual
  const isViewActivelyWorking = Boolean(
    selectedWeather.isFetching ||
    forecastBusy > 0 ||
    viewportWeatherBusy > 0 ||
    (isDrilledDown
      ? closeMunicipalView
        ? nearbyWeather.isFetching
        : stateWeather.isFetching ||
          municipalities.isFetching ||
          (municipalBatchingEnabled &&
            !municipalities.isCoverageComplete &&
            Boolean(municipalities.hasNextPage) &&
            !municipalities.isError &&
            !pauseMunicipalBatching)
      : nationalWeather.isFetching || nationalWeather.isRefining) ||
    (showFireHotspots && (fireHotspotsLayer.isFetching || fireSummary.isFetching)) ||
    (showHydrography && hydrographyLayer.isFetching) ||
    (showWeatherAlerts && alerts.isFetching) ||
    selectedBoundary.isFetching,
  );

  // Estabiliza a alternância entre "Atualizando…" e "Atualizar dados" para evitar piscar:
  // entra imediatamente em Atualizando, mas só sai após 600ms de repouso completo.
  const [isViewUpdating, setIsViewUpdating] = useState(false);
  useEffect(() => {
    if (isViewActivelyWorking) {
      setIsViewUpdating(true);
      return;
    }
    const timer = setTimeout(() => setIsViewUpdating(false), 600);
    return () => clearTimeout(timer);
  }, [isViewActivelyWorking]);

  const isMunicipalityActive = Boolean(isDrilledDown && selectedCode?.length === 7);
  const stateScopeName = scope.parentName ?? selectedFeature?.properties.parentName ?? 'Estado';

  // O que "Seguir" grava é só o código; nome e UF servem à linha otimista.
  const followTarget: FollowTarget | null = useMemo(() => {
    if (!isMunicipalityActive || !selectedCode) return null;
    const stateCode = scope.parent ?? selectedCode.slice(0, 2);
    return {
      municipalityCode: selectedCode,
      name: selectedFeature?.properties.name ?? city?.name ?? null,
      stateCode,
      stateName: scope.parentName ?? selectedFeature?.properties.parentName ?? null,
      stateAbbreviation: city?.stateAbbreviation ?? null,
    };
  }, [
    isMunicipalityActive,
    selectedCode,
    scope.parent,
    scope.parentName,
    selectedFeature?.properties.name,
    selectedFeature?.properties.parentName,
    city?.name,
    city?.stateAbbreviation,
  ]);
  const openFollowedMunicipality = useCallback(
    (item: FollowedMunicipality) => {
      if (!item.name || !item.stateCode) return;
      handleSearchSelect({
        ibgeCode: item.municipalityCode,
        name: item.name,
        level: 'municipality',
        abbreviation: item.stateAbbreviation,
        parentCode: item.stateCode,
        parentName: item.stateName,
      });
    },
    [handleSearchSelect],
  );

  const { backLabel, backAriaLabel, handleBack } = useMemo(() => {
    if (isMunicipalityActive) {
      return {
        backLabel: stateScopeName,
        backAriaLabel: `Voltar a ${stateScopeName}`,
        handleBack: () => setSelectedCode(null),
      };
    }
    if (isDrilledDown) {
      return {
        backLabel: 'Brasil',
        backAriaLabel: 'Voltar ao Brasil',
        handleBack: resetScope,
      };
    }
    if (selectedCode) {
      return {
        backLabel: 'Brasil',
        backAriaLabel: 'Voltar ao Brasil',
        handleBack: () => setSelectedCode(null),
      };
    }
    return {
      backLabel: undefined,
      backAriaLabel: undefined,
      handleBack: undefined,
    };
  }, [
    isMunicipalityActive,
    isDrilledDown,
    selectedCode,
    stateScopeName,
    resetScope,
    setSelectedCode,
  ]);

  const activeAlertsStateCode = useMemo(() => {
    if (isDrilledDown && scope.parent) return scope.parent;
    if (selectedCode) {
      return selectedCode.length === 2 ? selectedCode : selectedCode.slice(0, 2);
    }
    return null;
  }, [isDrilledDown, scope.parent, selectedCode]);

  return (
    <div className="app">
      {((!scopeReady && mapLayer.isFetching) ||
        selectedBoundary.isFetching ||
        (showClimate && selectedWeather.isFetching)) && <TopProgress />}
      <MapView
        collection={collection}
        selectedCode={selectedCode}
        onSelect={selectMapTerritory}
        onDrillDown={drillIntoState}
        weatherByCode={weatherByCode}
        stateOutline={selectedStateOutline}
        onViewportChange={setViewport}
        locationTarget={locationTarget}
        climateMode={showClimate}
        fireMode={showFireHotspots ? activeFireMode : undefined}
        fireByCode={fireByCode}
        fireHours={fireHotspotsLayer.data?.metadata.hours ?? FIRE_HOTSPOT_HOURS}
        rainMode={showRainfall}
      >
        <Suspense fallback={null}>
          {showWeatherAlerts && (
            <AlertsLayer
              collection={alerts.data}
              muted={showFireHotspots}
              stateCode={activeAlertsStateCode}
            />
          )}
          {showFireHotspots && activeFireMode === 'points' && fireHotspotsLayer.data && (
            <FireHotspotsLayer
              key={`${fireHotspotQuery.level}:${fireHotspotQuery.parent ?? 'BR'}:${fireHotspotsLayer.data.metadata.windowEnd}`}
              collection={fireHotspotsLayer.data}
              query={fireHotspotQuery}
              onMapError={setFireMapError}
            />
          )}
          {(showClimate || showRainfall) && (
            <WeatherLayer
              cities={knownWeather}
              selectedId={city?.id}
              municipal={isDrilledDown}
              mode={showRainfall ? 'rainfall' : 'temperature'}
            />
          )}
        </Suspense>
        <Suspense fallback={null}>
          {showHydrography && hydrographyLayer.data && (
            <HydrographyLayer
              collection={hydroCollection}
              fireActive={showFireHotspots}
              zoom={hydroDetail}
            />
          )}
        </Suspense>
      </MapView>
      <SearchBox onSelect={handleSearchSelect} onLocated={handleLocated} />
      <div className={`panel-slot ${mobilePeek ? 'is-peek' : ''}`}>
        <aside className="panel">
          <button
            type="button"
            className="mobile-sheet-handle"
            aria-label={mobilePeek ? 'Expandir painel' : 'Recolher painel'}
            aria-expanded={!mobilePeek}
            onClick={() => setMobilePeek((prev) => !prev)}
          >
            <span className="mobile-sheet-bar" />
          </button>
          <div
            className="panel-section scope-section"
            onClick={() => {
              if (mobilePeek) setMobilePeek(false);
            }}
          >
            <ScopeHeader
              name={scope.parentName ?? 'Brasil'}
              onBack={handleBack}
              backLabel={backLabel}
              backAriaLabel={backAriaLabel}
            />
            <div className="thematic-switch-wrapper">
              <WeatherThematicSwitch
                showClimate={showClimate}
                onToggleClimate={handleToggleClimate}
                showRainfall={showRainfall}
                onToggleRainfall={handleToggleRainfall}
                showFireHotspots={showFireHotspots}
                onToggleFireHotspots={handleToggleFireHotspots}
                minTemperature={minTemperature}
                maxTemperature={maxTemperature}
                maxRainfall={maxRainfall}
                fireHotspots={fireHotspotsLayer.data}
                fireHotspotsLoading={fireHotspotsLayer.isFetching}
                fireHotspotsError={fireError != null}
                current={currentWeather}
                error={weatherError ?? fireError}
                scopeName={isDrilledDown ? (scope.parentName ?? undefined) : undefined}
              />
            </div>
          </div>
          {failure && (
            <div className="panel-section">
              <ErrorMessage error={failure} />
            </div>
          )}
          {scopeReady &&
            collection?.features.length === 0 &&
            !visibleMunicipalities.isPending &&
            !visibleMunicipalities.hasNextPage && (
              <div className="panel-section">
                <EmptyState title="Nenhum território disponível neste recorte" />
              </div>
            )}
          <ErrorBoundary onReset={() => setSelectedCode(null)}>
            <Suspense
              fallback={
                <div className="panel-section" role="status">
                  Carregando…
                </div>
              }
            >
              {selectedCode ? (
                <WeatherPanel
                  key={selectedCode}
                  code={selectedCode}
                  territory={selectedFeature?.properties}
                  city={city}
                  data={selectedWeather.data}
                  error={selectedWeather.error}
                  loading={weatherLayerActive && selectedWeather.isPending}
                  onClose={() => setSelectedCode(null)}
                  onDrillDown={drillIntoState}
                  fireMunicipality={fireByCode.get(selectedCode)}
                  climateActive={showClimate}
                  fireActive={showFireHotspots}
                  fireLoading={fireSummary.isFetching}
                  fireHours={fireHotspotsLayer.data?.metadata.hours ?? FIRE_HOTSPOT_HOURS}
                  rainActive={showRainfall}
                />
              ) : null}
            </Suspense>
          </ErrorBoundary>
          {showClimate && !selectedCode && weatherCities.length === 0 && (
            <p className="panel-section navigation-hint" role="status">
              {weatherError ? 'Clima indisponível no momento.' : 'Carregando clima…'}
            </p>
          )}
          <Suspense fallback={null}>
            <>
              {showClimate && !selectedCode && (
                <ClimateOverview
                  cities={weatherCities}
                  hottest={currentWeather?.summary?.hottest}
                  coldest={currentWeather?.summary?.coldest}
                  scopeName={isDrilledDown ? (scope.parentName ?? undefined) : undefined}
                  isDrilledDown={isDrilledDown}
                  onSelect={selectWeatherCity}
                />
              )}
              {showRainfall && !selectedCode && (
                <RainOverview
                  cities={weatherCities}
                  ranked={currentWeather?.summary?.rankedRainfall}
                  scopeName={isDrilledDown ? (scope.parentName ?? undefined) : undefined}
                  onSelect={selectWeatherCity}
                />
              )}
              {showFireHotspots && fireSummary.data && !selectedCode && (
                <FireOverview
                  summary={fireSummary.data}
                  scopeName={isDrilledDown ? (scope.parentName ?? undefined) : undefined}
                  onSelect={selectFireCity}
                />
              )}
              <WeatherOptions
                showAlerts={showWeatherAlerts}
                onToggleAlerts={setShowWeatherAlerts}
                showHydrography={showHydrography}
                onToggleHydrography={setShowHydrography}
                hydrographyPartial={hydroCollection?.metadata.status === 'partial'}
                code={selectedCode ?? scope.parent}
                current={currentWeather}
                error={weatherError ?? fireError}
                hydrographyError={showHydrography && hydrographyLayer.error != null}
                loading={isViewUpdating}
                alertsData={alerts.data}
                alertsPending={alerts.isPending}
                alertsError={alerts.error}
                scopeName={isDrilledDown ? (scope.parentName ?? undefined) : undefined}
                onRefresh={() => {
                  // Pedido explícito do usuário: libera também as fontes pausadas,
                  // inclusive por cota esgotada.
                  clearSourcePauses();
                  // Com a última leitura há mais de 5 min, o backend busca a fonte
                  // na hora em vez de só agendar a renovação em segundo plano
                  // (ver `FORCE_MIN_AGE`/`force` em `app/services/weather_forecast.py`).
                  // Com menos de 5 min, o pedido é ignorado — o dado já é recente.
                  requestForcedWeatherRefresh();
                  // Os lotes municipais só rodam se o estado falhar: refazê-los junto
                  // com ele seria uma segunda consulta à mesma fonte. Ficam apenas
                  // marcados como desatualizados.
                  void client.invalidateQueries({
                    queryKey: ['weather', 'municipalities'],
                    refetchType: 'none',
                  });
                  void client.invalidateQueries({
                    queryKey: ['weather'],
                    predicate: (query) => query.queryKey[1] !== 'municipalities',
                  });
                  void client.invalidateQueries({ queryKey: ['fire-hotspots'], exact: false });
                  void client.invalidateQueries({ queryKey: ['hydrography'], exact: false });
                }}
              />
            </>
          </Suspense>
          <FollowedMunicipalitiesPanel current={followTarget} onOpen={openFollowedMunicipality} />
        </aside>
      </div>
      {!failure && (
        <div className="legend-slot">
          <Suspense fallback={null}>
            {showFireHotspots ? (
              <FireLegend
                loading={fireSummary.isFetching || fireHotspotsLayer.isFetching}
                error={fireSummary.error != null}
                hours={fireHotspotsLayer.data?.metadata.hours ?? FIRE_HOTSPOT_HOURS}
              />
            ) : showRainfall ? (
              <RainLegend loading={isViewUpdating} error={weatherError != null} />
            ) : showClimate ? (
              <WeatherLegend notice={weatherNotice} />
            ) : null}
          </Suspense>
        </div>
      )}
    </div>
  );
}
