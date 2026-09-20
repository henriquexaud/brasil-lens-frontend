import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDrainageArea, getHydroStyle } from '../src/features/map/hydroStyles.ts';

test('hierarquia visual de estilos de rios calibrada por área de drenagem a montante', () => {
  // 1. Rio colossal continental (ex.: Rio Amazonas, >= 200.000 km²)
  const grandRiver = getHydroStyle({
    id: 'river:1',
    name: 'Rio Amazonas',
    category: 'river',
    drainageAreaKm2: 6042610,
    dominion: 'Federal',
    management: 'ANA',
    bodyType: null,
  });
  assert.equal(grandRiver.weight, 3.8);
  assert.equal(grandRiver.color, '#0284c7');
  assert.equal(grandRiver.fill, false);

  // 2. Rio estruturante nacional (ex.: Rio Tietê, >= 50.000 km²)
  const majorRiver = getHydroStyle({
    id: 'river:2',
    name: 'Rio Tietê',
    category: 'river',
    drainageAreaKm2: 72000,
    dominion: 'Estadual',
    management: 'DAEE-SP',
    bodyType: null,
  });
  assert.equal(majorRiver.weight, 2.8);
  assert.equal(majorRiver.color, '#0284c7');

  // 3. Rio regional (ex.: Rio Piracicaba, >= 10.000 km²)
  const mediumRiver = getHydroStyle({
    id: 'river:3',
    name: 'Rio Piracicaba',
    category: 'river',
    drainageAreaKm2: 12500,
    dominion: 'Estadual',
    management: 'DAEE-SP',
    bodyType: null,
  });
  assert.equal(mediumRiver.weight, 2.1);
  assert.equal(mediumRiver.color, '#0ea5e9');

  // 4. Córrego / igarapé / tributário local (< 2.000 km²)
  const localStream = getHydroStyle({
    id: 'river:4',
    name: 'Córrego do Sapateiro',
    category: 'river',
    drainageAreaKm2: 45,
    dominion: 'Estadual',
    management: null,
    bodyType: null,
  });
  assert.equal(localStream.weight, 1.2);
  assert.equal(localStream.color, '#7dd3fc');
});

test('estilo de massas d água (lagos, represas e reservatórios)', () => {
  const lake = getHydroStyle({
    id: 'water_body:10',
    name: 'Represa de Sobradinho',
    category: 'water_body',
    drainageAreaKm2: null,
    dominion: 'Federal',
    management: null,
    bodyType: 'Artificial',
  });

  assert.equal(lake.fill, true);
  assert.equal(lake.fillColor, '#38bdf8');
  assert.equal(lake.fillOpacity, 0.35);
  assert.equal(lake.color, '#0284c7');
  assert.equal(lake.weight, 1.2);
});

test('formatação de área de drenagem da bacia', () => {
  assert.equal(formatDrainageArea(null), null);
  assert.equal(formatDrainageArea(0), null);
  assert.equal(formatDrainageArea(-5), null);

  const formattedLarge = formatDrainageArea(639219);
  assert.ok(formattedLarge.includes('639'));
  assert.ok(formattedLarge.includes('219'));

  const formattedSmall = formatDrainageArea(45.5);
  assert.ok(formattedSmall.includes('45'));
});

