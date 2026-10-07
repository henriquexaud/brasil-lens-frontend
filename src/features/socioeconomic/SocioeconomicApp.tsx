import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FollowedMunicipality, MapValuesResponse } from '@/api/types';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { ScopeHeader } from '@/components/ScopeHeader';
import { ErrorMessage, TopProgress } from '@/components/Feedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { MapView } from '@/features/map/MapView';
import type { MapViewport } from '@/features/map/ViewportObserver';
import { useMapScope } from '@/features/map/useMapScope';
import { useTerritoryMap } from '@/features/map/useTerritoryMap';
import { useNationalMunicipalData } from '@/features/map/useNationalMunicipalData';
import { SearchBox, type SearchResult } from '@/features/search/SearchBox';
import type { LocatedMunicipality } from '@/features/search/LocationButton';
import { FollowedMunicipalitiesPanel } from '@/features/follow/FollowedMunicipalitiesPanel';
import type { FollowTarget } from '@/features/follow/useFollowedMunicipalities';
import { usePageVisible } from '@/lib/usePageVisible';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { useMobileSheet } from '@/app/useMobileSheet';
import { ControlPanel } from './ControlPanel';
import { Legend } from './Legend';
import { TerritoryPanel } from './TerritoryPanel';
import { useIndicators, useValues } from './queries';
import { presentationFor } from './presentation';
import { yearForIndicator } from './indicatorCategories';

