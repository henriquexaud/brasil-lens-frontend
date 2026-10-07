import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { NationalMunicipalLayer } = await loadModule(`
  export { NationalMunicipalLayer } from './src/features/map/NationalMunicipalLayer';
`, { stubs: {
  'react-leaflet': `import { createElement } from 'react';
    export const useMap = () => globalThis.testMap;
    export const Pane = () => createElement('div', { id: 'overlay-pane' });`,
  'leaflet': `export const latLng = (lat, lng) => ({ lat, lng });
    export const svgOverlay = (svg) => ({
      svg,
      addTo() { document.querySelector('#overlay-pane').appendChild(svg); return this; },
      remove() { svg.remove(); return this; },
    });`,
  '@/lib/idle': `export const scheduleIdle = (work) => {
    const key = ++globalThis.nextIdle;
    globalThis.idle.set(key, work);
    return () => globalThis.idle.delete(key);
  };`,
} });

let root, handlers;
const feature = (id) => ({
  properties: { ibgeCode: id },
  geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]], [[.1, .1], [.2, .1], [.1, .1]]]] },
});
const data = {
  mesh: {
    states: { bbox: [-74, -34, -34, 6], features: [feature('35'), feature('33')] },
    municipalities: ['35', '33'].map((parent) => ({
      features: Array.from({ length: 70 }, (_, index) => feature(parent + String(index).padStart(5, '0'))),
    })),
  },
  weatherByCode: new Map(['35', '33'].flatMap((parent) => Array.from({ length: 70 }, (_, index) => [parent + String(index).padStart(5, '0'), { temperatureC: 24, precipitation48hMm: index }]))),
};
async function render(extra = {}) {
  await act(async () => root.render(h(NationalMunicipalLayer, { data, visible: true, paused: false, climateMode: true, ...extra })));
}
async function step() {
  const [key, work] = [...globalThis.idle][0] ?? [];
  assert.ok(work);
  globalThis.idle.delete(key);
  await act(async () => work());
}
async function drain() { for (let i = 0; i < 100 && globalThis.idle.size; i++) await step(); }
const svgs = () => [...document.querySelectorAll('svg')];
const visible = () => svgs().filter((svg) => svg.style.opacity === '1');
beforeEach(() => {
  globalThis.idle = new Map(); globalThis.nextIdle = 0;
  handlers = new Map();
  globalThis.testMap = {
    project: ({ lat, lng }) => ({ x: lng, y: -lat }),
    on(events, handler) { events.split(' ').forEach((event) => handlers.set(event, handler)); },
    off(events) { events.split(' ').forEach((event) => handlers.delete(event)); },
  };
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => { await act(async () => root.unmount()); assert.equal(handlers.size, 0); });
after(async () => { dom.window.close(); await disposeHarness(); });

test('todos os caminhos são preparados ocultos; publicação é única e cores iguais compartilham path', async () => {
  await render();
  assert.equal(visible().length, 0);
  await step();
  assert.equal(visible().length, 0);
  await step(); await step();
  assert.ok(svgs()[0].children.length > 0, 'primeira UF preparada');
  assert.equal(visible().length, 0, 'UF pronta ainda não é publicada');
  await drain();
  assert.equal(visible().length, 1);
  assert.equal(visible()[0].children.length, 4, 'duas cores por UF e duas divisas estaduais');
  assert.equal(visible()[0].getAttribute('aria-hidden'), 'true');
  assert.match(visible()[0].children[0].getAttribute('d'), /Z.*M/, 'anéis e buracos são preservados');
});

test('movimento e aba oculta pausam o desenho; retomar preserva o trabalho preparado', async () => {
  await render(); await step();
  handlers.get('movestart')();
  assert.equal(globalThis.idle.size, 0);
  handlers.get('moveend')();
  await step(); await step();
  const prepared = svgs()[0].children.length;
  assert.ok(prepared > 0);
  await render({ paused: true });
  assert.equal(globalThis.idle.size, 0);
  assert.equal(svgs()[0].children.length, prepared);
  await render(); await drain();
  assert.equal(visible().length, 1);
});

test('renovar dados mantém o mosaico anterior até a troca integral; trocar camada só mostra cores corretas', async () => {
  await render(); await drain();
  const previous = visible()[0];
  const nextData = { ...data, weatherByCode: new Map([...data.weatherByCode].map(([code, city]) => [code, { ...city, temperatureC: 36 }])) };
  await render({ data: nextData }); await step();
  assert.equal(visible()[0], previous);
  assert.equal(svgs().length, 2);
  await drain();
  assert.equal(visible().length, 1);
  assert.notEqual(visible()[0], previous);
  assert.equal(previous.isConnected, false);
  await render({ data: nextData, rainMode: true, climateMode: false });
  assert.equal(visible().length, 0, 'clima não aparece enquanto prepara chuva');
  await drain();
  assert.equal(visible()[0].dataset.nationalMosaic, 'rainfall');
  await render({ data: nextData });
  assert.equal(visible()[0].dataset.nationalMosaic, 'climate', 'camada preparada é reaproveitada integralmente');
  assert.equal(globalThis.idle.size, 0);
  await render({ visible: false });
  assert.equal(svgs().length, 0);
});
