import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/features/rainfall/rainScale.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const {
  RAIN_SCALE_STOPS,
  rainColor,
  rainDescription,
  rainBadgeText,
  rainAmount,
  rainingNowText,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('escala cromática de chuva contém paleta contínua de azuis', () => {
  assert.equal(RAIN_SCALE_STOPS.length, 7, 'deve ter 7 pontos de escala para a legenda');
  assert.equal(RAIN_SCALE_STOPS[0].color, '#f1f5f9');
  assert.equal(RAIN_SCALE_STOPS[6].color, '#1e3a8a');
});

test('rainColor mapeia valores de mm para a escala de azuis', () => {
  assert.equal(rainColor(null), '#f1f5f9');
  assert.equal(rainColor(undefined), '#f1f5f9');
  assert.equal(rainColor(0), '#f1f5f9');
  assert.equal(rainColor(1.5), '#dbeafe');
  assert.equal(rainColor(3), '#bfdbfe');
  assert.equal(rainColor(10), '#93c5fd');
  assert.equal(rainColor(25), '#60a5fa');
  assert.equal(rainColor(45), '#3b82f6');
  assert.equal(rainColor(60), '#2563eb');
  assert.equal(rainColor(85), '#1d4ed8');
  assert.equal(rainColor(120), '#1e3a8a');
});

test('rainDescription e rainBadgeText retornam classificações amigáveis', () => {
  assert.equal(rainDescription(0), 'Sem chuva registrada');
  assert.equal(rainDescription(1), 'Garoa / Chuva fraca');
  assert.equal(rainDescription(8), 'Chuva leve');
  assert.equal(rainDescription(20), 'Chuva moderada');
  assert.equal(rainDescription(40), 'Chuva forte');
  assert.equal(rainDescription(80), 'Chuva muito forte');
  assert.equal(rainDescription(150), 'Chuva torrencial');

  assert.equal(rainBadgeText(0), 'Sem chuva');
  assert.equal(rainBadgeText(2), 'Chuva leve');
  assert.equal(rainBadgeText(15), 'Moderada');
  assert.equal(rainBadgeText(35), 'Forte');
  assert.equal(rainBadgeText(80), 'Alerta de chuva');
});


test('chuva do mapa é o acumulado de 24 h e "chovendo agora" mostra a proporção do estado', () => {
  assert.equal(rainAmount({ precipitation24hMm: 12.4, precipitationSumMm: 3, precipitationMm: 0 }), 12.4);
  assert.equal(rainAmount({ precipitationSumMm: 3, precipitationMm: 0 }), 3, 'cache antigo sem 24 h');
  assert.equal(rainAmount({}), 0);
  assert.equal(rainingNowText({ rainingNow: false }), null);
  assert.equal(rainingNowText({ rainingNow: true }), 'Chovendo agora');
  assert.equal(
    rainingNowText({ rainingNow: true, rainPoints: 4, rainingPoints: 1 }),
    'Chovendo agora em 1 de 4 pontos',
  );
});
