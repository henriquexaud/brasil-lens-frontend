import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/map/colors.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const {
  TEMPERATURE_SCALE,
  colorForTemperature,
  bandForTemperature,
  NO_DATA_COLOR,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('escala fixa de temperatura com 9 faixas em intervalos de 5°C', () => {
  assert.equal(TEMPERATURE_SCALE.length, 9, 'deve ter exatamente 9 faixas');

  const expectedScale = [
    { max: 0, color: '#2454C6', label: '≤0°' },
    { max: 5, color: '#2F7DE1', label: '0–5°' },
    { max: 10, color: '#47B3E8', label: '5–10°' },
    { max: 15, color: '#79DCE2', label: '10–15°' },
    { max: 20, color: '#D8F4F0', label: '15–20°' },
    { max: 25, color: '#FFF5A6', label: '20–25°' },
    { max: 30, color: '#FFD447', label: '25–30°' },
    { max: 35, color: '#FF9B38', label: '30–35°' },
    { max: Infinity, color: '#F04432', label: '>35°' },
  ];

  expectedScale.forEach((expected, i) => {
    assert.equal(TEMPERATURE_SCALE[i].max, expected.max);
    assert.equal(TEMPERATURE_SCALE[i].color, expected.color);
    assert.equal(TEMPERATURE_SCALE[i].label, expected.label);
  });
});

test('colorForTemperature mapeia valores conforme a classe fixa especificada', () => {
  // Casos de fronteira e valores intermediários
  assert.equal(colorForTemperature(-10), '#2454C6');
  assert.equal(colorForTemperature(0), '#2454C6');
  assert.equal(colorForTemperature(0.1), '#2F7DE1');
  assert.equal(colorForTemperature(5), '#2F7DE1');
  assert.equal(colorForTemperature(7.5), '#47B3E8');
  assert.equal(colorForTemperature(10), '#47B3E8');
  assert.equal(colorForTemperature(12), '#79DCE2');
  assert.equal(colorForTemperature(15), '#79DCE2');
  assert.equal(colorForTemperature(18), '#D8F4F0');
  assert.equal(colorForTemperature(20), '#D8F4F0');

  // Exemplos explícitos do usuário
  assert.equal(colorForTemperature(23), '#FFF5A6', '23°C deve usar #FFF5A6');
  assert.equal(colorForTemperature(25), '#FFF5A6');
  assert.equal(colorForTemperature(28), '#FFD447', '28°C deve usar #FFD447');
  assert.equal(colorForTemperature(30), '#FFD447');

  assert.equal(colorForTemperature(32), '#FF9B38');
  assert.equal(colorForTemperature(35), '#FF9B38');
  assert.equal(colorForTemperature(36), '#F04432');
  assert.equal(colorForTemperature(42), '#F04432');

  // Ausência de dado
  assert.equal(colorForTemperature(null), NO_DATA_COLOR);
  assert.equal(colorForTemperature(undefined), NO_DATA_COLOR);
  assert.equal(colorForTemperature(Number.NaN), NO_DATA_COLOR);
});

test('bandForTemperature recupera metadados da faixa térmica correspondente', () => {
  const band23 = bandForTemperature(23);
  assert.equal(band23?.label, '20–25°');
  assert.equal(band23?.color, '#FFF5A6');

  const bandCold = bandForTemperature(-2);
  assert.equal(bandCold?.label, '≤0°');
  assert.equal(bandCold?.color, '#2454C6');

  const bandHot = bandForTemperature(40);
  assert.equal(bandHot?.label, '>35°');
  assert.equal(bandHot?.color, '#F04432');
});

