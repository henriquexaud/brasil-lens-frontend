import { ScaleLegend } from '@/components/ScaleLegend';
import { HUMIDITY_SCALE_STOPS } from './humidityScale';

const BANDS = HUMIDITY_SCALE_STOPS.map((stop) => ({ ...stop, name: stop.label }));
const TICKS = [
  { label: '0', percent: 0 },
  { label: '12', percent: 10 },
  { label: '30', percent: 30 },
  { label: '50', percent: 50 },
  { label: '100', percent: 100 },
];

export function HumidityLegend({
  loading = false,
  error = false,
  notice,
}: {
  loading?: boolean;
  error?: boolean;
  notice?: string;
}) {
  return (
    <ScaleLegend
      title="Umidade relativa"
      unit="%"
      bands={BANDS}
      ticks={TICKS}
      notice={error ? 'Dados de umidade indisponíveis' : loading ? 'Atualizando umidade…' : notice}
    />
  );
}
