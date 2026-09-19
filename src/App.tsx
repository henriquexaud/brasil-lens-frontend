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
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useContexts,
  useIndicators,
  useMapLayer,
  usePrefetchOverview,
  useTerritoryOverview,
  useWeatherAlerts,
  useWeatherSources,
  useWeatherStations,
} from '@/api/queries';
import type { DataContext, MapQuery, MapScopeInput, SavedView } from '@/api/types';
import { Select } from '@/components/Select';
import { EmptyState, ErrorMessage, TopProgress } from '@/components/Feedback';
import { ControlPanel, LATEST_YEAR } from '@/features/controls/ControlPanel';
import { TerritoryDetailPanel } from '@/features/detail/TerritoryDetailPanel';
import { Legend } from '@/features/map/Legend';
import { MapView } from '@/features/map/MapView';
import { useMapScope } from '@/features/map/useMapScope';
import { SearchBox } from '@/features/search/SearchBox';
import { SavedViewsPanel } from '@/features/views/SavedViewsPanel';
import { AlertsLayer } from '@/features/weather/AlertsLayer';
import { SourceStatusPanel } from '@/features/weather/SourceStatusPanel';
import { StationLayer } from '@/features/weather/StationLayer';
import type { SearchResult } from '@/lib/searchIndex';

const DEFAULT_INDICATOR = 'population';
const DEFAULT_CONTEXT: DataContext = 'sociopolitical';

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
  const [context, setContext] = useState<DataContext>(DEFAULT_CONTEXT);

  /**
   * Clima não é "mais um indicador" — é um painel diferente (estações e
   * alertas em vez de coroplética territorial). Em vez de espalhar `if
   * (context === 'climate_environmental')` pelo componente inteiro, esta
   * única flag decide o que fica ligado/desligado abaixo.
   */
  const isClimate = context === 'climate_environmental';

  /**
   * Esc como "voltar" a partir do mapa: fecha o detalhe aberto ou, sem
   * detalhe, sobe um nível de volta ao Brasil.
   *
   * Só age quando o foco está fora do painel e da busca — dentro deles, o
   * próprio `ControlPanel`/`SearchBox` já usa Esc para fechar o seletor de
   * ano/sobre ou o dropdown de resultados, e um select nativo aberto também
   * consome Esc antes de qualquer listener em `window`. Sem essa guarda, os
   * handlers disparariam juntos.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (document.activeElement?.closest('.panel, .search-slot')) return;
      if (selectedCode) setSelectedCode(null);
      else if (isDrilledDown) resetScope();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCode, isDrilledDown, setSelectedCode, resetScope]);

  /**
   * Escolher um resultado da busca é o mesmo fluxo de clicar no território no
   * mapa — só que o usuário pode nem estar vendo aquele pedaço do mapa ainda.
   * Estado: se estava dentro de uma UF, primeiro volta ao Brasil. Município:
   * sempre entra na UF-mãe antes de selecionar, já que o mapa só carrega
   * municípios de um estado por vez (ver useMapScope).
   */
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

  // Contextos de dados (sociopolítico, clima/ambiente, biodiversidade) e os
  // providers registrados em cada um — metadado do backend, não da ingestão.
  const contextsQuery = useContexts();
  const contexts = contextsQuery.data?.contexts ?? [];

  // A cobertura temporal depende do nível exibido, então o catálogo é pedido
  // para o nível atual: o seletor de ano nunca oferece um ano sem dado.
  // `context` restringe ao contexto ativo — os demais ainda não têm provider
  // registrado, então o catálogo vem vazio até um ser adicionado.
  const indicatorsQuery = useIndicators(scope.level, context, !isClimate);
  const indicators = indicatorsQuery.data?.indicators ?? [];

  // Clima: três consultas independentes, cada uma sua própria cadência —
  // nenhuma delas depende de nível/pai/ano (ver docs/ARCHITECTURE.md, o
  // contexto Clima não é territorial). Desligadas fora deste contexto para
  // não fazer polling à toa.
  const stationsQuery = useWeatherStations(isClimate);
  const alertsQuery = useWeatherAlerts(isClimate);
  const sourcesQuery = useWeatherSources(isClimate);
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

  const mapLayer = useMapLayer(mapQuery, indicators.length > 0 && !isClimate);
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
  const failure = isClimate
    ? (stationsQuery.error ?? alertsQuery.error ?? sourcesQuery.error)
    : (indicatorsQuery.error ?? mapLayer.error);
  const isFetching = isClimate
    ? stationsQuery.isFetching || alertsQuery.isFetching
    : mapLayer.isFetching || indicatorsQuery.isFetching;

  return (
    <div className="app">
      {isFetching && <TopProgress />}

      {isClimate ? (
        <MapView>
          <StationLayer collection={stationsQuery.data} />
          <AlertsLayer collection={alertsQuery.data} />
        </MapView>
      ) : (
        <MapView
          collection={collection}
          selectedCode={selectedCode}
          onSelect={setSelectedCode}
          onHover={prefetchOverview}
          onDrillDown={drillIntoState}
        />
      )}

      {!isClimate && <SearchBox onSelect={handleSearchSelect} />}

      <div className="panel-slot">
        <aside className="panel">
          {/* Sempre visível, mesmo quando o contexto ativo ainda não tem
              indicador algum: é o que permite sair dele. */}
          {contexts.length > 1 && (
            <div className="panel-section">
              <Select
                id="context"
                label="Contexto de dados"
                value={context}
                options={contexts.map((item) => ({
                  value: item.key,
                  label: item.indicatorCount > 0 ? item.name : `${item.name} (em breve)`,
                }))}
                onChange={(value) => setContext(value as DataContext)}
              />
            </div>
          )}

          {/* Clima substitui indicador/ano por frescor de fonte — não há
              coroplética nem recorte territorial neste contexto (ver
              docs/ARCHITECTURE.md). */}
          {isClimate && <SourceStatusPanel sources={sourcesQuery.data} />}

          {/* Os controles dependem do catálogo para exibir os indicadores. */}
          {!isClimate && indicators.length > 0 && (
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
          )}

          {failure && (
            <div className="panel-section">
              <ErrorMessage error={failure} />
            </div>
          )}

          {!isClimate && !failure && !indicatorsQuery.isFetching && indicators.length === 0 && (
            <div className="panel-section">
              <EmptyState
                title="Nenhum indicador neste contexto"
                hint="Este contexto ainda não tem nenhuma fonte de dados registrada."
              />
            </div>
          )}

          {!isClimate && !failure && indicators.length > 0 && isEmptyScope && (
            <div className="panel-section">
              <EmptyState
                title="Nenhum território para este recorte"
                hint="Não há territórios disponíveis neste recorte."
              />
            </div>
          )}

          {isClimate &&
            !failure &&
            !stationsQuery.isFetching &&
            (stationsQuery.data?.features.length ?? 0) === 0 && (
              <div className="panel-section">
                <EmptyState
                  title="Nenhuma estação com leitura no momento"
                  hint="As fontes ainda não publicaram uma leitura recente — ver frescor por fonte acima."
                />
              </div>
            )}

          {!isClimate && selectedCode && (
            <TerritoryDetailPanel
              overview={overview.data}
              isLoading={overview.isPending}
              error={overview.error}
              mappedIndicatorKey={indicatorKey}
              onClose={() => setSelectedCode(null)}
              onDrillDown={drillIntoState}
            />
          )}

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

      {!isClimate && !failure && (
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
