import { ScaleLegend } from '@/components/ScaleLegend';
import { TEMPERATURE_SCALE } from '@/features/map/colors';

const TEMPERATURE_TICKS = [0, 10, 20, 30, 40].map((temperature, index) => ({
  label: `${temperature}°`,
  percent: (index * 2 + 1) * 10,
}));

export function WeatherLegend({ notice }: { municipal?: boolean; notice?: string }) {
  return (
    <ScaleLegend
      title="Temperatura"
      unit="°C"
      bands={TEMPERATURE_SCALE}
      ticks={TEMPERATURE_TICKS}
      notice={notice}
    />
  );
}
