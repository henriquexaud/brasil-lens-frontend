import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom(`<!doctype html><html><head><meta name="theme-color" content="#f5f7f7" />
  <style>
    :root[data-theme='light'] { --surface-muted: #f5f7f7; }
    :root[data-theme='dark'] { --surface-muted: #111d23; }
  </style></head><body><div id="root"></div></body></html>`);
const { createElement: h, act, StrictMode } = await import('react');
const { createRoot } = await import('react-dom/client');
const { ThemeSwitch, THEME_STORAGE_KEY, applyTheme } = await loadModule(`
  export { ThemeSwitch } from './src/components/ThemeSwitch';
  export { THEME_STORAGE_KEY, applyTheme } from './src/app/theme';
`);
const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;
let root;

after(disposeHarness);
beforeEach(() => {
  Object.defineProperty(window, 'localStorage', storageDescriptor);
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  Object.defineProperty(window, 'localStorage', storageDescriptor);
  window.addEventListener = originalAddEventListener;
  window.removeEventListener = originalRemoveEventListener;
});

async function renderSwitch() {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(StrictMode, null, h(ThemeSwitch))));
  return document.querySelector('[role="switch"]');
}

async function click(button) {
  await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
}

test('o switch abre claro e alterna o tema, o estado acessível e a preferência persistida', async () => {
  const button = await renderSwitch();
  assert.equal(button.getAttribute('aria-label'), 'Tema escuro');
  assert.equal(button.getAttribute('aria-checked'), 'false');
  assert.equal(button.title, 'Ativar tema escuro');
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), null);
  assert.equal(button.querySelectorAll('svg[aria-hidden="true"]').length, 2);

  await click(button);
  assert.equal(button.getAttribute('aria-checked'), 'true');
  assert.equal(button.title, 'Ativar tema claro');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(document.querySelector('meta[name="theme-color"]').content, '#111d23');
  assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'dark');

  await click(button);
  assert.equal(button.getAttribute('aria-checked'), 'false');
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(document.querySelector('meta[name="theme-color"]').content, '#f5f7f7');
  assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'light');
});

test('a preferência escura é restaurada após montar o controle novamente', async () => {
  await click(await renderSwitch());
  await act(async () => root.unmount());
  root = undefined;
  const button = await renderSwitch();
  assert.equal(button.getAttribute('aria-checked'), 'true');
  assert.equal(document.documentElement.dataset.theme, 'dark');
});

test('uma preferência desconhecida mantém o padrão claro', async () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, '{tema inválido');
  const button = await renderSwitch();
  assert.equal(button.getAttribute('aria-checked'), 'false');
  assert.equal(document.documentElement.dataset.theme, 'light');
});

test('armazenamento bloqueado não impede abrir nem alternar o tema', async () => {
  const storage = window.localStorage;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new window.DOMException('Armazenamento bloqueado', 'SecurityError');
    },
  });
  const button = await renderSwitch();
  assert.equal(button.getAttribute('aria-checked'), 'false');
  await click(button);
  assert.equal(button.getAttribute('aria-checked'), 'true');
  assert.equal(document.documentElement.dataset.theme, 'dark');

  const errors = [];
  const captureError = (event) => errors.push(event.error);
  window.addEventListener('error', captureError);
  await act(async () => {
    window.dispatchEvent(
      new window.StorageEvent('storage', { key: THEME_STORAGE_KEY, storageArea: storage }),
    );
  });
  window.removeEventListener('error', captureError);
  assert.deepEqual(errors, []);
  assert.equal(button.getAttribute('aria-checked'), 'true');
});

test('falha ao gravar a preferência mantém a troca de tema funcionando', async () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => 'light',
      setItem() {
        throw new window.DOMException('Cota excedida', 'QuotaExceededError');
      },
    },
  });
  const button = await renderSwitch();
  await click(button);
  assert.equal(button.getAttribute('aria-checked'), 'true');
  assert.equal(document.documentElement.dataset.theme, 'dark');
});

