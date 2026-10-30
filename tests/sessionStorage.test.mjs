import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';

const source = (await readFile(new URL('../src/lib/sessionStorage.ts', import.meta.url), 'utf8'))
  .replace(
    '@/features/political/selection',
    new URL('../src/features/political/selection.ts', import.meta.url).href,
  )
  .replace(
    '@/features/transport/layers',
    new URL('../src/features/transport/layers.ts', import.meta.url).href,
  )
  .replace(
    '@/features/education/education',
    new URL('../src/features/education/education.ts', import.meta.url).href,
  );
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

test('os alertas do DETER no Meio ambiente são guardados só como booleano', () => {
  saveSessionState({ showDeforestationAlerts: true });
  assert.equal(loadSessionState().showDeforestationAlerts, true);
  mockStorage.setItem(
    'brasil_lens_session_v6',
    JSON.stringify({ showDeforestationAlerts: 'sim', environmentLayer: 'alerts' }),
  );
  assert.deepEqual(loadSessionState(), {});
});

test('clearSessionState remove a chave da sessão', () => {
  saveSessionState({ environmentLayer: 'fire' });
  assert.equal(loadSessionState().environmentLayer, 'fire');
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

test('sessão v3 preserva preferências de clima e leva Fogo para o Meio ambiente', () => {
  const previous = { activeThematicLayer: 'fire', showWeatherAlerts: false, selectedCode: '35' };
  mockStorage.setItem('brasil_lens_session_v3', JSON.stringify(previous));
  assert.deepEqual(loadSessionState(), {
    environmentLayer: 'fire',
    showWeatherAlerts: false,
    selectedCode: '35',
  });
  assert.equal(mockStorage.getItem('brasil_lens_session_v3'), null);
});

test('v5 com Fogo ativo abre o Meio ambiente; as outras abas abrem o Clima', () => {
  mockStorage.setItem(
    'brasil_lens_session_v5',
    JSON.stringify({ dataContext: 'climate_environmental', activeThematicLayer: 'fire' }),
  );
  assert.deepEqual(loadSessionState(), { dataContext: 'environment', environmentLayer: 'fire' });
  assert.equal(mockStorage.getItem('brasil_lens_session_v5'), null);
  mockStorage.clear();
  mockStorage.setItem(
    'brasil_lens_session_v5',
    JSON.stringify({
      dataContext: 'climate_environmental',
      activeThematicLayer: 'rainfall',
      showHydrography: false,
    }),
  );
  assert.deepEqual(loadSessionState(), {
    dataContext: 'climate',
    activeThematicLayer: 'rainfall',
    showHydrography: false,
  });
});

test('camada do Meio ambiente é validada', () => {
  saveSessionState({ dataContext: 'environment', environmentLayer: 'forest' });
  assert.deepEqual(loadSessionState(), { dataContext: 'environment', environmentLayer: 'forest' });
  mockStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ environmentLayer: 'lava' }));
  assert.deepEqual(loadSessionState(), {});
});

test('contexto e seleção socioeconômica são validados e preservam clima', () => {
  saveSessionState({
    activeThematicLayer: 'rainfall',
    dataContext: 'socioeconomic',
    socioeconomic: { indicatorKey: 'gdp', year: '2022' },
  });
  assert.deepEqual(loadSessionState(), {
    activeThematicLayer: 'rainfall',
    dataContext: 'socioeconomic',
    socioeconomic: { indicatorKey: 'gdp', year: '2022' },
  });
  mockStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      dataContext: 'inválido',
      socioeconomic: { indicatorKey: 'gdp', year: '5000' },
      activeThematicLayer: 'rainfall',
    }),
  );
  assert.deepEqual(loadSessionState(), { activeThematicLayer: 'rainfall' });
});

test('migra a sessão v4 e persiste Política com seleções válidas', () => {
  mockStorage.setItem(
    'brasil_lens_session_v4',
    JSON.stringify({
      dataContext: 'socioeconomic',
      socioeconomic: { indicatorKey: 'population', year: '2022' },
      selectedCode: '3550308',
    }),
  );
  assert.equal(loadSessionState().selectedCode, '3550308');
  assert.equal(mockStorage.getItem('brasil_lens_session_v4'), null);
  const political = {
    category: 'elections',
    office: 'president',
    year: 2026,
    round: 1,
    metric: 'leading_candidate',
  };
  saveSessionState({ dataContext: 'political', political });
  assert.deepEqual(loadSessionState().political, political);
  mockStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ political: { ...political, year: 1900 } }),
  );
  assert.equal(loadSessionState().political, undefined);
});

test('a aba Umidade do Clima é persistida', () => {
  saveSessionState({ dataContext: 'climate', activeThematicLayer: 'humidity' });
  assert.deepEqual(loadSessionState(), { dataContext: 'climate', activeThematicLayer: 'humidity' });
});

test('o contexto Transporte guarda aba e tipo de rodovia; valores inválidos caem', () => {
  const transport = { tab: 'waterways', roads: 'state' };
  saveSessionState({ dataContext: 'transport', transport });
  assert.deepEqual(loadSessionState(), { dataContext: 'transport', transport });
  mockStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ dataContext: 'transport', transport: { ...transport, roads: 'x' } }),
  );
  assert.deepEqual(loadSessionState(), { dataContext: 'transport' });
});

test('o contexto Educação guarda rede, tipo e ano; valores inválidos caem', () => {
  const education = { network: 'state', kind: 'college', year: '2022' };
  saveSessionState({ dataContext: 'education', education });
  assert.deepEqual(loadSessionState(), { dataContext: 'education', education });
  mockStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ dataContext: 'education', education: { network: 'public', kind: 'all', year: '2022' } }),
  );
  assert.deepEqual(loadSessionState(), { dataContext: 'education' });
});
