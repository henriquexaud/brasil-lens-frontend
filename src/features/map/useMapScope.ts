import { useCallback, useEffect, useState } from 'react';

import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';

export interface MapScopeState {
  level: 'state' | 'municipality';
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
