export const FIRE_COLOR = '#c8462a';

export function formatFireDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Horário não informado';
  return `${date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`;
}

export function formatFireValue(value: number | null, unit = ''): string | null {
  return value != null && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unit}`
    : null;
}

// Abaixo de ~1:5.000.000 (zoom ≈ 6,8) há dezenas de milhares de pontos por tela: o ponto encolhe.
const FAR_SCALE = 5_000_000;

const dot = (scale: string, size: number) =>
  `<Rule>${scale}<PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">${FIRE_COLOR}</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill></Mark><Size>${size}</Size></Graphic></PointSymbolizer></Rule>`;

export const FIRE_SLD = `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>bdqueimadas:focos</Name><UserStyle><FeatureTypeStyle>${dot(`<MinScaleDenominator>${FAR_SCALE}</MinScaleDenominator>`, 3)}${dot(`<MaxScaleDenominator>${FAR_SCALE}</MaxScaleDenominator>`, 4)}</FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
