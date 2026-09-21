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

