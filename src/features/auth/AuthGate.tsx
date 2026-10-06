import { lazy, memo, Suspense } from 'react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { useAuth } from './AuthContext';
import { AuthScreen } from './AuthScreen';

const MapApp = memo(lazy(() => import('@/App')));

function LoadingAccount() {
  return (
    <div className="app auth-page" role="status">
      Abrindo o Brasil Lens…
    </div>
  );
}

export function AuthGate() {
  const auth = useAuth()!;
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
