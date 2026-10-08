import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PoliticalValues } from '@/api/types';
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
import { usePageVisible } from '@/lib/usePageVisible';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { useMobileSheet } from '@/app/useMobileSheet';
import { ControlPanel } from './ControlPanel';
import { Legend } from './Legend';
import { TerritoryPanel } from './TerritoryPanel';
import { useCatalog, useValues, useDetail } from './queries';
import { presentationFor } from './presentation';
import { DEFAULT_SELECTION, latestSelection, normalizeSelection } from './selection';
import './political.css';

export default function PoliticalApp({ contextControl }: { contextControl: ReactNode }) {
  const queryClient = useQueryClient();
  const { scope, selectedCode, setSelectedCode, drillIntoState, resetScope, isDrilledDown } =
    useMapScope();
  const [selection, setSelection] = useState(
    () => loadSessionState().political ?? DEFAULT_SELECTION,
  );
  const [preferLatest, setPreferLatest] = useState(true);
  const [viewport, setViewport] = useState<MapViewport>({ zoom: 4 });
  const [locationTarget, setLocationTarget] = useState<{
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null>(null);
  const pageVisible = usePageVisible();
  const sheet = useMobileSheet();
  const catalog = useCatalog();
  const releases = useMemo(() => catalog.data?.releases ?? [], [catalog.data]);
  const resolvedSelection = useMemo(
    () =>
      normalizeSelection(preferLatest ? latestSelection(selection, releases) : selection, releases),
    [selection, releases, preferLatest],
  );
  const current = releases.find((item) => item.year === resolvedSelection.year);
  const {
    collection,
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    selectedBoundary,
    scopeReady,
    territoryReady,
    visibleMunicipalities,
  } = useTerritoryMap({ scope, isDrilledDown, viewport, selectedCode, pageVisible });

  useEffect(() => {
    if (releases.length) saveSessionState({ political: resolvedSelection });
  }, [resolvedSelection, releases]);
  const values = useValues(
    scope.level,
    scope.parent,
    resolvedSelection,
    Boolean(current) && scopeReady && pageVisible,
  );
  const presentation = useMemo(
    () =>
      values.data
        ? presentationFor(values.data)
        : {
            key: `political:${resolvedSelection.year}:${resolvedSelection.office}:${resolvedSelection.round}:${resolvedSelection.metric}`,
            colors: new Map<string, string>(),
            values: new Set<string>(),
            tooltips: new Map<string, { value: string; meta: string }>(),
          },
    [values.data, resolvedSelection],
  );
  const showNationalMosaic = !isDrilledDown;
  const municipalEnabled =
    showNationalMosaic && pageVisible && territoryReady && Boolean(values.data);
  const municipalValues = useValues('municipality', null, resolvedSelection, municipalEnabled);
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
  const [publishedLegend, setPublishedLegend] = useState<PoliticalValues>();
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
    nationalMosaic && publishedLegend && presentationFor(publishedLegend).key === presentation.key
      ? publishedLegend
      : values.data;
  const detailCode = selectedCode ?? scope.parent ?? 'BR';
  const detail = useDetail(detailCode, resolvedSelection, 0, false);

  return (
    <div className="app socioeconomic-app political-app">
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
        dataLoading={Boolean(current) && values.isPending}
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
              selection={resolvedSelection}
              releases={releases}
              onChange={(next) => {
                setPreferLatest(false);
                setSelection(next);
              }}
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
          <ErrorBoundary onReset={() => setSelectedCode(null)}>
            {current ? (
              <TerritoryPanel
                key={`${detailCode}:${resolvedSelection.year}:${resolvedSelection.office}:${resolvedSelection.category}`}
                code={detailCode}
                selection={resolvedSelection}
                enabled={Boolean(current) && pageVisible}
                onClose={selectedCode ? () => setSelectedCode(null) : undefined}
                onDrillDown={drillIntoState}
              />
            ) : (
              <p className="panel-section source-note" role="status">
                {catalog.isPending ? 'Carregando dados…' : 'Sem dados políticos importados.'}
              </p>
            )}
          </ErrorBoundary>
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
            data={legendData}
            detail={detail.error ? undefined : detail.data}
            selection={resolvedSelection}
            metric={resolvedSelection.metric}
            loading={catalog.isPending || (Boolean(current) && values.isPending)}
          />
        </div>
      )}
      <ThemeSwitch />
    </div>
  );
}
