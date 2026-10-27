import type { TransportLayer, TransportSummary } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { ErrorMessage } from '@/components/Feedback';
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
}: {
  preferences: TransportPreferences;
  summary?: TransportSummary;
  loading: boolean;
  error: Error | null;
}) {
  const value = (key: TransportLayer) =>
    summary?.totals.find((item) => item.layer === key)?.value ?? null;
  const layers = summaryLayers(preferences);
  const values = layers.map(value);
  const featured = values.some((item) => item === null)
    ? null
    : values.reduce<number>((total, item) => total + (item ?? 0), 0);
  const label = layers.length > 1 ? 'Rodovias' : LAYER_LABEL[layers[0]!];
  const others = SIBLINGS[preferences.tab].filter(
    (key) => layers.length > 1 || !layers.includes(key),
  );
  return (
    <section className="panel-section" aria-label="Extensão da malha">
      {error && !summary && <ErrorMessage error={error} />}
      <dl className="featured-indicator">
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
      {others.length > 0 && summary && (
        <dl className="indicator-list territory-details">
          {others.map((key) => (
            <div key={key} className="indicator-row">
              <dt className="indicator-label">{LAYER_LABEL[key]}</dt>
              <dd className={`indicator-value${value(key) === null ? ' is-missing' : ''}`}>
                {formatTotal(key, value(key))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="source-note">{NOTE[preferences.tab]}</p>
    </section>
  );
}
