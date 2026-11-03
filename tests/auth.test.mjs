import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
globalThis.FormData = window.FormData;
// O jsdom não implementa o modal nativo; basta abrir e fechar com o evento `close`.
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new window.Event('close'));
};
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { Harness, THEME_STORAGE_KEY } = await loadModule(`
  import { AuthProvider } from './src/features/auth/AuthProvider';
  import { AuthScreen } from './src/features/auth/AuthScreen';
  import { AccountMenu } from './src/features/auth/AccountMenu';
  import { TermsNotice } from './src/features/auth/TermsNotice';
  import { useAuth } from './src/features/auth/AuthContext';
  import { ThemeSwitch } from './src/components/ThemeSwitch';
  import { useFollowedMunicipalities } from './src/features/follow/useFollowedMunicipalities';
  export { THEME_STORAGE_KEY } from './src/app/theme';
  function PrivateView() {
    const follows = useFollowedMunicipalities();
    return <><AccountMenu /><ThemeSwitch />
      <ul>{follows.data?.municipalities.map(item => <li key={item.municipalityCode}>{item.name}</li>)}</ul>
      <button onClick={() => follows.refetch()}>Recarregar municípios</button>
    </>;
  }
  function Gate() {
    const auth = useAuth();
    if (auth.loading) return <p>Carregando conta</p>;
    if (auth.loadError) return <button onClick={auth.reload}>Tentar novamente</button>;
    return auth.user
      ? <><PrivateView key={auth.user.id} />{!auth.user.termsAccepted && <TermsNotice />}</>
      : <AuthScreen />;
  }
  export function Harness() { return <AuthProvider><Gate /></AuthProvider>; }
`);

let root, client, server, requests;
const alice = { id: 'alice', name: 'Ana', email: 'ana@exemplo.com', theme: 'dark', termsAccepted: true };
const bob = { id: 'bob', name: 'Bruno', email: 'bruno@exemplo.com', theme: 'light', termsAccepted: true };
const unauthorized = () => Response.json({ error: { code: 'authentication_required', message: 'Entre na sua conta para continuar.' } }, { status: 401 });

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  requests = [];
  server = {
    user: null,
    failLoad: false,
    failTheme: false,
    accounts: new Map([[alice.email, { ...alice }], [bob.email, { ...bob }]]),
    async handle(path, init) {
      if (path === '/auth/me') {
        if (this.failLoad) throw new TypeError('Failed to fetch');
        return this.user ? Response.json(this.user) : unauthorized();
      }
      const body = init.body ? JSON.parse(init.body) : {};
      if (path === '/auth/register') {
        if (this.accounts.has(body.email)) return Response.json({ error: { code: 'conflict', message: 'Este e-mail já está cadastrado. Entre na sua conta.' } }, { status: 409 });
        if (body.acceptTerms !== true) return Response.json({ error: { code: 'validation_error', message: 'Parâmetros inválidos.' } }, { status: 422 });
        this.user = { id: 'new-user', name: body.name, email: body.email, theme: body.theme, termsAccepted: true };
        this.accounts.set(body.email, this.user);
        return Response.json(this.user, { status: 201 });
      }
      if (path === '/auth/login') {
        if (body.password !== 'senha-123') return Response.json({ error: { code: 'authentication_required', message: 'E-mail ou senha incorretos.' } }, { status: 401 });
        this.user = this.accounts.get(body.email);
        return this.user ? Response.json(this.user) : unauthorized();
      }
      if (path === '/auth/logout') {
        this.user = null;
        return new Response(null, { status: 204 });
      }
      if (!this.user) return unauthorized();
      if (path === '/me/preferences') {
        if (this.failTheme) throw new TypeError('Failed to fetch');
        this.user.theme = body.theme;
        return Response.json(this.user);
      }
      if (path === '/me/terms') {
        this.user.termsAccepted = true;
        return Response.json(this.user);
      }
      if (path === '/me/data') return Response.json({ exportedAt: '2026-11-02T12:00:00Z', account: { email: this.user.email }, followedMunicipalities: [], devices: [], notifications: [], activeSessions: 1 });
      if (path === '/me/delete') {
        if (body.password !== 'senha-123') return Response.json({ error: { code: 'invalid_parameter', message: 'Senha incorreta.' } }, { status: 400 });
        this.accounts.delete(this.user.email);
        this.user = null;
        return new Response(null, { status: 204 });
      }
      if (path === '/me/followed-municipalities') return Response.json({ municipalities: this.user.id === 'alice' ? [{ municipalityCode: '3550308', name: 'São Paulo' }] : [] });
      throw new Error(`Requisição inesperada: ${path}`);
    },
  };
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(input).pathname.replace('/api/v1', '');
    requests.push({ path, ...init });
    return server.handle(path, init);
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  document.getElementById('root').replaceChildren();
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
});
after(disposeHarness);

