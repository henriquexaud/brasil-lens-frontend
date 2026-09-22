import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.adjustments-tests-'));

after(async () => {
  await rm(scratch, { recursive: true, force: true });
});

const compiled = await build({
  stdin: {
    contents: `
      export { measurement } from './src/features/weather/conditions';
      export { rainAmount } from './src/features/rainfall/rainScale';
    `,
    resolveDir: frontend,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  alias: { '@': join(frontend, 'src') },
  external: ['react', 'react-dom'],
});

const bundlePath = join(scratch, 'adjustments.mjs');
await writeFile(bundlePath, compiled.outputFiles[0].text);
const { measurement, rainAmount } = await import(pathToFileURL(bundlePath).href);

test('temperaturas devem sempre arredondar e não mostrar casas depois da vírgula', () => {
  // Arredondamento para cima e para baixo
  assert.equal(measurement(24.4, '°'), '24°');
  assert.equal(measurement(24.5, '°'), '25°');
  assert.equal(measurement(24.9, '°'), '25°');
  assert.equal(measurement(19.1, '°'), '19°');

  // Com °C e espaço
  assert.equal(measurement(31.8, ' °C'), '32 °C');
  assert.equal(measurement(20.4, '°C'), '20°C');

  // Proteção contra -0
  assert.equal(measurement(-0.2, '°'), '0°');
  assert.equal(measurement(-0.0, '°'), '0°');

  // Temperaturas negativas arredondadas
  assert.equal(measurement(-3.2, '°'), '-3°');
  assert.equal(measurement(-3.8, '°'), '-4°');

  // Valores ausentes ou inválidos
  assert.equal(measurement(null, '°'), '—');
  assert.equal(measurement(undefined, '°'), '—');
  assert.equal(measurement(Number.NaN, '°'), '—');

  // Outras unidades não-térmicas preservam decimais quando aplicável
  assert.equal(measurement(12.4, ' km/h'), '12,4 km/h');
  assert.equal(measurement(75, '%'), '75%');
});

test('lugares com 0mm de chuva são identificados com acumulado zero', () => {
  assert.equal(rainAmount({ precipitation24hMm: 0 }), 0);
  assert.equal(rainAmount({ precipitation24hMm: 0.0 }), 0);
  assert.equal(rainAmount({ precipitationSumMm: 0, precipitationMm: 0 }), 0);
  assert.equal(rainAmount({}), 0);

  // Lugares com chuva têm acumulado positivo
  assert.equal(rainAmount({ precipitation24hMm: 5.2 }), 5.2);
  assert.equal(rainAmount({ precipitation24hMm: 0.1 }), 0.1);
});

test('lugares com 0mm de chuva são excluídos dos marcadores do mapa', () => {
  const cities = [
    { id: '1', name: 'Cidade Seca 1', precipitation24hMm: 0, temperatureC: 25 },
    { id: '2', name: 'Cidade Seca 2', precipitationSumMm: 0, precipitationMm: 0, temperatureC: 22 },
    { id: '3', name: 'Cidade Seca 3', precipitation24hMm: 0.04, temperatureC: 30 },
    { id: '4', name: 'Cidade Chuvosa 1', precipitation24hMm: 12.5, temperatureC: 21 },
    { id: '5', name: 'Cidade Chuvosa 2', precipitationSumMm: 2.0, temperatureC: 19 },
  ];

  const rainCandidates = cities.filter((city) => rainAmount(city) >= 0.1);
  assert.equal(rainCandidates.length, 2);
  assert.deepEqual(
    rainCandidates.map((c) => c.id),
    ['4', '5'],
  );
});

