/**
 * Estado da navegação do mapa.
 *
 * É um hook local com `useState`, não uma store global: o estado é pequeno
 * (nível, pai, seleção) e consumido por poucos componentes. Introduzir Redux
 * aqui resolveria um problema que não existe.
 */
import { useCallback, useEffect, useState } from 'react';

import type { TerritoryLevel } from '@/api/types';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';

export interface MapScopeState {
  level: TerritoryLevel;
  /** Código IBGE do território pai quando há drill-down (ex.: UF). */
  parent: string | null;
  parentName: string | null;
}

const ROOT_SCOPE: MapScopeState = { level: 'state', parent: null, parentName: null };

export function useMapScope() {
  const [scope, setScope] = useState<MapScopeState>(() => {
    const saved = loadSessionState();
    return saved.scope ?? ROOT_SCOPE;
  });
  const [selectedCode, setSelectedCode] = useState<string | null>(() => {
    const saved = loadSessionState();
    return typeof saved.selectedCode === 'string' ? saved.selectedCode : null;
  });

  useEffect(() => {
    saveSessionState({ scope, selectedCode });
  }, [scope, selectedCode]);

  /** Drill-down: carrega apenas os municípios da UF escolhida. */
  const drillIntoState = useCallback((ibgeCode: string, name: string) => {
    setScope({ level: 'municipality', parent: ibgeCode, parentName: name });
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
    resetScope,
    isDrilledDown: scope.parent !== null,
  };
}
