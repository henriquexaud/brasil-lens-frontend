import type { PlaceLayerInfo } from '@/api/types';
import { AREA_COLORS, scaleBands, type CountScale, type PlaceTab } from './places';

function Square({ color }: { color: string }) {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
      <rect x="1" y="0.5" width="10" height="9" rx="2" fill={color} />
    </svg>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
      <circle cx="6" cy="5" r="3.4" fill={color} stroke="#ffffff" strokeWidth="1.2" />
    </svg>
  );
}

export function PlacesLegend({
  tab,
  layer,
  accent,
  scale,
  municipal,
  zoom,
  pointsShown,
  truncated,
  source,
}: {
  tab: PlaceTab;
  layer?: PlaceLayerInfo;
  accent: string;
  scale: CountScale | null;
  municipal: boolean;
  zoom: number;
  pointsShown: boolean;
  truncated: boolean;
  source: string;
}) {
  const areas = layer?.hasShapes ?? false;
  const keys = areas
    ? (layer?.categories ?? []).map((item) => ({
        label: item.label,
        color: AREA_COLORS[item.key] ?? accent,
      }))
    : scale && !pointsShown
      ? scaleBands(scale)
      : [];
  const note = areas
    ? tab.species
      ? null
      : 'Toque numa área para ver os detalhes'
    : truncated
      ? 'Muitos pontos nesta vista; aproxime para ver todos'
      : !pointsShown && layer?.pointZoom != null && zoom < layer.pointZoom
        ? 'Aproxime o mapa para ver cada local'
        : null;
  return (
    <figure
      className="legend scale-legend transport-legend places-legend"
      aria-label={`Legenda de ${tab.title}`}
    >
      <figcaption className="scale-legend-header">
        <span className="scale-legend-title">
          {areas || pointsShown
            ? tab.title
            : `${tab.title} por ${municipal ? 'município' : 'estado'}`}
        </span>
        <span className="scale-legend-unit">{source}</span>
      </figcaption>
      <ul className="transport-legend-keys">
        {keys.map((item) => (
          <li key={item.label}>
            <Square color={item.color} />
            <span>{item.label}</span>
          </li>
        ))}
        {pointsShown && (
          <li>
            <Dot color={accent} />
            <span>{tab.one}</span>
          </li>
        )}
      </ul>
      {note && <p className="scale-legend-notice">{note}</p>}
    </figure>
  );
}