export default function SocioeconomicApp({ contextControl }: { contextControl: ReactNode }) {
  const queryClient = useQueryClient();
  const { scope, selectedCode, setSelectedCode, drillIntoState, resetScope, isDrilledDown } =
    useMapScope();
  const [selection, setSelection] = useState(
    () => loadSessionState().socioeconomic ?? { indicatorKey: 'population', year: 'latest' },
  );
  const [viewport, setViewport] = useState<MapViewport>({ zoom: 4 });
  const [locationTarget, setLocationTarget] = useState<{
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null>(null);
  const pageVisible = usePageVisible();
  const sheet = useMobileSheet();
  const catalog = useIndicators(scope.level);
  const indicators = catalog.data?.indicators ?? [];
  const current = indicators.find((item) => item.key === selection.indicatorKey);
  const year = yearForIndicator(current, selection.year);
  const {
    collection,
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    selectedBoundary,
    selectedFeature,
    scopeReady,
    territoryReady,
    visibleMunicipalities,
  } = useTerritoryMap({ scope, isDrilledDown, viewport, selectedCode, pageVisible });

  useEffect(() => saveSessionState({ socioeconomic: selection }), [selection]);
  useEffect(() => {
    if (!catalog.data) return;
    if (!current) setSelection({ indicatorKey: 'population', year: 'latest' });
    else if (year !== selection.year) {
      setSelection((previous) => ({ ...previous, year }));
    }
  }, [catalog.data, current, selection.year, year]);

  const values = useValues(
    scope.level,
    scope.parent,
    selection.indicatorKey,
    year,
    Boolean(current) && scopeReady && pageVisible,
  );
  const supported = current?.supportedLevels.includes(scope.level) ?? true;
  const presentation = useMemo(
    () =>
      values.data
        ? presentationFor(values.data)
        : {
            key: `socioeconomic:${selection.indicatorKey}:${year}`,
            colors: new Map<string, string>(),
            values: new Set<string>(),
            tooltips: new Map<string, { value: string; meta: string }>(),
          },
    [values.data, selection.indicatorKey, year],
  );
  const showNationalMosaic =
    !isDrilledDown && Boolean(current?.supportedLevels.includes('municipality'));
  const municipalEnabled =
    showNationalMosaic && pageVisible && territoryReady && Boolean(values.data);
  const municipalValues = useValues(
    'municipality',
    null,
    selection.indicatorKey,
    year,
    municipalEnabled,
  );
  const national = useNationalMunicipalData({
    states: statesOutlineLayer.data,
    enabled:
      municipalEnabled && !viewport.moving && !mapLayer.isFetching && !selectedBoundary.isFetching,
    weatherEnabled: false,
  });
  const municipalPresentation = useMemo(
    () => (municipalValues.data ? presentationFor(municipalValues.data) : undefined),
    [municipalValues.data],
  );
  const nationalMosaic = useMemo(
    () =>
      national.mesh && municipalPresentation && showNationalMosaic
        ? {
            mesh: national.mesh,
            presentation: municipalPresentation,
          }
        : undefined,
    [national.mesh, municipalPresentation, showNationalMosaic],
  );
  const [publishedLegend, setPublishedLegend] = useState<MapValuesResponse>();
  const onNationalPublished = useCallback(
    (published: TerritoryPresentation | undefined) => {
      if (published === nationalMosaic?.presentation && municipalValues.data)
        setPublishedLegend(municipalValues.data);
    },
    [nationalMosaic, municipalValues.data],
  );

  const selectMapTerritory = useCallback(
    (code: string) => {
      setLocationTarget(null);
      if (code.length === 7 && code.slice(0, 2) !== scope.parent) {
        const parent = code.slice(0, 2);
        const state = statesOutlineLayer.data?.features.find((item) => item.id === parent);
        drillIntoState(parent, state?.properties.name ?? parent);
      }
      setSelectedCode(code);
    },
    [scope.parent, statesOutlineLayer.data, drillIntoState, setSelectedCode],
  );
  const selectSearch = useCallback(
    (result: SearchResult) => {
      setLocationTarget(null);
      if (result.level === 'state') {
        if (isDrilledDown) resetScope();
        setSelectedCode(result.ibgeCode);
      } else if (result.parentCode) {
        drillIntoState(result.parentCode, result.parentName ?? result.parentCode);
        setSelectedCode(result.ibgeCode);
      }
    },
    [drillIntoState, isDrilledDown, resetScope, setSelectedCode],
  );
  const onLocated = useCallback(
    ({ territory, latitude, longitude }: LocatedMunicipality) => {
      if (!territory.parent) return;
      drillIntoState(territory.parent.ibgeCode, territory.parent.name);
      setSelectedCode(territory.ibgeCode);
      setLocationTarget({ code: territory.ibgeCode, latitude, longitude, requestedAt: Date.now() });
    },
    [drillIntoState, setSelectedCode],
  );
  const openFollowed = useCallback(
    (item: FollowedMunicipality) => {
      if (!item.name || !item.stateCode) return;
      selectSearch({
        ibgeCode: item.municipalityCode,
        name: item.name,
        level: 'municipality',
        abbreviation: item.stateAbbreviation,
        parentCode: item.stateCode,
        parentName: item.stateName,
      });
    },
    [selectSearch],
  );
  const followTarget: FollowTarget | null =
    selectedCode?.length === 7
      ? {
          municipalityCode: selectedCode,
          name: selectedFeature?.properties.name ?? null,
          stateCode: scope.parent ?? selectedCode.slice(0, 2),
          stateName: scope.parentName ?? null,
          stateAbbreviation:
            statesOutlineLayer.data?.features.find((item) => item.id === selectedCode.slice(0, 2))
              ?.properties.abbreviation ?? null,
        }
      : null;
  const onBack = selectedCode
    ? () => setSelectedCode(null)
    : isDrilledDown
      ? resetScope
      : undefined;
  const backLabel =
    isDrilledDown && selectedCode?.length === 7 ? (scope.parentName ?? 'Estado') : 'Brasil';
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.activeElement?.closest('input, select, textarea, .search-slot')
      )
        return;
      if (selectedCode) setSelectedCode(null);
      else if (isDrilledDown) resetScope();
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [selectedCode, isDrilledDown, setSelectedCode, resetScope]);
  const failure =
    mapLayer.error ??
    statesOutlineLayer.error ??
    (isDrilledDown ? visibleMunicipalities.error : null) ??
    selectedBoundary.error;
  const retry = () => {
    if (mapLayer.error)
      void queryClient.invalidateQueries({ queryKey: ['map', scope.level, scope.parent] });
    if (statesOutlineLayer.error && isDrilledDown)
      void queryClient.invalidateQueries({ queryKey: ['map', 'state', null] });
    if (visibleMunicipalities.error) void visibleMunicipalities.refetch();
    if (selectedBoundary.error) void selectedBoundary.refetch();
    if (catalog.error) void catalog.refetch();
    if (values.error) void values.refetch();
    if (municipalValues.error) void municipalValues.refetch();
    if (national.meshError)
      void queryClient.invalidateQueries({
        queryKey: ['map', 'municipality'],
        refetchType: 'none',
      });
  };
  const legendData =
    nationalMosaic &&
    publishedLegend?.indicator.key === selection.indicatorKey &&
    publishedLegend.indicator.year === municipalValues.data?.indicator.year &&
    publishedLegend.indicator.requestedYear === year
      ? publishedLegend
      : values.data;
  const detailCode = selectedCode ?? scope.parent ?? 'BR';
  const indicator =
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

  return (
    <div className="app socioeconomic-app">
      {((!scopeReady && mapLayer.isFetching) ||
        values.isFetching ||
        selectedBoundary.isFetching) && <TopProgress />}
      <MapView
        collection={collection}
        selectedCode={selectedCode}
        onSelect={selectMapTerritory}
        onDrillDown={drillIntoState}
        presentation={presentation}
        climateMode={false}
        stateOutline={selectedStateOutline}
        nationalMosaic={nationalMosaic}
        onNationalMosaicPublished={onNationalPublished}
        nationalMosaicPaused={!pageVisible || Boolean(viewport.moving)}
        onViewportChange={setViewport}
        dataLoading={values.isPending && supported}
        locationTarget={locationTarget?.code === selectedCode ? locationTarget : null}
      />
      <SearchBox onSelect={selectSearch} onLocated={onLocated} />
      <div ref={sheet.slotRef} className={`panel-slot ${sheet.collapsed ? 'is-peek' : ''}`}>
        <aside className="panel">
          <div ref={sheet.headerRef} className="panel-section scope-section" {...sheet.headerProps}>
            <button
              type="button"
              className="mobile-sheet-handle"
              aria-label={sheet.collapsed ? 'Expandir painel' : 'Recolher painel'}
              aria-expanded={!sheet.collapsed}
              onClick={sheet.toggle}
            >
              <span className="mobile-sheet-bar" />
            </button>
            {contextControl}
            <ScopeHeader
              name={scope.parentName ?? 'Brasil'}
              onBack={onBack}
              backLabel={onBack ? backLabel : undefined}
              backAriaLabel={onBack ? `Voltar a ${backLabel}` : undefined}
            />
            <ControlPanel
              indicators={indicators}
              selectedIndicatorKey={selection.indicatorKey}
              onIndicatorChange={(indicatorKey) =>
                setSelection((previous) => ({
                  indicatorKey,
                  year: yearForIndicator(
                    indicators.find((item) => item.key === indicatorKey),
                    previous.year,
                  ),
                }))
              }
              selectedYear={year}
              onYearChange={(year) => setSelection((previous) => ({ ...previous, year }))}
              resolvedYear={values.data?.indicator.year ?? null}
              level={scope.level}
              parentCode={scope.parent}
            />
          </div>
          {(failure || catalog.error || values.error) && (
            <div className="panel-section">
              <ErrorMessage error={failure ?? catalog.error ?? values.error} />
              <button type="button" className="text-button" onClick={retry}>
                Tentar novamente
              </button>
            </div>
          )}
          {!supported && (
            <p className="panel-section source-note" role="status">
              O IBGE publica este indicador por estado, sem cobertura municipal. Volte ao Brasil
              para comparar as UFs.
            </p>
          )}
          <ErrorBoundary onReset={() => setSelectedCode(null)}>
            <TerritoryPanel
              key={detailCode}
              code={detailCode}
              territory={selectedFeature?.properties}
              indicator={indicator}
              value={
                selectedCode
                  ? values.data?.values.find((item) => item.ibgeCode === selectedCode)
                  : undefined
              }
              year={year}
              loading={values.isPending}
              onClose={selectedCode ? () => setSelectedCode(null) : undefined}
              onDrillDown={drillIntoState}
            />
          </ErrorBoundary>
          <FollowedMunicipalitiesPanel current={followTarget} onOpen={openFollowed} />
          {!isDrilledDown && (national.meshError || municipalValues.error) && (
            <div className="panel-section">
              <ErrorMessage error={national.meshError ?? municipalValues.error} />
              <button type="button" className="text-button" onClick={retry}>
                Tentar novamente
              </button>
            </div>
          )}
          <AccountMenu />
        </aside>
      </div>
      {!failure && (
        <div className="legend-slot">
          <Legend
            indicator={legendData?.indicator ?? indicator}
            classification={legendData?.classification ?? null}
            statistics={legendData?.statistics ?? null}
            loading={values.isPending}
          />
        </div>
      )}
      <ThemeSwitch />
    </div>
  );
}
