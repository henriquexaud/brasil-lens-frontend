import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useMapScope, useAppPreferences, SESSION_STORAGE_KEY } = await loadModule(`
  export { useMapScope } from './src/features/map/useMapScope';
  export { useAppPreferences } from './src/app/useAppPreferences';
  export { SESSION_STORAGE_KEY } from './src/lib/sessionStorage';
`);

after(disposeHarness);

let root;
beforeEach(() => window.sessionStorage.clear());
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
});

async function renderHook(useHook) {
  const ref = { current: undefined };
  function Probe() {
    ref.current = useHook();
    return null;
  }
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(Probe)));
  return ref;
}

const stored = () => JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
const seed = (state) => window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));

test('sem sessão, o mapa abre no Brasil sem seleção', async () => {
  const hook = await renderHook(useMapScope);
  assert.deepEqual(hook.current.scope, { level: 'state', parent: null, parentName: null });
  assert.equal(hook.current.selectedCode, null);
  assert.equal(hook.current.isDrilledDown, false);
});

test('a sessão restaura a UF aberta e o município selecionado', async () => {
  seed({
    scope: { level: 'municipality', parent: '35', parentName: 'São Paulo' },
    selectedCode: '3550308',
  });
  const hook = await renderHook(useMapScope);
  assert.deepEqual(hook.current.scope, { level: 'municipality', parent: '35', parentName: 'São Paulo' });
  assert.equal(hook.current.selectedCode, '3550308');
  assert.equal(hook.current.isDrilledDown, true);
});

test('sessão adulterada não quebra a carga: volta ao Brasil', async () => {
  seed({ scope: { level: 'municipality', parent: '35; DROP' }, selectedCode: '12' + 'x' });
  const hook = await renderHook(useMapScope);
  assert.equal(hook.current.scope.parent, null);
  assert.equal(hook.current.selectedCode, null);
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, '{não é json');
  root && (await act(async () => root.unmount()));
  const again = await renderHook(useMapScope);
  assert.equal(again.current.isDrilledDown, false);
});

test('entrar numa UF limpa a seleção e grava; voltar ao Brasil desfaz', async () => {
  const hook = await renderHook(useMapScope);
  await act(async () => hook.current.setSelectedCode('3550308'));
  assert.equal(stored().selectedCode, '3550308');

  await act(async () => hook.current.drillIntoState('33', 'Rio de Janeiro'));
  assert.deepEqual(hook.current.scope, { level: 'municipality', parent: '33', parentName: 'Rio de Janeiro' });
  assert.equal(hook.current.selectedCode, null, 'a seleção da UF anterior não vaza');
  assert.deepEqual(stored().scope, { level: 'municipality', parent: '33', parentName: 'Rio de Janeiro' });

  await act(async () => hook.current.resetScope());
  assert.equal(hook.current.isDrilledDown, false);
  assert.deepEqual(stored().scope, { level: 'state', parent: null, parentName: null });
});

test('preferências começam em clima com alertas; Meio ambiente começa em desmatamento com rios', async () => {
  const prefs = (await renderHook(() => useAppPreferences('climate'))).current;
  assert.deepEqual(
    [prefs.showClimate, prefs.showRainfall, prefs.showFireHotspots, prefs.weatherLayerActive],
    [true, false, false, true],
  );
  assert.equal(prefs.showWeatherAlerts, true);
  assert.equal(prefs.showHydrography, false, 'rios ficam no Meio ambiente');
  await act(async () => root.unmount());
  root = undefined;

  const environment = (await renderHook(() => useAppPreferences('environment'))).current;
  assert.deepEqual(
    [environment.indicatorLayer, environment.showFireHotspots, environment.weatherLayerActive],
    ['deforestation', false, false],
  );
  assert.equal(environment.showHydrography, true);
  assert.equal(environment.showWeatherAlerts, false, 'avisos ficam no Clima');
});

test('a sessão restaura a aba de cada contexto; valor desconhecido cai no padrão', async () => {
  seed({ environmentLayer: 'fire', showHydrography: false, showWeatherAlerts: false });
  const prefs = (await renderHook(() => useAppPreferences('environment'))).current;
  assert.deepEqual(
    [prefs.showFireHotspots, prefs.indicatorLayer, prefs.showHydrography, prefs.showClimate],
    [true, null, false, false],
  );
  await act(async () => root.unmount());
  root = undefined;

  seed({ activeThematicLayer: 'lava', environmentLayer: 'lava' });
  assert.equal((await renderHook(() => useAppPreferences('climate'))).current.showClimate, true);
  await act(async () => root.unmount());
  root = undefined;
  assert.equal(
    (await renderHook(() => useAppPreferences('environment'))).current.indicatorLayer,
    'deforestation',
  );
});

test('só uma camada temática fica ativa; desligar a ativa deixa nenhuma', async () => {
  const hook = await renderHook(() => useAppPreferences('climate'));

  await act(async () => hook.current.handleToggleRainfall(true));
  assert.deepEqual([hook.current.showRainfall, hook.current.showClimate], [true, false]);
  assert.equal(hook.current.weatherLayerActive, true, 'chuva usa os mesmos dados do clima');
  assert.equal(stored().activeThematicLayer, 'rainfall');

  await act(async () => hook.current.handleToggleRainfall(false));
  assert.deepEqual([hook.current.showClimate, hook.current.showRainfall], [false, false]);
  assert.equal(stored().activeThematicLayer, 'none');
  await act(async () => root.unmount());
  root = undefined;

  const environment = await renderHook(() => useAppPreferences('environment'));
  await act(async () => environment.current.handleEnvironmentLayer('fire'));
  assert.deepEqual([environment.current.showFireHotspots, environment.current.indicatorLayer], [true, null]);
  assert.equal(environment.current.weatherLayerActive, false, 'focos não consultam o clima');
  await act(async () => environment.current.handleEnvironmentLayer('none'));
  assert.equal(environment.current.showFireHotspots, false);
  assert.equal(stored().environmentLayer, 'none');
  assert.equal(stored().activeThematicLayer, 'none', 'a aba do Clima é preservada');
});

test('alertas e hidrografia são persistidos de forma independente da camada temática', async () => {
  const hook = await renderHook(useAppPreferences);
  await act(async () => hook.current.setShowHydrography(false));
  await act(async () => hook.current.setShowWeatherAlerts(false));
  assert.deepEqual(
    [stored().showHydrography, stored().showWeatherAlerts, stored().activeThematicLayer],
    [false, false, 'climate'],
  );
});
