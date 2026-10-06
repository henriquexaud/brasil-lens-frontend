import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { supportsPush, enableDevice, disableDevice, existingSubscription } = await loadModule(
  `export * from './src/features/notifications/device';`,
  {
    stubs: {
      '@/api/client': `export async function apiPost(path, body) {
    globalThis.notificationCalls.push(['api', path, body]);
    if (globalThis.failSubscription) throw new Error('Falha ao registrar');
  }`,
    },
  },
);
after(async () => {
  dom.window.close();
  await disposeHarness();
});
const key = 'BAECAw';
let subscription, registration;

beforeEach(() => {
  globalThis.notificationCalls = [];
  globalThis.failSubscription = false;
  class FakeNotification {
    static permission = 'default';
    static async requestPermission() {
      globalThis.notificationCalls.push(['permission']);
      this.permission = globalThis.denyNotification ? 'denied' : 'granted';
      return this.permission;
    }
  }
  globalThis.denyNotification = false;
  window.Notification = globalThis.Notification = FakeNotification;
  window.PushManager = class {};
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  subscription = null;
  const createSubscription = (options) => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    options,
    toJSON() {
      return { endpoint: this.endpoint, keys: { p256dh: 'public', auth: 'auth' } };
    },
    async unsubscribe() {
      globalThis.notificationCalls.push(['unsubscribe']);
      subscription = null;
      return true;
    },
  });
  registration = {
    pushManager: {
      async getSubscription() {
        return subscription;
      },
      async subscribe(options) {
        globalThis.notificationCalls.push(['subscribe', options]);
        subscription = createSubscription(options);
        return subscription;
      },
    },
    async getNotifications() {
      return [
        {
          close() {
            globalThis.notificationCalls.push(['close']);
          },
        },
      ];
    },
  };
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      async getRegistration() {
        return registration;
      },
      async register(path) {
        globalThis.notificationCalls.push(['register', path]);
        return registration;
      },
      ready: Promise.resolve(registration),
    },
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
});

test('permissão é pedida no gesto antes de registrar o worker e salvar a inscrição', async () => {
  assert.ok(supportsPush());
  assert.equal(await existingSubscription(), null);
  assert.deepEqual(globalThis.notificationCalls, [], 'abrir o app não pede permissão');
  await enableDevice(key);
  assert.deepEqual(
    globalThis.notificationCalls.map((c) => c[0]),
    ['permission', 'register', 'subscribe', 'api'],
  );
  const options = globalThis.notificationCalls.find((c) => c[0] === 'subscribe')[1];
  assert.equal(options.userVisibleOnly, true);
  assert.deepEqual([...options.applicationServerKey], [4, 1, 2, 3]);
  assert.equal(globalThis.notificationCalls.at(-1)[1], '/me/notifications/subscriptions');
});

test('permissão negada não cria inscrição nem escreve na API', async () => {
  globalThis.denyNotification = true;
  await assert.rejects(enableDevice(key), /Permita as notificações/);
  assert.deepEqual(
    globalThis.notificationCalls.map((c) => c[0]),
    ['permission'],
  );
});

test('falha ao salvar a inscrição cancela o recebimento local', async () => {
  globalThis.failSubscription = true;
  await assert.rejects(enableDevice(key), /Falha ao registrar/);
  assert.equal(subscription, null);
  assert.equal(globalThis.notificationCalls.at(-1)[0], 'unsubscribe');
});

test('trocar a chave VAPID renova a inscrição mesmo quando a chave anterior tem o mesmo prefixo', async () => {
  await enableDevice(key);
  subscription.options.applicationServerKey = Uint8Array.from([4, 1, 2, 3, 5]).buffer;
  globalThis.notificationCalls = [];
  await enableDevice(key);
  assert.deepEqual(
    globalThis.notificationCalls.map((c) => c[0]),
    ['register', 'unsubscribe', 'subscribe', 'api'],
  );
  assert.deepEqual([...subscription.options.applicationServerKey], [4, 1, 2, 3]);
});

test('desativar ou sair remove a inscrição da conta e fecha notificações do dispositivo', async () => {
  await enableDevice(key);
  globalThis.notificationCalls = [];
  await disableDevice();
  assert.deepEqual(
    globalThis.notificationCalls.map((c) => c[0]),
    ['api', 'unsubscribe', 'close'],
  );
  assert.equal(globalThis.notificationCalls[0][1], '/me/notifications/unsubscribe');
  assert.equal(subscription, null);
});

test('worker recebe push com o app fechado, sem interceptar ou cachear requisições', async () => {
  const handlers = new Map();
  const notifications = [];
  const navigation = [];
  const context = {
    URL,
    Date,
    self: {
      location: { origin: 'https://brasil-lens.vercel.app' },
      addEventListener(type, handler) {
        handlers.set(type, handler);
      },
      registration: {
        async showNotification(title, options) {
          notifications.push({ title, ...options });
        },
      },
      clients: {
        async matchAll() {
          return [];
        },
        async openWindow(url) {
          navigation.push(url);
        },
      },
    },
  };
  vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  assert.equal(handlers.has('fetch'), false);
  let work;
  const payload = {
    title: 'Brasil Lens · São Paulo',
    body: 'Chuvas intensas · INMET',
    tag: 'event-1',
    data: { url: '/?municipality=3550308', expiresAt: new Date(Date.now() + 60_000).toISOString() },
  };
  handlers.get('push')({
    data: { json: () => payload },
    waitUntil(promise) {
      work = promise;
    },
  });
  await work;
  assert.equal(notifications[0].title, payload.title);
  assert.equal(notifications[0].tag, 'event-1');
  handlers.get('notificationclick')({
    notification: { ...notifications[0], close() {} },
    waitUntil(promise) {
      work = promise;
    },
  });
  await work;
  assert.deepEqual(navigation, ['https://brasil-lens.vercel.app/?municipality=3550308']);
  payload.data.expiresAt = new Date(Date.now() - 60_000).toISOString();
  handlers.get('push')({
    data: { json: () => payload },
    waitUntil(promise) {
      work = promise;
    },
  });
  assert.equal(notifications.length, 1, 'um aviso expirado não deve aparecer como vigente');
});
