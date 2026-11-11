import { useMemo } from 'react';
import type { PathOptions } from 'leaflet';
import { GeoJSON, Pane } from 'react-leaflet';
import type { PlaceAreas } from '@/api/types';
import { LayerToggle } from '@/components/LayerToggle';
import { StatusBadge } from '@/components/StatusBadge';
import type { MapViewport } from '@/features/map/ViewportObserver';
import { usePlaceAreas } from '@/features/places/queries';
import { networkArea, networkDetail } from '@/features/transport/layers';

// Só o contorno, por cima da pintura de desmatamento, floresta ou fogo: dá para
// ler o que acontece dentro e fora das áreas protegidas sem trocar de contexto.
const STYLE: PathOptions = {
  color: '#1F6F50',
  weight: 1.1,
  opacity: 0.9,
  fill: false,
  interactive: false,
};

const responseIds = new WeakMap<PlaceAreas, number>();
let nextResponseId = 0;
function responseId(areas: PlaceAreas): number {
  let id = responseIds.get(areas);
  if (id === undefined) {
    id = nextResponseId++;
    responseIds.set(areas, id);
  }
  return id;
}

export function useProtectedAreas(viewport: MapViewport, enabled: boolean) {
  const detail = networkDetail(viewport.zoom);
  const area = networkArea(detail, viewport.bbox);
  return usePlaceAreas(
    'conservation_unit',
    null,
    detail,
    viewport.zoom,
    area,
    enabled && !viewport.moving && (detail < 6 || Boolean(area)),
  );
}

export function ProtectedAreasLayer({ areas }: { areas: PlaceAreas }) {
  const key = useMemo(() => responseId(areas), [areas]);
  return (
    <Pane name="protected-areas" style={{ zIndex: 436, pointerEvents: 'none' }}>
      <GeoJSON key={key} data={areas} style={STYLE} interactive={false} />
    </Pane>
  );
}

export function ProtectedAreasOption({
  checked,
  onChange,
  pending,
  error,
}: {
  checked: boolean;
  onChange: (show: boolean) => void;
  pending: boolean;
  error: boolean;
}) {
  return (
    <section className="panel-section weather-options-section" aria-label="Áreas protegidas">
      <div className="weather-layers-panel">
        <LayerToggle
          label="Áreas protegidas"
          sources={[
            {
              label: 'MMA',
              description:
                'Unidades de conservação do Cadastro Nacional (CNUC/MMA). O detalhe de cada uma está no contexto Fauna e flora.',
            },
          ]}
          checked={checked}
          onChange={onChange}
          status={
            <StatusBadge tone={error ? 'error' : 'neutral'}>
              {error ? 'Indisponível' : pending ? 'Carregando…' : 'Contornos'}
            </StatusBadge>
          }
        />
      </div>
    </section>
  );
}
