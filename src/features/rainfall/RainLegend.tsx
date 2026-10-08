import { ScaleLegend } from '@/components/ScaleLegend';
import { RAIN_SCALE_STOPS } from './rainScale';

const BANDS = RAIN_SCALE_STOPS.map((stop) => ({ ...stop, name: stop.label }));
const TICKS = [
  { label: '0', percent: 0 },
  { label: '5', percent: 30 },
  { label: '30', percent: 50 },
  { label: '75', percent: 70 },
  { label: '150+', percent: 100 },
];

export function RainLegend({
  loading = false,
  error = false,
}: {
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <ScaleLegend
      title="Chuva acumulada"
      unit="mm / 48h"
      bands={BANDS}
      ticks={TICKS}
      notice={
        error ? 'Dados de chuva indisponíveis' : loading ? 'Atualizando precipitação…' : undefined
      }
    />
  );
}
