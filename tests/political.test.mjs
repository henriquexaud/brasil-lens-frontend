import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const {
  PoliticalApp,
  presentationFor,
  candidateName,
  numericBands,
  numericColor,
  DEFAULT_SELECTION,
  normalizeSelection,
  latestSelection,
  SESSION_STORAGE_KEY,
} = await loadModule(
  `
  export { default as PoliticalApp } from './src/features/political/PoliticalApp';
  export { presentationFor, candidateName, numericBands, numericColor } from './src/features/political/presentation';
  export { DEFAULT_SELECTION, normalizeSelection, latestSelection } from './src/features/political/selection';
  export { useDataContext } from './src/app/useDataContext';
  export { SESSION_STORAGE_KEY } from './src/lib/sessionStorage';
`,
  {
    stubs: {
      './political.css': 'export {};',
      '@/features/map/MapView': `import { createElement } from 'react'; export const MapView = (props) => { globalThis.mapProps = props; return createElement('div', {id:'map'}); };`,
      '@/features/map/useTerritoryMap': `export const useTerritoryMap = () => globalThis.geography;`,
      '@/features/map/useNationalMunicipalData': `export const useNationalMunicipalData = (props) => { globalThis.nationalProps = props; return globalThis.nationalState; };`,
      '@/features/search/SearchBox': `export const SearchBox = () => null;`,
      '@/features/follow/FollowedMunicipalitiesPanel': `export const FollowedMunicipalitiesPanel = () => null;`,
      '@/features/auth/AccountMenu': `export const AccountMenu = () => null;`,
      '@/components/ThemeSwitch': `export const ThemeSwitch = () => null;`,
      '@/app/useMobileSheet': `export const useMobileSheet = () => ({ slotRef: null, headerRef: null, headerProps: {}, collapsed: false, toggle() {} });`,
    },
  },
);
const releases = [
  {
    year: 2022,
    status: 'ok',
    note: 'TSE',
    updatedAt: null,
    contests: [
      { office: 'president', rounds: [1, 2] },
      { office: 'federal_deputy', rounds: [1] },
    ],
  },
  {
    year: 2024,
    status: 'ok',
    note: 'TSE',
    updatedAt: null,
    contests: [
      { office: 'mayor', rounds: [1, 2] },
      { office: 'councillor', rounds: [1] },
    ],
  },
  {
    year: 2026,
    status: 'partial',
    note: 'TSE',
    updatedAt: '2026-10-08T10:00:00-03:00',
    contests: [
      { office: 'president', rounds: [1] },
      { office: 'federal_deputy', rounds: [1] },
    ],
  },
];
let root, client, calls;
beforeEach(() => {
  window.sessionStorage.clear();
  calls = [];
  globalThis.nationalState = {};
  globalThis.geography = {
    collection: { features: [], scope: { level: 'state', parent: null } },
    scopeReady: true,
    territoryReady: true,
    mapLayer: { isFetching: false },
    statesOutlineLayer: {},
    selectedBoundary: { isFetching: false },
    visibleMunicipalities: {},
  };
  globalThis.fetch = async (url) => {
    const p = new URL(url);
    calls.push(p);
    const year = Number(p.searchParams.get('year'));
    const body = p.pathname.endsWith('/catalog')
      ? { releases }
      : p.pathname.endsWith('/values')
        ? {
            year,
            office: p.searchParams.get('office'),
            round: Number(p.searchParams.get('round')),
            metric: p.searchParams.get('metric'),
            status: year === 2026 ? 'partial' : 'ok',
            updatedAt: null,
            note: 'TSE',
            values: [{ ibgeCode: '35', value: 0, label: 'Candidato', party: 'PT', tie: false }],
          }
        : {
            ibgeCode: 'BR',
            name: 'Brasil',
            level: 'country',
            year,
            office: 'president',
            round: 2,
            status: 'ok',
            updatedAt: null,
            summary: null,
            leaders: [],
            representatives: [],
            representativeTotal: 0,
            offset: 0,
            limit: 25,
            note: 'TSE',
          };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
});
after(async () => {
  dom.window.close();
  await disposeHarness();
});
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
}
async function render() {
  await act(async () =>
    root.render(h(QueryClientProvider, { client }, h(PoliticalApp, { contextControl: null }))),
  );
  await settle();
  await settle();
}

