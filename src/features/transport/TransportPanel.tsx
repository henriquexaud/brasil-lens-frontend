import type { TransportLayer, TransportSummary } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { ErrorMessage } from '@/components/Feedback';
import { LAYER_LABEL, formatTotal, type TransportTab } from './layers';

const SIBLINGS: Record<TransportTab, TransportLayer[]> = {
  roads: ['road_federal', 'road_state', 'road_local'],
  rail: [],
  waterways: ['port'],
};

export function TransportPanel({
  layer,
  tab,
  summary,
  loading,
  error,
}: {
  layer: TransportLayer;
  tab: TransportTab;
  summary?: TransportSummary;
  loading: boolean;
  error: Error | null;
}) {
  const value = (key: TransportLayer) =>
    summary?.totals.find((item) => item.layer === key)?.value ?? null;
  const featured = value(layer);
  const others = SIBLINGS[tab].filter((key) => key !== layer);
  return (
    <section className="panel-section" aria-label="Extensão da malha">
      {error && !summary && <ErrorMessage error={error} />}
      <dl className="featured-indicator">
        <dt className="indicator-label">
          {LAYER_LABEL[layer]}
          <span className="indicator-year">extensão</span>
        </dt>
        <AnimatedText
          as="dd"
          mode="number"
          className={`featured-value${featured === null ? ' is-missing' : ''}`}
          text={loading && !summary ? 'Carregando…' : formatTotal(layer, featured)}
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
      <p className="source-note">Soma do traçado dentro do território.</p>
    </section>
  );
}
