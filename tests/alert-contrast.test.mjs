import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.alert-tests-'));
const modulePath = join(scratch, 'harness.mjs');
const compiled = await build({
  stdin: {
    contents: `
      export * from './src/features/weather/alertStyles';
      export * from './src/features/weather/alertUtils';
    `,
    resolveDir: frontend,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  alias: { '@': join(frontend, 'src') },
});
await writeFile(modulePath, compiled.outputFiles[0].text);

after(async () => {
  await rm(scratch, { recursive: true, force: true });
});

const {
  ALERT_STYLES,
  SEVERITY_RANK,
  resolveAlertTier,
  getAlertStyle,
  alertSourceLabel,
  extractAlertUrls,
  isAlertInState,
  getNationalAlertsSummary,
  groupStateAlerts,
  partitionMunicipalityAlerts,
} = await import(pathToFileURL(modulePath).href);

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

test('classificação de severidades normalizada em 4 níveis (Moderado, Alto, Muito alto, Extremo)', () => {
  // Extremo (#7F1D1D)
  assert.equal(resolveAlertTier('Grande Perigo', '#dc2626'), 'extreme');
  assert.equal(resolveAlertTier('GRANDE PERIGO', null), 'extreme');
  assert.equal(resolveAlertTier('Tempestade - Extremo', '#7f1d1d'), 'extreme');

  // Muito alto (#C62828)
  assert.equal(resolveAlertTier('Muito Alto', '#ff0000'), 'very_high');
  assert.equal(resolveAlertTier('Movimentos de Massa - Muito Alto', null), 'very_high');
  assert.equal(resolveAlertTier(null, '#c62828'), 'very_high');

  // Alto (#E25822)
  assert.equal(resolveAlertTier('Perigo', '#ff9e00'), 'high');
  assert.equal(resolveAlertTier('Alto', '#ffa500'), 'high');
  assert.equal(resolveAlertTier('Ventos Costeiros - Perigo', null), 'high');
  assert.equal(resolveAlertTier(null, '#e25822'), 'high');

  // Moderado (#C58A00)
  assert.equal(resolveAlertTier('Perigo Potencial', '#FFFE00'), 'moderate');
  assert.equal(resolveAlertTier('Moderado', '#ffff00'), 'moderate');
  assert.equal(resolveAlertTier('Chuva Intensa (Perigo Potencial)', '#c58a00'), 'moderate');
  assert.equal(resolveAlertTier(null, '#c58a00'), 'moderate');

  // Fallback
  assert.equal(resolveAlertTier(null, null), 'moderate');
});

test('estilos de avisos contêm as cores oficiais exatas solicitadas e bordas correspondentes', () => {
  // Moderado: #C58A00
  const moderate = getAlertStyle({ severity: 'Moderado', color: '#c58a00' });
  assert.equal(moderate.tier, 'moderate');
  assert.equal(moderate.label, 'Moderado');
  assert.equal(moderate.color, '#C58A00');
  assert.equal(moderate.strokeColor, '#C58A00');
  assert.equal(moderate.fillColor, '#C58A00');
  assert(moderate.fillOpacity >= 0.08 && moderate.fillOpacity <= 0.2);

  // Alto: #E25822
  const high = getAlertStyle({ severity: 'Alto', color: '#e25822' });
  assert.equal(high.tier, 'high');
  assert.equal(high.label, 'Alto');
  assert.equal(high.color, '#E25822');
  assert.equal(high.strokeColor, '#E25822');
  assert.equal(high.fillColor, '#E25822');

  // Muito alto: #C62828
  const veryHigh = getAlertStyle({ severity: 'Muito Alto', color: '#c62828' });
  assert.equal(veryHigh.tier, 'very_high');
  assert.equal(veryHigh.label, 'Muito alto');
  assert.equal(veryHigh.color, '#C62828');
  assert.equal(veryHigh.strokeColor, '#C62828');
  assert.equal(veryHigh.fillColor, '#C62828');

  // Extremo: #7F1D1D
  const extreme = getAlertStyle({ severity: 'Grande Perigo', color: '#7f1d1d' });
  assert.equal(extreme.tier, 'extreme');
  assert.equal(extreme.label, 'Extremo');
  assert.equal(extreme.color, '#7F1D1D');
  assert.equal(extreme.strokeColor, '#7F1D1D');
  assert.equal(extreme.fillColor, '#7F1D1D');
});

test('ordem de severidade: Extremo > Muito alto > Alto > Moderado', () => {
  assert(SEVERITY_RANK.extreme < SEVERITY_RANK.very_high);
  assert(SEVERITY_RANK.very_high < SEVERITY_RANK.high);
  assert(SEVERITY_RANK.high < SEVERITY_RANK.moderate);
});

test('badges de fonte são neutros e identificam CEMADEN e INMET', () => {
  assert.equal(alertSourceLabel('inmet'), 'INMET');
  assert.equal(alertSourceLabel('cemaden'), 'CEMADEN');
});

test('extractAlertUrls limpa URLs cruas e extrai links de boletins', () => {
  const rawInstruction =
    'Para mais informações, consulte o boletim: https://siaden.cemaden.gov.br/dados/resources/FilePDF/12345.pdf';
  const { cleanedText, urls } = extractAlertUrls(rawInstruction);

  assert.equal(urls.length, 1);
  assert.equal(urls[0], 'https://siaden.cemaden.gov.br/dados/resources/FilePDF/12345.pdf');
  assert.equal(cleanedText, '', 'Texto cru com link foi totalmente limpo para evitar poluição visual');

  const textWithUrl = 'Evite áreas alagadas. Ver detalhes em https://inmet.gov.br/aviso/999.';
  const res2 = extractAlertUrls(textWithUrl);
  assert.equal(res2.urls.length, 1);
  assert.equal(res2.urls[0], 'https://inmet.gov.br/aviso/999');
  assert.equal(res2.cleanedText, 'Evite áreas alagadas. Ver detalhes em');
});

test('getNationalAlertsSummary agrega visão nacional sem listar municípios ou boletins', () => {
  const mockFeatures = [
    {
      id: 'cemaden:1',
      properties: {
        provider: 'cemaden',
        event: 'Movimentos de Massa',
        severity: 'Alto',
        severityLevel: 'high',
        affectedIbgeCodes: ['4202404'], // SC
      },
    },
    {
      id: 'cemaden:2',
      properties: {
        provider: 'cemaden',
        event: 'Movimentos de Massa',
        severity: 'Alto',
        severityLevel: 'high',
        affectedIbgeCodes: ['4205407'], // SC
      },
    },
    {
      id: 'inmet:3',
      properties: {
        provider: 'inmet',
        event: 'Tempestade',
        severity: 'Grande Perigo',
        severityLevel: 'extreme',
        affectedIbgeCodes: ['3550308', '3106200'], // SP, MG
      },
    },
  ];

  const summary = getNationalAlertsSummary(mockFeatures);
  assert.equal(summary.totalAlerts, 3);
  assert.equal(summary.affectedStatesCount, 3); // SC, SP, MG
  assert.equal(summary.severityDistribution.extreme, 1);
  assert.equal(summary.severityDistribution.high, 2);
  assert.equal(summary.sources.cemaden, 2);
  assert.equal(summary.sources.inmet, 1);
  assert.equal(summary.topStates[0].uf, 'SC');
  assert.equal(summary.topStates[0].count, 2);
});

test('groupStateAlerts agrupa ocorrências semelhantes no estado (ex.: Risco hidrológico · 8 municípios)', () => {
  const scFeatures = [
    {
      id: 'cemaden:1',
      properties: {
        provider: 'cemaden',
        event: 'Risco Hidrológico - Alto',
        severity: 'Alto',
        severityLevel: 'high',
        description: 'Blumenau/SC',
        affectedIbgeCodes: ['4202404'],
        instructions: ['Consulte o boletim: https://cemaden.gov.br/1.pdf'],
      },
    },
    {
      id: 'cemaden:2',
      properties: {
        provider: 'cemaden',
        event: 'Risco Hidrológico - Alto',
        severity: 'Alto',
        severityLevel: 'high',
        description: 'Gaspar/SC',
        affectedIbgeCodes: ['4205407'],
        instructions: ['Consulte o boletim: https://cemaden.gov.br/2.pdf'],
      },
    },
    {
      id: 'inmet:3',
      properties: {
        provider: 'inmet',
        event: 'Declínio de Temperatura',
        severity: 'Perigo Potencial',
        severityLevel: 'moderate',
        affectedIbgeCodes: ['4200000'],
      },
    },
  ];

  const grouped = groupStateAlerts(scFeatures, '42');
  assert.equal(grouped.length, 2, 'Deve ter 2 grupos: Risco Hidrológico e Declínio de Temperatura');

  const riscoHidro = grouped.find((g) => g.event.includes('Risco Hidrológico'));
  assert(riscoHidro);
  assert.equal(riscoHidro.isGroup, true);
  assert.equal(riscoHidro.count, 2);
  assert(riscoHidro.municipalities.some((m) => m.name === 'Blumenau'));
  assert(riscoHidro.municipalities.some((m) => m.name === 'Gaspar'));
  assert.equal(
    riscoHidro.municipalities.find((m) => m.name === 'Blumenau')?.bulletinUrl,
    'https://cemaden.gov.br/1.pdf',
  );
  assert.equal(
    riscoHidro.municipalities.find((m) => m.name === 'Gaspar')?.bulletinUrl,
    'https://cemaden.gov.br/2.pdf',
  );
  assert.equal(riscoHidro.bulletinUrls.length, 2);
});

test('extractAlertUrls limpa introduções residuais como "Boletim oficial do CEMADEN:" para não gerar bullets vazios', () => {
  const { cleanedText, urls } = extractAlertUrls(
    'Boletim oficial do CEMADEN: https://siaden.cemaden.gov.br/dados/resources/FilePDF/alerta_35454.pdf',
  );
  assert.equal(cleanedText, '', 'Deve limpar texto introdutório residual deixando vazio');
  assert.equal(urls.length, 1);
  assert.equal(urls[0], 'https://siaden.cemaden.gov.br/dados/resources/FilePDF/alerta_35454.pdf');
});

test('isAlertInState filtra alertas fora do estado ativo', () => {
  const alertSC = {
    id: 'cemaden:sc',
    properties: {
      provider: 'cemaden',
      event: 'Movimentos de Massa',
      affectedIbgeCodes: ['4202404'],
    },
  };
  const alertSP = {
    id: 'cemaden:sp',
    properties: {
      provider: 'cemaden',
      event: 'Inundação',
      affectedIbgeCodes: ['3550308'],
    },
  };
  const alertRegional = {
    id: 'inmet:reg',
    properties: {
      provider: 'inmet',
      event: 'Tempestade',
      affectedIbgeCodes: ['4200000', '4100000'],
    },
  };

  assert.equal(isAlertInState(alertSC, '42'), true, 'Alerta de SC deve estar em SC');
  assert.equal(isAlertInState(alertSP, '42'), false, 'Alerta de SP não deve estar em SC');
  assert.equal(isAlertInState(alertRegional, '42'), true, 'Alerta regional que toca SC deve estar em SC');
  assert.equal(isAlertInState(alertSP, null), true, 'Sem stateCode (nacional), todo alerta é visível');
});

test('partitionMunicipalityAlerts prioriza avisos diretos no município e secundários no estado', () => {
  const features = [
    {
      id: 'cemaden:1',
      properties: {
        provider: 'cemaden',
        event: 'Deslizamento',
        severity: 'Alto',
        affectedIbgeCodes: ['4202404'], // Blumenau
      },
    },
    {
      id: 'cemaden:2',
      properties: {
        provider: 'cemaden',
        event: 'Enxurrada',
        severity: 'Moderado',
        affectedIbgeCodes: ['4205407'], // Gaspar
      },
    },
  ];

  // Blumenau selecionado
  const { localAlerts, otherStateAlerts } = partitionMunicipalityAlerts(
    features,
    '4202404',
    '42',
  );

  assert.equal(localAlerts.length, 1);
  assert.equal(localAlerts[0].id, 'cemaden:1');
  assert.equal(otherStateAlerts.length, 1);
  assert.equal(otherStateAlerts[0].id, 'cemaden:2');
});

test('AlertsLayer renderiza em Pane com zIndex 450 e suporta filtro por stateCode', async () => {
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
  assert(
    alertsLayerSource.includes('stateCode'),
    'AlertsLayer deve aceitar stateCode para filtrar alertas fora do estado',
  );
  assert(
    alertsLayerSource.includes('isAlertInState(feature, stateCode)'),
    'AlertsLayer deve ocultar qualquer alerta fora do limite do estado atual',
  );
});

test('WeatherAlertGroupCard transforma badges das cidades em links diretos para o boletim com ↗', async () => {
  const groupCardSource = await readFile(
    new URL('../src/features/weather/WeatherAlertGroupCard.tsx', import.meta.url),
    'utf8',
  );
  assert(
    groupCardSource.includes('weather-alert-muni-chip is-link'),
    'Municípios com boletim devem ser renderizados com classe is-link',
  );
  assert(
    groupCardSource.includes('bulletin-external-icon'),
    'Municípios com link devem exibir o ícone de link externo ↗',
  );
  assert(
    groupCardSource.includes('group.municipalities.length === 0 && group.bulletinUrls.length > 0'),
    'Lista de botões Ver boletim não deve aparecer quando houver municípios com link direto',
  );
});

test('Rankings de clima, chuva e focos vêm fechados por padrão (defaultOpen={false})', async () => {
  const climateSource = await readFile(
    new URL('../src/features/weather/ClimateOverview.tsx', import.meta.url),
    'utf8',
  );
  const rainSource = await readFile(
    new URL('../src/features/rainfall/RainOverview.tsx', import.meta.url),
    'utf8',
  );
  const fireSource = await readFile(
    new URL('../src/features/fire/FireOverview.tsx', import.meta.url),
    'utf8',
  );

  assert(
    climateSource.includes('className="climate-ranking" defaultOpen={false}'),
    'ClimateOverview deve vir fechado por padrão',
  );
  assert(
    rainSource.includes('className="rain-ranking" defaultOpen={false}'),
    'RainOverview deve vir fechado por padrão',
  );
  assert(
    fireSource.includes('className="fire-ranking" defaultOpen={false}'),
    'FireOverview deve vir fechado por padrão',
  );
});

test('Sidebar esconde barra de rolagem visual mantendo rolagem operacional', async () => {
  const stylesSource = await readFile(
    new URL('../src/styles.css', import.meta.url),
    'utf8',
  );

  assert(
    stylesSource.includes('scrollbar-width: none;'),
    '.panel deve ter scrollbar-width: none para Firefox',
  );
  assert(
    stylesSource.includes('.panel::-webkit-scrollbar {\n  display: none;\n}'),
    '.panel::-webkit-scrollbar deve ter display: none para WebKit/Chrome/Safari',
  );
});

test('WeatherOptions mantém a camada de avisos aberta e estruturada com divulgação progressiva', async () => {
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
  assert(
    weatherOptionsSource.includes('WeatherAlertsNationalSummary'),
    'WeatherOptions deve usar o resumo compacto na visão nacional',
  );
  assert(
    weatherOptionsSource.includes('WeatherAlertGroupCard'),
    'WeatherOptions deve agrupar ocorrências semelhantes na visão estadual',
  );
  assert(
    weatherOptionsSource.includes('Neste município'),
    'WeatherOptions deve priorizar Neste município na visão municipal',
  );
});
