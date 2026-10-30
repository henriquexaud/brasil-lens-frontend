import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MapValuesResponse } from '@/api/types';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { ScopeHeader } from '@/components/ScopeHeader';
import { ErrorMessage, TopProgress } from '@/components/Feedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { DonationButton } from '@/features/donation/DonationButton';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { MapView } from '@/features/map/MapView';
import type { MapViewport } from '@/features/map/ViewportObserver';
import { useMapScope } from '@/features/map/useMapScope';
import { useTerritoryMap } from '@/features/map/useTerritoryMap';
import { useNationalMunicipalData } from '@/features/map/useNationalMunicipalData';
import { SearchBox, type SearchResult } from '@/features/search/SearchBox';
import type { LocatedMunicipality } from '@/features/search/LocationButton';
import { Legend } from '@/features/socioeconomic/Legend';
import { paletteForIndicator } from '@/features/socioeconomic/colors';
import { scheduleIdle } from '@/lib/idle';
import { usePageVisible } from '@/lib/usePageVisible';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { useMobileSheet } from '@/app/useMobileSheet';
import {
  DEFAULT_EDUCATION,
  NETWORK_OPTIONS,
  indicatorKey,
  type EducationPreferences,
} from './education';
import { EducationControls } from './EducationControls';
import { EducationPanel } from './EducationPanel';
import { InstitutionDetail } from './InstitutionDetail';
import { NO_OFFER, educationPresentation, highlightInstitution } from './presentation';
import {
  prefetchEducationChoice,
  useEducationIndicators,
  useEducationInstitution,
  useEducationTerritory,
  useEducationValues,
} from './queries';
import './education.css';

const EMPTY: Omit<TerritoryPresentation, 'key'> = {
  colors: new Map(),
  values: new Set(),
  tooltips: new Map(),
};

