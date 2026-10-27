import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const {
  EducationApp,
  educationPresentation,
  highlightInstitution,
  institutionName,
  normalizeEducation,
  SESSION_STORAGE_KEY,
} = await loadModule(`
  export { default as EducationApp } from './src/features/education/EducationApp';
  export { educationPresentation, highlightInstitution } from './src/features/education/presentation';
  export { institutionName, normalizeEducation } from './src/features/education/education';
  export { SESSION_STORAGE_KEY } from './src/lib/sessionStorage';
`, { stubs: {
  '@/features/map/MapView': `import { createElement } from 'react'; export const MapView = (props) => { globalThis.mapProps = props; return createElement('div', {id:'map'}); };`,
  '@/features/map/useTerritoryMap': `export const useTerritoryMap = () => globalThis.geography;`,
  '@/features/map/useNationalMunicipalData': `export const useNationalMunicipalData = (props) => { globalThis.nationalProps = props; return globalThis.nationalState; };`,
  '@/features/search/SearchBox': `export const SearchBox = () => null;`,
  '@/features/auth/AccountMenu': `export const AccountMenu = () => null;`,
  '@/components/ThemeSwitch': `export const ThemeSwitch = () => null;`,
  './education.css': '',
  '@/app/useMobileSheet': `export const useMobileSheet = () => ({ slotRef: null, headerRef: null, headerProps: {}, collapsed: false, toggle() {} });`,
} });

const KEYS = ['public', 'federal', 'state', 'municipal'].map((network) => `higher_ed_${network}_enrollment`);
const catalog = KEYS.map((key) => ({
  key, name: `Matrículas ${key}`, description: 'Censo da Educação Superior (INEP)', unit: 'enrollments',
  origin: 'sourced', decimalPlaces: 0, availableYears: [2023, 2024], latestYear: 2024,
  supportedLevels: ['country', 'region', 'state', 'municipality'],
}));
const values = (key, year = 'latest') => ({
  level: 'state', parent: null, version: '1',
  indicator: { ...catalog.find((item) => item.key === key), year: 2024, requestedYear: year },
  statistics: { min: 10, max: 100, mean: 55, median: 55, count: 2, missing: 1 },
  classification: { method: 'quantile', scope: 'national', min: 10, max: 100, classes: 10,
    breaks: Array.from({ length: 10 }, (_, i) => (i + 1) * 10) },
  values: [
    { ibgeCode: '31', value: 100, classIndex: 9 },
    { ibgeCode: '35', value: 10, classIndex: 0 },
    { ibgeCode: '11', value: null, classIndex: null },
  ],
});
const institution = (code, name, acronym, category, enrollment) => ({
  code, name, acronym, category, organization: 'university',
  seat: { code: '3106200', name: 'Belo Horizonte', state: 'MG' }, enrollment, courses: 3, municipalities: 1,
});
const territory = (network) => ({
  code: 'BR', name: 'Brasil', year: 2024, availableYears: [2023, 2024], network,
  enrollment: 1500, courses: 40,
  institutions: [
    institution(1, 'UNIVERSIDADE FEDERAL DE MINAS GERAIS - UFMG', 'UFMG', 'federal', 1000),
    institution(2, 'Universidade de São Paulo', 'USP', 'state', 500),
  ],
});
const detail = {
  code: 1, year: 2024, name: 'UNIVERSIDADE FEDERAL DE MINAS GERAIS', acronym: 'UFMG',
  category: 'federal', organization: 'university', seat: { code: '3106200', name: 'Belo Horizonte', state: 'MG' },
  faculty: 3000, staff: 4000, enrollment: 1000, distanceEnrollment: 50, courses: 90,
  campuses: [
    { code: '3106200', name: 'Belo Horizonte', state: 'MG', enrollment: 900, courses: 80, entrants: 1, graduates: 1 },
    { code: '3143302', name: 'Montes Claros', state: 'MG', enrollment: 100, courses: 10, entrants: 1, graduates: 1 },
  ],
};

