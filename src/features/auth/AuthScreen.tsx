import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { loadTheme } from '@/app/theme';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { useAuth } from './AuthContext';
import { AuthLens } from './AuthLens';

type Field = 'name' | 'email' | 'password';

// Mensagens próprias: as do navegador mudam de idioma e de estilo a cada sistema.
function fieldError(input: HTMLInputElement): string | undefined {
  const value = input.value.trim();
  if (input.name === 'name') {
    if (!value) return 'Informe seu nome.';
    if (value.length < 2) return 'Use pelo menos 2 caracteres.';
  }
  if (input.name === 'email') {
    if (!value) return 'Informe seu e-mail.';
    if (input.validity.typeMismatch || !value.includes('.'))
      return 'Confira o e-mail, por exemplo nome@email.com.';
  }
  if (input.name === 'password') {
    if (!input.value) return 'Informe sua senha.';
    if (input.value.length < input.minLength)
      return `A senha precisa de pelo menos ${input.minLength} caracteres.`;
  }
  return undefined;
}

export function AuthScreen() {
  const auth = useAuth()!;
  const [registering, setRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.submitting) return;
    const form = event.currentTarget;
    const inputs = (['name', 'email', 'password'] as const)
      .map((name) => form.elements.namedItem(name) as HTMLInputElement | null)
      .filter((input): input is HTMLInputElement => input !== null);
    const found = Object.fromEntries(
      inputs.flatMap((input) => {
        const message = fieldError(input);
        return message ? [[input.name, message]] : [];
      }),
    );
    setErrors(found);
    const invalid = inputs.find((input) => found[input.name]);
    if (invalid) {
      invalid.focus();
      return;
    }
    const fields = new FormData(form);
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
    <main className={`app auth-page${registering ? ' is-registering' : ''}`}>
      <div className="auth-layout">
        <div className="auth-form-side">
          <div className="auth-brand">
            <img src="/logo-192.png?v=3" width="48" height="48" alt="" />
            <span>
              Brasil <strong>Lens</strong>
            </span>
          </div>
          <section className="auth-card" aria-labelledby="auth-title">
            <h1 id="auth-title">{registering ? 'Crie sua conta' : 'Acesse sua conta'}</h1>
            <form
              onSubmit={submit}
              onInput={(event) => {
                const name = (event.target as HTMLInputElement).name as Field;
                if (errors[name]) setErrors({ ...errors, [name]: undefined });
              }}
              key={registering ? 'register' : 'login'}
              noValidate
            >
              <fieldset disabled={auth.submitting}>
                {registering && (
                  <div className="auth-field">
                    <label htmlFor="auth-name">Nome</label>
                    <input
                      id="auth-name"
                      name="name"
                      autoComplete="name"
                      autoCapitalize="words"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Seu nome"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'auth-name-error' : undefined}
                    />
                    <FieldError id="auth-name-error" message={errors.name} />
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="auth-email">E-mail</label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete={registering ? 'email' : 'username'}
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                    placeholder="nome@email.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'auth-email-error' : undefined}
                  />
                  <FieldError id="auth-email-error" message={errors.email} />
                </div>
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
                      placeholder={registering ? 'Crie uma senha' : 'Sua senha'}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password
                          ? 'auth-password-error'
                          : registering
                            ? 'password-hint'
                            : undefined
                      }
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
                  {errors.password ? (
                    <FieldError id="auth-password-error" message={errors.password} />
                  ) : (
                    registering && (
                      <span id="password-hint" className="auth-hint">
                        Mínimo de 8 caracteres.
                      </span>
                    )
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
                  {auth.submitting && <span className="auth-spinner" aria-hidden="true" />}
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
                  setErrors({});
                  auth.resetSubmit();
                }}
              >
                {registering ? 'Entrar' : 'Criar conta'}
              </button>
            </p>
          </section>
          {registering && (
            <p className="auth-hint auth-note">
              Seu e-mail serve só para acessar a conta. Notificações são opcionais: ative pelo sino
              em Municípios seguidos, quando quiser.
            </p>
          )}
        </div>
        <aside className="auth-visual" aria-hidden="true">
          <AuthLens />
        </aside>
      </div>
      <ThemeSwitch />
    </main>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="auth-field-error">
      {message}
    </span>
  );
}
