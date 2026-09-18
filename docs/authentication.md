# GitMD authentication

The desktop app requires a Supabase Auth session before the repository UI is mounted. In a production Tauri build, the Supabase session is stored in the operating system keychain through Tauri IPC; it is not persisted in browser local storage.

Configure the frontend with:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

Apply `supabase/migrations/20260918105824_create_profiles_and_auth_trigger.sql` to create the user profile table and its row-level security policies. Enable email/password sign-up in Supabase Auth. The current MVP requires email verification before the main application is unlocked.

Browser demo mode uses a deterministic demo identity so the existing offline demo and Playwright flows do not require a production Supabase project. Tauri builds always require the environment variables above.
