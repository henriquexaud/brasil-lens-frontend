/**
 * Seção de filtros: indicador e ano.
 *
 * É uma *seção* do painel, não um painel próprio: controles e detalhe do
 * território dividem uma única superfície, separados por um fio, para que a
 * interface tenha um objeto flutuante em vez de dois competindo.
 *
 * O seletor de ano é populado por `availableYears`, que vem do catálogo da API.
 * Isso importa: a cobertura é irregular (a série de estimativas do IBGE não tem
 * 2007 nem 2023, e a área territorial só tem 2010 e 2022). Um seletor com
 * intervalo fixo ofereceria anos sem dado.
 *
 * O catálogo é pedido para o nível exibido, então um indicador pode chegar aqui
 * sem ano nenhum — a PNAD Contínua não desce a município. Nesse caso o seletor
 * de ano fica desabilitado e o painel diz por quê, em vez de deixar o mapa
 * inteiro cinza sem explicação.
 */
import { useId, useRef, useState } from 'react';

import type { Indicator } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { Select } from '@/components/Select';

export const LATEST_YEAR = 'latest';

interface Props {
  indicators: Indicator[];
  selectedIndicatorKey: string;
  onIndicatorChange: (key: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  scopeTitle: string;
  scopeSubtitle: string;
  resolvedYear: number | null;
  onResetScope?: () => void;
}

export function ControlPanel({
  indicators,
  selectedIndicatorKey,
  onIndicatorChange,
  selectedYear,
  onYearChange,
  scopeTitle,
  scopeSubtitle,
  resolvedYear,
  onResetScope,
}: Props) {
  const [expandedControl, setExpandedControl] = useState<'year' | 'about' | null>(null);
  const contentId = useId();
  const yearButton = useRef<HTMLButtonElement>(null);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const current = indicators.find((indicator) => indicator.key === selectedIndicatorKey);
  const years = current?.availableYears ?? [];
  const hasCoverage = years.length > 0;
  const latestYear = current?.latestYear ?? (selectedYear === LATEST_YEAR ? resolvedYear : null);
  const yearLabel =
    selectedYear === LATEST_YEAR
      ? latestYear !== null && latestYear !== undefined
        ? `${latestYear} · Último`
        : 'Último disponível'
      : selectedYear;

  function closeControl() {
    (expandedControl === 'year' ? yearButton : aboutButton).current?.focus();
    setExpandedControl(null);
  }

  const yearOptions = [
    {
      value: LATEST_YEAR,
      // "Último" não significa "ano atual": significa o último ano publicado
      // daquele indicador. Mostrar qual ano respondeu evita a ambiguidade.
      label: latestYear != null ? `Último · ${latestYear}` : 'Último disponível',
    },
    ...[...years]
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: String(year) })),
  ];

  return (
    <div
      className="panel-section"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expandedControl !== null) closeControl();
      }}
    >
      <header className="scope">
        <div className="scope-text">
          <p className="scope-kicker">{scopeSubtitle}</p>
          {onResetScope ? (
            <AnimatedText key={scopeTitle} as="h1" className="scope-title" text={scopeTitle} />
          ) : (
            <h1 className="scope-title">{scopeTitle}</h1>
          )}
        </div>
        {onResetScope && (
          <button
            type="button"
            className="ghost-button"
            onClick={onResetScope}
            title="Voltar para o mapa do Brasil"
            aria-label="Voltar para o mapa do Brasil"
          >
            <span aria-hidden="true">←</span> Brasil
          </button>
        )}
      </header>

      <Select
        id="indicator"
        label="Indicador"
        value={selectedIndicatorKey}
        options={indicators.map((indicator) => ({
          value: indicator.key,
          label: indicator.name,
        }))}
        onChange={(key) => {
          setExpandedControl(null);
          onIndicatorChange(key);
        }}
      />

      <p className="navigation-hint">
        {onResetScope
          ? 'Clique para ver dados. Duplo clique para aproximar.'
          : 'Clique para ver dados. Duplo clique para ver municípios.'}
      </p>

      <div className="control-actions">
        <button
          ref={yearButton}
          type="button"
          className="text-button year-toggle"
          aria-label={`Alterar ano: ${hasCoverage ? yearLabel : 'sem dados'}`}
          aria-expanded={expandedControl === 'year'}
          aria-controls={`${contentId}-year`}
          disabled={!hasCoverage}
          onClick={() => setExpandedControl(expandedControl === 'year' ? null : 'year')}
        >
          {hasCoverage ? `Ano: ${yearLabel}` : 'Sem dados'}
          <span className="disclosure-chevron" aria-hidden="true" />
        </button>
        {current?.description && (
          <button
            ref={aboutButton}
            type="button"
            className="text-button"
            aria-label="Sobre este indicador"
            aria-expanded={expandedControl === 'about'}
            aria-controls={`${contentId}-about`}
            onClick={() => setExpandedControl(expandedControl === 'about' ? null : 'about')}
          >
            Sobre o indicador
          </button>
        )}
      </div>

      <div id={`${contentId}-year`} hidden={expandedControl !== 'year'} className="control-extra">
        <Select
          id="year"
          label="Ano de referência"
          value={selectedYear}
          options={yearOptions}
          onChange={(value) => {
            onYearChange(value);
            closeControl();
          }}
          disabled={!hasCoverage}
        />
      </div>

      {!hasCoverage && (
        <p className="source-note">Sem dados deste indicador neste recorte territorial.</p>
      )}

      {current?.description && (
        <div
          id={`${contentId}-about`}
          hidden={expandedControl !== 'about'}
          className="control-extra"
        >
          <p className="source-note">
            {current.origin === 'derived' && <span className="derived-mark">calculado</span>}
            {current.description}
          </p>
        </div>
      )}
    </div>
  );
}
