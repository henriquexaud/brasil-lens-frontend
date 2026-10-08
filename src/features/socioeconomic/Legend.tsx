import type { MapClassification, MapIndicatorMeta, MapStatistics } from '@/api/types';
import { ScaleLegend } from '@/components/ScaleLegend';
import { formatCompact, unitLabel } from './format';
import { classColors, paletteForIndicator } from './colors';

interface Props {
  indicator: MapIndicatorMeta | null;
  classification: MapClassification | null;
  statistics: MapStatistics | null;
  loading?: boolean;
}

export function Legend({ indicator, classification, statistics, loading = false }: Props) {
  if (!indicator) return null;
  const palette = paletteForIndicator(indicator.key);
  const available = classification !== null && statistics !== null;
  const colors = available ? classColors(classification.classes, palette) : palette;
  const bands = colors.map((color, index) => {
    const lower = index === 0 ? classification?.min : classification?.breaks[index - 1];
    const upper = classification?.breaks[index];
    const label =
      lower == null || upper == null
        ? 'Sem dado'
        : lower === upper
          ? formatCompact(upper)
          : `${formatCompact(lower)} a ${formatCompact(upper)}`;
    const empty = available && index > 0 && upper === classification.breaks[index - 1];
    const name = empty
      ? `Sem valores distintos nesta faixa (limite ${label} ${unitLabel(indicator.unit)})`
      : `${label} ${unitLabel(indicator.unit)}`;
    return { color, label, name };
  });
  const ticks = available
    ? [
        { label: formatCompact(classification.min), percent: 0 },
        { label: formatCompact(classification.breaks[4] ?? classification.max), percent: 50 },
        { label: formatCompact(classification.max), percent: 100 },
      ]
    : [];
  const notice = !available
    ? loading
      ? 'Carregando dados…'
      : 'Sem dados para este recorte'
    : statistics.missing > 0
      ? `${statistics.missing.toLocaleString('pt-BR')} sem dado`
      : undefined;

  return (
    <ScaleLegend
      key={`${indicator.key}:${indicator.year ?? indicator.requestedYear}`}
      title={indicator.name}
      unit={unitLabel(indicator.unit)}
      bands={bands}
      ticks={ticks}
      notice={notice}
      loading={loading && !available}
      unavailable={!available}
    />
  );
}
