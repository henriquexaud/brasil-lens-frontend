/** Informações gerais e consolidadas do Brasil na visão nacional. */
import type { MapIndicatorMeta } from '@/api/types';
import { useTerritoryOverview } from '@/api/queries';
import { AnimatedText } from '@/components/AnimatedText';
import { Disclosure } from '@/components/Disclosure';
import { ErrorMessage } from '@/components/Feedback';
import { formatValue } from '@/lib/format';

interface Props {
  indicator: MapIndicatorMeta | null;
  selectedYear?: string;
}

export function BrazilOverviewPanel({ indicator, selectedYear }: Props) {
  const query = useTerritoryOverview('BR', selectedYear);
  const overview = query.data;

  const currentIndicatorValue = overview?.indicators.find((item) => item.key === indicator?.key);

  return (
    <section
      className="panel-section territory-detail brazil-detail"
      aria-label="Visão geral do Brasil"
    >
      <header className="detail-header">
        <div>
          <p className="detail-kicker">País</p>
          <AnimatedText as="h2" className="detail-title" text="Brasil" />
          <p className="detail-capital">Brasília · capital federal · 27 UFs</p>
        </div>
      </header>

      {query.isPending && !overview && (
        <div className="weather-skeleton" role="status" aria-label="Carregando dados do Brasil">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-row" />
        </div>
      )}

      {query.error && !overview && <ErrorMessage error={query.error} />}

      {overview && (
        <>
          {indicator && currentIndicatorValue && (
            <dl className="featured-indicator">
              <dt className="indicator-label">
                {indicator.name}
                <span className="indicator-year">
                  {currentIndicatorValue.year ?? indicator.year}
                </span>
              </dt>
              <AnimatedText
                as="dd"
                className={
                  currentIndicatorValue.value === null
                    ? 'featured-value is-missing'
                    : 'featured-value'
                }
                mode="number"
                text={formatValue(
                  currentIndicatorValue.value,
                  indicator.unit,
                  indicator.decimalPlaces,
                )}
              />
            </dl>
          )}

          <Disclosure title="Mais detalhes" className="territory-details">
            <dl className="indicator-list">
              {overview.indicators
                .filter((item) => item.key !== indicator?.key && item.value !== null)
                .map((item) => (
                  <div key={item.key} className="indicator-row">
                    <dt className="indicator-label">
                      {item.name}
                      {item.year && <span className="indicator-year">{item.year}</span>}
                    </dt>
                    <AnimatedText
                      as="dd"
                      mode="number"
                      className="indicator-value"
                      title={item.source ?? undefined}
                      text={formatValue(item.value, item.unit, item.decimalPlaces)}
                    />
                  </div>
                ))}
            </dl>
            {currentIndicatorValue?.source && (
              <p className="source-note">{currentIndicatorValue.source}</p>
            )}
          </Disclosure>
        </>
      )}
    </section>
  );
}
