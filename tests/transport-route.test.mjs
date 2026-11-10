import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  decodePolyline,
  emptyPlan,
  formatDistance,
  formatDuration,
  planReducer,
  routePoints,
  searchBias,
  MAX_WAYPOINTS,
} = await import('../src/features/transport/route/model.ts');

const point = (label, latitude, longitude) => ({ label, detail: null, latitude, longitude });

test('a polyline do OSRM (precisão 6) volta a lat,lon', () => {
  // Exemplo do formato do Google, codificado com precisão 6.
  const encoded = '_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI';
  assert.deepEqual(decodePolyline(encoded), [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453],
  ]);
});

test('distância e duração em pt-BR, arredondadas como num app de mapa', () => {
  assert.deepEqual([3, 438, 1000, 4550, 436443.8].map(formatDistance), [
    '10 m',
    '440 m',
    '1 km',
    '4,6 km',
    '436 km',
  ]);
  assert.deepEqual([20, 600, 3600, 20335.7, 3 * 86400 + 7200].map(formatDuration), [
    '1 min',
    '10 min',
    '1 h',
    '5 h 39 min',
    '3 d 2 h',
  ]);
});

test('parada entra antes do destino, até o teto, e inverter troca o sentido', () => {
  let plan = emptyPlan();
  plan = planReducer(plan, { type: 'set', index: 0, waypoint: point('A', -23.5, -46.6) });
  plan = planReducer(plan, { type: 'set', index: 1, waypoint: point('B', -22.9, -43.2) });
  const destination = plan.waypoints[1].key;
  plan = planReducer(plan, { type: 'addStop' });
  assert.equal(plan.waypoints.length, 3);
  assert.equal(plan.waypoints[2].key, destination);
  for (let i = 0; i < 10; i++) plan = planReducer(plan, { type: 'addStop' });
  assert.equal(plan.waypoints.length, MAX_WAYPOINTS);

  // Paradas vazias não entram na rota.
  assert.equal(routePoints(plan), '-23.50000,-46.60000;-22.90000,-43.20000');
  plan = planReducer(plan, { type: 'reverse' });
  assert.equal(routePoints(plan), '-22.90000,-43.20000;-23.50000,-46.60000');
});

test('remover com só dois campos limpa, e o rótulo atrasado não sobrescreve ponto novo', () => {
  let plan = planReducer(emptyPlan(), {
    type: 'set',
    index: 0,
    waypoint: point('A', -23.5, -46.6),
  });
  const key = plan.waypoints[0].key;
  plan = planReducer(plan, { type: 'remove', index: 0 });
  assert.equal(plan.waypoints.length, 2);
  assert.equal(plan.waypoints[0].key, key);
  assert.equal(plan.waypoints[0].latitude, null);

  plan = planReducer(plan, { type: 'set', index: 0, waypoint: point('Ponto no mapa', -10, -50) });
  const late = { type: 'label', key, latitude: -9, longitude: -50, label: 'Antigo', detail: null };
  assert.equal(planReducer(plan, late).waypoints[0].label, 'Ponto no mapa');
  const fresh = { ...late, latitude: -10, label: 'Rua Nova' };
  assert.equal(planReducer(plan, fresh).waypoints[0].label, 'Rua Nova');
  assert.equal(routePoints(plan), null);
});

test('a busca prioriza o GPS, depois o centro da vista aproximada', () => {
  const device = { latitude: -23.56, longitude: -46.65 };
  assert.deepEqual(searchBias('-50,-30,-40,-20', 10, device), device);
  assert.deepEqual(searchBias('-50,-30,-40,-20', 10, null), { latitude: -25, longitude: -45 });
  assert.equal(searchBias('-50,-30,-40,-20', 5, null), null);
  assert.equal(searchBias(undefined, 10, null), null);
});

test('o ponto do território só entra se o campo ainda for aquele território', () => {
  let plan = planReducer(emptyPlan(), {
    type: 'set',
    index: 1,
    waypoint: {
      label: 'Bahia',
      detail: 'Estado',
      latitude: null,
      longitude: null,
      territory: '29',
    },
  });
  const key = plan.waypoints[1].key;
  const resolve = {
    type: 'resolve',
    key,
    territory: '29',
    label: 'Bahia · Salvador',
    detail: 'Capital, BA',
    latitude: -12.97,
    longitude: -38.5,
  };
  const resolved = planReducer(plan, resolve);
  assert.equal(resolved.waypoints[1].label, 'Bahia · Salvador');
  assert.equal(resolved.waypoints[1].latitude, -12.97);

  // O usuário trocou o destino antes de a capital chegar: a resposta atrasada é ignorada.
  plan = planReducer(plan, { type: 'set', index: 1, waypoint: point('Recife', -8.05, -34.9) });
  assert.equal(planReducer(plan, resolve).waypoints[1].label, 'Recife');
});

test('"Como chegar" troca o destino, mantém a partida e tira as paradas', () => {
  let plan = emptyPlan();
  plan = planReducer(plan, { type: 'set', index: 0, waypoint: point('Casa', -23.5, -46.6) });
  plan = planReducer(plan, { type: 'addStop' });
  plan = planReducer(plan, { type: 'goTo', destination: point('Quadra', -23.6, -46.7) });
  assert.deepEqual(
    plan.waypoints.map((item) => item.label),
    ['Casa', 'Quadra'],
  );
  // A posição do aparelho só preenche a partida vazia.
  plan = planReducer(plan, { type: 'origin', waypoint: point('Minha localização', -23, -46) });
  assert.equal(plan.waypoints[0].label, 'Casa');
  plan = planReducer(emptyPlan(), { type: 'goTo', destination: point('Quadra', -23.6, -46.7) });
  plan = planReducer(plan, { type: 'origin', waypoint: point('Minha localização', -23, -46) });
  assert.equal(routePoints(plan), '-23.00000,-46.00000;-23.60000,-46.70000');
});
