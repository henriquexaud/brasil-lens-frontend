import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { DataContext } from '@/api/types';
import { Select } from '@/components/Select';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';
import { crossfade, finishEntryAnimations, waitFor } from './crossfade';

// Tempo máximo com a tela anterior parada à espera dos dados do contexto novo
// (rede lenta) e, depois, da malha pintada.
const DATA_READY_MS = 700;
const MAP_READY_MS = 400;

type Prefetch = (client: QueryClient) => Promise<void>;

// `preload` adianta o código de um contexto carregado sob demanda; `prefetch`,
// os dados do primeiro quadro dele no recorte e nas escolhas salvas.
export function useDataContext(
  preload: Partial<Record<DataContext, () => Promise<void>>> = {},
  prefetch: Partial<Record<DataContext, Prefetch>> = {},
) {
  const client = useQueryClient();
  const prepare = (value: DataContext) =>
    prefetch[value]?.(client).catch(() => undefined) ?? Promise.resolve();
  // Apontar, focar ou tocar o seletor já aquece os outros contextos: quando a
  // escolha chega, o mapa novo nasce pintado. Com cache fresco, nada sai.
  const warm = () => {
    for (const value of Object.keys(prefetch) as DataContext[])
      if (value !== committed.current) void prepare(value);
  };
  const [context, setContext] = useState<DataContext>(() =>
    new URL(window.location.href).searchParams.has('municipality')
      ? 'climate'
      : (loadSessionState().dataContext ?? 'climate'),
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
  // a tela anterior fica até o contexto novo ter código e dados e desenhar a
  // malha sem skeleton, e o mapa novo nasce na mesma vista (MapView), então só
  // as cores se dissolvem, sem passar pelo neutro.
  const change = async (value: DataContext) => {
    setChoice(value);
    latest.current = value;
    await Promise.all([
      preload[value]?.(),
      Promise.race([prepare(value), new Promise((done) => setTimeout(done, DATA_READY_MS))]),
    ]);
    if (latest.current !== value) return; // outra escolha chegou durante a carga
    void crossfade('screen', async () => {
      startTransition(() => setContext(value));
      await waitFor(
        () =>
          committed.current === value &&
          document.querySelector('.leaflet-container .territory-shape') !== null &&
          document.querySelector('.leaflet-container .territory-pending-shape') === null,
        MAP_READY_MS,
      );
      finishEntryAnimations();
    });
  };

  const control = (
    <div
      className="context-select"
      onPointerEnter={warm}
      onPointerDown={warm}
      onFocusCapture={warm}
    >
      <Select
        id="data-context"
        label="Contexto do mapa"
        hideLabel
        value={choice}
        options={[
          { value: 'climate', label: 'Clima' },
          { value: 'environment', label: 'Meio ambiente' },
          { value: 'socioeconomic', label: 'Socioeconômico' },
          { value: 'political', label: 'Política' },
          { value: 'transport', label: 'Transporte' },
          { value: 'education', label: 'Educação' },
        ]}
        onChange={(value) => void change(value as DataContext)}
      />
    </div>
  );
  return { context, control };
}
