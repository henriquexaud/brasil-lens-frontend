import { useMemo } from 'react';
import type { MapFeatureCollection } from '@/api/types';
import { territoryExtremes } from '@/lib/territoryExtremes';
import { Disclosure } from './Disclosure';

export function TerritoryRanking({
  title,
  values,
  collection,
  formatValue,
  note,
  onSelect,
}: {
  title: string;
  values: { ibgeCode: string; value: number | null }[];
  collection: MapFeatureCollection;
  formatValue: (value: number) => string;
  note: string;
  onSelect: (code: string) => void;
}) {
  const extremes = useMemo(() => territoryExtremes(values, collection), [values, collection]);
  if (!extremes) return null;
  const level = collection.scope.level === 'state' ? 'estados' : 'municípios';
  return (
    <Disclosure title={title} className="territory-ranking">
      <div className="climate-ranking-groups">
        {[
          { label: 'Maiores', items: extremes.highest },
          { label: 'Menores', items: extremes.lowest },
        ].map(({ label, items }) => (
          <div className="climate-ranking-group" key={label}>
            <div className="climate-ranking-header">{label}</div>
            <ol aria-label={label}>
              {items.map((item) => (
                <li key={item.ibgeCode}>
                  <button
                    type="button"
                    className="territory-ranking-item"
                    onClick={() => onSelect(item.ibgeCode)}
                  >
                    <span>{item.name}</span>
                    <strong>{formatValue(item.value)}</strong>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="source-note">
        {extremes.count.toLocaleString('pt-BR')} {level} com dados · {note}
      </p>
    </Disclosure>
  );
}
