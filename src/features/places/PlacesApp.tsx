import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PlaceContext, PlaceItem, SpeciesGroup } from '@/api/types';
import { buildUrl } from '@/api/client';
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
import { DEFAULT_TRANSPORT, networkArea, networkDetail } from '@/features/transport/layers';
import { useTransportCatalog } from '@/features/transport/queries';
import { searchBias } from '@/features/transport/route/model';
import { useRoutePlan } from '@/features/transport/route/useRoutePlan';
import { SearchBox, type SearchResult } from '@/features/search/SearchBox';
import type { LocatedMunicipality } from '@/features/search/LocationButton';
import { usePageVisible } from '@/lib/usePageVisible';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { useMobileSheet } from '@/app/useMobileSheet';
import {
  PLACE_CONTEXTS,
  colorForCount,
  countLabel,
  countScale,
  defaultPreferences,
  pointArea,
  type PlacePreferences,
} from './places';
import { PlacesControls } from './PlacesControls';
import { PlacesLayers, type PlaceDestination, type PlaceFocus } from './PlacesLayers';
import { PlacesLegend } from './PlacesLegend';
import { PlacesPanel } from './PlacesPanel';
import { SpeciesPanel } from './SpeciesPanel';
import {
  usePlaceAreas,
  usePlaceCatalog,
  usePlacePoints,
  usePlaceSummary,
  usePlaceValues,
  useSpecies,
} from './queries';
import '@/features/transport/transport.css';
import '@/features/education/education.css';
import '@/features/transport/route/route.css';
import './places.css';

// As ruas só entram de perto, e o código delas (tiles vetoriais) vem junto.
const StreetsLayer = lazy(() =>
  import('@/features/transport/OsmTransportLayer').then((module) => ({
    default: module.OsmTransportLayer,
  })),
);
// A rota só carrega para quem pede o caminho até um lugar.
const RoutePlanner = lazy(() =>
  import('@/features/transport/route/RoutePlanner').then((module) => ({
    default: module.RoutePlanner,
  })),
);
const RouteLayer = lazy(() =>
  import('@/features/transport/route/RouteLayer').then((module) => ({
    default: module.RouteLayer,
  })),
);
const STREETS_ZOOM = 11;
const FINE_POINTS_ZOOM = 12;
// Com as ruas do OpenStreetMap, o mapa chega ao quarteirão.
const MAX_ZOOM = 16;
// Perto assim, o clique é para o ponto: selecionar o município faria o mapa
// saltar para o enquadramento dele.
const POINT_CLICK_ZOOM = 11;

