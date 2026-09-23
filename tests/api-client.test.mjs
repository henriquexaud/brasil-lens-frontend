import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/api/client.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { buildUrl } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('buildUrl suporta caminhos absolutos e parametros query', () => {
  const url = buildUrl('/weather/current', { territory: '35', forecast: true });
  assert.match(url, /\/weather\/current\?territory=35&forecast=true$/);
});

test('buildUrl suporta URLs relativas no navegador sem disparar TypeError', () => {
  globalThis.window = {
    location: { origin: 'https://meu-dominio-producao.com.br' },
  };
  const url = buildUrl('/map', { level: 'state' });
  assert.ok(url.startsWith('http'));
  assert.match(url, /\/map\?level=state$/);
});


const { apiGet, clearSourcePauses, isTransientError, ApiError } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

function mockFetch(respond) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(new URL(url).pathname);
    return respond(new URL(url));
  };
  return calls;
}
const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('cota esgotada pausa a fonte inteira até o usuário pedir nova tentativa', async () => {
  const calls = mockFetch((url) =>
    url.pathname.startsWith('/api/v1/weather/alerts')
      ? jsonResponse(200, { type: 'FeatureCollection', features: [] })
      : jsonResponse(503, {
          error: {
            code: 'provider_rate_limited',
            message: 'O limite diário de consultas da fonte de clima (Open-Meteo) foi atingido.',
            details: { retryAfterSeconds: 900 },
          },
        }),
  );
  const first = await apiGet('/weather/state', { parent: '35' }).catch((error) => error);
  assert.ok(first instanceof ApiError);
  assert.equal(first.isRateLimited, true);
  assert.equal(first.retryAt, null);
  assert.match(first.message, /limite diário/);

  // Outras rotas da mesma fonte falham na hora, sem ir à rede.
  const second = await apiGet('/weather/states').catch((error) => error);
  assert.equal(second, first);
  assert.deepEqual(calls, ['/api/v1/weather/state']);

  // Avisos vêm do banco, não da Open-Meteo: continuam consultando.
  await apiGet('/weather/alerts');
  assert.equal(calls.length, 2);

  clearSourcePauses();
  await apiGet('/weather/states').catch(() => {});
  assert.equal(calls.at(-1), '/api/v1/weather/states');
  clearSourcePauses();
});

test('fonte indisponível espera um intervalo crescente e depois volta a consultar', async () => {
  const realNow = Date.now;
  const calls = mockFetch(() =>
    jsonResponse(502, {
      error: { code: 'provider_error', message: 'Não foi possível consultar os focos de calor no INPE.' },
    }),
  );
  try {
    const first = await apiGet('/fire-hotspots').catch((error) => error);
    const firstDelay = first.retryAt - realNow();
    assert.ok(firstDelay > 25_000 && firstDelay <= 30_000);
    await apiGet('/fire-hotspots/summary').catch(() => {});
    assert.equal(calls.length, 1);

    Date.now = () => realNow() + 31_000; // a pausa terminou
    const second = await apiGet('/fire-hotspots').catch((error) => error);
    assert.equal(calls.length, 2);
    assert.ok(second.retryAt - Date.now() > 55_000); // segunda falha seguida: espera dobra
  } finally {
    Date.now = realNow;
    clearSourcePauses();
  }
});

test('só falhas passageiras são repetidas automaticamente', () => {
  assert.equal(isTransientError(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientError(new ApiError(502, 'http_error', 'gateway')), true);
  assert.equal(isTransientError(new ApiError(502, 'provider_error', 'INPE')), false);
  assert.equal(isTransientError(new ApiError(503, 'provider_rate_limited', 'cota')), false);
  assert.equal(isTransientError(new ApiError(404, 'not_found', 'não existe')), false);
});
