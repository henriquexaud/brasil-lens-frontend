import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DataContext } from '@/api/types';
import { Select } from '@/components/Select';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { crossfade, finishEntryAnimations, waitFor } from './crossfade';

// Tempo máximo com a tela anterior parada à espera da malha do contexto novo.
const MAP_READY_MS = 400;

// `preload` adianta o código de um contexto carregado sob demanda.
export function useDataContext(preload: Partial<Record<DataContext, () => Promise<void>>> = {}) {
  const [context, setContext] = useState<DataContext>(() =>
    new URL(window.location.href).searchParams.has('municipality')
      ? 'climate_environmental'
      : (loadSessionState().dataContext ?? 'climate_environmental'),
  );
  // O select mostra a escolha na hora; `context` só muda dentro do cross-fade.
  const [choice, setChoice] = useState(context);
  const committed = useRef(context);
  const latest = useRef(context);
  useLayoutEffect(() => {
    committed.current = context;
  }, [context]);
  useEffect(() => saveSessionState({ dataContext: context }), [context]);

  // Cada contexto monta o próprio mapa e painel. A troca vira um cross-fade:
  // a tela anterior fica até o contexto novo ter a malha desenhada, e o mapa
  // novo nasce na mesma vista (MapView), então só as cores se dissolvem.
  const change = async (value: DataContext) => {
    setChoice(value);
    latest.current = value;
    await preload[value]?.();
    if (latest.current !== value) return; // outra escolha chegou durante a carga
    void crossfade('screen', async () => {
      startTransition(() => setContext(value));
      await waitFor(
        () =>
          committed.current === value &&
          document.querySelector('.leaflet-container .territory-shape') !== null,
        MAP_READY_MS,
      );
      finishEntryAnimations();
    });
  };

  const control = (
    <div className="context-select">
      <Select
        id="data-context"
        label="Contexto do mapa"
        hideLabel
        value={choice}
        options={[
          { value: 'climate_environmental', label: 'Clima e meio ambiente' },
          { value: 'socioeconomic', label: 'Socioeconômico' },
          { value: 'political', label: 'Política' },
        ]}
        onChange={(value) => void change(value as DataContext)}
      />
    </div>
  );
  return { context, control };
}
