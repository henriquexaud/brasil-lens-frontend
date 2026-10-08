import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { SocioeconomicApp, presentationFor, useDataContext, SESSION_STORAGE_KEY } = await loadModule(`
  export { default as SocioeconomicApp } from './src/features/socioeconomic/SocioeconomicApp';
  export { presentationFor } from './src/features/socioeconomic/presentation';
  export { useDataContext } from './src/app/useDataContext';
  export { SESSION_STORAGE_KEY } from './src/lib/sessionStorage';
`, { stubs: {
  '@/features/map/MapView': `import { createElement } from 'react'; export const MapView = (props) => { globalThis.mapProps = props; return createElement('div', {id:'map'}); };`,
  '@/features/map/useTerritoryMap': `export const useTerritoryMap = () => globalThis.geography;`,
  '@/features/map/useNationalMunicipalData': `export const useNationalMunicipalData = (props) => { globalThis.nationalProps = props; return globalThis.nationalState; };`,
  '@/features/search/SearchBox': `export const SearchBox = () => null;`,
  '@/features/follow/FollowedMunicipalitiesPanel': `export const FollowedMunicipalitiesPanel = () => null;`,
  '@/features/auth/AccountMenu': `export const AccountMenu = () => null;`,
  '@/components/ThemeSwitch': `export const ThemeSwitch = () => null;`,
  '@/app/useMobileSheet': `export const useMobileSheet = () => ({ slotRef: null, headerRef: null, headerProps: {}, collapsed: false, toggle() {} });`,
} });
const indicator = (key, supportedLevels = ['country','region','state','municipality']) => ({
  key, name: ({population:'População', population_density:'Densidade populacional', urban_population:'População urbana', gdp:'PIB total', gdp_per_capita:'PIB per capita', area_km2:'Área territorial', household_income_per_capita:'Renda domiciliar per capita', unemployment_rate:'Taxa de desemprego'})[key],
  unit: key === 'population' || key === 'urban_population' ? 'people' : key === 'area_km2' ? 'km2' : key === 'population_density' ? 'people/km2' : key === 'unemployment_rate' ? '%' : 'BRL', origin: 'sourced', decimalPlaces: 0,
  availableYears: [2022, 2024], latestYear: 2024, description: 'Fonte IBGE', supportedLevels,
});
const catalog = [indicator('population'), indicator('urban_population'), indicator('population_density'), indicator('gdp'), indicator('gdp_per_capita'), indicator('area_km2'), indicator('household_income_per_capita', ['country','region','state']), indicator('unemployment_rate', ['country','region','state'])];
const response = (key = 'population', year = 'latest', level = 'state', parent = null) => ({
  level, parent, indicator: { ...catalog.find(item => item.key === key), year: year === 'latest' ? catalog.find(item => item.key === key).latestYear : Number(year), requestedYear: year },
  statistics: { min: 0, max: 100, mean: 50, median: 50, count: 2, missing: 1 },
  classification: { method: 'quantile', scope: 'national', min: 0, max: 100, classes: 10, breaks: Array.from({length: 10}, (_, i) => (i + 1) * 10) },
  values: [{ibgeCode:'35',value:0,classIndex:0}, {ibgeCode:'33',value:100,classIndex:9}, {ibgeCode:'99',value:null,classIndex:null}], version:'1',
});
let root, client, calls;
const stored = () => JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
beforeEach(() => {
  window.sessionStorage.clear(); calls = [];
  globalThis.nationalState = {};
  globalThis.geography = { collection: {features:[], scope:{level:'state',parent:null}}, scopeReady:true, territoryReady:true,
    mapLayer:{isFetching:false}, statesOutlineLayer:{}, selectedBoundary:{isFetching:false}, visibleMunicipalities:{} };
  globalThis.fetch = async url => {
    const parsed = new URL(url); calls.push(parsed);
    let body;
    if (parsed.pathname.endsWith('/indicators')) body = { indicators:catalog,version:'1' };
    else if (parsed.pathname.endsWith('/values')) body = response(parsed.searchParams.get('indicator'), parsed.searchParams.get('year'), parsed.searchParams.get('level'), parsed.searchParams.get('parent'));
    else body = { ibgeCode:'BR',name:'Brasil',level:'country',parent:null,bbox:null,capital:null,indicators:catalog.map(item=>({...item,value:100,year:2024,source:'IBGE'})) };
    return new Response(JSON.stringify(body), { status:200,headers:{'Content-Type':'application/json'} });
  };
  client = new QueryClient({ defaultOptions:{ queries:{retry:false,gcTime:Infinity} } });
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); });
after(async () => { dom.window.close(); await disposeHarness(); });
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve,35)); }); }
async function render() { await act(async () => root.render(h(QueryClientProvider,{client},h(SocioeconomicApp,{contextControl:null})))); await settle(); await settle(); }
async function click(text) { const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes(text)); assert.ok(button,text); await act(async()=>button.click()); await settle(); }

