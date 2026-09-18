import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ipc, isTauri } from '@/core/ipc';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? viteEnv.VITE_SUPABASE_ANON_KEY;
export const authRedirectUrl = viteEnv.VITE_SUPABASE_AUTH_REDIRECT_URL ?? 'http://localhost:3000/auth/callback';

const storage = {
  async getItem(_key: string): Promise<string | null> {
    return ipc.authSessionGet();
  },
  async setItem(_key: string, value: string): Promise<void> {
    await ipc.authSessionSet(value);
  },
  async removeItem(_key: string): Promise<void> {
    await ipc.authSessionRemove();
  },
};

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = authConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isDemoAuth = !isTauri();
