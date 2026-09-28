export interface SupabaseConfig {
  url: string;
  key: string;
  redirectUrl: string;
}

const PLACEHOLDER_VALUE =
  /(?:your[-_ ]?(?:key|project)|replace[-_ ]?(?:with[-_ ]?)?(?:your[-_ ]?)?(?:key|project)|change[-_ ]?me|\.\.\.)/i;

const configuredValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && !PLACEHOLDER_VALUE.test(normalized) ? normalized : null;
};

export const readSupabaseConfig = (
  env: Record<string, string | undefined>,
): SupabaseConfig | null => {
  const url = configuredValue(env.VITE_SUPABASE_URL);
  const key =
    configuredValue(env.VITE_SUPABASE_PUBLISHABLE_KEY) ?? configuredValue(env.VITE_SUPABASE_ANON_KEY);
  if (!url || !key) return null;

  return {
    url,
    key,
    redirectUrl:
      configuredValue(env.VITE_SUPABASE_AUTH_REDIRECT_URL) ?? 'http://localhost:1420/auth/callback',
  };
};
