/**
 * Seção de detalhe do território.
 *
 * Alimentada por `/territories/{code}/overview`, que já chega pronta para
 * exibição: hierarquia, capital, contagem de filhos e todos os indicadores com
 * seus respectivos anos e fontes. O componente não faz nenhuma junção nem
 * cálculo — só formata.
 *
 * Aparece como continuação do painel de controles, separada por um fio, em vez
 * de como um segundo cartão flutuante.
 */
import type { TerritoryOverview } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';
import { ScrambleText } from '@/components/ScrambleText';
import { childrenLabel, formatValue, levelLabel } from '@/lib/format';

interface Props {
  overview: TerritoryOverview | undefined;
  isLoading: boolean;
  error: unknown;
  /** Indicador desenhado no mapa — a linha correspondente é destacada. */
  mappedIndicatorKey?: string;
  onClose: () => void;
  onDrillDown?: (ibgeCode: string, name: string) => void;
}

export function TerritoryDetailPanel({
  overview,
  isLoading,
  error,
  mappedIndicatorKey,
  onClose,
  onDrillDown,
}: Props) {
  if (error) {
    return (
      <div className="panel-section territory-detail">
        <div className="detail-header">
          <ErrorMessage error={error} />
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar detalhe"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    );
  }

  // Enquanto carrega, o esqueleto mantém a altura do painel estável em vez de
  // fazer a superfície saltar quando os dados chegam.
  if (isLoading || !overview) {
    return (
      <div className="panel-section territory-detail" aria-busy="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    );
  }

  const canDrillDown =
    onDrillDown !== undefined && overview.level === 'state' && overview.childrenCount > 0;
  const featuredIndicator = overview.indicators.find(
    (indicator) => indicator.key === mappedIndicatorKey,
  );
  const otherIndicators = overview.indicators.filter(
    (indicator) => indicator !== featuredIndicator,
  );

  return (
    <div className="panel-section territory-detail">
      {/* `header` e `details` têm prefixos distintos de propósito: com a mesma
          key literal (`overview.ibgeCode`) nos dois, a troca de território faz
          o React colidir as duas entradas ao montar o mapa de reconciliação —
          uma sobrescreve a outra, e a mais antiga fica órfã no DOM em vez de
          ser removida. É a causa de estados "acumulando" no painel ao clicar
          em vários seguidos. */}
      <header key={`header:${overview.ibgeCode}`} className="detail-header">
        <div>
          <p className="detail-kicker">
            {levelLabel(overview.level)}
            {overview.parent && ` · ${overview.parent.name}`}
          </p>
          <ScrambleText as="h2" className="detail-title" text={overview.name} />
          {/* Só estados (e o país) têm capital — municípios e regiões não. */}
          {overview.capital && <p className="detail-capital">Capital: {overview.capital.name}</p>}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar detalhe">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </header>

      {featuredIndicator && (
        <dl
          key={`${overview.ibgeCode}:${featuredIndicator.key}:${featuredIndicator.year}`}
          className="featured-indicator"
        >
          <dt className="indicator-label">
            <ScrambleText text={featuredIndicator.name} />
            {featuredIndicator.year !== null && (
              <span className="indicator-year">{featuredIndicator.year}</span>
            )}
          </dt>
          <ScrambleText
            as="dd"
            className={
              featuredIndicator.value === null ? 'featured-value is-missing' : 'featured-value'
            }
            text={formatValue(
              featuredIndicator.value,
              featuredIndicator.unit,
              featuredIndicator.decimalPlaces,
            )}
          />
        </dl>
      )}

      {canDrillDown && (
        <button
          type="button"
          className="drill-button"
          onClick={() => onDrillDown(overview.ibgeCode, overview.name)}
        >
          Ver {overview.childrenCount.toLocaleString('pt-BR')} municípios
          <span aria-hidden="true"> →</span>
        </button>
      )}

      <details key={`details:${overview.ibgeCode}`} className="disclosure territory-details">
        <summary className="disclosure-trigger">
          <span className="disclosure-closed-label">Mais detalhes</span>
          <span className="disclosure-open-label">Menos detalhes</span>
          <span className="disclosure-chevron" aria-hidden="true" />
        </summary>
        <div className="disclosure-content">
          <p className="detail-facts">
            {overview.childrenLevel && overview.childrenCount > 0 && (
              <span>
                {overview.childrenCount.toLocaleString('pt-BR')}{' '}
                {childrenLabel(overview.childrenLevel, overview.childrenCount)}
              </span>
            )}
            <span>IBGE {overview.ibgeCode}</span>
          </p>

          {featuredIndicator?.source && (
            <p className="source-note detail-source">
              Fonte de {featuredIndicator.name}: {featuredIndicator.source}
            </p>
          )}

          <dl className="indicator-list">
            {otherIndicators.map((indicator) => (
              <div key={indicator.key} className="indicator-row">
                <dt className="indicator-label">
                  <ScrambleText text={indicator.name} />
                  {/* Cada indicador carrega o seu próprio ano: a API resolve
                  "último disponível" por indicador, não por tela. */}
                  {indicator.year !== null && (
                    <span className="indicator-year">{indicator.year}</span>
                  )}
                </dt>
                <ScrambleText
                  as="dd"
                  className={
                    indicator.value === null ? 'indicator-value is-missing' : 'indicator-value'
                  }
                  title={indicator.source ?? undefined}
                  text={formatValue(indicator.value, indicator.unit, indicator.decimalPlaces)}
                />
              </div>
            ))}
          </dl>
        </div>
      </details>
    </div>
  );
}
