/**
 * Frescor e disponibilidade por fonte de clima.
 *
 * Substitui `ControlPanel`/`Legend` neste contexto: não há indicador nem ano
 * para escolher, só transparência sobre o que está (ou não) chegando de cada
 * fonte — o mesmo espírito de "indisponibilidade tratada explicitamente" que
 * o resto do produto já aplica a indicador sem dado.
 */
import type { WeatherSourcesResponse, WeatherSourceStatusValue } from '@/api/types';
import { formatRelativeTime } from '@/lib/format';

const STATUS_LABEL: Record<WeatherSourceStatusValue, string> = {
  ok: 'Atualizado',
  stale: 'Atrasado',
  unavailable: 'Indisponível',
};

// Cores de sinalização de estado — não fazem parte das famílias de dado de
// docs/ARCHITECTURE.md, são cromo de UI (como HOVER_COLOR/SELECTED_COLOR em
// features/map/colors.ts), por isso não vêm de PALETTES.
const STATUS_COLOR: Record<WeatherSourceStatusValue, string> = {
  ok: '#2E9C57',
  stale: '#C9461C',
  unavailable: '#a4262c',
};

interface Props {
  sources: WeatherSourcesResponse | undefined;
}

export function SourceStatusPanel({ sources }: Props) {
  if (!sources || sources.sources.length === 0) return null;

  return (
    <div className="weather-source-status">
      <ul className="weather-source-list">
        {sources.sources.map((source) => (
          <li key={source.key} className="weather-source-row">
            <span
              className="weather-source-dot"
              style={{ background: STATUS_COLOR[source.status] }}
              aria-hidden="true"
            />
            <span className="weather-source-text">
              <span className="weather-source-name">{source.name}</span>
              <span className="weather-source-meta">
                {STATUS_LABEL[source.status]}
                {source.lastUpdatedAt && ` · ${formatRelativeTime(source.lastUpdatedAt)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