test('mudanças em outra aba sincronizam o controle e removem o listener ao desmontar', async () => {
  const registered = new Set();
  window.addEventListener = function (type, listener, ...args) {
    if (type === 'storage') registered.add(listener);
    return originalAddEventListener.call(this, type, listener, ...args);
  };
  window.removeEventListener = function (type, listener, ...args) {
    if (type === 'storage') registered.delete(listener);
    return originalRemoveEventListener.call(this, type, listener, ...args);
  };
  const button = await renderSwitch();
  assert.equal(registered.size, 1);
  window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  await act(async () => {
    window.dispatchEvent(
      new window.StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        storageArea: window.localStorage,
      }),
    );
  });
  assert.equal(button.getAttribute('aria-checked'), 'true');
  assert.equal(document.documentElement.dataset.theme, 'dark');

  window.localStorage.clear();
  await act(async () => {
    window.dispatchEvent(
      new window.StorageEvent('storage', { key: null, storageArea: window.localStorage }),
    );
  });
  assert.equal(button.getAttribute('aria-checked'), 'false');
  await act(async () => root.unmount());
  root = undefined;
  assert.equal(registered.size, 0);
});

test('eventos de sessionStorage não alteram o tema, mesmo com a mesma chave ou clear', async () => {
  const button = await renderSwitch();
  await click(button);
  window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

  for (const key of [THEME_STORAGE_KEY, null]) {
    await act(async () => {
      window.dispatchEvent(
        new window.StorageEvent('storage', { key, storageArea: window.sessionStorage }),
      );
    });
    assert.equal(button.getAttribute('aria-checked'), 'true');
    assert.equal(document.documentElement.dataset.theme, 'dark');
  }

  await act(async () => {
    window.dispatchEvent(
      new window.StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        storageArea: window.localStorage,
      }),
    );
  });
  assert.equal(button.getAttribute('aria-checked'), 'false');
});

test('a cor do navegador acompanha o token de superfície do tema', () => {
  document.documentElement.style.setProperty('--surface-muted', '#102030');
  applyTheme('dark');
  assert.equal(document.querySelector('meta[name="theme-color"]').content, '#102030');
  document.documentElement.style.removeProperty('--surface-muted');
});

test('o HTML inicial aplica a preferência antes de renderizar o corpo da aplicação', async (t) => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const [stored, expected] of [
    [null, 'light'],
    ['light', 'light'],
    ['dark', 'dark'],
    ['invalid', 'light'],
  ]) {
    await t.test(`preferência ${stored ?? 'ausente'}`, () => {
      let appliedBeforeBody;
      const dom = new JSDOM(html, {
        url: 'http://localhost/',
        runScripts: 'dangerously',
        beforeParse(browser) {
          if (stored) browser.localStorage.setItem(THEME_STORAGE_KEY, stored);
          const originalQuery = browser.document.querySelector.bind(browser.document);
          browser.document.querySelector = (selector) => {
            if (selector === 'meta[name="theme-color"]' && appliedBeforeBody === undefined) {
              appliedBeforeBody = !browser.document.body;
            }
            return originalQuery(selector);
          };
        },
      });
      assert.equal(dom.window.document.documentElement.dataset.theme, expected);
      assert.equal(
        dom.window.document.querySelector('meta[name="theme-color"]').content,
        expected === 'dark' ? '#111d23' : '#f5f7f7',
      );
      assert.equal(appliedBeforeBody, true);
      dom.window.close();
    });
  }
  await t.test('armazenamento bloqueado', () => {
    const dom = new JSDOM(html, {
      url: 'http://localhost/',
      runScripts: 'dangerously',
      beforeParse(browser) {
        Object.defineProperty(browser, 'localStorage', {
          get() {
            throw new browser.DOMException('Armazenamento bloqueado', 'SecurityError');
          },
        });
      },
    });
    assert.equal(dom.window.document.documentElement.dataset.theme, 'light');
    assert.equal(dom.window.document.querySelector('meta[name="theme-color"]').content, '#f5f7f7');
    dom.window.close();
  });
});