test('2026 usa somente turno publicado e cargo municipal resolve 2024', () => {
  assert.equal(normalizeSelection({ ...DEFAULT_SELECTION, year: 2026 }, releases).round, 1);
  const municipal = normalizeSelection(
    { ...DEFAULT_SELECTION, year: 2026, office: 'mayor' },
    releases,
  );
  assert.equal(municipal.year, 2024);
  assert.equal(
    normalizeSelection({ ...DEFAULT_SELECTION, category: 'participation', year: 2024 }, releases)
      .office,
    'mayor',
  );
});
test('ano padrão vem do catálogo mais recente por cargo, independentemente da ordem', () => {
  const future = { ...releases[2], year: 2030 };
  const available = [future, releases[1], releases[0], releases[2]];
  assert.equal(latestSelection(DEFAULT_SELECTION, available).year, 2030);
  assert.equal(latestSelection({ ...DEFAULT_SELECTION, office: 'mayor' }, available).year, 2024);
  assert.equal(normalizeSelection({ ...DEFAULT_SELECTION, year: 2028 }, available).year, 2030);
  assert.equal(
    latestSelection(
      { ...DEFAULT_SELECTION, category: 'participation', office: 'mayor', year: 2024 },
      available,
    ).year,
    2030,
  );
  assert.equal(
    normalizeSelection({ ...DEFAULT_SELECTION, category: 'participation', year: 2028 }, [
      { ...releases[1], year: 2028 },
    ]).office,
    'mayor',
  );
});
test('nomes ficam legíveis sem alterar siglas, partículas ou grafia já formatada', () => {
  assert.equal(candidateName('LULA'), 'Lula');
  assert.equal(candidateName('JOÃO DA SILVA'), 'João da Silva');
  assert.equal(candidateName('ZÉ DO PT'), 'Zé do PT');
  assert.equal(candidateName("D'ÁVILA"), "D'Ávila");
  assert.equal(candidateName('McDonald'), 'McDonald');
  const data = {
    year: 2022,
    office: 'president',
    round: 2,
    metric: 'leading_candidate',
    status: 'ok',
    values: [{ ibgeCode: '35', value: 1, label: 'LULA', party: 'PT', tie: false }],
  };
  assert.equal(presentationFor(data).tooltips.get('35').value, 'Lula');
  data.metric = 'representation';
  data.values[0].label = 'PT';
  assert.equal(presentationFor(data).tooltips.get('35').value, 'PT');
});
test('escala percentual usa as mesmas classes fixas na legenda e no mapa', () => {
  for (const metric of [
    'leader_share',
    'margin',
    'turnout',
    'abstention',
    'invalid_votes',
    'blank_votes',
    'null_votes',
  ]) {
    const bands = numericBands(metric);
    assert.equal(bands.length, 10);
    assert.equal(new Set(bands.map((band) => band.color)).size, 10);
    assert.equal(numericColor(0, metric), bands[0].color);
    assert.equal(numericColor(100, metric), bands.at(-1).color);
    for (const band of bands) assert.equal(numericColor(band.lower, metric), band.color);
  }
  assert.notEqual(numericColor(1, 'margin'), numericColor(12, 'margin'));
  assert.notEqual(numericColor(72, 'turnout'), numericColor(85, 'turnout'));
});
test('zero recebe cor; ausência e empate preservam significado', () => {
  const data = {
    year: 2026,
    office: 'president',
    round: 1,
    metric: 'turnout',
    status: 'partial',
    values: [
      { ibgeCode: '35', value: 0, label: null, party: null, tie: false },
      { ibgeCode: '33', value: null, label: null, party: null, tie: false },
    ],
  };
  const result = presentationFor(data);
  assert.equal(result.values.has('35'), true);
  assert.equal(result.values.has('33'), false);
  assert.equal(result.tooltips.get('35').value, '0%');
  assert.match(result.tooltips.get('35').meta, /Parcial/);
  assert.match(result.colors.get('33'), /map-neutral/);
  data.metric = 'leading_candidate';
  data.values[0].tie = true;
  assert.equal(presentationFor(data).tooltips.get('35').value, 'Empate');
});
test('menu abre no pleito mais recente, mantém categorias e não consulta clima', async () => {
  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ political: { ...DEFAULT_SELECTION, year: 2022, round: 2 } }),
  );
  await render();
  assert.deepEqual(
    [...document.querySelectorAll('[role=tab]')].map((b) => b.textContent),
    ['Eleições', 'Cargos', 'Participação'],
  );
  assert.equal(globalThis.nationalProps.weatherEnabled, false);
  const year = document.querySelector('[aria-label="Ano da eleição"]');
  assert.equal(year.value, '2026');
  assert.deepEqual(
    [...year.options].map((o) => o.value),
    ['2026', '2022'],
  );
  assert.match(document.body.textContent, /2026 em andamento/);
  const round = document.querySelector('[aria-label="Turno"]');
  assert.deepEqual(
    [...round.options].map((o) => o.value),
    ['1'],
  );
  const reads = calls.filter(
    (p) => p.pathname.endsWith('/values') && p.searchParams.get('year') === '2026',
  );
  assert.ok(reads.length > 0);
  assert.ok(reads.every((p) => p.searchParams.get('round') === '1'));
  assert.ok(calls.every((p) => p.pathname.includes('/political/')));
  assert.equal(JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).political.year, 2026);
  await act(async () => {
    year.value = '2022';
    year.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await settle();
  assert.equal(document.querySelector('[aria-label="Ano da eleição"]').value, '2022');
  assert.equal(JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).political.year, 2022);
  const officeButton = (name) =>
    [...document.querySelectorAll('.indicator-pill-btn')].find(
      (button) => button.textContent === name,
    );
  await act(async () => officeButton('Prefeitura').click());
  await settle();
  assert.equal(document.querySelector('[aria-label="Ano da eleição"]').value, '2024');
  await act(async () => officeButton('Presidência').click());
  await settle();
  assert.equal(document.querySelector('[aria-label="Ano da eleição"]').value, '2026');
});
