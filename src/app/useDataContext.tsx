import { useEffect, useState } from 'react';
import type { DataContext } from '@/api/types';
import { Select } from '@/components/Select';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';

export function useDataContext() {
  const [context, setContext] = useState<DataContext>(() =>
    new URL(window.location.href).searchParams.has('municipality')
      ? 'climate_environmental'
      : (loadSessionState().dataContext ?? 'climate_environmental'),
  );
  useEffect(() => saveSessionState({ dataContext: context }), [context]);
  const control = (
    <div className="context-select">
      <Select
        id="data-context"
        label="Contexto do mapa"
        hideLabel
        value={context}
        options={[
          { value: 'climate_environmental', label: 'Clima e meio ambiente' },
          { value: 'socioeconomic', label: 'Socioeconômico' },
          { value: 'political', label: 'Política' },
        ]}
        onChange={(value) => setContext(value as DataContext)}
      />
    </div>
  );
  return { context, control };
}
