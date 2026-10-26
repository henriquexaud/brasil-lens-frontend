import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { ScopeHeader } from '@/components/ScopeHeader';
import { ErrorMessage, TopProgress } from '@/components/Feedback';
import { LayerToggle } from '@/components/LayerToggle';
import { StatusBadge } from '@/components/StatusBadge';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { MapView } from '@/features/map/MapView';
import type { MapViewport } from '@/features/map/ViewportObserver';
import { useMapScope } from '@/features/map/useMapScope';
import { useTerritoryMap } from '@/features/map/useTerritoryMap';
import { SearchBox, type SearchResult } from '@/features/search/SearchBox';
import type { LocatedMunicipality } from '@/features/search/LocationButton';
import { usePageVisible } from '@/lib/usePageVisible';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { useMobileSheet } from '@/app/useMobileSheet';
import { DEFAULT_TRANSPORT, LAYER_STYLE, lineLayer, networkArea, networkDetail } from './layers';
import { NetworkLayer, StreetsLayer } from './NetworkLayer';
import { TransportControls } from './TransportControls';
import { TransportPanel } from './TransportPanel';
import { useTransportCatalog, useTransportNetwork, useTransportSummary } from './queries';
import './transport.css';

// Território sem pintura: aqui o dado é o traçado, desenhado por cima.
const NEUTRAL: TerritoryPresentation = {
  key: 'transport',
  colors: new Map(),
  values: new Set(),
  tooltips: new Map(),
};
// As ruas do IBGE só fazem sentido de perto; o resto do app para no zoom 12.
const MAX_ZOOM = 14;

export default function TransportApp({ contextControl }: { contextControl: ReactNode }) {
  const queryClient = useQueryClient();
  const { scope, selectedCode, setSelectedCode, drillIntoState, resetScope, isDrilledDown } =
    useMapScope();
  const [preferences, setPreferences] = useState(
    () => loadSessionState().transport ?? DEFAULT_TRANSPORT,
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
  useEffect(() => saveSessionState({ transport: preferences }), [preferences]);

  const {
    collection,
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    selectedBoundary,
    scopeReady,
    visibleMunicipalities,
  } = useTerritoryMap({ scope, isDrilledDown, viewport, selectedCode, pageVisible });

  const catalog = useTransportCatalog();
  const layer = lineLayer(preferences);
  const minZoom = catalog.data?.layers.find((item) => item.key === layer)?.minZoom;
  const visible = minZoom !== undefined && viewport.zoom >= minZoom;
  const detail = networkDetail(viewport.zoom);
  const area = networkArea(detail, viewport.bbox, isDrilledDown ? collection?.bbox : null);
  const network = useTransportNetwork(
    layer,
    detail,
    viewport.zoom,
    area,
    pageVisible && scopeReady && !viewport.moving && visible && (detail < 6 || Boolean(area)),
  );
  const ports = useTransportNetwork(
    'port',
    4,
    4,
    undefined,
    pageVisible && preferences.tab === 'waterways',
  );
  const detailCode = selectedCode ?? scope.parent ?? 'BR';
  const summary = useTransportSummary(detailCode, pageVisible);

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
  const dataError = catalog.error ?? network.error ?? ports.error;
  const retry = () => {
    if (mapLayer.error)
      void queryClient.invalidateQueries({ queryKey: ['map', scope.level, scope.parent] });
    if (statesOutlineLayer.error && isDrilledDown)
      void queryClient.invalidateQueries({ queryKey: ['map', 'state', null] });
    if (visibleMunicipalities.error) void visibleMunicipalities.refetch();
    if (selectedBoundary.error) void selectedBoundary.refetch();
    void queryClient.invalidateQueries({ queryKey: ['transport'] });
  };
  const streets = catalog.data?.streets;
  const streetsVisible = Boolean(streets && viewport.zoom >= streets.minZoom);

  return (
    <div
      className="app socioeconomic-app transport-app"
      style={{ ['--indicator-accent' as string]: LAYER_STYLE[layer].color }}
    >
      {((!scopeReady && mapLayer.isFetching) ||
        network.isFetching ||
        selectedBoundary.isFetching) && <TopProgress />}
      <MapView
        collection={collection}
        selectedCode={selectedCode}
        onSelect={selectMapTerritory}
        onDrillDown={drillIntoState}
        presentation={NEUTRAL}
        climateMode={false}
        stateOutline={selectedStateOutline}
        onViewportChange={setViewport}
        maxZoom={MAX_ZOOM}
        locationTarget={locationTarget?.code === selectedCode ? locationTarget : null}
      >
        {preferences.showStreets && streets && <StreetsLayer streets={streets} />}
        <NetworkLayer
          layer={layer}
          network={visible ? network.data : undefined}
          ports={preferences.tab === 'waterways' ? ports.data : undefined}
        />
      </MapView>
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
            <TransportControls
              preferences={preferences}
              onChange={setPreferences}
              catalog={catalog.data}
              zoom={viewport.zoom}
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
          <TransportPanel
            layer={layer}
            tab={preferences.tab}
            summary={summary.data}
            loading={summary.isPending}
            error={summary.error}
          />
          {streets && (
            <section
              className="panel-section weather-options-section"
              aria-label="Camadas de apoio"
            >
              <div className="weather-layers-panel">
                <LayerToggle
                  label="Ruas"
                  sources={[{ label: 'IBGE', description: streets.description }]}
                  checked={preferences.showStreets}
                  onChange={(showStreets) => setPreferences({ ...preferences, showStreets })}
                  status={
                    <StatusBadge tone="neutral">
                      {streetsVisible ? 'Ativo' : 'Aproxime o mapa'}
                    </StatusBadge>
                  }
                />
              </div>
            </section>
          )}
          <AccountMenu />
        </aside>
      </div>
      <ThemeSwitch />
    </div>
  );
}
