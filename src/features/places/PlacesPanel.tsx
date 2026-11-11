import type { ReactNode } from 'react';
import type { MapFeatureProperties, PlaceItem, PlaceSummary } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import { QuantityList } from '@/components/QuantityList';
import { ScrollList } from '@/components/ScrollList';
import { DetailHeader } from '@/features/education/EducationPanel';
import { categoryIcon } from './categoryIcons';
import { formatCount, type PlaceTab } from './places';

// Categorias no resumo do painel; o resto fica no filtro.
const TOP_CATEGORIES = 6;

function share(value: number): string {
  return value >= 0.995 ? '100%' : `${Math.max(1, Math.round(value * 100))}%`;
}

export function PlacesPanel({
  tab,
  summary,
  loading,
  error,
  category,
  areas,
  territory,
  onClose,
  onDrillDown,
  onSelect,
  onCategory,
  children,
}: {
  tab: PlaceTab;
  summary?: PlaceSummary;
  loading: boolean;
  error: Error | null;
  category: string | null;
  /** Camada de áreas, e não de pontos. */
  areas: boolean;
  territory?: MapFeatureProperties;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
  onSelect: (item: PlaceItem) => void;
  onCategory: (category: string | null) => void;
  /** Espécies do território, no lugar da lista de lugares. */
  children?: ReactNode;
}) {
  const current = summary?.layer === tab.layer ? summary : undefined;
  const chosen = current?.categories.find((item) => item.key === category);
  const breakdown =
    !tab.species && !category && current && current.categories.length > 1
      ? current.categories.slice(0, TOP_CATEGORIES)
      : [];
  const total = current?.total;
  // Uma amostra de milhares de pontos não informa nada: a lista entra quando é
  // de áreas (as maiores primeiro), de um município ou cabe inteira.
  const listed =
    areas || current?.code.length === 7 || (total != null && total <= (current?.items.length ?? 0));
  const items = listed ? (current?.items ?? []) : [];
  return (
    <section
      className="panel-section territory-detail"
      aria-label={onClose ? 'Local selecionado' : tab.title}
    >
      {onClose && <DetailHeader territory={territory} fallback={summary?.name} onClose={onClose} />}
      {error && !summary && <ErrorMessage error={error} />}
      {current && current.biomes.length > 0 && (
        <p className="places-biomes" title="Parte do território em cada bioma (IBGE)">
          {current.biomes.map((item) => (
            <span key={item.key}>
              {item.label} <small>{share(item.share)}</small>
            </span>
          ))}
        </p>
      )}
      {!tab.species && (
        <dl className="featured-indicator" title={tab.note}>
          <dt className="indicator-label">
            {tab.title}
            {chosen && <span className="indicator-year">{chosen.label}</span>}
          </dt>
          <AnimatedText
            as="dd"
            mode="number"
            className={`featured-value${total == null ? ' is-missing' : ''}`}
            text={
              loading && !current ? 'Carregando…' : total == null ? 'Sem dados' : formatCount(total)
            }
          />
        </dl>
      )}
      {territory?.level === 'state' && onClose && (
        <DrillDownButton onClick={() => onDrillDown(territory.ibgeCode, territory.name)} />
      )}
      {children}
      <QuantityList
        label={`${tab.title} por tipo`}
        rows={breakdown.map((item) => ({
          key: item.key,
          label: item.label,
          icon: categoryIcon(tab.layer, item.key, 14),
          value: formatCount(item.count),
          amount: item.count,
          onSelect: () => onCategory(item.key),
        }))}
      />
      {!tab.species && items.length > 0 && (
        <div className="education-institutions places-items">
          <ScrollList
            items={items}
            label={tab.title}
            render={(item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="education-institution"
                  onClick={() => onSelect(item)}
                >
                  {categoryIcon(tab.layer, item.category)}
                  <span className="education-institution-name">
                    {item.name ?? item.categoryLabel ?? tab.one}
                    {item.summary && <small>{item.summary}</small>}
                  </span>
                </button>
              </li>
            )}
          />
          {total != null && total > items.length && (
            <p className="source-note">
              {formatCount(items.length)} de {formatCount(total)}; aproxime o mapa para ver os
              demais.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
