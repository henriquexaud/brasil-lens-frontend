import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const {
  PoliticalApp,
  TerritoryPanel,
  summaryMetric,
  voteShares,
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
  export { TerritoryPanel } from './src/features/political/TerritoryPanel';
  export { summaryMetric, voteShares } from './src/features/political/summary';
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
  assert.doesNotMatch(document.body.textContent, /Parcial · em andamento/);
  assert.match(document.querySelector('.source-tag').title, /Resultado parcial/);
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

const detailFixture = {
  ibgeCode: 'BR',
  name: 'Brasil',
  level: 'country',
  year: 2026,
  office: 'president',
  round: 1,
  status: 'partial',
  updatedAt: null,
  note: 'Dados do TSE',
  summary: {
    eligible: 1000,
    turnout: 800,
    abstention: 200,
    totalVotes: 800,
    validVotes: 700,
    blankVotes: 40,
    nullVotes: 60,
    representatives: 10,
    party: 'PL',
    partySeats: 4,
    partyVotes: 400,
  },
  leaders: [
    { id: '1', name: 'CANDIDATO A', party: 'PL', votes: 400 },
    { id: '2', name: 'CANDIDATO B', party: 'PT', votes: 300 },
  ],
  representatives: [],
  representativeTotal: 10,
  offset: 0,
  limit: 25,
};

test('destaques políticos preservam bases percentuais, zero, empate e ausência', () => {
  for (const [metric, expected] of Object.entries({
    turnout: 80,
    abstention: 20,
    blank_votes: 5,
    null_votes: 7.5,
    invalid_votes: 12.5,
    leader_share: 57.14,
    margin: 14.29,
  })) {
    assert.equal(summaryMetric(detailFixture, metric).value, expected);
  }
  const zero = { ...detailFixture, summary: { ...detailFixture.summary, blankVotes: 0 } };
  assert.equal(summaryMetric(zero, 'blank_votes').value, 0);
  zero.summary.nullVotes = null;
  assert.equal(summaryMetric(zero, 'invalid_votes').value, null);
  zero.summary.totalVotes = 0;
  assert.equal(summaryMetric(zero, 'blank_votes').value, null);
  assert.equal(
    summaryMetric({ ...detailFixture, leaders: [detailFixture.leaders[0]] }, 'margin').value,
    null,
  );
  assert.equal(
    summaryMetric(
      { ...detailFixture, leaders: [detailFixture.leaders[0], detailFixture.leaders[0]] },
      'margin',
    ).value,
    0,
  );
});

test('detalhes priorizam a categoria e deixam contagens secundárias sob demanda', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify(detailFixture), { status: 200 });
  for (const selection of [
    DEFAULT_SELECTION,
    { ...DEFAULT_SELECTION, category: 'participation', metric: 'turnout' },
    { ...DEFAULT_SELECTION, category: 'representation', metric: 'representation' },
  ]) {
    await act(async () =>
      root.render(
        h(
          QueryClientProvider,
          { client },
          h(TerritoryPanel, {
            key: selection.category,
            code: 'BR',
            selection,
            enabled: true,
            onDrillDown() {},
          }),
        ),
      ),
    );
    await settle();
    await settle();
    const section = document.querySelector('.territory-detail');
    assert.equal(section.querySelector('.detail-header'), null);
    assert.equal(
      section.querySelectorAll('.featured-value').length,
      selection.category === 'elections' ? 0 : 1,
    );
    if (selection.category === 'elections') {
      assert.equal((section.textContent.match(/Candidato A/g) ?? []).length, 1);
      assert.equal((section.textContent.match(/PL/g) ?? []).length, 1);
      assert.equal(section.querySelectorAll('.indicator-row.is-emphasized').length, 1);
    }
    assert.ok(!section.textContent.includes('Eleitorado'));
    assert.ok(!section.textContent.includes('Sobre estes dados'));
    assert.equal(section.querySelector('.political-vote-share'), null);
    assert.equal(
      section.querySelectorAll('.political-candidate-votes .indicator-row').length,
      selection.category === 'elections' ? 3 : 0,
    );
    if (selection.category === 'representation') {
      assert.equal(section.querySelector('.featured-value').textContent, '10');
      assert.match(section.textContent, /Ver eleitos/);
    } else {
      if (selection.category === 'participation') {
        assert.equal(section.querySelector('.featured-value').textContent, '80%');
        assert.equal(section.querySelector('.source-note').textContent, 'Presidência');
      }
      await act(async () => section.querySelector('summary').click());
      await settle();
      assert.match(section.textContent, /Eleitorado/);
      assert.equal(section.textContent.includes('Dois mais votados'), false);
    }
  }
});

