import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { loadTheme } from '@/app/theme';
import { useTheme } from '@/app/useTheme';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { useAuth } from './AuthContext';

export function AuthScreen() {
  const auth = useAuth()!;
  const { theme } = useTheme();
  const [registering, setRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.submitting) return;
    const fields = new FormData(event.currentTarget);
    const credentials = {
      email: String(fields.get('email')).trim(),
      password: String(fields.get('password')),
    };
    auth.submit(
      registering
        ? { ...credentials, name: String(fields.get('name')).trim(), theme: loadTheme() }
        : credentials,
    );
  }

  return (
    <main className="app auth-page">
      <div className="auth-layout">
        <div className="auth-form-side">
          <div className="auth-brand">
            <img src="/icon-192.png?v=2" width="48" height="48" alt="" />
            <span>
              Brasil <strong>Lens</strong>
            </span>
          </div>
          <section className="auth-card" aria-labelledby="auth-title">
            <p className="auth-eyebrow">O Brasil, mais perto.</p>
            <h1 id="auth-title">{registering ? 'Crie sua conta' : 'Bem-vindo de volta'}</h1>
            <p className="auth-description">
              {registering
                ? 'Acompanhe os municípios que importam para você.'
                : 'Entre para retomar seus municípios e explorar o mapa.'}
            </p>
            <form onSubmit={submit} key={registering ? 'register' : 'login'}>
              <fieldset disabled={auth.submitting}>
                {registering && (
                  <label className="auth-field">
                    Nome
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Como podemos chamar você?"
                    />
                  </label>
                )}
                <label className="auth-field">
                  E-mail
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                    placeholder="voce@exemplo.com"
                  />
                </label>
                <div className="auth-field">
                  <label htmlFor="auth-password">Senha</label>
                  <span className="auth-password">
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={registering ? 'new-password' : 'current-password'}
                      required
                      minLength={registering ? 8 : 1}
                      maxLength={128}
                      aria-describedby={registering ? 'password-hint' : undefined}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {showPassword && <path d="m3 3 18 18" />}
                      </svg>
                    </button>
                  </span>
                  {registering && (
                    <span id="password-hint" className="auth-hint">
                      Use pelo menos 8 caracteres.
                    </span>
                  )}
                </div>
                {auth.submitError && (
                  <p className="auth-error" role="alert">
                    {auth.submitError instanceof ApiError
                      ? auth.submitError.message
                      : 'Não foi possível conectar. Confira sua conexão e tente novamente.'}
                  </p>
                )}
                <button type="submit" className="auth-submit">
                  {auth.submitting
                    ? registering
                      ? 'Criando conta…'
                      : 'Entrando…'
                    : registering
                      ? 'Criar conta'
                      : 'Entrar'}
                  {!auth.submitting && <span aria-hidden="true">→</span>}
                </button>
              </fieldset>
            </form>
            <p className="auth-alternative">
              {registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
              <button
                type="button"
                disabled={auth.submitting}
                onClick={() => {
                  setRegistering(!registering);
                  setShowPassword(false);
                  auth.resetSubmit();
                }}
              >
                {registering ? 'Entrar' : 'Criar conta'}
              </button>
            </p>
          </section>
          {registering && (
            <p className="auth-hint">
              Seu e-mail é usado para acessar a conta. As notificações do app são opcionais: você
              escolhe os municípios pelo sino em Municípios seguidos e autoriza o recebimento neste
              dispositivo. Pode desativar quando quiser.
            </p>
          )}
          <p className="auth-footer">Clima e meio ambiente, do país ao seu município.</p>
        </div>
        <aside className="auth-visual" aria-hidden="true">
          <img
            src={theme === 'dark' ? '/auth-map-dark.png' : '/auth-map.jpg'}
            width="1540"
            height="1568"
            alt=""
          />
        </aside>
      </div>
      <ThemeSwitch />
    </main>
  );
}
