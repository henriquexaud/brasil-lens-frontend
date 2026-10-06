import { useIsMutating } from '@tanstack/react-query';
import { loadTheme } from '@/app/theme';
import { useAuth } from './AuthContext';

export function AccountMenu() {
  const auth = useAuth();
  const writes = useIsMutating({ mutationKey: ['me'] });
  if (!auth?.user) return null;
  return (
    <div className="account-menu">
      <div className="account-menu__row">
        <span className="account-menu__name" title={auth.user.email}>
          {auth.user.name}
        </span>
        <button
          type="button"
          className="ghost-button"
          aria-label="Sair da conta"
          disabled={auth.loggingOut || writes > 0}
          onClick={auth.logout}
        >
          {auth.loggingOut ? 'Saindo…' : 'Sair'}
        </button>
      </div>
      {auth.logoutError && (
        <p className="auth-error" role="alert">
          Não foi possível sair. Tente novamente.
        </p>
      )}
      {auth.themeError && (
        <p className="auth-error" role="alert">
          Não foi possível salvar o tema na conta.{' '}
          <button
            type="button"
            className="account-menu__retry"
            disabled={auth.savingTheme}
            onClick={() => auth.saveTheme(loadTheme())}
          >
            Tentar novamente
          </button>
        </p>
      )}
    </div>
  );
}
