/** O indicador fica à vista; ano e explicação aparecem sob demanda. */
import { useId, useRef, useState } from 'react';
import type { Indicator } from '@/api/types';
import { Select } from '@/components/Select';

export const LATEST_YEAR = 'latest';
interface Props {
  indicators: Indicator[];
  selectedIndicatorKey: string;
  onIndicatorChange: (key: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  resolvedYear: number | null;
}

export function ControlPanel({
  indicators,
  selectedIndicatorKey,
  onIndicatorChange,
  selectedYear,
  onYearChange,
  resolvedYear,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = indicators.find((item) => item.key === selectedIndicatorKey);
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
      <Select
        id="indicator"
        label="Indicador"
        hideLabel
        value={selectedIndicatorKey}
        options={indicators.map((item) => ({ value: item.key, label: item.name }))}
        onChange={(value) => {
          setExpanded(false);
          onIndicatorChange(value);
        }}
      />
      <button
        ref={trigger}
        className="text-button control-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        aria-label="Ajustar ano e ver informações do indicador"
      >
        <span>{years.length ? label : 'Sem dados neste recorte'}</span>
        <span>
          Ajustes <span className="disclosure-chevron" aria-hidden="true" />
        </span>
      </button>
      {expanded && (
        <div id={id} className="control-extra">
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
          {current?.description && <p className="source-note">{current.description}</p>}
        </div>
      )}
    </section>
  );
}