async function tick() { await act(() => new Promise(resolve => setTimeout(resolve, 20))); }
async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await tick();
  assert.ok(check(), 'Estado esperado não foi atingido');
}
async function render() {
  await act(async () => root.render(h(QueryClientProvider, { client }, h(Harness))));
}
async function click(button) {
  await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
}
function button(text) { return [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text); }
async function submit(email, password = 'senha-123', name, { acceptTerms = true } = {}) {
  document.querySelector('[name=email]').value = email;
  document.querySelector('[name=password]').value = password;
  if (name) document.querySelector('[name=name]').value = name;
  const terms = document.querySelector('[name=terms]');
  if (terms) terms.checked = acceptTerms;
  await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
}

test('login restaura tema e municípios, logout limpa dados privados e outra conta fica isolada', async () => {
  await render();
  await until(() => document.querySelector('form'));
  assert.equal(requests.filter(item => item.path.startsWith('/me/')).length, 0);
  await submit(alice.email);
  await until(() => document.querySelector('li')?.textContent === 'São Paulo');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'dark');
  assert.ok(client.getQueryData(['me', 'alice', 'followed-municipalities']));
  await click(button('Sair'));
  await until(() => document.querySelector('form'));
  assert.equal(client.getQueryCache().findAll({ queryKey: ['me'] }).length, 0);
  await submit(bob.email);
  await until(() => button('Sair') && document.documentElement.dataset.theme === 'light');
  assert.equal(document.querySelector('li'), null);
  assert.ok(document.body.textContent.includes('Bruno'));
  assert.ok(requests.every(item => item.credentials === 'include'));
  assert.ok(requests.filter(item => item.method !== 'GET').every(item => item.headers['X-Brasil-Lens-Client'] === 'web'));
});

