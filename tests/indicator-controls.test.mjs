import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.indicator-tests-'));
const modulePath = join(scratch, 'harness.mjs');
const compiled = await build({
  stdin: {
    contents: `
      export * from './src/features/controls/indicatorCategories';
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
  INDICATOR_CATEGORIES,
  groupIndicatorsByCategory,
  getCategoryForIndicatorKey,
  formatIndicatorUnit,
} = await import(pathToFileURL(modulePath).href);

const mockIndicators = [
  { key: 'population', name: 'População', unit: 'people', availableYears: [2022, 2010], latestYear: 2022 },
  { key: 'population_growth', name: 'Crescimento populacional', unit: '%/year', availableYears: [2022], latestYear: 2022 },
  { key: 'area_km2', name: 'Área territorial', unit: 'km2', availableYears: [2022], latestYear: 2022 },
  { key: 'population_density', name: 'Densidade demográfica', unit: 'people/km2', availableYears: [2022], latestYear: 2022 },
  { key: 'gdp', name: 'PIB', unit: 'BRL', availableYears: [2021], latestYear: 2021 },
  { key: 'gdp_per_capita', name: 'PIB per capita', unit: 'BRL', availableYears: [2021], latestYear: 2021 },
  { key: 'urban_population', name: 'População urbana', unit: 'people', availableYears: [2022], latestYear: 2022 },
  { key: 'urbanization_rate', name: 'Taxa de urbanização', unit: '%', availableYears: [2022], latestYear: 2022 },
  { key: 'gdp_share_national', name: 'Participação no PIB nacional', unit: '%', availableYears: [2021], latestYear: 2021 },
  { key: 'gdp_agriculture', name: 'PIB — Agropecuária', unit: 'BRL', availableYears: [2021], latestYear: 2021 },
  { key: 'gdp_industry', name: 'PIB — Indústria', unit: 'BRL', availableYears: [2021], latestYear: 2021 },
  { key: 'gdp_services', name: 'PIB — Serviços', unit: 'BRL', availableYears: [2021], latestYear: 2021 },
  { key: 'household_income_per_capita', name: 'Renda domiciliar per capita', unit: 'BRL', availableYears: [2023], latestYear: 2023 },
  { key: 'unemployment_rate', name: 'Taxa de desemprego', unit: '%', availableYears: [2023], latestYear: 2023 },
];

test('groupIndicatorsByCategory agrupa os indicadores do catálogo nas 3 dimensões (População, Economia, Outros)', () => {
  const groups = groupIndicatorsByCategory(mockIndicators);

  assert.equal(groups.length, 3, 'Deve conter exatamente 3 categorias: População, Economia e Outros');
  assert.equal(groups[0].id, 'population');
  assert.equal(groups[0].label, 'População');
  assert.equal(groups[0].indicators.length, 5);
  assert.equal(groups[0].indicators[0].shortLabel, 'Total');
  assert.equal(groups[0].indicators[1].shortLabel, 'Urbana');

  assert.equal(groups[1].id, 'economy');
  assert.equal(groups[1].label, 'Economia');
  assert.equal(groups[1].indicators.length, 6);
  assert.equal(groups[1].indicators[0].shortLabel, 'PIB Total');
  assert.equal(groups[1].indicators[1].shortLabel, 'Per capita');

  assert.equal(groups[2].id, 'other');
  assert.equal(groups[2].label, 'Outros');
  assert.equal(groups[2].indicators.length, 3);
  assert.equal(groups[2].indicators[0].shortLabel, 'Área territorial');
  assert.equal(groups[2].indicators[1].shortLabel, 'Renda domiciliar');
  assert.equal(groups[2].indicators[2].shortLabel, 'Taxa de desemprego');
});

test('getCategoryForIndicatorKey identifica corretamente a categoria de qualquer indicador', () => {
  const groups = groupIndicatorsByCategory(mockIndicators);

  assert.equal(getCategoryForIndicatorKey('population', groups), 'population');
  assert.equal(getCategoryForIndicatorKey('urbanization_rate', groups), 'population');
  assert.equal(getCategoryForIndicatorKey('gdp_per_capita', groups), 'economy');
  assert.equal(getCategoryForIndicatorKey('gdp_industry', groups), 'economy');
  assert.equal(getCategoryForIndicatorKey('household_income_per_capita', groups), 'other');
  assert.equal(getCategoryForIndicatorKey('unemployment_rate', groups), 'other');
  assert.equal(getCategoryForIndicatorKey('area_km2', groups), 'other');
});

test('formatIndicatorUnit formata rótulos amigáveis de unidade', () => {
  assert.equal(formatIndicatorUnit('people'), 'habitantes');
  assert.equal(formatIndicatorUnit('people/km2'), 'hab. / km²');
  assert.equal(formatIndicatorUnit('BRL'), 'R$ correntes');
  assert.equal(formatIndicatorUnit('%'), '%');
  assert.equal(formatIndicatorUnit('%/year'), '% ao ano');
});

test('App.tsx posiciona WeatherThematicSwitch logo após ScopeHeader e desabilita seletor em WeatherOptions', async () => {
  const appSource = await readFile(
    new URL('../src/App.tsx', import.meta.url),
    'utf8',
  );

  // Deve importar WeatherThematicSwitch
  assert(
    appSource.includes('WeatherThematicSwitch'),
    'App.tsx deve importar WeatherThematicSwitch',
  );

  // ScopeHeader seguido de WeatherThematicSwitch dentro de thematic-switch-wrapper
  const scopeHeaderPos = appSource.indexOf('<ScopeHeader');
  const thematicWrapperPos = appSource.indexOf('thematic-switch-wrapper');
  assert(scopeHeaderPos !== -1, 'ScopeHeader deve existir');
  assert(thematicWrapperPos !== -1, 'thematic-switch-wrapper deve existir');
  assert(
    thematicWrapperPos > scopeHeaderPos,
    'thematic-switch-wrapper deve vir logo após ScopeHeader no topo da sidebar',
  );

  // WeatherOptions recebe showThematicSelector={false}
  assert(
    appSource.includes('showThematicSelector={false}'),
    'WeatherOptions deve receber showThematicSelector={false} no App.tsx',
  );
});

test('ControlPanel.tsx implementa navegação segmentada por categorias e pílulas de análises', async () => {
  const controlPanelSource = await readFile(
    new URL('../src/features/controls/ControlPanel.tsx', import.meta.url),
    'utf8',
  );

  assert(
    controlPanelSource.includes('indicator-segmented-control'),
    'ControlPanel deve conter a barra de categorias segmentada',
  );
  assert(
    controlPanelSource.includes('indicator-pills-row'),
    'ControlPanel deve conter a linha de pílulas de sub-indicadores',
  );
  assert(
    controlPanelSource.includes('indicator-meta-row'),
    'ControlPanel deve conter a linha de metadados compacta com ajustes de ano',
  );
  assert(
    controlPanelSource.includes('indicator-adjust-toggle'),
    'ControlPanel deve permitir expandir ajustes de ano de forma recolhida',
  );
});

