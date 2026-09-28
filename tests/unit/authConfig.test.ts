import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from '../../apps/desktop/src/features/auth/config';

describe('readSupabaseConfig', () => {
  it('ignores placeholder publishable keys and falls back to an anon key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ' https://example.supabase.co ',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_your-key',
        VITE_SUPABASE_ANON_KEY: 'eyJvalid-anon-key',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      key: 'eyJvalid-anon-key',
      redirectUrl: 'http://localhost:1420/auth/callback',
    });
  });

  it('does not configure auth when only a placeholder key is present', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_your-key',
      }),
    ).toBeNull();
  });
});
