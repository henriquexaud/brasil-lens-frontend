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
  schoolName,
  SESSION_STORAGE_KEY,
} = await loadModule(`
  export { default as EducationApp } from './src/features/education/EducationApp';
  export { educationPresentation, highlightInstitution } from './src/features/education/presentation';
  export { institutionName, normalizeEducation, schoolName } from './src/features/education/education';
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

const KEYS = ['federal', 'state', 'municipal'].flatMap((network) =>
  ['', 'university_', 'institute_', 'college_'].map((kind) => `higher_ed_${network}_${kind}enrollment`));
// Como no Censo: não há instituto estadual nem municipal.
const catalog = KEYS.map((key) => {
  const empty = /(state|municipal)_institute/.test(key);
  return {
    key, name: `Matrículas ${key}`, description: 'Censo da Educação Superior (INEP)', unit: 'enrollments',
    origin: 'sourced', decimalPlaces: 0, availableYears: empty ? [] : [2023, 2024], latestYear: empty ? null : 2024,
    supportedLevels: ['country', 'region', 'state', 'municipality'],
  };
});
const BASIC = {
  basic_schools: ['schools', 0, 137020], basic_enrollment: ['enrollments', 0, 36772996],
  basic_early_childhood_schools: ['schools', 0, 76523], basic_early_childhood_enrollment: ['enrollments', 0, 6912034],
  basic_early_childhood_coverage: ['%', 1, 44.5],
};
for (const stage of ['elementary', 'high_school']) {
  BASIC[`basic_${stage}_schools`] = ['schools', 0, 1000];
  BASIC[`basic_${stage}_enrollment`] = ['enrollments', 0, 50000];
  if (stage === 'high_school') BASIC.basic_high_school_coverage = ['%', 1, 104.2];
}
for (const [key, [unit, decimalPlaces]] of Object.entries(BASIC)) {
  const years = key.endsWith('_coverage') ? [2022, 2023, 2024, 2025] : [2019, 2024, 2025];
  catalog.push({ key, name: key, description: 'Censo Escolar (INEP)', unit, origin: 'sourced', decimalPlaces,
    availableYears: years, latestYear: 2025, supportedLevels: ['country', 'region', 'state', 'municipality'] });
}
const overview = (code) => ({
  ibgeCode: code, name: code === 'BR' ? 'Brasil' : code, level: code === 'BR' ? 'country' : 'state', parentCode: null,
  parentName: null, bbox: null,
  indicators: Object.entries(BASIC).map(([key, [unit, decimalPlaces, value]]) => ({
    key, name: key, unit, decimalPlaces, origin: 'sourced', value: Math.round(value * 10) / 10, year: 2025, source: null })),
});
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
const territory = (network, kind) => ({
  code: 'BR', name: 'Brasil', year: 2024, availableYears: [2023, 2024], network, kind,
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

// 25 escolas: a busca aparece acima de 20. No médio, só a estadual.
const schoolList = (code, stage) => ({
  code, name: 'Belo Horizonte', year: 2025, stage,
  schools: (stage === 'high_school' ? [0] : Array.from({ length: 25 }, (_, i) => i)).map((i) => ({
    code: i + 1,
    name: i === 0 ? 'EE GOVERNADOR MILTON CAMPOS' : i === 1 ? 'EMEF JOAO XXIII DE OLIVEIRA' : `EM ESCOLA ${i}`,
    network: i === 0 ? 'state' : 'municipal',
    enrollment: 1000 - i,
  })),
});

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
    else if (parsed.pathname.includes('/education/territories/')) body = territory(parsed.searchParams.get('network'), parsed.searchParams.get('kind'));
    else if (parsed.pathname.includes('/education/institutions/')) body = detail;
    else if (parsed.pathname.includes('/education/schools/')) body = schoolList(parsed.pathname.split('/').pop(), parsed.searchParams.get('stage'));
    else if (parsed.pathname.includes('/socioeconomic/territories/')) body = overview(parsed.pathname.split('/').pop());
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
const pills = () => [...document.querySelectorAll('.indicator-pill-btn')].map((item) => item.textContent);

test('nomes em maiúsculas viram nome próprio, sem repetir a sigla; os mistos ficam como vêm', () => {
  assert.equal(institutionName('UNIVERSIDADE FEDERAL DE MINAS GERAIS - UFMG', 'UFMG'), 'Universidade Federal de Minas Gerais');
  assert.equal(institutionName('INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA  DO RIO GRANDE DO NORTE', 'IFRN'),
    'Instituto Federal do Rio Grande do Norte');
  assert.equal(institutionName('INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA BAIANO', 'IF BAIANO'), 'Instituto Federal Baiano');
  assert.equal(institutionName('UNIVERSIDADE FEDERAL RURAL DO SEMI-ÁRIDO', 'UFERSA'), 'Universidade Federal Rural do Semi-Árido');
  // Depois do hífen vem uma cidade, não a sigla: fica.
  assert.equal(institutionName('FACULDADE DE TECNOLOGIA NILO DE STÉFANI - JABOTICABAL', 'FATEC JBL'),
    'Faculdade de Tecnologia Nilo de Stéfani - Jaboticabal');
  assert.equal(institutionName('Academia Militar das Agulhas Negras', 'AMAN'), 'Academia Militar das Agulhas Negras');
});

test('escolas: siglas do tipo, de órgão e números romanos ficam em maiúsculas', () => {
  assert.equal(schoolName('COLEGIO TIRADENTES PMMG - UNIDADE ARGENTINO MADEIRA'), 'Colegio Tiradentes PMMG - Unidade Argentino Madeira');
  assert.equal(schoolName('CEU CEI JARDIM PAULISTANO'), 'CEU CEI Jardim Paulistano');
  assert.equal(schoolName('EM  ESCOLA EM TEMPO INTEGRAL'), 'EM Escola em Tempo Integral');
  assert.equal(schoolName('E M PROF JOAO XXIII'), 'E M Prof Joao XXIII');
});

test('preferências guardadas só valem com rede, tipo e ano conhecidos', () => {
  // Sessão de antes da educação básica: abre no ensino superior, com as métricas padrão.
  assert.deepEqual(normalizeEducation({ network: 'federal', kind: 'institute', year: '2023' }),
    { level: 'higher', network: 'federal', kind: 'institute', stage: 'all', metric: 'schools', year: '2023' });
  // As abas Creches e Escolas da primeira versão viram etapa e medida da Básica.
  const legacy = (fields) => normalizeEducation({ network: 'state', kind: 'all', year: 'latest', ...fields });
  assert.deepEqual([legacy({ level: 'daycare', daycare: 'units' })].map(({ level, stage, metric }) => [level, stage, metric]),
    [['basic', 'early_childhood', 'schools']]);
  // Creche e pré-escola viraram a educação infantil, com a medida preservada.
  assert.deepEqual([legacy({ level: 'basic', stage: 'daycare', metric: 'coverage' })].map(({ stage, metric }) => [stage, metric]),
    [['early_childhood', 'coverage']]);
  assert.equal(legacy({ level: 'basic', stage: 'preschool', metric: 'enrollment' }).stage, 'early_childhood');
  assert.equal(legacy({ level: 'daycare', daycare: 'coverage' }).metric, 'coverage');
  assert.deepEqual([legacy({ level: 'schools', schools: 'enrollment' })].map(({ stage, metric }) => [stage, metric]),
    [['all', 'enrollment']]);
  // Atendimento não existe em Todas.
  assert.equal(legacy({ level: 'basic', stage: 'all', metric: 'coverage' }).metric, 'schools');
  assert.equal(legacy({ level: 'pós' }).level, 'higher');
  // A rede "public" saiu do switch: sessão antiga volta ao padrão.
  assert.equal(normalizeEducation({ network: 'public', kind: 'all', year: 'latest' }), undefined);
  assert.equal(normalizeEducation({ network: 'state', year: '2023' }), undefined);
  assert.equal(normalizeEducation({ network: 'state', kind: 'all', year: 'ontem' }), undefined);
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
  assert.deepEqual([...document.querySelectorAll('[role=tab]')].map((item) => item.textContent), ['Básica', 'Superior']);
  await click('Superior');
  assert.deepEqual(pills(), ['Federais', 'Estaduais', 'Municipais', 'Todas', 'Universidades', 'Institutos', 'Faculdades']);
  assert.equal(document.querySelector('.source-tag').textContent, 'INEP');
  assert.ok(calls.some((url) => url.pathname.endsWith('/values') && url.searchParams.get('context') === 'education'
    && url.searchParams.get('indicator') === KEYS[0]));
  assert.equal(globalThis.nationalProps.weatherEnabled, false);
  assert.equal(calls.some((url) => /weather|fire-hotspots|hydrography|transport/.test(url.pathname)), false);
  assert.match(document.querySelector('.scale-legend-missing').textContent, /Sem oferta presencial · 1 território/);
  const names = [...document.querySelectorAll('.education-institution-name')].map((item) => item.textContent);
  assert.deepEqual(names, ['Universidade Federal de Minas GeraisUFMG', 'Universidade de São PauloUSP']);
  assert.match(document.querySelector('.education-summary').textContent, /2 instituições · 40 cursos/);
  // A lista de instituições substitui o ranking de territórios.
  assert.equal(document.querySelector('.territory-ranking'), null);

  await click('Universidade Federal de Minas Gerais');
  assert.ok(calls.some((url) => url.pathname.endsWith('/education/institutions/1')));
  assert.match(document.querySelector('.detail-kicker').textContent, /Federal · Universidade · UFMG/);
  assert.match(document.body.textContent, /Montes ClarosMG/);
  assert.match(document.querySelector('.education-summary').textContent, /90 cursos · 2 municípios/);
  assert.match(document.body.textContent, /Matrículas a distância/);
  assert.match(globalThis.mapProps.presentation.key, /institution:1$/);

  await act(async () => document.querySelector('[aria-label="Fechar instituição"]').click());
  await settle();
  assert.doesNotMatch(globalThis.mapProps.presentation.key, /institution/);
  await click('Institutos');
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === 'higher_ed_federal_institute_enrollment'));
  assert.ok(calls.some((url) => url.pathname.includes('/education/territories/BR')
    && url.searchParams.get('network') === 'federal' && url.searchParams.get('kind') === 'institute'));
  assert.deepEqual(stored().education,
    { level: 'higher', network: 'federal', kind: 'institute', stage: 'all', metric: 'schools', year: 'latest' });

  // Estaduais não têm instituto: o filtro some e volta a Todas.
  await click('Estaduais');
  assert.deepEqual(pills(), ['Federais', 'Estaduais', 'Municipais', 'Todas', 'Universidades', 'Faculdades']);
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === 'higher_ed_state_enrollment'));
  assert.equal(stored().education.network, 'state');
  assert.equal(stored().education.kind, 'all');
});

test('a básica abre por etapa e medida, com atendimento só na infantil e no médio', async () => {
  await render();
  // Sessão nova abre na Básica · Todas · Escolas, sem Atendimento (Todas não tem idade).
  assert.deepEqual(pills(), ['Todas', 'Infantil', 'Fundamental', 'Médio', 'Escolas', 'Matrículas']);
  assert.ok(calls.some((url) => url.pathname.endsWith('/values') && url.searchParams.get('indicator') === 'basic_schools'));
  assert.ok(calls.some((url) => url.pathname.endsWith('/socioeconomic/territories/BR')
    && url.searchParams.get('context') === 'education'));
  assert.match(document.querySelector('.indicator-label').textContent, /Escolas públicas/);
  assert.match(document.querySelector('.featured-value').textContent, /137\.020/);
  assert.match(document.querySelector('.education-summary').textContent, /^36\.772\.996 matrículas$/);
  assert.equal(document.querySelector('.layer-metadata-unit').textContent, 'escolas');
  // Sem valor na básica é falta de dado, não "sem oferta".
  assert.match(document.querySelector('.scale-legend-missing').textContent, /Sem dados · 1 território/);
  assert.equal(globalThis.mapProps.presentation.tooltips.get('11').value, 'Sem dados');

  await click('Infantil');
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === 'basic_early_childhood_schools'));
  assert.match(document.querySelector('.indicator-label').textContent, /Escolas com educação infantil/);
  assert.match(document.querySelector('.education-summary').textContent, /6\.912\.034 matrículas · atendimento de 44,5%/);

  await click('Atendimento');
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === 'basic_early_childhood_coverage'));
  assert.deepEqual([...document.querySelectorAll('.source-tag')].map((item) => item.textContent), ['INEP']);
  assert.equal(document.querySelector('.layer-metadata-unit').textContent, '% de 0 a 5 anos');
  assert.match(document.querySelector('.indicator-label').textContent, /Atendimento na educação infantil/);
  assert.match(document.querySelector('.featured-value').textContent, /44,5%/);

  // A medida segue na troca de etapa; acima de 100%, o painel explica.
  await click('Médio');
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === 'basic_high_school_coverage'));
  assert.equal(document.querySelector('.layer-metadata-unit').textContent, '% de 15 a 17 anos');
  assert.match(document.body.textContent, /fora da idade/);

  // Fundamental (e Todas) não tem Atendimento: a pílula some e o mapa volta a Escolas.
  await click('Fundamental');
  assert.deepEqual(pills().slice(4), ['Escolas', 'Matrículas']);
  assert.ok(calls.some((url) => url.searchParams.get('indicator') === 'basic_elementary_schools'));
  assert.equal(stored().education.metric, 'schools');
  assert.equal(document.querySelectorAll('.source-tag').length, 1);
  await click('Todas');
  assert.deepEqual(pills().slice(4), ['Escolas', 'Matrículas']);
});

test('trocar para a Básica fecha a instituição aberta no Superior', async () => {
  await render();
  await click('Superior');
  await click('Universidade Federal de Minas Gerais');
  assert.match(globalThis.mapProps.presentation.key, /institution:1$/);
  await click('Básica');
  assert.doesNotMatch(globalThis.mapProps.presentation.key, /institution/);
  assert.equal(stored().education.level, 'basic');
});

test('na básica, o município lista as escolas da etapa, com busca e nome legível', async () => {
  await render();
  // No Brasil e na UF, a lista seria de milhares: o painel aponta o município.
  assert.match(document.querySelector('.education-schools-hint').textContent, /Abra um município/);
  assert.ok(!calls.some((url) => url.pathname.includes('/education/schools/')));

  await act(async () => globalThis.mapProps.onSelect('3106200'));
  await settle(); await settle();
  assert.ok(calls.some((url) => url.pathname.endsWith('/education/schools/3106200') && url.searchParams.get('stage') === 'all'));
  assert.equal(document.querySelector('.education-schools-hint'), null);
  const rows = () => [...document.querySelectorAll('.education-school')].map((item) => item.textContent);
  // As siglas do tipo e os números romanos ficam; o resto ganha caixa de leitura.
  assert.deepEqual(rows().slice(0, 2), ['EE Governador Milton CamposEstadual1.000', 'EMEF Joao XXIII de OliveiraMunicipal999']);
  // Todas na mesma lista, que rola dentro do painel em vez de esticá-lo.
  assert.equal(rows().length, 25);
  assert.ok(document.querySelector('.education-school').closest('.scroll-list'));
  assert.ok(![...document.querySelectorAll('button')].some((item) => /^Mostrar/.test(item.textContent)));

  // Busca sem acento nem caixa.
  const search = document.querySelector('.education-school-search');
  assert.equal(search.placeholder, 'Buscar entre 25 escolas');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(search, 'joão');
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await settle();
  assert.deepEqual(rows(), ['EMEF Joao XXIII de OliveiraMunicipal999']);

  // A lista segue a etapa; com poucas escolas, sem busca.
  await click('Médio');
  assert.ok(calls.some((url) => url.pathname.endsWith('/education/schools/3106200') && url.searchParams.get('stage') === 'high_school'));
  assert.equal(rows().length, 1);
  assert.equal(document.querySelector('.education-school-search'), null);
});
