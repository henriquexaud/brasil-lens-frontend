/**
 * Composição da aplicação.
 *
 * O fluxo de dados é deliberadamente curto:
 *
 *     API → FeatureCollection → Leaflet
 *
 * Não há junção, cálculo de indicador, agregação nem transformação geográfica
 * no browser. A camada do mapa e os metadados de coropleta chegam na mesma
 * resposta, e os municípios só são buscados quando um estado é aberto.
 */
import { useCallback, useMemo, useState } from 'react';

import {
  useIndicators,
  useMapLayer,
  usePrefetchOverview,
  useTerritoryOverview,
} from '@/api/queries';
import type { MapQuery, MapScopeInput, SavedView } from '@/api/types';
import { EmptyState, ErrorMessage, TopProgress } from '@/components/Feedback';
import { ControlPanel, LATEST_YEAR } from '@/features/controls/ControlPanel';
import { TerritoryDetailPanel } from '@/features/detail/TerritoryDetailPanel';
import { Legend } from '@/features/map/Legend';
import { MapView } from '@/features/map/MapView';
import { useMapScope } from '@/features/map/useMapScope';
import { SavedViewsPanel } from '@/features/views/SavedViewsPanel';

const DEFAULT_INDICATOR = 'population';

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

  const [indicatorKey, setIndicatorKey] = useState(DEFAULT_INDICATOR);
  const [year, setYear] = useState<string>(LATEST_YEAR);

  // A cobertura temporal depende do nível exibido, então o catálogo é pedido
  // para o nível atual: o seletor de ano nunca oferece um ano sem dado.
  const indicatorsQuery = useIndicators(scope.level);
  const indicators = indicatorsQuery.data?.indicators ?? [];
  const currentIndicator = indicators.find((indicator) => indicator.key === indicatorKey);

  /**
   * O ano é *derivado*, não redefinido por efeito.
   *
   * Antes, um efeito voltava o ano para "último disponível" a cada troca de
   * escopo. Isso descartava a escolha do usuário e disparava uma requisição
   * extra: a consulta do mapa já havia saído com o ano antigo quando o efeito
   * rodava. Derivando, o ano escolhido é preservado quando existe no novo nível
   * e só cai para "último" quando de fato não existe.
   */
  const effectiveYear = useMemo(() => {
    if (year === LATEST_YEAR) return year;
    const years = currentIndicator?.availableYears ?? [];
    // Enquanto a cobertura exibida ainda é a do nível anterior, não há como
    // julgar se o ano existe aqui — manter a escolha evita um descarte injusto.
    if (indicatorsQuery.isPlaceholderData || years.length === 0) return year;
    return years.includes(Number(year)) ? year : LATEST_YEAR;
  }, [year, currentIndicator, indicatorsQuery.isPlaceholderData]);

  const mapQuery: MapQuery = useMemo(
    () => ({
      level: scope.level,
      parent: scope.parent,
      indicator: indicatorKey,
      year: effectiveYear,
    }),
    [scope.level, scope.parent, indicatorKey, effectiveYear],
  );

  const mapLayer = useMapLayer(mapQuery, indicators.length > 0);
  const overview = useTerritoryOverview(selectedCode);
  const prefetchOverview = usePrefetchOverview();

  /** O recorte em exibição, na forma que o backend grava — falta só o nome. */
  const currentView: MapScopeInput = useMemo(
    () => ({
      level: scope.level,
      parentCode: scope.parent,
      indicatorKey,
      year: effectiveYear,
    }),
    [scope.level, scope.parent, indicatorKey, effectiveYear],
  );

  /** Abrir uma visualização salva é repor os três estados de uma vez. */
  const applySavedView = useCallback(
    (view: SavedView, parentName: string | null) => {
      applyScope({ level: view.level, parent: view.parentCode, parentName });
      setIndicatorKey(view.indicatorKey);
      setYear(view.year);
    },
    [applyScope],
  );

  const collection = mapLayer.data;
  const showsCurrentScope =
    collection?.scope.level === scope.level && (collection?.scope.parent ?? null) === scope.parent;
  const isEmptyScope = Boolean(collection && showsCurrentScope && collection.features.length === 0);
  const failure = indicatorsQuery.error ?? mapLayer.error;

  return (
    <div className="app">
      {(mapLayer.isFetching || indicatorsQuery.isFetching) && <TopProgress />}

      <MapView
        collection={collection}
        selectedCode={selectedCode}
        onSelect={setSelectedCode}
        onHover={prefetchOverview}
      />

      <div className="panel-slot">
        <aside className="panel">
          {/* Ambas as seções dependem do catálogo: sem ele não há nome de
              indicador para exibir em nenhuma das duas. */}
          {indicators.length > 0 && (
            <>
              <ControlPanel
                indicators={indicators}
                selectedIndicatorKey={indicatorKey}
                onIndicatorChange={setIndicatorKey}
                selectedYear={effectiveYear}
                onYearChange={setYear}
                scopeTitle={scope.parentName ?? 'Brasil'}
                scopeSubtitle={isDrilledDown ? 'Municípios de' : 'Estados do'}
                resolvedYear={showsCurrentScope ? (collection?.indicator?.year ?? null) : null}
                onResetScope={isDrilledDown ? resetScope : undefined}
              />
              <SavedViewsPanel
                current={currentView}
                currentParentName={scope.parentName}
                indicators={indicators}
                onApply={applySavedView}
              />
            </>
          )}

          {failure && (
            <div className="panel-section">
              <ErrorMessage error={failure} />
            </div>
          )}

          {!failure && isEmptyScope && (
            <div className="panel-section">
              <EmptyState
                title="Nenhum território para este recorte"
                hint="Não há territórios disponíveis neste recorte."
              />
            </div>
          )}

          {selectedCode && (
            <TerritoryDetailPanel
              overview={overview.data}
              isLoading={overview.isPending}
              error={overview.error}
              mappedIndicatorKey={indicatorKey}
              onClose={() => setSelectedCode(null)}
              onDrillDown={drillIntoState}
            />
          )}
        </aside>
      </div>

      {!failure && (
        <div className="legend-slot">
          <Legend
            indicator={collection?.indicator ?? null}
            classification={collection?.classification ?? null}
            statistics={collection?.statistics ?? null}
          />
        </div>
      )}
    </div>
  );
}
