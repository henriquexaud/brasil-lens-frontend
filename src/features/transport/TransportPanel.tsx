import type { MapFeatureProperties, TransportLayer, TransportSummary } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import { QuantityList } from '@/components/QuantityList';
import { DetailHeader } from '@/features/education/EducationPanel';
import { LAYER_LABEL, formatTotal, summaryLayers, type TransportPreferences } from './layers';

const NOTE: Record<TransportPreferences['tab'], string> = {
  roads: 'Extensão oficial dentro do território: federais do DNIT; as demais, do IBGE.',
  rail: 'Extensão oficial dentro do território, do IBGE (BC250).',
  waterways: 'Extensão oficial dentro do território e portos, do IBGE (BC250).',
};

const SIBLINGS: Record<TransportPreferences['tab'], TransportLayer[]> = {
  roads: ['road_federal', 'road_state', 'road_local'],
  rail: [],
  waterways: ['port'],
};

export function TransportPanel({
  preferences,
  summary,
  loading,
  error,
  territory,
  onClose,
  onDrillDown,
}: {
  preferences: TransportPreferences;
  summary?: TransportSummary;
  loading: boolean;
  error: Error | null;
  territory?: MapFeatureProperties;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const value = (key: TransportLayer) =>
    summary?.totals.find((item) => item.layer === key)?.value ?? null;
  const layers = summaryLayers(preferences);
  const values = layers.map(value);
  const featured = values.some((item) => item === null)
    ? null
    : values.reduce<number>((total, item) => total + (item ?? 0), 0);
  const label = layers.length > 1 ? 'Rodovias' : LAYER_LABEL[layers[0]!];
  // Zero não informa nada no painel (ex.: UF sem porto); some a linha.
  const others = SIBLINGS[preferences.tab]
    .filter((key) => (layers.length > 1 || !layers.includes(key)) && value(key) !== 0)
    // A maior extensão primeiro.
    .sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1));
  return (
    <section
      className={`panel-section${onClose ? ' territory-detail' : ''}`}
      aria-label={onClose ? 'Local selecionado' : 'Extensão da malha'}
    >
      {onClose && <DetailHeader territory={territory} fallback={summary?.name} onClose={onClose} />}
      {error && !summary && <ErrorMessage error={error} />}
      <dl className="featured-indicator" title={NOTE[preferences.tab]}>
        <dt className="indicator-label">
          {label}
          <span className="indicator-year">extensão</span>
        </dt>
        <AnimatedText
          as="dd"
          mode="number"
          className={`featured-value${featured === null ? ' is-missing' : ''}`}
          text={loading && !summary ? 'Carregando…' : formatTotal(layers[0]!, featured)}
        />
      </dl>
      {territory?.level === 'state' && onClose && (
        <DrillDownButton onClick={() => onDrillDown(territory.ibgeCode, territory.name)} />
      )}
      {summary && (
        <QuantityList
          label="Extensão por tipo"
          rows={others.map((key) => ({
            key,
            label: LAYER_LABEL[key],
            value: formatTotal(key, value(key)),
            amount: value(key),
          }))}
        />
      )}
    </section>
  );
}
