import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
const { createElement: h, act, Suspense } = await import('react');
const { flushSync } = await import('react-dom');
const { createRoot } = await import('react-dom/client');
const { lazyPreload } = await loadModule(`export { lazyPreload } from './src/lib/lazyPreload';`);

let root;
after(disposeHarness);
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
});

const container = () => document.getElementById('root');
const within = (piece) => h(Suspense, { fallback: h('p', null, 'carregando') }, h(piece));

test('código já carregado renderiza direto, sem passar pelo fallback do Suspense', async () => {
  const Piece = lazyPreload(async () => ({ default: () => h('p', null, 'pronto') }));
  await Piece.preload();
  root = createRoot(container());
  flushSync(() => root.render(within(Piece)));
  assert.equal(container().textContent, 'pronto');
});

test('sem pré-carga o componente suspende e aparece quando o código chega', async () => {
  const Piece = lazyPreload(async () => ({ default: () => h('p', null, 'pronto') }));
  root = createRoot(container());
  flushSync(() => root.render(within(Piece)));
  assert.equal(container().textContent, 'carregando');
  await act(async () => {});
  assert.equal(container().textContent, 'pronto');
});

test('falha na pré-carga não rejeita nem fica guardada', async () => {
  let calls = 0;
  const Piece = lazyPreload(async () => {
    calls += 1;
    if (calls === 1) throw new Error('rede');
    return { default: () => h('p', null, 'pronto') };
  });
  await Piece.preload();
  await Piece.preload();
  assert.equal(calls, 2);
  root = createRoot(container());
  flushSync(() => root.render(within(Piece)));
  assert.equal(container().textContent, 'pronto');
});
