import type { MapClassification, MapIndicatorMeta, MapStatistics } from '@/api/types';
import { ScaleLegend } from '@/components/ScaleLegend';
import { formatCompact, unitLabel } from './format';
import { classColors, paletteForIndicator } from './colors';

interface Props {
  indicator: MapIndicatorMeta | null;
  classification: MapClassification | null;
  statistics: MapStatistics | null;
  /**
   * Menor e maior valor do recorte aberto, quando a classificação é a nacional:
   * a legenda mostra só as faixas e os números que existem ali.
   */
  range?: { min: number; max: number } | null;
  loading?: boolean;
  missingLabel?: string;
  missingTitle?: string;
}

export function Legend({
  indicator,
  classification,
  statistics,
  range,
  loading = false,
  missingLabel,
  missingTitle,
}: Props) {
  if (!indicator) return null;
  const palette = paletteForIndicator(indicator.key);
  const available = classification !== null && statistics !== null;
  const colors = available ? classColors(classification.classes, palette) : palette;
  const clip = (value: number | undefined) =>
    value == null || !range ? value : Math.min(range.max, Math.max(range.min, value));
  const all = colors.map((color, index) => {
    const lower = index === 0 ? classification?.min : classification?.breaks[index - 1];
    const upper = classification?.breaks[index];
    return { color, lower, upper, index };
  });
  // Faixa nacional inteira acima (ou abaixo) do que há no recorte não entra.
  const inRange = all.filter(
    ({ lower, upper }) =>
      !range || lower == null || upper == null || (lower <= range.max && upper >= range.min),
  );
  const visible = inRange.length ? inRange : all;
  const bands = visible.map(({ color, lower: rawLower, upper: rawUpper, index }) => {
    const lower = clip(rawLower);
    const upper = clip(rawUpper);
    const label =
      lower == null || upper == null
        ? 'Sem dado'
        : lower === upper
          ? formatCompact(upper)
          : `${formatCompact(lower)} a ${formatCompact(upper)}`;
    const empty = available && !range && index > 0 && rawUpper === classification.breaks[index - 1];
    const name = empty
      ? `Sem valores distintos nesta faixa (limite ${label} ${unitLabel(indicator.unit)})`
      : `${label} ${unitLabel(indicator.unit)}`;
    return { color, label, name };
  });
  const middle = Math.floor(visible.length / 2);
  const first = clip(visible[0]?.lower);
  const last = clip(visible[visible.length - 1]?.upper);
  const ticks =
    available && first != null && last != null
      ? [
          { label: formatCompact(first), percent: 0 },
          ...(visible.length >= 3
            ? [
                {
                  label: formatCompact(clip(visible[middle]!.lower) ?? first),
                  percent: (middle / visible.length) * 100,
                },
              ]
            : []),
          { label: formatCompact(last), percent: 100 },
        ]
      : [];
  const notice = available
    ? undefined
    : loading
      ? 'Carregando dados…'
      : 'Sem dados para este recorte';

  return (
    <ScaleLegend
      key={`${indicator.key}:${indicator.year ?? indicator.requestedYear}`}
      title={indicator.name}
      unit={unitLabel(indicator.unit)}
      bands={bands}
      ticks={ticks}
      notice={notice}
      missing={statistics?.missing ?? 0}
      missingLabel={missingLabel}
      missingTitle={missingTitle}
      loading={loading && !available}
      unavailable={!available}
    />
  );
}
