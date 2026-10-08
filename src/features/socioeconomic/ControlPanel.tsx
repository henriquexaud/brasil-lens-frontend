import { useCallback, useMemo, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { valuesOptions } from './queries';
import type { Indicator, TerritoryLevel } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  formatIndicatorUnit,
  getCategoryForIndicatorKey,
  groupIndicatorsByCategory,
  yearForIndicator,
} from './indicatorCategories';
import { paletteForIndicator } from './colors';

export const LATEST_YEAR = 'latest';

function categoryStyle(key: string): CSSProperties {
  const palette = paletteForIndicator(key);
  return {
    '--indicator-accent': palette[palette.length - 1],
    '--indicator-tone': palette[7],
  } as CSSProperties;
}

interface Props {
  indicators: Indicator[];
  selectedIndicatorKey: string;
  onIndicatorChange: (key: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  resolvedYear: number | null;
  level?: TerritoryLevel;
  parentCode?: string | null;
}

export function ControlPanel({
  indicators,
  selectedIndicatorKey,
  onIndicatorChange,
  selectedYear,
  onYearChange,
  resolvedYear,
  level = 'state',
  parentCode = null,
}: Props) {
  const queryClient = useQueryClient();

  const prefetchIndicator = useCallback(
    (key: string) => {
      const indicator = indicators.find((item) => item.key === key);
      if (!indicator?.supportedLevels.includes(level)) return;
      void queryClient.prefetchQuery(
        valuesOptions(level, parentCode, key, yearForIndicator(indicator, selectedYear)),
      );
    },
    [queryClient, indicators, level, parentCode, selectedYear],
  );

  const categories = useMemo(() => groupIndicatorsByCategory(indicators), [indicators]);
  const activeCategoryId = useMemo(
    () => getCategoryForIndicatorKey(selectedIndicatorKey, categories),
    [selectedIndicatorKey, categories],
  );
  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) ?? categories[0],
    [categories, activeCategoryId],
  );

  const current = useMemo(
    () => indicators.find((item) => item.key === selectedIndicatorKey),
    [indicators, selectedIndicatorKey],
  );

  const years = current?.availableYears ?? [];
  const latest = current?.latestYear ?? resolvedYear;
  const latestLabel = latest ? `${latest} · Último` : 'Último disponível';

  return (
    <section
      className="panel-section indicator-controls"
      style={categoryStyle(selectedIndicatorKey)}
      aria-label="Indicador do mapa"
    >
      {categories.length > 1 && (
        <SegmentedControl
          className="indicator-segmented-control"
          label="Dimensões socioeconômicas"
          value={activeCategoryId}
          options={categories.map((category) => ({
            value: category.id,
            label: category.label,
            onIntent: () => prefetchIndicator(category.defaultKey),
          }))}
          onChange={(value) => {
            const category = categories.find((item) => item.id === value);
            if (category) onIndicatorChange(category.defaultKey);
          }}
        />
      )}

      {activeCategory && activeCategory.indicators.length > 0 && (
        <div
          className="indicator-pills-row"
          role="group"
          aria-label={`Análises de ${activeCategory.label}`}
        >
          {activeCategory.indicators.map(({ indicator, shortLabel }) => {
            const isActive = indicator.key === selectedIndicatorKey;
            return (
              <button
                key={indicator.key}
                type="button"
                className={`indicator-pill-btn ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                title={indicator.name}
                onMouseEnter={() => prefetchIndicator(indicator.key)}
                onFocus={() => prefetchIndicator(indicator.key)}
                onClick={() => {
                  onIndicatorChange(indicator.key);
                }}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      )}

      <LayerMetadata
        sources={[{ label: 'IBGE', description: current?.description ?? undefined }]}
        unit={
          current?.unit
            ? current.key === 'household_income_per_capita'
              ? 'R$ constantes'
              : formatIndicatorUnit(current.unit)
            : undefined
        }
      >
        {years.length > 1 ? (
          <select
            id="year"
            className="indicator-year-select"
            aria-label="Ano de referência"
            value={selectedYear}
            onChange={(event) => onYearChange(event.target.value)}
          >
            <option value={LATEST_YEAR}>{latestLabel}</option>
            {[...years]
              .sort((a, b) => b - a)
              .map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
          </select>
        ) : (
          <span className="indicator-year-label">
            {years.length
              ? selectedYear === LATEST_YEAR
                ? latestLabel
                : selectedYear
              : 'Sem dados'}
          </span>
        )}
      </LayerMetadata>
    </section>
  );
}
