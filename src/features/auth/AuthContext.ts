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
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  return useContext(AuthContext);
}
