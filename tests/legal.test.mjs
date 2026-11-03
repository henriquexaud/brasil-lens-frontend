import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { legalDocumentFor, LegalPage, LEGAL_VERSION, CONTACT_EMAIL } = await loadModule(
  `
  export { legalDocumentFor } from './src/features/legal/routes';
  export { LEGAL_VERSION, CONTACT_EMAIL } from './src/features/legal/routes';
  export { default as LegalPage } from './src/features/legal/LegalPage';
`,
  { stubs: { './legal.css': '' } },
);
after(disposeHarness);

test('só /privacidade e /termos abrem as páginas públicas', () => {
  assert.equal(legalDocumentFor('/privacidade'), 'privacy');
  assert.equal(legalDocumentFor('/privacidade/'), 'privacy');
  assert.equal(legalDocumentFor('/termos'), 'terms');
  for (const path of ['/', '/termos-de-uso', '/privacidade/x', '/Termos']) {
    assert.equal(legalDocumentFor(path), null, path);
  }
});

test('a versão dos documentos é a mesma do backend', async () => {
  const { readFile } = await import('node:fs/promises');
  const backend = await readFile(new URL('../../backend/app/core/legal.py', import.meta.url), 'utf8').catch(() => null);
  if (backend === null) return; // fora do workspace, só o frontend está disponível
  assert.match(backend, new RegExp(`TERMS_VERSION = "${LEGAL_VERSION}"`));
});

test('cada página traz resumo, seções com âncora, contato e título próprio', async () => {
  const root = createRoot(document.getElementById('root'));
  for (const [kind, title] of [['privacy', 'Política de Privacidade'], ['terms', 'Termos de Uso']]) {
    await act(async () => root.render(h(LegalPage, { document: kind })));
    assert.equal(document.querySelector('h1').textContent, title);
    assert.equal(document.title, `${title} · Brasil Lens`);
    assert.ok(document.querySelector('.legal-summary li'));
    const anchors = [...document.querySelectorAll('.legal-toc a')].map(a => a.getAttribute('href').slice(1));
    assert.ok(anchors.length >= 8);
    for (const id of anchors) assert.ok(document.getElementById(id), id);
    assert.ok(document.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`));
    assert.equal(document.querySelector('[aria-current=page]').getAttribute('href'), kind === 'privacy' ? '/privacidade' : '/termos');
  }
  await act(async () => root.unmount());
});
