import type { MapFeatureProperties, MapIndicatorMeta, MapValue } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { Disclosure } from '@/components/Disclosure';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import { useOverview } from './queries';
import { formatValue, levelLabel } from './format';
import { indicatorCategoryId } from './indicatorCategories';

function TerritoryExtra({
  code,
  year,
  mappedKey,
}: {
  code: string;
  year: string;
  mappedKey: string;
}) {
  const query = useOverview(code, year);
  if (query.error) return <ErrorMessage error={query.error} />;
  if (!query.data)
    return (
      <p className="source-note" role="status">
        Carregando detalhes…
      </p>
    );
  return (
    <>
      <dl className="indicator-list">
        {query.data.indicators
          .filter(
            (item) =>
              item.key !== mappedKey &&
              indicatorCategoryId(item.key) === indicatorCategoryId(mappedKey),
          )
          .map((item) => (
            <div key={item.key} className="indicator-row">
              <dt className="indicator-label">
                {item.name}
                <span className="indicator-year">{item.year}</span>
              </dt>
              <AnimatedText
                as="dd"
                mode="number"
                className={`indicator-value${item.value === null ? ' is-missing' : ''}`}
                title={item.source ?? undefined}
                text={formatValue(item.value, item.unit, item.decimalPlaces)}
              />
            </div>
          ))}
      </dl>
      <p className="source-note">
        {query.data.indicators.find((item) => item.key === mappedKey)?.source}
      </p>
    </>
  );
}

export function TerritoryPanel({
  code,
  territory,
  indicator,
  value,
  year,
  loading,
  onClose,
  onDrillDown,
}: {
  code: string;
  territory?: MapFeatureProperties;
  indicator: MapIndicatorMeta | null;
  value?: MapValue;
  year: string;
  loading: boolean;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const needsOverview = !territory || (!loading && value === undefined);
  const overview = useOverview(
    code,
    indicator?.year === null || indicator?.year === undefined ? year : String(indicator.year),
    Boolean(indicator) && needsOverview,
  );
  const name = territory?.name ?? overview.data?.name;
  const level = territory?.level ?? overview.data?.level;
  const parentName = territory?.parentName ?? overview.data?.parent?.name;
  const selectedValue =
    value === undefined
      ? (overview.data?.indicators.find((item) => item.key === indicator?.key)?.value ?? null)
      : value.value;
  const referenceYear =
    indicator?.year ?? overview.data?.indicators.find((item) => item.key === indicator?.key)?.year;
  return (
    <section
      className="panel-section territory-detail"
      aria-label={onClose ? 'Local selecionado' : 'Resumo do território'}
    >
      <header className="detail-header">
        <div>
          {name && level ? (
            <>
              <p className="detail-kicker">
                {levelLabel(level)}
                {parentName && ` · ${parentName}`}
              </p>
              <AnimatedText as="h2" className="detail-title" text={name} />
            </>
          ) : (
            <span role="status">Carregando local…</span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar detalhe"
          >
            ×
          </button>
        )}
      </header>
      {overview.error && !territory && <ErrorMessage error={overview.error} />}
      {indicator && (
        <dl className="featured-indicator">
          <dt className="indicator-label">
            {indicator.name}
            <span className="indicator-year">{referenceYear}</span>
          </dt>
          <AnimatedText
            as="dd"
            mode="number"
            className={`featured-value${selectedValue === null ? ' is-missing' : ''}`}
            text={
              (loading || (needsOverview && overview.isPending)) && selectedValue === null
                ? 'Carregando…'
                : formatValue(selectedValue, indicator.unit, indicator.decimalPlaces)
            }
          />
        </dl>
      )}
      {level === 'state' && name && onClose && (
        <DrillDownButton onClick={() => onDrillDown(code, name)} />
      )}
      {name && indicator && indicatorCategoryId(indicator.key) !== 'other' && (
        <Disclosure
          key={`${code}:${year}:${indicatorCategoryId(indicator.key)}`}
          title="Mais detalhes"
          className="territory-details"
        >
          <TerritoryExtra code={code} year={year} mappedKey={indicator.key} />
        </Disclosure>
      )}
    </section>
  );
}