test('legenda balanceia os dois líderes em 100%, mas preserva percentuais e restante reais', () => {
  const data = { ...detailFixture, summary: { ...detailFixture.summary, validVotes: 1000 } };
  const shares = voteShares(data, DEFAULT_SELECTION);
  assert.deepEqual(
    shares.leaders.map((c) => c.percent),
    [40, 30],
  );
  assert.equal(shares.others, 30);
  assert.equal(shares.otherVotes, 300);
  assert.ok(Math.abs(shares.leaders[0].balancePercent - (400 / 700) * 100) < 0.001);
  assert.equal(
    shares.leaders.reduce((sum, item) => sum + item.balancePercent, 0),
    100,
  );
  for (const office of ['president', 'governor', 'mayor']) {
    assert.ok(voteShares(data, { ...DEFAULT_SELECTION, office }));
  }
  for (const office of ['senator', 'federal_deputy', 'state_deputy', 'councillor']) {
    assert.equal(voteShares(data, { ...DEFAULT_SELECTION, office }), null);
  }
  assert.equal(voteShares(data, { ...DEFAULT_SELECTION, category: 'representation' }), null);
  assert.equal(
    voteShares(data, { ...DEFAULT_SELECTION, category: 'participation', metric: 'turnout' }),
    null,
  );
  assert.equal(voteShares(data, { ...DEFAULT_SELECTION, metric: 'leading_party' }), null);
  for (const validVotes of [null, undefined, 0, -1, 600, NaN]) {
    assert.equal(
      voteShares({ ...data, summary: { ...data.summary, validVotes } }, DEFAULT_SELECTION),
      null,
    );
  }
  for (const votes of [null, undefined, -1, NaN]) {
    assert.equal(
      voteShares(
        { ...data, leaders: [{ ...data.leaders[0], votes }, data.leaders[1]] },
        DEFAULT_SELECTION,
      ),
      null,
    );
  }
  assert.equal(voteShares({ ...data, leaders: [data.leaders[0]] }, DEFAULT_SELECTION), null);
  assert.equal(
    voteShares({ ...data, leaders: [data.leaders[0], data.leaders[0]] }, DEFAULT_SELECTION),
    null,
  );
  const zero = voteShares(
    { ...data, leaders: [{ ...data.leaders[0], votes: 0 }, data.leaders[1]] },
    DEFAULT_SELECTION,
  );
  assert.equal(zero.leaders[0].percent, 0);
});

test('menu mostra os votos dos dois líderes e do restante, acompanhando a renovação sem barra', async () => {
  let response = { ...detailFixture, summary: { ...detailFixture.summary, validVotes: 1000 } };
  globalThis.fetch = async () => new Response(JSON.stringify(response), { status: 200 });
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(TerritoryPanel, {
          code: 'BR',
          selection: DEFAULT_SELECTION,
          enabled: true,
          onDrillDown() {},
        }),
      ),
    ),
  );
  await settle();
  await settle();
  const counts = () =>
    [...document.querySelectorAll('.political-candidate-votes dd')].map((item) => item.textContent);
  assert.deepEqual(counts(), ['400', '300', '300']);
  assert.equal(document.querySelector('.political-vote-share'), null);
  response = {
    ...response,
    leaders: [{ ...response.leaders[0], votes: 500, party: 'PT' }, response.leaders[1]],
  };
  await act(async () => client.invalidateQueries({ queryKey: ['political', 'detail'] }));
  await settle();
  assert.deepEqual(counts(), ['500', '300', '200']);
  response = { ...response, summary: { ...response.summary, validVotes: null } };
  await act(async () => client.invalidateQueries({ queryKey: ['political', 'detail'] }));
  await settle();
  assert.deepEqual(counts(), ['500', '300', 'Sem dados']);
});

test('legenda acompanha o detalhe do recorte com a mesma consulta do menu', async () => {
  const originalFetch = globalThis.fetch;
  let response = { ...detailFixture, summary: { ...detailFixture.summary, validVotes: 1000 } };
  globalThis.fetch = async (url, ...args) => {
    if (new URL(url).pathname.includes('/territories/')) {
      calls.push(new URL(url));
      return new Response(JSON.stringify(response), { status: 200 });
    }
    return originalFetch(url, ...args);
  };
  await render();
  const labels = () =>
    [...document.querySelectorAll('.scale-legend-labels > span')].map((item) => item.textContent);
  assert.deepEqual(labels(), ['PL 40%', 'PT 30%']);
  assert.equal(calls.filter((p) => p.pathname.includes('/territories/')).length, 1);
  response = {
    ...response,
    leaders: [{ ...response.leaders[0], votes: 500 }, response.leaders[1]],
  };
  await act(async () => client.invalidateQueries({ queryKey: ['political', 'detail'] }));
  await settle();
  assert.deepEqual(labels(), ['PL 50%', 'PT 30%']);
});

test('território selecionado mantém identificação e empate não destaca um vencedor', async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ...detailFixture,
        ibgeCode: '35',
        name: 'São Paulo',
        level: 'state',
        summary: { ...detailFixture.summary, candidateTie: true },
      }),
      { status: 200 },
    );
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(TerritoryPanel, {
          code: '35',
          selection: DEFAULT_SELECTION,
          enabled: true,
          onClose() {},
          onDrillDown() {},
        }),
      ),
    ),
  );
  await settle();
  await settle();
  assert.equal(document.querySelector('.detail-title').textContent, 'São Paulo');
  assert.equal(document.querySelector('.featured-value').textContent, 'Empate');
  assert.equal(document.querySelector('.indicator-row.is-emphasized'), null);
  assert.equal(
    (document.querySelector('.territory-detail').textContent.match(/Candidato A/g) ?? []).length,
    1,
  );
});
