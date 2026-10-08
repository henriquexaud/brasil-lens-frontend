import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const {
  electionWindowAt,
  nextElectionBoundary,
  electionRefreshInterval,
  LIVE_REFRESH_INTERVAL,
  ELECTION_WINDOWS,
  useElectionWindow,
  useDetail,
  ControlPanel,
} = await loadModule(`
  export * from './src/features/political/liveElection';
  export { useElectionWindow } from './src/features/political/useElectionWindow';
  export { useDetail } from './src/features/political/queries';
  export { ControlPanel } from './src/features/political/ControlPanel';
`);
const [window] = ELECTION_WINDOWS;
const selection = {
  category: 'elections',
  office: 'president',
  year: 2026,
  round: 2,
  metric: 'leading_candidate',
};
after(async () => {
  dom.window.close();
  await disposeHarness();
});

test('janela começa às 18h de Brasília e termina no fim do dia, sem recorrência implícita', () => {
  assert.equal(window.startsAt, Date.parse('2026-10-25T21:00:00Z'));
  assert.equal(window.endsAt, Date.parse('2026-10-26T03:00:00Z'));
  assert.equal(electionWindowAt(Date.parse('2026-10-08T18:00:00-03:00')), null);
  assert.equal(electionWindowAt(window.startsAt - 1), null);
  assert.equal(electionWindowAt(window.startsAt), window);
  assert.equal(electionWindowAt(window.endsAt - 1), window);
  assert.equal(electionWindowAt(window.endsAt), null);
  assert.equal(electionWindowAt(Date.parse('2027-10-25T18:00:00-03:00')), null);
  assert.equal(nextElectionBoundary(window.startsAt - 1), window.startsAt);
  assert.equal(nextElectionBoundary(window.startsAt), window.endsAt);
  assert.equal(nextElectionBoundary(window.endsAt), undefined);
});

test('só resultados parciais do segundo turno de 2026 têm busca periódica na janela', () => {
  assert.equal(electionRefreshInterval(null, selection, 'partial'), false);
  assert.equal(electionRefreshInterval(window, selection, 'partial'), LIVE_REFRESH_INTERVAL);
  assert.equal(electionRefreshInterval(window, selection, 'ok'), false);
  assert.equal(electionRefreshInterval(window, selection), false);
  for (const patch of [
    { year: 2022 },
    { round: 1 },
    { category: 'representation' },
    { office: 'senator' },
    { office: 'mayor' },
    { office: 'federal_deputy' },
  ]) {
    assert.equal(electionRefreshInterval(window, { ...selection, ...patch }, 'partial'), false);
  }
  assert.equal(
    electionRefreshInterval(window, { ...selection, office: 'governor' }, 'partial'),
    LIVE_REFRESH_INTERVAL,
  );
  assert.equal(
    electionRefreshInterval(
      window,
      { ...selection, category: 'participation', metric: 'turnout' },
      'partial',
    ),
    LIVE_REFRESH_INTERVAL,
  );
});

test('app aberto entra na janela e sai à meia-noite sem recarregar a página', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: window.startsAt - 1000 });
  const root = createRoot(document.getElementById('root'));
  function Probe() {
    const active = useElectionWindow();
    return h('span', null, active ? 'ativo' : 'pausado');
  }
  try {
    await act(async () => root.render(h(Probe)));
    assert.equal(document.getElementById('root').textContent, 'pausado');
    await act(async () => t.mock.timers.tick(1000));
    assert.equal(document.getElementById('root').textContent, 'ativo');
    await act(async () => t.mock.timers.tick(window.endsAt - window.startsAt));
    assert.equal(document.getElementById('root').textContent, 'pausado');
  } finally {
    await act(async () => root.unmount());
    t.mock.timers.reset();
  }
});

test('consulta carrega normalmente antes do pleito, renova às 18h e para após conclusão', async (t) => {
  t.mock.timers.enable({
    apis: ['Date', 'setTimeout', 'setInterval'],
    now: window.startsAt - 1000,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const root = createRoot(document.getElementById('root'));
  const originalFetch = globalThis.fetch;
  let calls = 0,
    status = 'partial';
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ status }), { status: 200 });
  };
  function Probe() {
    useDetail('BR', selection);
    return null;
  }
  const settle = async (ms = 1) =>
    act(async () => {
      t.mock.timers.tick(ms);
      await Promise.resolve();
    });
  try {
    await act(async () => root.render(h(QueryClientProvider, { client }, h(Probe))));
    await settle();
    await settle();
    assert.equal(calls, 1);
    await settle(1000);
    await settle();
    assert.equal(calls, 2);
    await settle(LIVE_REFRESH_INTERVAL);
    await settle();
    assert.equal(calls, 3);
    status = 'ok';
    await settle(LIVE_REFRESH_INTERVAL);
    await settle();
    assert.equal(calls, 4);
    await settle(LIVE_REFRESH_INTERVAL * 2);
    await settle();
    assert.equal(calls, 4);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    globalThis.fetch = originalFetch;
    t.mock.timers.reset();
  }
});

test('linha de parcial fica oculta quando pausada e reaparece somente durante a apuração', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: window.startsAt - 1000 });
  const root = createRoot(document.getElementById('root'));
  const releases = [
    {
      year: 2026,
      status: 'partial',
      updatedAt: '2026-10-25T18:00:00-03:00',
      note: 'TSE',
      contests: [{ office: 'president', rounds: [1, 2] }],
    },
  ];
  try {
    await act(async () => root.render(h(ControlPanel, { selection, releases, onChange() {} })));
    assert.equal(document.querySelector('.indicator-controls [role="status"]'), null);
    assert.match(document.querySelector('.source-tag').title, /Resultado parcial.*Publicação/);
    await act(async () => t.mock.timers.tick(1000));
    assert.match(
      document.querySelector('.indicator-controls [role="status"]').textContent,
      /Parcial · em andamento/,
    );
    await act(async () => t.mock.timers.tick(window.endsAt - window.startsAt));
    assert.equal(document.querySelector('.indicator-controls [role="status"]'), null);
    assert.match(document.querySelector('.source-tag').title, /Resultado parcial/);
  } finally {
    await act(async () => root.unmount());
    t.mock.timers.reset();
  }
});
