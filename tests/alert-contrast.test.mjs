import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/features/weather/alertStyles.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const {
  ALERT_STYLES,
  resolveAlertTier,
  getAlertStyle,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function hexToLuminance(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1, hex2) {
  const lum1 = hexToLuminance(hex1);
  const lum2 = hexToLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

test('classificação de severidades e resolução de tier de avisos', () => {
  // Grande Perigo
  assert.equal(resolveAlertTier('Grande Perigo', '#ff0000'), 'extreme');
  assert.equal(resolveAlertTier('GRANDE PERIGO', null), 'extreme');
  assert.equal(resolveAlertTier('Tempestade - Grande Perigo', '#dc2626'), 'extreme');

  // Perigo Potencial
  assert.equal(resolveAlertTier('Perigo Potencial', '#FFFE00'), 'potential');
  assert.equal(resolveAlertTier('Chuva Intensa (Perigo Potencial)', '#ffff00'), 'potential');
  assert.equal(resolveAlertTier(null, '#fffe00'), 'potential');

  // Perigo
  assert.equal(resolveAlertTier('Perigo', '#ff9e00'), 'danger');
  assert.equal(resolveAlertTier('Ventos Costeiros - Perigo', null), 'danger');
  assert.equal(resolveAlertTier(null, '#ff9e00'), 'danger');

  // Outros / Fallback
  assert.equal(resolveAlertTier('Aviso Especial', '#0000ff'), 'other');
  assert.equal(resolveAlertTier(null, null), 'other');
});

test('estilos de avisos contêm preenchimentos sutis e bordas sólidas laranjas', () => {
  const potential = getAlertStyle({ severity: 'Perigo Potencial', color: '#FFFE00' });
  assert.equal(potential.tier, 'potential');
  assert.equal(potential.fillColor, '#F59E0B', 'Âmbar alerta');
  assert.equal(potential.strokeColor, '#EA580C', 'Borda laranja');
  assert.equal(potential.strokeDashArray, undefined, 'Linha sólida contínua (sem tracejado)');
  assert(potential.fillOpacity <= 0.2 && potential.fillOpacity >= 0.08, 'Preenchimento leve e sutil');
  assert(potential.strokeWeight <= 1.5, 'Traço fino');

  const danger = getAlertStyle({ severity: 'Perigo', color: '#ff9e00' });
  assert.equal(danger.tier, 'danger');
  assert.equal(danger.fillColor, '#EA580C');
  assert.equal(danger.strokeColor, '#EA580C', 'Borda laranja');
  assert.equal(danger.strokeDashArray, undefined, 'Linha sólida contínua');
  assert(danger.fillOpacity <= 0.2 && danger.fillOpacity >= 0.08);
  assert(danger.strokeWeight <= 1.5);

  const extreme = getAlertStyle({ severity: 'Grande Perigo', color: '#ff0000' });
  assert.equal(extreme.tier, 'extreme');
  assert.equal(extreme.fillColor, '#DC2626');
  assert.equal(extreme.strokeColor, '#EA580C', 'Borda laranja');
  assert.equal(extreme.strokeDashArray, undefined, 'Linha sólida contínua');
  assert(extreme.fillOpacity <= 0.2 && extreme.fillOpacity >= 0.08);
  assert(extreme.strokeWeight <= 1.5);
});

test('borda dos avisos é sólida e laranja com contraste adequado sobre o mapa', () => {
  for (const [tier, style] of Object.entries(ALERT_STYLES)) {
    assert.equal(
      style.strokeColor,
      '#EA580C',
      `Borda de ${tier} deve ser sólida e laranja (#EA580C)`,
    );
    assert.equal(
      style.strokeDashArray,
      undefined,
      `Borda de ${tier} não deve ter tracejado (linha contínua)`,
    );
    assert(
      style.strokeWeight >= 1.0 && style.strokeWeight <= 1.5,
      `Borda de ${tier} deve ser sutil e fina`,
    );
  }

  // Contraste contra as faixas claras da coropleta
  const ratioPastel = contrastRatio('#EA580C', '#FFF5A6');
  assert(
    ratioPastel >= 3.0,
    `Borda laranja deve ter contraste gráfico >= 3:1 com fundo claro (#FFF5A6), obtido: ${ratioPastel.toFixed(2)}:1`,
  );
});

test('AlertsLayer renderiza em Pane com zIndex 450 acima da coropleta', async () => {
  const alertsLayerSource = await readFile(
    new URL('../src/features/weather/AlertsLayer.tsx', import.meta.url),
    'utf8',
  );
  assert(
    alertsLayerSource.includes('zIndex: 450'),
    'AlertsLayer deve usar zIndex 450 para se sobrepor à coropleta (zIndex 400)',
  );
  assert(
    alertsLayerSource.includes("pointerEvents: 'none'"),
    'AlertsLayer não deve bloquear cliques no mapa',
  );
});

test('avisos do INMET aguardam a base e permanecem disponíveis no painel', async () => {
  const appSource = await readFile(
    new URL('../src/App.tsx', import.meta.url),
    'utf8',
  );
  assert(
    appSource.includes('useWeatherAlerts(isClimate && showWeatherAlerts && climateBaseReady)'),
    'App.tsx deve consultar avisos depois do mapa base',
  );

  const weatherOptionsSource = await readFile(
    new URL('../src/features/weather/WeatherOptions.tsx', import.meta.url),
    'utf8',
  );
  assert(
    weatherOptionsSource.includes('{showAlerts && ('),
    'WeatherOptions deve renderizar a lista de avisos diretamente quando o checkbox estiver ativo',
  );
  assert(
    weatherOptionsSource.includes('weather-alerts-container'),
    'WeatherOptions deve manter os avisos abertos e visíveis sem esconder atrás de disclosure',
  );
});