export default function EducationApp({ contextControl }: { contextControl: ReactNode }) {
  const queryClient = useQueryClient();
  const { scope, selectedCode, setSelectedCode, drillIntoState, resetScope, isDrilledDown } =
    useMapScope();
  const [preferences, setPreferences] = useState(
    () => loadSessionState().education ?? DEFAULT_EDUCATION,
  );
  const [institutionCode, setInstitutionCode] = useState<number | null>(null);
  const [viewport, setViewport] = useState<MapViewport>({ zoom: 4 });
  const [locationTarget, setLocationTarget] = useState<{
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null>(null);
  const pageVisible = usePageVisible();
  const sheet = useMobileSheet();
  useEffect(() => saveSessionState({ education: preferences }), [preferences]);

  const catalog = useEducationIndicators(scope.level);
  // Tipo sem dado na rede (ex.: sessão antiga) volta a Todas.
  const kind = catalog.data?.indicators.find(
    (item) => item.key === indicatorKey(preferences.network, preferences.kind),
  )?.latestYear
    ? preferences.kind
    : 'all';
  const key = indicatorKey(preferences.network, kind);
  const current = catalog.data?.indicators.find((item) => item.key === key);
  // Um ano guardado que a ingestão não tem mais volta ao último disponível.
  const year =
    preferences.year === 'latest' || current?.availableYears.includes(Number(preferences.year))
      ? preferences.year
      : 'latest';
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

  const values = useEducationValues(
    scope.level,
    scope.parent,
    key,
    year,
    Boolean(current) && scopeReady && pageVisible,
  );
  const showNationalMosaic = !isDrilledDown && Boolean(current);
  const municipalEnabled =
    showNationalMosaic && pageVisible && territoryReady && Boolean(values.data);
  const municipalValues = useEducationValues('municipality', null, key, year, municipalEnabled);
  const national = useNationalMunicipalData({
    states: statesOutlineLayer.data,
    enabled:
      municipalEnabled && !viewport.moving && !mapLayer.isFetching && !selectedBoundary.isFetching,
    weatherEnabled: false,
  });
  const institution = useEducationInstitution(institutionCode, year);
  const highlighted = institution.data;

  const presentation = useMemo(() => {
    const base = values.data
      ? educationPresentation(values.data)
      : { key: `education:${key}:${year}`, ...EMPTY };
    return highlighted ? highlightInstitution(base, highlighted) : base;
  }, [values.data, key, year, highlighted]);
  const municipalPresentation = useMemo(() => {
    if (!municipalValues.data) return undefined;
    const base = educationPresentation(municipalValues.data);
    return highlighted ? highlightInstitution(base, highlighted) : base;
  }, [municipalValues.data, highlighted]);
  const nationalMosaic = useMemo(
    () =>
      national.mesh && municipalPresentation && showNationalMosaic
        ? { mesh: national.mesh, presentation: municipalPresentation }
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

  const detailCode = selectedCode ?? scope.parent ?? 'BR';
  const territory = useEducationTerritory(
    detailCode,
    year,
    preferences.network,
    kind,
    pageVisible && institutionCode === null,
  );
  const prefetchChoice = useCallback(
    (choice: EducationPreferences) => {
      if (catalog.data)
        void prefetchEducationChoice(
          queryClient,
          catalog.data,
          scope.level,
          scope.parent,
          detailCode,
          choice,
        );
    },
    [queryClient, catalog.data, scope.level, scope.parent, detailCode],
  );
  // Com o mapa pronto e parado, as outras redes do recorte chegam com o navegador
  // ocioso: no celular, sem hover, a troca de aba também pinta na hora.
  useEffect(() => {
    if (!values.data || viewport.moving || !pageVisible) return;
    return scheduleIdle(() => {
      for (const option of NETWORK_OPTIONS)
        if (option.value !== preferences.network)
          prefetchChoice({ ...preferences, network: option.value });
    }, 1500);
  }, [values.data, viewport.moving, pageVisible, preferences, prefetchChoice]);

  const selectMapTerritory = useCallback(
    (code: string) => {
      setLocationTarget(null);
      setInstitutionCode(null);
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
      setInstitutionCode(null);
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
    ({ territory: located, latitude, longitude }: LocatedMunicipality) => {
      if (!located.parent) return;
      setInstitutionCode(null);
      drillIntoState(located.parent.ibgeCode, located.parent.name);
      setSelectedCode(located.ibgeCode);
      setLocationTarget({ code: located.ibgeCode, latitude, longitude, requestedAt: Date.now() });
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
      if (institutionCode !== null) setInstitutionCode(null);
      else if (selectedCode) setSelectedCode(null);
      else if (isDrilledDown) resetScope();
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [institutionCode, selectedCode, isDrilledDown, setSelectedCode, resetScope]);

  const failure =
    mapLayer.error ??
    statesOutlineLayer.error ??
    (isDrilledDown ? visibleMunicipalities.error : null) ??
    selectedBoundary.error;
  const dataError = catalog.error ?? values.error;
  const retry = () => {
    if (mapLayer.error)
      void queryClient.invalidateQueries({ queryKey: ['map', scope.level, scope.parent] });
    if (statesOutlineLayer.error && isDrilledDown)
      void queryClient.invalidateQueries({ queryKey: ['map', 'state', null] });
    if (visibleMunicipalities.error) void visibleMunicipalities.refetch();
    if (selectedBoundary.error) void selectedBoundary.refetch();
    void queryClient.invalidateQueries({ queryKey: ['education'] });
  };
  const legendData =
    nationalMosaic &&
    publishedLegend?.indicator.key === key &&
    publishedLegend.indicator.year === municipalValues.data?.indicator.year &&
    publishedLegend.indicator.requestedYear === year
      ? publishedLegend
      : values.data;
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
  const palette = paletteForIndicator(key);

  return (
    <div
      className="app socioeconomic-app education-app"
      style={{
        ['--indicator-accent' as string]: palette[palette.length - 1],
        ['--indicator-tone' as string]: palette[7],
      }}
    >
      {((!scopeReady && mapLayer.isFetching) ||
        values.isFetching ||
        institution.isFetching ||
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
        dataLoading={values.isPending && Boolean(current)}
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
            <EducationControls
              preferences={{ ...preferences, kind, year }}
              onChange={setPreferences}
              indicators={catalog.data?.indicators}
              onIntent={prefetchChoice}
            />
          </div>
          {(failure || dataError) && (
            <div className="panel-section">
              <ErrorMessage error={failure ?? dataError} />
              <button type="button" className="text-button" onClick={retry}>
                Tentar novamente
              </button>
            </div>
          )}
          <ErrorBoundary
            onReset={() => {
              setInstitutionCode(null);
              setSelectedCode(null);
            }}
          >
            {institutionCode !== null ? (
              <InstitutionDetail
                key={institutionCode}
                data={institution.data}
                error={institution.error}
                onClose={() => setInstitutionCode(null)}
                onSelectMunicipality={selectMapTerritory}
              />
            ) : (
              <EducationPanel
                data={
                  territory.data?.code === detailCode &&
                  territory.data.network === preferences.network &&
                  territory.data.kind === kind
                    ? territory.data
                    : undefined
                }
                loading={territory.isFetching}
                error={territory.error}
                territory={selectedCode ? selectedFeature?.properties : undefined}
                onClose={selectedCode ? () => setSelectedCode(null) : undefined}
                onDrillDown={drillIntoState}
                onSelectInstitution={setInstitutionCode}
              />
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
            indicator={legendData?.indicator ?? indicator}
            classification={legendData?.classification ?? null}
            statistics={legendData?.statistics ?? null}
            loading={values.isPending}
            missingLabel={NO_OFFER}
            missingTitle="Território sem curso presencial da rede no ano; aparece em cinza no mapa"
          />
        </div>
      )}
      <DonationButton />
      <ThemeSwitch />
    </div>
  );
}
