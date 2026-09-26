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

test('salva e recupera preferências climáticas', () => {
  saveSessionState({ showWeatherAlerts: true, activeThematicLayer: 'climate' });
  const state = loadSessionState();
  assert.equal(state.showWeatherAlerts, true);
  assert.equal(state.activeThematicLayer, 'climate');
});

test('saveSessionState salva e recupera a camada de chuva ativa', () => {
  saveSessionState({
    activeThematicLayer: 'rainfall',
  });

  const state = loadSessionState();
  assert.equal(state.activeThematicLayer, 'rainfall');
});

test('saveSessionState salva e recupera a camada de clima ativa', () => {
  saveSessionState({
    activeThematicLayer: 'climate',
  });

  const state = loadSessionState();
  assert.equal(state.activeThematicLayer, 'climate');
});

test('mescla patches parciais preservando território selecionado', () => {
  saveSessionState({ showWeatherAlerts: false });
  saveSessionState({
    scope: { level: 'municipality', parent: '35', parentName: 'São Paulo' },
    selectedCode: '3550308',
  });
  const state = loadSessionState();
  assert.equal(state.showWeatherAlerts, false);
  assert.deepEqual(state.scope, { level: 'municipality', parent: '35', parentName: 'São Paulo' });
  assert.equal(state.selectedCode, '3550308');
});

test('loadSessionState trata JSON corrompido sem quebrar', () => {
  mockStorage.setItem(SESSION_STORAGE_KEY, '{invalid json syntax}');
  const state = loadSessionState();
  assert.deepEqual(state, {});
});

test('clearSessionState remove a chave da sessão', () => {
  saveSessionState({ activeThematicLayer: 'fire' });
  assert.equal(loadSessionState().activeThematicLayer, 'fire');
  clearSessionState();
  assert.deepEqual(loadSessionState(), {});
});

test('loadSessionState migra a sessão v1 e descarta preferências antigas sem uso', () => {
  mockStorage.setItem('brasil_lens_session_v1', JSON.stringify({ obsoletePreference: true }));
  const state = loadSessionState();
  assert.equal(state.showWeatherAlerts, true, 'migra avisos para true por default');
  assert.equal('obsoletePreference' in state, false);
  assert.equal(
    mockStorage.getItem('brasil_lens_session_v1'),
    null,
    'chave antiga v1 deve ser removida',
  );
  assert.notEqual(mockStorage.getItem(SESSION_STORAGE_KEY), null, 'chave nova deve ser gravada');
});

test('migração mantém apenas preferências ambientais e elimina todas as versões antigas', () => {
  const scope = { level: 'municipality', parent: '35', parentName: 'São Paulo' };
  mockStorage.setItem('brasil_lens_session_v1', JSON.stringify({ context: 'sociopolitical' }));
  mockStorage.setItem(
    'brasil_lens_session_v2',
    JSON.stringify({
      scope: { ...scope, indicatorKey: 'population' },
      indicatorKey: 'population',
      context: 'sociopolitical',
      activeThematicLayer: 'rainfall',
      selectedCode: '3550308',
    }),
  );
  assert.deepEqual(loadSessionState(), {
    scope,
    activeThematicLayer: 'rainfall',
    selectedCode: '3550308',
  });
  assert.equal(mockStorage.getItem('brasil_lens_session_v1'), null);
  assert.equal(mockStorage.getItem('brasil_lens_session_v2'), null);
  assert.doesNotMatch(mockStorage.getItem(SESSION_STORAGE_KEY), /population|sociopolitical/);
});

test('limpar a sessão não ressuscita uma versão antiga', () => {
  mockStorage.setItem('brasil_lens_session_v1', JSON.stringify({ activeThematicLayer: 'fire' }));
  mockStorage.setItem(
    'brasil_lens_session_v2',
    JSON.stringify({ activeThematicLayer: 'rainfall' }),
  );
  mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ activeThematicLayer: 'climate' }));
  clearSessionState();
  assert.deepEqual(loadSessionState(), {});
  assert.equal(mockStorage.store.size, 0);
});

test('sessão antiga corrompida permite recuperar a próxima versão válida', () => {
  mockStorage.setItem('brasil_lens_session_v2', '{invalid');
  mockStorage.setItem('brasil_lens_session_v1', JSON.stringify({ showHydrography: false }));
  assert.deepEqual(loadSessionState(), { showHydrography: false, showWeatherAlerts: true });
  assert.equal(mockStorage.getItem('brasil_lens_session_v2'), null);
});

test('recortes antigos ou municipais sem UF não são restaurados', () => {
  for (const scope of [
    { level: 'region' },
    { level: 'municipality' },
    { level: 'state', parent: '3' },
  ]) {
    mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ scope }));
    assert.deepEqual(loadSessionState(), {});
  }
});