test('resolução progressiva do escopo de hidrografia (país -> estado -> município)', () => {
  function resolveHydroQuery({ isDrilledDown, parentCode, selectedCode }) {
    if (isDrilledDown) {
      if (selectedCode && selectedCode.length === 7) {
        return { level: 'municipality', parent: selectedCode, includeWaterBodies: true };
      }
      return { level: 'state', parent: parentCode, includeWaterBodies: true };
    }
    if (selectedCode && selectedCode.length === 2) {
      return { level: 'state', parent: selectedCode, includeWaterBodies: true };
    }
    return { level: 'country', includeWaterBodies: true };
  }

  // 1. Visão Geral (Brasil):
  assert.deepEqual(
    resolveHydroQuery({ isDrilledDown: false, parentCode: null, selectedCode: null }),
    { level: 'country', includeWaterBodies: true },
  );

  // 2. Estado selecionado no mapa nacional (ex: '35' SP):
  assert.deepEqual(
    resolveHydroQuery({ isDrilledDown: false, parentCode: null, selectedCode: '35' }),
    { level: 'state', parent: '35', includeWaterBodies: true },
  );

  // 3. Drill-down no estado (SP):
  assert.deepEqual(
    resolveHydroQuery({ isDrilledDown: true, parentCode: '35', selectedCode: null }),
    { level: 'state', parent: '35', includeWaterBodies: true },
  );

  // 4. Município selecionado dentro do estado (ex: '3550308' São Paulo):
  assert.deepEqual(
    resolveHydroQuery({ isDrilledDown: true, parentCode: '35', selectedCode: '3550308' }),
    { level: 'municipality', parent: '3550308', includeWaterBodies: true },
  );
});

test('switch de rios e lagos fica dentro do menu da direita junto com o checkselector de avisos', async () => {
  const { readFile } = await import('node:fs/promises');

  // Verifica WeatherOptions.tsx
  const weatherOptionsSrc = await readFile(
    new URL('../src/features/weather/WeatherOptions.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    weatherOptionsSrc.includes('title="Camadas e fontes"'),
    'WeatherOptions deve ter disclosure de "Camadas e fontes"',
  );
  assert.ok(
    weatherOptionsSrc.includes('Rios e lagos no mapa (ANA)'),
    'WeatherOptions deve conter o switch/checkbox de rios e lagos',
  );
  assert.ok(
    weatherOptionsSrc.includes('Avisos do INMET no mapa'),
    'WeatherOptions deve conter o checkselector de avisos do INMET',
  );
  assert.ok(
    weatherOptionsSrc.includes('weather-toggles-group'),
    'WeatherOptions deve agrupar os toggles de avisos e rios/lagos juntos',
  );

  // Verifica App.tsx
  const appSrc = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(
    !appSrc.includes('<HydrographyToggle'),
    'App.tsx não deve ter botão flutuante HydrographyToggle solto sobre o mapa',
  );
  assert.ok(
    appSrc.includes('showHydrography={showHydrography}'),
    'App.tsx deve repassar showHydrography para o painel da direita',
  );
  assert.ok(
    appSrc.includes('onToggleHydrography={setShowHydrography}'),
    'App.tsx deve repassar handler de toggle para o painel da direita',
  );
  assert.ok(
    appSrc.includes('useHydrography(hydroQuery, isClimate && showHydrography)'),
    'App.tsx deve consultar hidrografia apenas no contexto do clima',
  );
  assert.ok(
    appSrc.includes('{isClimate && showHydrography && <HydrographyLayer'),
    'App.tsx deve renderizar a camada de hidrografia no mapa apenas no contexto do clima',
  );
});

test('camada de hidrografia suprime focus ring do navegador e repassa cliques ao território', async () => {
  const { readFile } = await import('node:fs/promises');

  // Verifica HydrographyLayer.tsx
  const hydroLayerSrc = await readFile(
    new URL('../src/features/map/HydrographyLayer.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    hydroLayerSrc.includes('event.originalEvent?.preventDefault()'),
    'HydrographyLayer deve prevenir default em mousedown para evitar que o navegador crie caixa delimitadora de foco',
  );
  assert.ok(
    hydroLayerSrc.includes("el.classList.contains('territory-shape')"),
    'HydrographyLayer deve repassar cliques para o território subjacente',
  );

  // Verifica styles.css
  const stylesSrc = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.ok(
    stylesSrc.includes('.hydro-shape:focus') && stylesSrc.includes('outline: none !important'),
    'styles.css deve desativar explicitamente qualquer outline de foco em hydro-shape',
  );
  assert.ok(
    stylesSrc.includes('.leaflet-hydrography-pane'),
    'styles.css deve desativar outline em leaflet-hydrography-pane',
  );
});



