import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { ScopeHeader } from '@/components/ScopeHeader';
import { ErrorMessage, TopProgress } from '@/components/Feedback';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { DonationButton } from '@/features/donation/DonationButton';
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
import { buildUrl } from '@/api/client';
import { COLORS, DEFAULT_TRANSPORT, networkArea, networkDetail } from './layers';
import { NetworkLayer } from './NetworkLayer';
import { OsmTransportLayer } from './OsmTransportLayer';
import { TransportControls } from './TransportControls';
import { TransportLegend } from './TransportLegend';
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
// A malha do OpenStreetMap chega à rua; o resto do app para no zoom 12.
const MAX_ZOOM = 16;
// Perto assim, o clique é para a via: selecionar o município faria o mapa saltar
// para o enquadramento dele.
const STREET_CLICK_ZOOM = 11;

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
  const tiles = catalog.data?.tiles;
  // `buildUrl` escapa as chaves do modelo {z}/{x}/{y}; o renderizador precisa delas.
  const tileUrl = tiles ? buildUrl(tiles.url).replace(/%7B/g, '{').replace(/%7D/g, '}') : null;
  // Hidrovias e portos são oficiais (IBGE) e vêm da API; vias e trilhos, dos tiles OSM.
  const waterways = preferences.tab === 'waterways';
  const detail = networkDetail(viewport.zoom);
  const area = networkArea(detail, viewport.bbox, isDrilledDown ? collection?.bbox : null);
  const network = useTransportNetwork(
    'waterway',
    detail,
    viewport.zoom,
    area,
    waterways && pageVisible && scopeReady && !viewport.moving && (detail < 6 || Boolean(area)),
  );
  const ports = useTransportNetwork('port', 4, 4, undefined, waterways && pageVisible);
  const detailCode = selectedCode ?? scope.parent ?? 'BR';
  const summary = useTransportSummary(detailCode, pageVisible);

  const selectMapTerritory = useCallback(
    (code: string) => {
      if (viewport.zoom >= STREET_CLICK_ZOOM) return;
      setLocationTarget(null);
      if (code.length === 7 && code.slice(0, 2) !== scope.parent) {
        const parent = code.slice(0, 2);
        const state = statesOutlineLayer.data?.features.find((item) => item.id === parent);
        drillIntoState(parent, state?.properties.name ?? parent);
      }
      setSelectedCode(code);
    },
    [viewport.zoom, scope.parent, statesOutlineLayer.data, drillIntoState, setSelectedCode],
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
  const dataError = catalog.error ?? (waterways ? (network.error ?? ports.error) : null);
  const retry = () => {
    if (mapLayer.error)
      void queryClient.invalidateQueries({ queryKey: ['map', scope.level, scope.parent] });
    if (statesOutlineLayer.error && isDrilledDown)
      void queryClient.invalidateQueries({ queryKey: ['map', 'state', null] });
    if (visibleMunicipalities.error) void visibleMunicipalities.refetch();
    if (selectedBoundary.error) void selectedBoundary.refetch();
    void queryClient.invalidateQueries({ queryKey: ['transport'] });
  };
  const accent = preferences.tab === 'rail' ? COLORS.rail : waterways ? COLORS.water : COLORS.road;

  return (
    <div
      className="app socioeconomic-app transport-app"
      style={{ ['--indicator-accent' as string]: accent }}
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
        {tileUrl && tiles && (
          <OsmTransportLayer url={tileUrl} maxDataZoom={tiles.maxZoom} preferences={preferences} />
        )}
        {waterways && <NetworkLayer layer="waterway" network={network.data} ports={ports.data} />}
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
            preferences={preferences}
            summary={summary.data}
            loading={summary.isPending}
            error={summary.error}
          />
          <AccountMenu />
        </aside>
      </div>
      {!failure && (
        <div className="legend-slot">
          <TransportLegend
            preferences={preferences}
            zoom={viewport.zoom}
            source={waterways ? 'IBGE · OSM' : 'OpenStreetMap'}
          />
        </div>
      )}
      <DonationButton />
      <ThemeSwitch />
    </div>
  );
}
