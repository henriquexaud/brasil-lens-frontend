/**
 * Estado da navegação do mapa.
 *
 * É um hook local com `useState`, não uma store global: o estado é pequeno
 * (nível, pai, seleção) e consumido por poucos componentes. Introduzir Redux
 * aqui resolveria um problema que não existe.
 */
import { useCallback, useState } from 'react';

import type { TerritoryLevel } from '@/api/types';

export interface MapScopeState {
  level: TerritoryLevel;
  /** Código IBGE do território pai quando há drill-down (ex.: UF). */
  parent: string | null;
  parentName: string | null;
}

const ROOT_SCOPE: MapScopeState = { level: 'state', parent: null, parentName: null };

export function useMapScope() {
  const [scope, setScope] = useState<MapScopeState>(ROOT_SCOPE);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  /** Drill-down: carrega apenas os municípios da UF escolhida. */
  const drillIntoState = useCallback((ibgeCode: string, name: string) => {
    setScope({ level: 'municipality', parent: ibgeCode, parentName: name });
    setSelectedCode(null);
  }, []);

  /**
   * Salta direto para um recorte arbitrário — é como uma visualização salva é
   * aberta. `drillIntoState` não serve: ele pressupõe que se está descendo a
   * partir do mapa do país, e uma visualização pode apontar para qualquer nível.
   */
  const applyScope = useCallback((next: MapScopeState) => {
    setScope(next);
    setSelectedCode(null);
  }, []);

  const resetScope = useCallback(() => {
    setScope(ROOT_SCOPE);
    setSelectedCode(null);
  }, []);

  return {
    scope,
    selectedCode,
    setSelectedCode,
    drillIntoState,
    applyScope,
    resetScope,
    isDrilledDown: scope.parent !== null,
  };
}
