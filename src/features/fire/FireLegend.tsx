import { ScaleLegend } from '@/components/ScaleLegend';
import { FIRE_DENSITY_SCALE } from './fireDensity';

const TICKS = [
  { label: '0', percent: 0 },
  { label: '5', percent: 30 },
  { label: '25', percent: 50 },
  { label: '75', percent: 70 },
  { label: '150+', percent: 100 },
];

export function FireLegend({
  loading,
  error,
  hours = 48,
}: {
  loading: boolean;
  error: boolean;
  hours?: number;
}) {
  return (
    <ScaleLegend
      title="Focos / 1.000 km²"
      unit={`${hours}h`}
      bands={FIRE_DENSITY_SCALE}
      ticks={TICKS}
      notice={
        error ? 'Resumo de focos indisponível' : loading ? 'Atualizando densidade…' : undefined
      }
    />
  );
}
