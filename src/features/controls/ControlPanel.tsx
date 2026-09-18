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
import type { Indicator } from '@/api/types';
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
  const current = indicators.find((indicator) => indicator.key === selectedIndicatorKey);
  const years = current?.availableYears ?? [];
  const hasCoverage = years.length > 0;

  const yearOptions = [
    {
      value: LATEST_YEAR,
      // "Último" não significa "ano atual": significa o último ano publicado
      // daquele indicador. Mostrar qual ano respondeu evita a ambiguidade.
      label: resolvedYear !== null ? `Último · ${resolvedYear}` : 'Último disponível',
    },
    ...[...years].reverse().map((year) => ({ value: String(year), label: String(year) })),
  ];

  return (
    <div className="panel-section">
      <header className="scope">
        <div className="scope-text">
          <p className="scope-kicker">{scopeSubtitle}</p>
          <h1 className="scope-title">{scopeTitle}</h1>
        </div>
        {onResetScope && (
          <button
            type="button"
            className="ghost-button"
            onClick={onResetScope}
            title="Voltar para o mapa do Brasil"
          >
            Brasil
          </button>
        )}
      </header>

      <div className="fields">
        <Select
          id="indicator"
          label="Indicador"
          value={selectedIndicatorKey}
          options={indicators.map((indicator) => ({
            value: indicator.key,
            label: indicator.name,
          }))}
          onChange={onIndicatorChange}
        />
        <Select
          id="year"
          label="Ano"
          value={selectedYear}
          options={yearOptions}
          onChange={onYearChange}
          disabled={!hasCoverage}
        />
      </div>

      {!hasCoverage && (
        <p className="source-note">Sem dados deste indicador neste recorte territorial.</p>
      )}

      {current?.description && (
        // Fica em duas linhas e o texto completo vai para o `title`: a
        // procedência do dado é informação de confiança, mas não precisa
        // ocupar o painel inteiro o tempo todo.
        <p className="source-note" title={current.description}>
          {current.origin === 'derived' && <span className="derived-mark">calculado</span>}
          {current.description}
        </p>
      )}
    </div>
  );
}