export default function PlacesApp({
  context,
  contextControl,
}: {
  context: PlaceContext;
  contextControl: ReactNode;
}) {
  const config = PLACE_CONTEXTS[context];
  const queryClient = useQueryClient();
  const { scope, selectedCode, setSelectedCode, drillIntoState, resetScope, isDrilledDown } =
    useMapScope();
  const [preferences, setPreferences] = useState<PlacePreferences>(
    () => loadSessionState().places?.[context] ?? defaultPreferences(context),
  );
  const [viewport, setViewport] = useState<MapViewport>({ zoom: 4 });
  const [focus, setFocus] = useState<PlaceFocus | null>(null);
  const [locationTarget, setLocationTarget] = useState<{
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  // Estado ou município na busca: o mapa vai até ele, como no resto do app.
  const selectSearch = useCallback(
    (result: SearchResult) => {
      setLocationTarget(null);
      setFocus(null);
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
      setFocus(null);
      drillIntoState(located.parent.ibgeCode, located.parent.name);
      setSelectedCode(located.ibgeCode);
      setLocationTarget({ code: located.ibgeCode, latitude, longitude, requestedAt: Date.now() });
    },
    [drillIntoState, setSelectedCode],
  );
  const routing = useRoutePlan({ onTerritoryView: selectSearch });
  const pickingRoute = routeOpen && routing.picking !== null;
  const pickedAt = useRef(0);
  const pick = useCallback(
    (next: PlaceFocus | null) => {
      // Marcando um ponto da rota, o clique é do ponto, não do lugar.
      if (pickingRoute) return;
      if (next) pickedAt.current = performance.now();
      setFocus(next);
    },
    [pickingRoute],
  );
  // "Limpar" na rota devolve a busca comum.
  const routeEmpty = !routing.plan.waypoints.some((item) => item.label);
  useEffect(() => {
    if (routeOpen && routeEmpty) setRouteOpen(false);
  }, [routeOpen, routeEmpty]);
  const { routeTo } = routing;
  const openRoute = useCallback(
    (destination: PlaceDestination) => {
      setFocus(null);
      setRouteOpen(true);
      void routeTo(destination);
    },
    [routeTo],
  );
  const pageVisible = usePageVisible();
  const sheet = useMobileSheet();
  useEffect(
    () => saveSessionState({ places: { ...loadSessionState().places, [context]: preferences } }),
    [context, preferences],
  );

  const {
    collection,
    mapLayer,
    statesOutlineLayer,
    selectedStateOutline,
    selectedBoundary,
    scopeReady,
    visibleMunicipalities,
    selectedFeature,
  } = useTerritoryMap({ scope, isDrilledDown, viewport, selectedCode, pageVisible });

  const tab = config.tabs.find((item) => item.key === preferences.tab) ?? config.tabs[0]!;
  const catalog = usePlaceCatalog(context);
  const layer = catalog.data?.layers.find((item) => item.key === tab.layer);
  const saved = tab.species ? null : (preferences.categories[tab.key] ?? null);
  // Categoria salva que saiu do catálogo volta para "todas".
  const category = !layer || layer.categories.some((item) => item.key === saved) ? saved : null;
  const areasTab = layer ? layer.hasShapes : false;
  const counted = Boolean(layer && !layer.hasShapes);
  const parent = isDrilledDown ? scope.parent : null;
  const ready = pageVisible && scopeReady;

  const values = usePlaceValues(tab.layer, category, parent, counted && ready);
  const detail = networkDetail(viewport.zoom);
  const area = networkArea(detail, viewport.bbox);
  const areas = usePlaceAreas(
    tab.layer,
    category,
    detail,
    viewport.zoom,
    area,
    areasTab && ready && !viewport.moving && (detail < 6 || Boolean(area)),
  );
  const pointsShown = counted && layer?.pointZoom != null && viewport.zoom >= layer.pointZoom;
  const points = usePlacePoints(
    tab.layer,
    category,
    viewport.zoom >= FINE_POINTS_ZOOM ? pointArea(viewport.zoom, viewport.bbox) : area,
    pointsShown && ready && !viewport.moving,
  );
  const detailCode = selectedCode ?? scope.parent ?? 'BR';
  const summary = usePlaceSummary(detailCode, tab.layer, category, pageVisible);
  const species = useSpecies(detailCode, preferences.group, Boolean(tab.species) && pageVisible);
  const streets = useTransportCatalog().data?.tiles;
  const streetsUrl = streets
    ? buildUrl(streets.url).replace(/%7B/g, '{').replace(/%7D/g, '}')
    : null;

  const scale = useMemo(
    () =>
      counted && values.data ? countScale(Object.values(values.data.values), config.ramp) : null,
    [counted, values.data, config.ramp],
  );
  const categoryLabel = layer?.categories.find((item) => item.key === category)?.label;
  const presentation = useMemo<TerritoryPresentation>(() => {
    const colors = new Map<string, string>();
    const painted = new Set<string>();
    const tooltips = new Map<string, { value: string; meta: string }>();
    // Com os pontos na tela, a pintura do território sai: de perto ela vira um fundo
    // chapado que esconde as ruas e os próprios pontos.
    const data =
      counted && !pointsShown && values.data?.layer === tab.layer ? values.data : undefined;
    if (data && collection) {
      for (const feature of collection.features) {
        const code = feature.properties.ibgeCode;
        const count = data.values[code] ?? 0;
        if (count > 0 && scale) {
          colors.set(code, colorForCount(count, scale));
          painted.add(code);
        }
        tooltips.set(code, {
          value: count > 0 ? countLabel(count, tab) : 'Nenhum registro',
          meta: categoryLabel ?? tab.title,
        });
      }
    }
    return {
      key: `places:${tab.layer}:${data ? `${data.category}:${data.parent}` : 'neutral'}`,
      colors,
      values: painted,
      tooltips,
    };
  }, [counted, pointsShown, values.data, collection, scale, tab, categoryLabel]);

  const update = (patch: Partial<PlacePreferences>) => {
    setFocus(null);
    setPreferences((current) => ({ ...current, ...patch }));
  };
  const setCategory = (value: string | null) => {
    const categories = { ...preferences.categories };
    if (value) categories[tab.key] = value;
    else delete categories[tab.key];
    update({ categories });
  };

  const selectMapTerritory = useCallback(
    (code: string) => {
      // O clique que acabou de abrir um lugar não seleciona o território embaixo.
      if (performance.now() - pickedAt.current < 300 || pickingRoute) return;
      if (pointsShown && viewport.zoom >= POINT_CLICK_ZOOM) return;
      if (code.length === 7 && code.slice(0, 2) !== scope.parent) {
        const state = code.slice(0, 2);
        const found = statesOutlineLayer.data?.features.find((item) => item.id === state);
        drillIntoState(state, found?.properties.name ?? state);
      }
      setSelectedCode(code);
    },
    [
      pickingRoute,
      pointsShown,
      viewport.zoom,
      scope.parent,
      statesOutlineLayer.data,
      drillIntoState,
      setSelectedCode,
    ],
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
        pickingRoute ||
        document.activeElement?.closest('input, select, textarea, .search-slot')
      )
        return;
      if (focus) setFocus(null);
      else if (selectedCode) setSelectedCode(null);
      else if (isDrilledDown) resetScope();
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [focus, selectedCode, isDrilledDown, setSelectedCode, resetScope, pickingRoute]);

  const failure =
    mapLayer.error ??
    statesOutlineLayer.error ??
    (isDrilledDown ? visibleMunicipalities.error : null) ??
    selectedBoundary.error;
  const dataError = catalog.error ?? values.error ?? areas.error ?? points.error;
  const retry = () => {
    if (mapLayer.error)
      void queryClient.invalidateQueries({ queryKey: ['map', scope.level, scope.parent] });
    if (statesOutlineLayer.error && isDrilledDown)
      void queryClient.invalidateQueries({ queryKey: ['map', 'state', null] });
    if (visibleMunicipalities.error) void visibleMunicipalities.refetch();
    if (selectedBoundary.error) void selectedBoundary.refetch();
    void queryClient.invalidateQueries({ queryKey: ['places'] });
  };
  const source = catalog.data?.sources.find((item) => item.key === layer?.source);
  const selectItem = (item: PlaceItem) => {
    setFocus({ id: item.id, latitude: item.latitude, longitude: item.longitude, travel: true });
    // No celular o painel cobre o mapa: recolhe para o lugar aparecer.
    if (window.matchMedia('(max-width: 900px)').matches && !sheet.collapsed) sheet.toggle();
  };

  return (
    <div
      className={`app socioeconomic-app places-app${pointsShown ? ' is-map-close' : ''}`}
      style={{ ['--indicator-accent' as string]: config.accent }}
    >
      {((!scopeReady && mapLayer.isFetching) ||
        values.isFetching ||
        areas.isFetching ||
        points.isFetching ||
        selectedBoundary.isFetching) && <TopProgress />}
      <MapView
        collection={collection}
        selectedCode={selectedCode}
        onSelect={selectMapTerritory}
        onDrillDown={drillIntoState}
        presentation={presentation}
        climateMode={false}
        stateOutline={selectedStateOutline}
        onViewportChange={setViewport}
        maxZoom={MAX_ZOOM}
        locationTarget={locationTarget?.code === selectedCode ? locationTarget : null}
      >
        {streetsUrl && streets && viewport.zoom >= STREETS_ZOOM && (
          <Suspense fallback={null}>
            <StreetsLayer
              url={streetsUrl}
              maxDataZoom={streets.maxZoom}
              preferences={DEFAULT_TRANSPORT}
              backdrop
            />
          </Suspense>
        )}
        <PlacesLayers
          tab={tab}
          accent={config.accent}
          zoom={viewport.zoom}
          areas={areasTab ? areas.data : undefined}
          points={pointsShown ? points.data?.points : undefined}
          travelZoom={areasTab ? 8 : 14}
          focus={focus}
          onFocus={pick}
          onDirections={openRoute}
        />
        {routeOpen && (
          <Suspense fallback={null}>
            <RouteLayer
              waypoints={routing.plan.waypoints}
              route={routing.route}
              stale={routing.stale}
              focus={routing.focus}
              device={routing.device}
              picking={routing.picking !== null}
              onPick={routing.onPickPoint}
              onDrag={routing.onDrag}
            />
          </Suspense>
        )}
      </MapView>
      {routeOpen ? (
        <Suspense fallback={null}>
          <RoutePlanner
            plan={routing.plan}
            dispatch={routing.dispatch}
            route={routing.route}
            routeLoading={routing.routeLoading}
            routeError={routing.routeError}
            near={searchBias(viewport.bbox, viewport.zoom, routing.device)}
            picking={routing.picking}
            onPick={routing.setPicking}
            onSelectPlace={routing.onSelectPlace}
            onSelectTerritory={(index, result) => void routing.onSelectTerritory(index, result)}
            notice={routing.notice}
            onPosition={routing.onPosition}
          />
        </Suspense>
      ) : (
        <SearchBox onSelect={selectSearch} onLocated={onLocated} />
      )}
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
            <PlacesControls
              tabs={config.tabs}
              tab={tab}
              onTab={(key) => update({ tab: key })}
              layer={layer}
              category={category}
              onCategory={setCategory}
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
          <PlacesPanel
            tab={tab}
            summary={summary.data}
            loading={summary.isPending}
            error={summary.error}
            category={category}
            areas={areasTab}
            territory={selectedCode ? selectedFeature?.properties : undefined}
            onClose={selectedCode ? () => setSelectedCode(null) : undefined}
            onDrillDown={drillIntoState}
            onSelect={selectItem}
            onCategory={setCategory}
          >
            {tab.species && (
              <SpeciesPanel
                group={preferences.group}
                onGroup={(group: SpeciesGroup) => update({ group })}
                data={species.data}
                loading={species.isFetching}
                error={species.error}
              />
            )}
          </PlacesPanel>
          <AccountMenu />
        </aside>
      </div>
      {!failure && (
        <div className="legend-slot">
          <PlacesLegend
            tab={tab}
            layer={layer}
            accent={config.accent}
            scale={scale}
            municipal={isDrilledDown}
            zoom={viewport.zoom}
            pointsShown={Boolean(pointsShown)}
            truncated={Boolean(pointsShown && points.data?.truncated)}
            source={source?.label ?? ''}
          />
        </div>
      )}
      <DonationButton />
      <ThemeSwitch />
    </div>
  );
}
