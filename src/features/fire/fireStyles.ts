/** Mesma cor do símbolo no mapa e na indicação da camada. */
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

/** O risco INPE é um índice, não uma probabilidade em porcentagem. */
export function formatFireValue(value: number | null, unit = ''): string | null {
  return value != null && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unit}`
    : null;
}

// SLD público para preservar a linguagem do produto; não altera os dados da fonte.
export const FIRE_SLD = `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>bdqueimadas:focos</Name><UserStyle><FeatureTypeStyle><Rule><PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">${FIRE_COLOR}</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill></Mark><Size>4</Size></Graphic></PointSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
