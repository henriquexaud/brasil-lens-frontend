import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { loadTheme } from '@/app/theme';
import { AccountDialog } from './AccountDialog';
import { useAuth } from './AuthContext';

export function AccountMenu() {
  const auth = useAuth();
  const writes = useIsMutating({ mutationKey: ['me'] });
  const [open, setOpen] = useState(false);
  if (!auth?.user) return null;
  return (
    <div className="account-menu">
      <div className="account-menu__row">
        <button
          type="button"
          className="account-menu__name"
          title={auth.user.email}
          aria-haspopup="dialog"
          aria-label={`Sua conta: ${auth.user.name}`}
          onClick={() => setOpen(true)}
        >
          {auth.user.name}
        </button>
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
      {open && <AccountDialog onClose={() => setOpen(false)} />}
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
