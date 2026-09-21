import { useMemo } from 'react';
import type { FireMunicipality, FireSummary } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { densityColor } from './fireDensity';

export function FireOverview({
  summary,
  onSelect,
  scopeName,
}: {
  summary: FireSummary;
  onSelect: (city: FireMunicipality) => void;
  scopeName?: string;
}) {
  const ranked = useMemo(
    () =>
      summary.rankedMunicipalities ??
      summary.municipalities
        .filter((city) => city.density != null && city.count > 0)
        .sort((a, b) => b.density! - a.density!)
        .slice(0, 5),
    [summary],
  );
  if (!ranked.length) return null;
  const title = scopeName ? `Maior densidade de focos · ${scopeName}` : 'Maior densidade de focos';
  return (
    <Disclosure title={title} className="fire-ranking">
      <ol>
        {ranked.map((city) => (
          <li key={city.ibgeCode}>
            <button className="fire-ranking-city" onClick={() => onSelect(city)}>
              <span
                className="fire-layer-dot"
                style={{ background: densityColor(city.density) }}
                aria-hidden="true"
              />
              <span>
                {city.name} <small>{city.state}</small>
              </span>
              <strong>{city.density!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</strong>
            </button>
          </li>
        ))}
      </ol>
      <p className="source-note">
        Detecções em {summary.hours}h por 1.000 km² · área calculada sobre a malha IBGE.
      </p>
    </Disclosure>
  );
}
