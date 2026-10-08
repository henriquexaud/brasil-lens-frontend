import { memo, Suspense, useEffect } from 'react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { scheduleIdle } from '@/lib/idle';
import { lazyPreload } from '@/lib/lazyPreload';
import { useAuth } from './AuthContext';
import { AuthScreen } from './AuthScreen';
import './auth-lens.css';

const loadableMapApp = lazyPreload(() => import('@/App'));
const MapApp = memo(loadableMapApp);

function LoadingAccount() {
  return (
    <div className="app auth-page" role="status">
      Abrindo o Brasil Lens…
    </div>
  );
}

export function AuthGate() {
  const auth = useAuth()!;
  // O mapa chega enquanto a pessoa ainda está na tela de acesso.
  useEffect(() => scheduleIdle(() => void loadableMapApp.preload(), 1200), []);
  if (auth.loading) return <LoadingAccount />;
  if (auth.user)
    return (
      <Suspense fallback={<LoadingAccount />}>
        <MapApp key={auth.user.id} />
      </Suspense>
    );
  if (auth.loadError)
    return (
      <main className="app auth-page">
        <section className="auth-card auth-unavailable">
          <h1>Não foi possível conectar</h1>
          <p>Confira sua conexão e tente novamente.</p>
          <button className="auth-submit" onClick={auth.reload}>
            Tentar novamente
          </button>
        </section>
        <ThemeSwitch />
      </main>
    );
  return <AuthScreen />;
}