test('cadastro usa o tema escolhido e erros podem ser corrigidos sem sair da tela', async () => {
  await render();
  await until(() => document.querySelector('form'));
  await submit(alice.email, 'incorreta');
  await until(() => document.querySelector('[role=alert]'));
  assert.match(document.querySelector('[role=alert]').textContent, /E-mail ou senha incorretos/);
  assert.ok(document.querySelector('form'));
  await click(button('Criar conta'));
  assert.equal(document.querySelector('[role=alert]'), null);
  assert.equal(document.querySelector('[name=password]').getAttribute('autocomplete'), 'new-password');
  await click(document.querySelector('[role=switch]'));
  await submit('nova@exemplo.com', 'senha-123', 'Nova conta');
  await until(() => button('Sair'));
  assert.equal(server.user.theme, 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
});

test('campos inválidos mostram a mensagem em pt-BR sem chamar a API', async () => {
  await render();
  await until(() => document.querySelector('form'));
  const before = requests.length;
  await submit('ana@', '');
  assert.equal(requests.length, before);
  assert.match(document.body.textContent, /Confira o e-mail/);
  assert.match(document.body.textContent, /Informe sua senha/);
  assert.equal(document.querySelector('[name=email]').getAttribute('aria-invalid'), 'true');
  assert.equal(document.activeElement, document.querySelector('[name=email]'));
});

test('a sessão é retomada ao abrir, e um 401 privado volta ao login sem dados antigos', async () => {
  server.user = server.accounts.get(alice.email);
  await render();
  await until(() => document.querySelector('li'));
  assert.equal(document.querySelector('form'), null);
  server.user = null;
  await click(button('Recarregar municípios'));
  await until(() => document.querySelector('form'));
  await until(() => client.getQueryCache().findAll({ queryKey: ['me'] }).length === 0);
  assert.equal(document.querySelector('li'), null);
});

test('falha ao salvar tema fica visível e a nova tentativa persiste para o próximo login', async () => {
  server.user = server.accounts.get(alice.email);
  await render();
  await until(() => document.querySelector('li'));
  server.failTheme = true;
  await click(document.querySelector('[role=switch]'));
  await until(() => document.querySelector('[role=alert]'));
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(server.user.theme, 'dark');
  server.failTheme = false;
  await click(button('Tentar novamente'));
  await until(() => !document.querySelector('[role=alert]'));
  assert.equal(server.user.theme, 'light');
  await click(button('Sair'));
  await until(() => document.querySelector('form'));
  await click(document.querySelector('[role=switch]'));
  assert.equal(document.documentElement.dataset.theme, 'dark');
  await submit(alice.email);
  await until(() => button('Sair') && document.documentElement.dataset.theme === 'light');
});

test('falha de conexão permite tentar novamente sem perder a abertura da aplicação', async () => {
  server.failLoad = true;
  await render();
  await until(() => button('Tentar novamente'));
  assert.equal(document.querySelector('form'), null);
  server.failLoad = false;
  await click(button('Tentar novamente'));
  await until(() => document.querySelector('form'));
});


test('o cadastro exige aceitar os Termos e a Política, com links para os dois', async () => {
  await render();
  await until(() => document.querySelector('form'));
  assert.ok(document.querySelector('a[href="/privacidade"]'));
  assert.ok(document.querySelector('a[href="/termos"]'));
  await click(button('Criar conta'));
  const before = requests.length;
  await submit('nova@exemplo.com', 'senha-123', 'Nova conta', { acceptTerms: false });
  assert.equal(requests.length, before);
  assert.match(document.body.textContent, /aceite os Termos de Uso e a Política de Privacidade/);
  assert.equal(document.activeElement, document.querySelector('[name=terms]'));
  await submit('nova@exemplo.com', 'senha-123', 'Nova conta');
  await until(() => button('Sair'));
  const register = requests.find(item => item.path === '/auth/register');
  assert.equal(JSON.parse(register.body).acceptTerms, true);
});

test('conta sem a versão vigente só segue depois de aceitar a Política e os Termos', async () => {
  server.user = { ...server.accounts.get(alice.email), termsAccepted: false };
  await render();
  await until(() => document.querySelector('dialog[open]'));
  assert.match(document.querySelector('dialog').textContent, /Atualizamos a Política e os Termos/);
  await click(button('Li e aceito'));
  await until(() => !document.querySelector('dialog'));
  assert.ok(requests.some(item => item.path === '/me/terms' && item.method === 'POST'));
  assert.equal(client.getQueryData(['auth', 'me']).termsAccepted, true);
});

test('quem não aceita a nova versão pode sair da conta pelo aviso', async () => {
  server.user = { ...server.accounts.get(alice.email), termsAccepted: false };
  await render();
  await until(() => document.querySelector('dialog[open]'));
  await click(button('Sair da conta'));
  await until(() => document.querySelector('form'));
  assert.ok(!requests.some(item => item.path === '/me/terms'));
});

test('a conta baixa os próprios dados e é excluída só com a senha certa', async () => {
  server.user = server.accounts.get(alice.email);
  const downloads = [];
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = (blob) => { downloads.push(blob); return 'blob:dados'; };
  URL.revokeObjectURL = () => {};
  after(() => Object.assign(URL, { createObjectURL, revokeObjectURL }));
  window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
  await render();
  await until(() => document.querySelector('li'));
  await click(document.querySelector('.account-menu__name'));
  await until(() => document.querySelector('dialog[open]'));
  assert.match(document.querySelector('dialog').textContent, /ana@exemplo\.com/);

  await click(button('Baixar meus dados'));
  await until(() => downloads.includes('brasil-lens-meus-dados.json'));
  assert.match(await downloads[0].text(), /"activeSessions": 1/);

  await click(button('Excluir minha conta'));
  document.querySelector('#account-password').value = 'incorreta';
  await act(async () => document.querySelector('.account-delete').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await until(() => /Senha incorreta/.test(document.querySelector('dialog').textContent));
  assert.ok(server.accounts.has(alice.email));

  document.querySelector('#account-password').value = 'senha-123';
  await act(async () => document.querySelector('.account-delete').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await until(() => document.querySelector('form [name=email]'));
  assert.equal(server.accounts.has(alice.email), false);
  assert.match(document.querySelector('[role=status]').textContent, /foram excluídos/);
  assert.equal(client.getQueryCache().findAll({ queryKey: ['me'] }).length, 0);
});
