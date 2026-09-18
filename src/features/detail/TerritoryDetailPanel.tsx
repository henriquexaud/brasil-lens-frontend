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
      <div className="panel-section">
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
      <div className="panel-section" aria-busy="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    );
  }

  const canDrillDown =
    onDrillDown !== undefined && overview.level === 'state' && overview.childrenCount > 0;

  return (
    <div className="panel-section">
      <header className="detail-header">
        <div>
          <p className="detail-kicker">
            {levelLabel(overview.level)}
            {overview.parent && ` · ${overview.parent.name}`}
          </p>
          <h2 className="detail-title">{overview.name}</h2>
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

      <p className="detail-facts">
        {overview.capital && <span>Capital {overview.capital.name}</span>}
        {overview.childrenLevel && overview.childrenCount > 0 && (
          <span>
            {overview.childrenCount.toLocaleString('pt-BR')}{' '}
            {childrenLabel(overview.childrenLevel, overview.childrenCount)}
          </span>
        )}
        <span>IBGE {overview.ibgeCode}</span>
      </p>

      <dl className="indicator-list">
        {overview.indicators.map((indicator) => (
          <div
            key={indicator.key}
            className={
              indicator.key === mappedIndicatorKey ? 'indicator-row is-mapped' : 'indicator-row'
            }
          >
            <dt className="indicator-label">
              {indicator.name}
              {/* Cada indicador carrega o seu próprio ano: a API resolve
                  "último disponível" por indicador, não por tela. */}
              {indicator.year !== null && <span className="indicator-year">{indicator.year}</span>}
            </dt>
            <dd
              className={
                indicator.value === null ? 'indicator-value is-missing' : 'indicator-value'
              }
              title={indicator.source ?? undefined}
            >
              {formatValue(indicator.value, indicator.unit, indicator.decimalPlaces)}
            </dd>
          </div>
        ))}
      </dl>

      {canDrillDown && (
        <button
          type="button"
          className="drill-button"
          onClick={() => onDrillDown(overview.ibgeCode, overview.name)}
        >
          Ver {overview.childrenCount.toLocaleString('pt-BR')} municípios
        </button>
      )}
    </div>
  );
}