test('zero tem cor e texto; ausência fica neutra, sem inventar valor', () => {
  const presentation = presentationFor(response());
  assert.equal(presentation.colors.get('35'),'#EAF6ED');
  assert.equal(presentation.colors.get('33'),'#0B6B33');
  assert.match(presentation.colors.get('99'),/var\(--map-neutral/);
  assert.equal(presentation.values.has('35'),true);
  assert.equal(presentation.values.has('99'),false);
  assert.equal(presentation.tooltips.get('35').value,'0 hab.');
  assert.equal(presentation.tooltips.get('99').value,'sem dado');
  assert.equal(presentationFor(response('gdp')).colors.get('35'),'#EDF7F5');
  for (const key of ['area_km2','household_income_per_capita','unemployment_rate']) {
    assert.equal(presentationFor(response(key)).colors.get('35'),'#EEF3FB');
    assert.equal(presentationFor(response(key)).colors.get('33'),'#24548D');
  }
});

test('dez faixas têm cores distintas e a legenda acompanha o mapa em todas as categorias', async () => {
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith('/values')) {
      const body = parsed.pathname.endsWith('/indicators')
        ? { indicators: catalog, version: '1' }
        : { ibgeCode: 'BR', name: 'Brasil', level: 'country', indicators: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }
    const body = response(parsed.searchParams.get('indicator'));
    body.classification = { method: 'quantile', scope: 'national', min: 0, max: 100,
      classes: 10, breaks: Array.from({length: 10}, (_, i) => (i + 1) * 10) };
    body.values = Array.from({length: 10}, (_, i) => ({ibgeCode: String(i), value: i * 10, classIndex: i}));
    return new Response(JSON.stringify(body), { status: 200 });
  };
  await render();
  for (const category of ['População', 'Economia', 'Outros']) {
    await click(category);
    const colors = [...document.querySelectorAll('.scale-legend-segment')].map(item => item.style.backgroundColor);
    assert.equal(colors.length, 10);
    assert.equal(new Set(colors).size, 10);
    const mapColors = [...globalThis.mapProps.presentation.colors.values()];
    assert.equal(new Set(mapColors).size, 10);
    mapColors.forEach((color, index) => {
      const swatch = document.createElement('span');
      swatch.style.background = color;
      assert.equal(colors[index], swatch.style.background);
    });
  }
});

test('menu alterna indicador e ano diretamente, sem Ajustes, e só consulta o domínio socioeconômico', async () => {
  await render();
  assert.deepEqual([...document.querySelectorAll('[role=tab]')].map(item=>item.textContent),['População','Economia','Outros']);
  assert.equal(globalThis.nationalProps.weatherEnabled,false);
  await click('Economia');
  assert.equal(globalThis.mapProps.presentation.colors.get('35'),'#EDF7F5');
  assert.equal([...document.querySelectorAll('button')].some(item => item.textContent.includes('Ajustes')), false);
  assert.equal(document.querySelector('.indicator-extra-panel'), null);
  assert.equal(document.querySelector('.source-tag').title, 'Fonte IBGE');
  const year = document.querySelector('.layer-metadata #year'); assert.ok(year);
  assert.equal(year.getAttribute('aria-label'), 'Ano de referência');
  await act(async()=>{ year.value='2022'; year.dispatchEvent(new window.Event('change',{bubbles:true})); });
  await settle();
  assert.ok(calls.some(url=>url.searchParams.get('indicator')==='gdp' && url.searchParams.get('year')==='2022'));
  assert.equal(stored().socioeconomic.year,'2022');
  assert.equal(calls.some(url=>/weather|fire-hotspots|hydrography/.test(url.pathname)),false);
});

test('PNAD municipal informa ausência de cobertura e não prepara o mosaico', async () => {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({ scope:{level:'municipality',parent:'35',parentName:'São Paulo'}, socioeconomic:{indicatorKey:'household_income_per_capita',year:'latest'} }));
  await render();
  assert.match(document.body.textContent,/sem cobertura municipal/);
  assert.equal(globalThis.nationalProps.enabled,false);
  assert.equal(calls.some(url=>url.pathname.endsWith('/values') && !url.searchParams.get('parent')),false);
});

test('trocar contexto preserva preferências climáticas e território', async () => {
  const state = { dataContext:'climate_environmental', activeThematicLayer:'rainfall', showHydrography:false, selectedCode:'3550308' };
  window.sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify(state));
  function Probe() { return useDataContext().control; }
  await act(async()=>root.render(h(Probe)));
  const select = document.querySelector('#data-context');
  await act(async()=>{ select.value='socioeconomic'; select.dispatchEvent(new window.Event('change',{bubbles:true})); });
  assert.deepEqual(stored(), {...state,dataContext:'socioeconomic'});
  await act(async()=>{ select.value='climate_environmental'; select.dispatchEvent(new window.Event('change',{bubbles:true})); });
  assert.deepEqual(stored(),state);
});