let root, client, calls;
const stored = () => JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
beforeEach(() => {
  window.sessionStorage.clear(); calls = [];
  globalThis.nationalState = {};
  globalThis.geography = { collection: { features: [], scope: { level: 'state', parent: null } }, scopeReady: true,
    territoryReady: true, mapLayer: { isFetching: false }, statesOutlineLayer: {},
    selectedBoundary: { isFetching: false }, visibleMunicipalities: {} };
  globalThis.fetch = async (url) => {
    const parsed = new URL(url); calls.push(parsed);
    let body;
    if (parsed.pathname.endsWith('/indicators')) body = { indicators: catalog, version: '1' };
    else if (parsed.pathname.endsWith('/values')) body = values(parsed.searchParams.get('indicator'), parsed.searchParams.get('year'));
    else if (parsed.pathname.includes('/education/territories/')) body = territory(parsed.searchParams.get('network'));
    else if (parsed.pathname.includes('/education/institutions/')) body = detail;
    else throw new Error(`rota inesperada ${parsed.pathname}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); });
after(async () => { dom.window.close(); await disposeHarness(); });
async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 35)); }); }
async function render() { await act(async () => root.render(h(QueryClientProvider, { client }, h(EducationApp, { contextControl: null })))); await settle(); await settle(); }
async function click(text) { const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes(text)); assert.ok(button, text); await act(async () => button.click()); await settle(); }

test('nomes em maiúsculas viram nome próprio, sem repetir a sigla; os mistos ficam como vêm', () => {
  assert.equal(institutionName('UNIVERSIDADE FEDERAL DE MINAS GERAIS - UFMG', 'UFMG'), 'Universidade Federal de Minas Gerais');
  assert.equal(institutionName('INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA  DO RIO GRANDE DO NORTE', 'IFRN'),
    'Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte');
  assert.equal(institutionName('UNIVERSIDADE FEDERAL RURAL DO SEMI-ÁRIDO', 'UFERSA'), 'Universidade Federal Rural do Semi-Árido');
  // Depois do hífen vem uma cidade, não a sigla: fica.
  assert.equal(institutionName('FACULDADE DE TECNOLOGIA NILO DE STÉFANI - JABOTICABAL', 'FATEC JBL'),
    'Faculdade de Tecnologia Nilo de Stéfani - Jaboticabal');
  assert.equal(institutionName('Academia Militar das Agulhas Negras', 'AMAN'), 'Academia Militar das Agulhas Negras');
});

test('preferências guardadas só valem com rede e ano conhecidos', () => {
  assert.deepEqual(normalizeEducation({ network: 'federal', year: '2023' }), { network: 'federal', year: '2023' });
  assert.equal(normalizeEducation({ network: 'private', year: 'latest' }), undefined);
  assert.equal(normalizeEducation({ network: 'state', year: 'ontem' }), undefined);
});

test('sem valor é sem oferta presencial, não falta de dado; a instituição apaga o resto do mapa', () => {
  const base = educationPresentation(values(KEYS[0]));
  assert.equal(base.colors.get('31'), '#3C2878');
  assert.equal(base.colors.get('35'), '#F3F0FA');
  assert.match(base.colors.get('11'), /var\(--map-neutral/);
  assert.equal(base.tooltips.get('11').value, 'Sem oferta presencial');
  const highlighted = highlightInstitution(base, detail);
  // No Brasil, a UF de um campus continua pintada; as outras ficam neutras.
  assert.equal(highlighted.colors.get('31'), '#3C2878');
  assert.match(highlighted.colors.get('35'), /var\(--map-neutral/);
  assert.deepEqual([...highlighted.values], ['31']);
  assert.notEqual(highlighted.key, base.key);
});

test('o contexto pinta matrículas, lista instituições e abre o detalhe de uma delas', async () => {
  await render();
  assert.deepEqual([...document.querySelectorAll('[role=tab]')].map((item) => item.textContent),
    ['Públicas', 'Federais', 'Estaduais', 'Municipais']);
  assert.equal(document.querySelector('.source-tag').textContent, 'INEP');
  assert.ok(calls.some((url) => url.pathname.endsWith('/values') && url.searchParams.get('context') === 'education'
    && url.searchParams.get('indicator') === KEYS[0]));
  assert.equal(globalThis.nationalProps.weatherEnabled, false);
  assert.equal(calls.some((url) => /weather|fire-hotspots|hydrography|transport/.test(url.pathname)), false);
  assert.match(document.querySelector('.scale-legend-missing').textContent, /Sem oferta presencial · 1 território/);
  const names = [...document.querySelectorAll('.education-institution-name')].map((item) => item.textContent);
  assert.deepEqual(names, ['Universidade Federal de Minas Gerais', 'Universidade de São Paulo']);

  await click('Universidade Federal de Minas Gerais');
  assert.ok(calls.some((url) => url.pathname.endsWith('/education/institutions/1')));
  assert.match(document.querySelector('.detail-kicker').textContent, /Federal · Universidade · UFMG/);
  assert.match(document.body.textContent, /Montes Claros · MG/);
  assert.match(document.body.textContent, /Matrículas a distância/);
  assert.match(globalThis.mapProps.presentation.key, /institution:1$/);

  await act(async () => document.querySelector('[aria-label="Fechar instituição"]').click());
  await settle();
  assert.doesNotMatch(globalThis.mapProps.presentation.key, /institution/);
  await click('Federais');
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === KEYS[1]));
  assert.ok(calls.some((url) => url.pathname.includes('/education/territories/BR') && url.searchParams.get('network') === 'federal'));
  assert.deepEqual(stored().education, { network: 'federal', year: 'latest' });
});
