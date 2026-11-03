import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, User } from '@/api/types';

export interface AuthState {
  user: User | null;
  loading: boolean;
  loadError: Error | null;
  reload: () => void;
  submit: (body: LoginRequest | RegisterRequest) => void;
  submitting: boolean;
  submitError: Error | null;
  resetSubmit: () => void;
  logout: () => void;
  loggingOut: boolean;
  logoutError: Error | null;
  saveTheme: (theme: User['theme']) => void;
  savingTheme: boolean;
  themeError: Error | null;
  acceptTerms: () => void;
  acceptingTerms: boolean;
  termsError: Error | null;
  deleteAccount: (password: string) => void;
  deletingAccount: boolean;
  deleteError: Error | null;
  resetDelete: () => void;
  /** A conta acabou de ser excluída neste aparelho: a tela de acesso confirma. */
  accountDeleted: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  return useContext(AuthContext);
}
