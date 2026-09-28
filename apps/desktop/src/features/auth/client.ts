import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ipc, isTauri } from '@/core/ipc';
import { readSupabaseConfig } from './config';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const supabaseConfig = readSupabaseConfig(viteEnv);
export const authRedirectUrl = supabaseConfig?.redirectUrl ?? 'http://localhost:1420/auth/callback';

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

export const authConfigured = supabaseConfig !== null;

export const supabase: SupabaseClient | null = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.key, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isDemoAuth = !isTauri();
