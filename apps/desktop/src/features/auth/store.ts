import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { authConfigured, authRedirectUrl, isDemoAuth, supabase } from './client';

export type AuthStatus = 'loading' | 'signed_out' | 'pending_email' | 'signed_in' | 'error';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  error: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  verifyEmail: (email: string, token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  showSignIn: () => void;
  clearError: () => void;
}

const demoUser = {
  id: 'demo-user',
  email: 'demo@gitmd.dev',
  email_confirmed_at: new Date(0).toISOString(),
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { display_name: 'Demo User' },
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} as User;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  if (typeof error === 'string') return error;
  return 'Authentication failed. Please try again.';
};

const consumeAuthCallback = async (): Promise<string | null> => {
  if (!supabase || typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const callbackError = hash.get('error_description') ?? query.get('error_description');
  if (callbackError) {
    window.history.replaceState({}, document.title, window.location.pathname);
    return decodeURIComponent(callbackError.replace(/\+/g, ' '));
  }
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    window.history.replaceState({}, document.title, window.location.pathname);
    if (error) return errorMessage(error);
    return null;
  }
  const code = query.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    window.history.replaceState({}, document.title, window.location.pathname);
    if (error) return errorMessage(error);
  }
  return null;
};

const statusFor = (session: Session | null): AuthStatus => {
  if (!session?.user) return 'signed_out';
  return session.user.email_confirmed_at ? 'signed_in' : 'pending_email';
};

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  session: null,
  error: null,
  initialized: false,

  async initialize() {
    if (get().initialized) return;
    if (isDemoAuth) {
      set({ status: 'signed_in', user: demoUser, session: null, initialized: true, error: null });
      return;
    }
    if (!authConfigured || !supabase) {
      set({
        status: 'error',
        initialized: true,
        error: 'Supabase authentication is not configured for this build.',
      });
      return;
    }
    const callbackError = await consumeAuthCallback();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ status: 'error', initialized: true, error: callbackError ?? errorMessage(error) });
      return;
    }
    set({
      status: statusFor(data.session),
      user: data.session?.user ?? null,
      session: data.session,
      initialized: true,
      error: callbackError,
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ status: statusFor(session), user: session?.user ?? null, session, error: null });
    });
  },

  async signIn(email, password) {
    if (isDemoAuth) return;
    if (!supabase) throw new Error('Supabase authentication is not configured for this build.');
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
    set({
      status: data.session ? statusFor(data.session) : 'pending_email',
      user: data.user,
      session: data.session,
      error: null,
    });
  },

  async signUp(email, password, displayName) {
    if (isDemoAuth) return;
    if (!supabase) throw new Error('Supabase authentication is not configured for this build.');
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: authRedirectUrl,
        data: { display_name: displayName.trim() || undefined },
      },
    });
    if (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
    set({
      status: data.session ? statusFor(data.session) : 'pending_email',
      user: data.user,
      session: data.session,
      error: null,
    });
  },

  async verifyEmail(email, token) {
    if (isDemoAuth) return;
    if (!supabase) throw new Error('Supabase authentication is not configured for this build.');
    set({ error: null });
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'signup',
    });
    if (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
    set({
      status: statusFor(data.session),
      user: data.user,
      session: data.session,
      error: null,
    });
  },

  async resetPassword(email) {
    if (isDemoAuth) return;
    if (!supabase) throw new Error('Supabase authentication is not configured for this build.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  },

  async signOut() {
    if (supabase && !isDemoAuth) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    get().clearError();
    set({ status: 'signed_out', user: null, session: null, error: null });
  },

  showSignIn() {
    set({ status: 'signed_out', user: null, session: null, error: null });
  },

  clearError() {
    set({ error: null });
  },
}));