async function openDetails() {
  const details = document.querySelector('.territory-details');
  assert.ok(details);
  await act(async()=>{
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  await settle();
}

test('Mais detalhes mostra apenas a categoria ativa e fica oculto em Outros', async () => {
  await render();
  await openDetails();
  assert.deepEqual([...document.querySelectorAll('.indicator-row dt')].map(item=>item.firstChild.textContent),['População urbana','Densidade populacional']);
  await click('Economia');
  assert.equal(document.querySelector('.territory-details').open,false);
  await openDetails();
  assert.deepEqual([...document.querySelectorAll('.indicator-row dt')].map(item=>item.firstChild.textContent),['PIB per capita']);
  await click('Outros');
  assert.equal(document.querySelector('.territory-details'),null);
  assert.equal(globalThis.mapProps.presentation.colors.get('35'),'#EEF3FB');
});

test('resumo aguarda os valores e consulta somente o ano resolvido', async () => {
  const fetch = globalThis.fetch;
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  globalThis.fetch = async url=>{
    if(new URL(url).pathname.includes('/territories/')) await gate;
    return fetch(url);
  };
  await render();
  assert.equal(document.querySelector('.featured-value').textContent,'Carregando…');
  release();
  await settle();
  assert.equal(document.querySelector('.featured-value').textContent,'100 hab.');
  const overviews = calls.filter(url=>url.pathname.includes('/territories/'));
  assert.equal(overviews.length,1);
  assert.equal(overviews[0].searchParams.get('year'),'2024');
});

test('seleção com valor e identificação no mapa evita consultar o resumo', async () => {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({selectedCode:'35'}));
  globalThis.geography.selectedFeature = { properties:{name:'São Paulo',level:'state',ibgeCode:'35'} };
  await render();
  assert.equal(document.querySelector('.featured-value').textContent,'0 hab.');
  assert.equal(calls.some(url=>url.pathname.includes('/territories/')),false);
  await openDetails();
  assert.equal(calls.filter(url=>url.pathname.includes('/territories/')).length,1);
});

test('prefetch e troca de indicador usam o mesmo ano disponível', async () => {
  const gdp = catalog.find(item=>item.key==='gdp');
  const previous = { availableYears:gdp.availableYears,latestYear:gdp.latestYear };
  gdp.availableYears = [2022]; gdp.latestYear = 2022;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({socioeconomic:{indicatorKey:'population',year:'2024'}}));
    await render();
    const button = [...document.querySelectorAll('[role=tab]')].find(item=>item.textContent==='Economia');
    await act(async()=>button.dispatchEvent(new window.FocusEvent('focusin',{bubbles:true})));
    await settle();
    await click('Economia');
    const requests = calls.filter(url=>url.pathname.endsWith('/values') && url.searchParams.get('indicator')==='gdp' && url.searchParams.get('level')==='state');
    assert.equal(requests.length,1);
    assert.equal(requests[0].searchParams.get('year'),'latest');
    assert.equal(stored().socioeconomic.year,'latest');
  } finally { Object.assign(gdp,previous); }
});

test('ano da sessão indisponível é corrigido antes de consultar valores', async () => {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({socioeconomic:{indicatorKey:'population',year:'2020'}}));
  await render();
  const requests = calls.filter(url=>url.pathname.endsWith('/values'));
  assert.ok(requests.length>0);
  assert.ok(requests.every(url=>url.searchParams.get('year')==='latest'));
});

test('falha da malha dentro da UF oferece nova tentativa na consulta correta', async () => {
  const attempts = [];
  const invalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = (options)=>{attempts.push(options.queryKey); return invalidate(options);};
  window.sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({scope:{level:'municipality',parent:'35',parentName:'São Paulo'}}));
  globalThis.geography.mapLayer = { error:new Error('Malha indisponível') };
  await render();
  assert.match(document.body.textContent,/Não foi possível carregar os dados/);
  await click('Tentar novamente');
  assert.deepEqual(attempts,[['map','municipality','35']]);
});

test('mosaico preserva a apresentação ao ocultar a aba e voltar de uma UF', async () => {
  globalThis.nationalState = {mesh:{states:{features:[]},municipalities:[]}};
  await render();
  for (let attempt=0;attempt<5 && !globalThis.mapProps.nationalMosaic;attempt++) await settle();
  assert.ok(globalThis.mapProps.nationalMosaic);
  const presentation = globalThis.mapProps.nationalMosaic.presentation;
  try {
    await act(async()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new window.Event('visibilitychange'));
    });
    assert.equal(globalThis.mapProps.nationalMosaic.presentation,presentation);
    assert.equal(globalThis.mapProps.nationalMosaicPaused,true);
  } finally {
    await act(async()=>{
      delete document.visibilityState;
      document.dispatchEvent(new window.Event('visibilitychange'));
    });
  }
  await act(async()=>globalThis.mapProps.onDrillDown('35','São Paulo'));
  await settle();
  assert.equal(globalThis.mapProps.nationalMosaic,undefined);
  await click('Brasil');
  assert.equal(globalThis.mapProps.nationalMosaic.presentation,presentation);
});
