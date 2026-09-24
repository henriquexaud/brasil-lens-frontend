/**
 * Menu do contexto socioeconômico com navegação em categorias segmentadas
 * (População, Economia, Trabalho & Renda, Território) e pílulas de análises específicas.
 */
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { Indicator, TerritoryLevel } from '@/api/types';
import { Select } from '@/components/Select';
import {
  formatIndicatorUnit,
  getCategoryForIndicatorKey,
  groupIndicatorsByCategory,
} from './indicatorCategories';

export const LATEST_YEAR = 'latest';

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
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  const prefetchIndicator = useCallback(
    (key: string) => {
      void queryClient.prefetchQuery({
        queryKey: ['map-values', level, parentCode, key, selectedYear],
        queryFn: ({ signal }) =>
          apiGet('/map/values', { level, parent: parentCode, indicator: key, year: selectedYear }, signal),
        staleTime: 30 * 60 * 1000,
      });
    },
    [queryClient, level, parentCode, selectedYear],
  );

  // Agrupa os indicadores recebidos da API nas categorias principais
  const categories = useMemo(
    () => groupIndicatorsByCategory(indicators),
    [indicators],
  );

  // Categoria ativa com base no indicador selecionado
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
  const label =
    selectedYear === LATEST_YEAR
      ? latest
        ? `${latest} · Último`
        : 'Último disponível'
      : selectedYear;

  return (
    <section
      className="panel-section indicator-controls"
      aria-label="Indicador do mapa"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) {
          event.stopPropagation();
          setExpanded(false);
          trigger.current?.focus();
        }
      }}
    >
      {/* 1. Barra de Categorias Segmentada */}
      {categories.length > 1 && (
        <div
          className="indicator-segmented-control"
          role="tablist"
          aria-label="Dimensões socioeconômicas"
        >
          {categories.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`indicator-segment-btn ${isActive ? 'is-active' : ''}`}
                onMouseEnter={() => prefetchIndicator(cat.defaultKey)}
                onFocus={() => prefetchIndicator(cat.defaultKey)}
                onClick={() => {
                  if (cat.id !== activeCategoryId) {
                    setExpanded(false);
                    onIndicatorChange(cat.defaultKey);
                  }
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Pílulas de Sub-indicadores da Categoria Ativa */}
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
                  setExpanded(false);
                  onIndicatorChange(indicator.key);
                }}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Linha de Metadados e Acionador de Ajustes de Ano */}
      <div className="indicator-meta-row">
        <div className="indicator-meta-left">
          <span className="indicator-source-tag">IBGE</span>
          {current?.unit && (
            <span className="indicator-unit-badge">
              {formatIndicatorUnit(current.unit)}
            </span>
          )}
        </div>
        <button
          ref={trigger}
          type="button"
          className="text-button indicator-adjust-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
          aria-label="Ajustar ano e ver informações do indicador"
        >
          <span className="indicator-year-label">{years.length ? label : 'Sem dados'}</span>
          <span className="indicator-adjust-cta">
            Ajustes <span className="disclosure-chevron" aria-hidden="true" />
          </span>
        </button>
      </div>

      {/* 4. Painel de Ajustes Expansível */}
      {expanded && (
        <div id={id} className="control-extra indicator-extra-panel">
          {years.length > 1 && (
            <Select
              id="year"
              label="Ano de referência"
              value={selectedYear}
              options={[
                { value: LATEST_YEAR, label: 'Último disponível' },
                ...[...years]
                  .sort((a, b) => b - a)
                  .map((year) => ({ value: String(year), label: String(year) })),
              ]}
              onChange={onYearChange}
            />
          )}
          {current?.description && (
            <p className="source-note">{current.description}</p>
          )}
        </div>
      )}
    </section>
  );
}
