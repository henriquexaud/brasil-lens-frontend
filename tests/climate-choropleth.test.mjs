import assert from 'node:assert/strict';
import { test } from 'node:test';

// Escala térmica de 9 classes fixas
const TEMPERATURE_SCALE = [
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

function colorForTemperature(tempC) {
  if (tempC == null || Number.isNaN(tempC)) return '#94a3b8';
  for (const band of TEMPERATURE_SCALE) {
    if (tempC <= band.max) return band.color;
  }
  return TEMPERATURE_SCALE[TEMPERATURE_SCALE.length - 1].color;
}

function calculateClimatePolygonStyle({
  ibgeCode,
  weatherByCode,
  hovered,
  municipal,
}) {
  const weather = weatherByCode?.get(ibgeCode);
  const hasTemp = weather?.temperatureC !== null && weather?.temperatureC !== undefined;
  const fillColor = hasTemp ? colorForTemperature(weather.temperatureC) : '#f1f5f9';
  const fillOpacity = hasTemp ? (hovered ? 0.85 : 0.68) : (hovered ? 0.35 : 0.18);

  return {
    fillColor,
    fillOpacity,
    color: hovered ? '#26373d' : '#ffffff',
    weight: hovered ? (municipal ? 1.4 : 1.6) : (municipal ? 0.5 : 0.85),
    opacity: hovered ? 0.95 : (municipal ? 0.7 : 0.85),
  };
}

test('polígonos de estados e municípios são coloridos pela escala térmica no modo clima', () => {
  const weatherMap = new Map([
    ['35', { temperatureC: 23.4, weatherCode: 1 }], // SP - 20-25° -> #FFF5A6
    ['33', { temperatureC: 31.8, weatherCode: 0 }], // RJ - 30-35° -> #FF9B38
    ['43', { temperatureC: 8.2, weatherCode: 3 }],  // RS - 5-10° -> #47B3E8
    ['13', { temperatureC: 36.5, weatherCode: 2 }], // AM - >35° -> #F04432
    ['3550308', { temperatureC: 22.0, weatherCode: 1 }], // Município SP - 20-25° -> #FFF5A6
  ]);

  // 1. Estado de SP pintado com a cor correspondente a 23.4°C
  const spStyle = calculateClimatePolygonStyle({
    ibgeCode: '35',
    weatherByCode: weatherMap,
    hovered: false,
    municipal: false,
  });
  assert.equal(spStyle.fillColor, '#FFF5A6');
  assert.equal(spStyle.fillOpacity, 0.68);

  // 2. Estado do RJ pintado com a cor de 31.8°C
  const rjStyle = calculateClimatePolygonStyle({
    ibgeCode: '33',
    weatherByCode: weatherMap,
    hovered: false,
    municipal: false,
  });
  assert.equal(rjStyle.fillColor, '#FF9B38');

  // 3. Estado do RS (frio) pintado com #47B3E8
  const rsStyle = calculateClimatePolygonStyle({
    ibgeCode: '43',
    weatherByCode: weatherMap,
    hovered: false,
    municipal: false,
  });
  assert.equal(rsStyle.fillColor, '#47B3E8');

  // 4. Município individual carregado (ex.: São Paulo capital)
  const muniStyle = calculateClimatePolygonStyle({
    ibgeCode: '3550308',
    weatherByCode: weatherMap,
    hovered: false,
    municipal: true,
  });
  assert.equal(muniStyle.fillColor, '#FFF5A6');

  // 5. Município ainda não carregado na área (sem dados climáticos)
  const unloadedMuni = calculateClimatePolygonStyle({
    ibgeCode: '3500105',
    weatherByCode: weatherMap,
    hovered: false,
    municipal: true,
  });
  assert.equal(unloadedMuni.fillColor, '#f1f5f9');
  assert.equal(unloadedMuni.fillOpacity, 0.18);

  // 6. Hover preserva a cor térmica do polígono aumentando opacidade
  const spHover = calculateClimatePolygonStyle({
    ibgeCode: '35',
    weatherByCode: weatherMap,
    hovered: true,
    municipal: false,
  });
  assert.equal(spHover.fillColor, '#FFF5A6');
  assert.equal(spHover.fillOpacity, 0.85);
  assert.equal(spHover.color, '#26373d');
});

