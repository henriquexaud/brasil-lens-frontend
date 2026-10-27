import { COLORS, type TransportPreferences } from './layers';

interface Key {
  label: string;
  color: string;
  kind: 'line' | 'thin' | 'dash' | 'dot' | 'station';
}

const CONTEXT: Key = { label: 'Demais vias', color: COLORS.context, kind: 'thin' };

function legendFor(preferences: TransportPreferences): { title: string; keys: Key[] } {
  if (preferences.tab === 'rail') {
    return {
      title: 'Ferrovias',
      keys: [
        { label: 'Ferrovia', color: COLORS.rail, kind: 'line' },
        { label: 'Metrô, VLT e bonde', color: COLORS.railUrban, kind: 'dash' },
        { label: 'Estação', color: COLORS.rail, kind: 'station' },
      ],
    };
  }
  if (preferences.tab === 'waterways') {
    return {
      title: 'Hidrovias',
      keys: [
        { label: 'Hidrovia', color: COLORS.water, kind: 'line' },
        { label: 'Balsa', color: COLORS.water, kind: 'dash' },
        { label: 'Porto', color: COLORS.water, kind: 'dot' },
      ],
    };
  }
  if (preferences.roads === 'federal') {
    return {
      title: 'Rodovias federais',
      keys: [{ label: 'Federal (BR)', color: COLORS.road, kind: 'line' }, CONTEXT],
    };
  }
  if (preferences.roads === 'state') {
    return {
      title: 'Rodovias estaduais',
      keys: [{ label: 'Estadual', color: COLORS.road, kind: 'line' }, CONTEXT],
    };
  }
  return {
    title: 'Malha viária',
    keys: [
      { label: 'Principal', color: COLORS.road, kind: 'line' },
      { label: 'Local e rua', color: COLORS.roadMinor, kind: 'thin' },
      { label: 'Ciclovia', color: COLORS.cycle, kind: 'line' },
      { label: 'Ciclofaixa', color: COLORS.cycle, kind: 'dash' },
    ],
  };
}

// Zoom a partir do qual o detalhe de cada aba aparece (mesmo `transport.yml`).
function hint(preferences: TransportPreferences, zoom: number): string | null {
  if (preferences.tab === 'roads' && preferences.roads === 'all' && zoom < 12)
    return 'Aproxime o mapa para ver ruas e ciclovias';
  if (preferences.tab === 'rail' && zoom < 9) return 'Aproxime o mapa para ver metrô e VLT';
  return null;
}

function Swatch({ item }: { item: Key }) {
  if (item.kind === 'dot' || item.kind === 'station') {
    return (
      <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
        <circle
          cx="9"
          cy="5"
          r="3.4"
          fill={item.kind === 'dot' ? item.color : '#ffffff'}
          stroke={item.kind === 'dot' ? '#ffffff' : item.color}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
      <line
        x1="1"
        y1="5"
        x2="17"
        y2="5"
        stroke={item.color}
        strokeWidth={item.kind === 'thin' ? 1.4 : 2.4}
        strokeDasharray={item.kind === 'dash' ? '3.5 2.5' : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TransportLegend({
  preferences,
  zoom,
  source,
}: {
  preferences: TransportPreferences;
  zoom: number;
  source: string;
}) {
  const { title, keys } = legendFor(preferences);
  const note = hint(preferences, zoom);
  return (
    <figure className="legend scale-legend transport-legend" aria-label={`Legenda de ${title}`}>
      <figcaption className="scale-legend-header">
        <span className="scale-legend-title">{title}</span>
        <span className="scale-legend-unit">{source}</span>
      </figcaption>
      <ul className="transport-legend-keys">
        {keys.map((item) => (
          <li key={item.label}>
            <Swatch item={item} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {note && <p className="scale-legend-notice">{note}</p>}
    </figure>
  );
}
