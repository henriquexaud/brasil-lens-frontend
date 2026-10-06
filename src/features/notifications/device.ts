import { apiPost } from '@/api/client';

export function supportsPush() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function existingSubscription() {
  if (!supportsPush() || Notification.permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function saveSubscription(subscription: PushSubscription) {
  await apiPost<void>('/me/notifications/subscriptions', subscription.toJSON());
}

export async function enableDevice(publicKey: string) {
  if (!supportsPush())
    throw new Error(
      'Este navegador não oferece notificações. Use o app instalado em um dispositivo compatível.',
    );
  // A permissão precisa ser solicitada diretamente no clique, antes de esperar a rede.
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== 'granted')
    throw new Error('Permita as notificações nas configurações do navegador para receber avisos.');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
  let subscription = await registration.pushManager.getSubscription();
  const previousKey = subscription?.options.applicationServerKey;
  if (
    subscription &&
    previousKey &&
    (previousKey.byteLength !== key.byteLength ||
      !key.every((value, index) => value === new Uint8Array(previousKey)[index]))
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  try {
    await saveSubscription(subscription);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
  return subscription;
}

export async function disableDevice() {
  if (!supportsPush()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await apiPost<void>('/me/notifications/unsubscribe', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
  for (const notification of (await registration?.getNotifications()) ?? []) notification.close();
}
