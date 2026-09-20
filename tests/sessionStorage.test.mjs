import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/sessionStorage.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { loadSessionState, saveSessionState, clearSessionState, SESSION_STORAGE_KEY } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

class MockStorage {
  store = new Map();
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

let mockStorage;

beforeEach(() => {
  mockStorage = new MockStorage();
  globalThis.window = { sessionStorage: mockStorage };
});

test('loadSessionState retorna objeto vazio quando storage está vazio', () => {
  const state = loadSessionState();
  assert.deepEqual(state, {});
});

test('saveSessionState salva e loadSessionState recupera contexto e outros estados', () => {
  saveSessionState({
    context: 'climate_environmental',
    indicatorKey: 'gdp',
    year: '2022',
    showWeatherAlerts: true,
  });

  const state = loadSessionState();
  assert.equal(state.context, 'climate_environmental');
  assert.equal(state.indicatorKey, 'gdp');
  assert.equal(state.year, '2022');
  assert.equal(state.showWeatherAlerts, true);
});

test('saveSessionState mescla patches parciais preservando campos anteriores', () => {
  saveSessionState({ context: 'sociopolitical', indicatorKey: 'population' });
  saveSessionState({
    scope: { level: 'municipality', parent: '35', parentName: 'São Paulo' },
    selectedCode: '3550308',
  });

  const state = loadSessionState();
  assert.equal(state.context, 'sociopolitical');
  assert.equal(state.indicatorKey, 'population');
  assert.deepEqual(state.scope, {
    level: 'municipality',
    parent: '35',
    parentName: 'São Paulo',
  });
  assert.equal(state.selectedCode, '3550308');
});

test('loadSessionState trata JSON corrompido sem quebrar', () => {
  mockStorage.setItem(SESSION_STORAGE_KEY, '{invalid json syntax}');
  const state = loadSessionState();
  assert.deepEqual(state, {});
});

test('clearSessionState remove a chave da sessão', () => {
  saveSessionState({ context: 'biodiversity' });
  assert.equal(loadSessionState().context, 'biodiversity');
  clearSessionState();
  assert.deepEqual(loadSessionState(), {});
});

test('loadSessionState migra dados legados v1 garantindo avisos do INMET ativos por default', () => {
  mockStorage.setItem('brasil_lens_session_v1', JSON.stringify({ context: 'climate_environmental', showWeatherAlerts: false }));
  const state = loadSessionState();
  assert.equal(state.context, 'climate_environmental');
  assert.equal(state.showWeatherAlerts, true, 'migra avisos para true por default');
  assert.equal(mockStorage.getItem('brasil_lens_session_v1'), null, 'chave antiga v1 deve ser removida');
  assert.notEqual(mockStorage.getItem(SESSION_STORAGE_KEY), null, 'chave nova v2 deve ser gravada');
});

