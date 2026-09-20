/** O valor selecionado já vem do mapa; demais indicadores só são buscados ao abrir. */
import type { MapFeature, MapIndicatorMeta } from '@/api/types';
import { useTerritoryOverview } from '@/api/queries';
import { AnimatedText } from '@/components/AnimatedText';
import { Disclosure } from '@/components/Disclosure';
import { ErrorMessage } from '@/components/Feedback';
import { formatValue, levelLabel } from '@/lib/format';

function TerritoryExtra({ code, mappedKey }: { code: string; mappedKey?: string }) {
  const query = useTerritoryOverview(code);
  if (query.error) return <ErrorMessage error={query.error} />;
  if (!query.data)
    return (
      <p className="source-note" role="status">
        Carregando detalhes…
      </p>
    );
  const overview = query.data;
  return (
    <>
      <p className="detail-facts">
        {overview.capital && <span>Capital: {overview.capital.name}</span>}
        <span>IBGE {overview.ibgeCode}</span>
      </p>
      <dl className="indicator-list">
        {overview.indicators
          .filter((indicator) => indicator.key !== mappedKey)
          .map((indicator) => (
            <div key={indicator.key} className="indicator-row">
              <dt className="indicator-label">
                {indicator.name}
                <span className="indicator-year">{indicator.year}</span>
              </dt>
              <AnimatedText
                as="dd"
                mode="number"
                className={
                  indicator.value === null ? 'indicator-value is-missing' : 'indicator-value'
                }
                title={indicator.source ?? undefined}
                text={formatValue(indicator.value, indicator.unit, indicator.decimalPlaces)}
              />
            </div>
          ))}
      </dl>
      <p className="source-note">
        {overview.indicators.find((item) => item.key === mappedKey)?.source}
      </p>
    </>
  );
}

export function TerritoryDetailPanel({
  feature,
  indicator,
  onClose,
  onDrillDown,
}: {
  feature: MapFeature | undefined;
  indicator: MapIndicatorMeta | null;
  onClose: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const territory = feature?.properties;
  return (
    <section className="panel-section territory-detail" aria-label="Local selecionado">
      <header className="detail-header">
        <div>
          {territory ? (
            <>
              <p className="detail-kicker">
                {levelLabel(territory.level)}
                {territory.parentName && ` · ${territory.parentName}`}
              </p>
              <AnimatedText as="h2" className="detail-title" text={territory.name} />
            </>
          ) : (
            <span role="status">Carregando local…</span>
          )}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar detalhe">
          ×
        </button>
      </header>
      {territory && (
        <>
          {indicator && (
            <dl className="featured-indicator">
              <dt className="indicator-label">
                {indicator.name}
                <span className="indicator-year">{indicator.year}</span>
              </dt>
              <AnimatedText
                as="dd"
                className={
                  territory.value === null ? 'featured-value is-missing' : 'featured-value'
                }
                mode="number"
                text={formatValue(territory.value, indicator.unit, indicator.decimalPlaces)}
              />
            </dl>
          )}
          {territory.level === 'state' && (
            <button
              className="drill-button"
              onClick={() => onDrillDown(territory.ibgeCode, territory.name)}
            >
              Ver municípios <span aria-hidden="true">→</span>
            </button>
          )}
          <Disclosure key={territory.ibgeCode} title="Mais detalhes" className="territory-details">
            <TerritoryExtra code={territory.ibgeCode} mappedKey={indicator?.key} />
          </Disclosure>
        </>
      )}
    </section>
  );
}
