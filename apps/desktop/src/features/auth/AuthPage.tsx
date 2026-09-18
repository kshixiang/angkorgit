import { useState, type FormEvent, type ReactNode, type ChangeEvent } from 'react';
import { KeyRound, Mail, UserRound } from 'lucide-react';
import { Button, Input, Logo, Spinner, TemplePattern } from '@gitmd/design-system';
import { useAuth } from './store';

type Mode = 'login' | 'register' | 'reset';

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  if (typeof error === 'string') return error;
  return 'Something went wrong. Please try again.';
};

export function AuthPage() {
  const status = useAuth((state) => state.status);
  const user = useAuth((state) => state.user);
  const authError = useAuth((state) => state.error);
  const signIn = useAuth((state) => state.signIn);
  const signUp = useAuth((state) => state.signUp);
  const verifyEmail = useAuth((state) => state.verifyEmail);
  const resetPassword = useAuth((state) => state.resetPassword);
  const showSignIn = useAuth((state) => state.showSignIn);
  const clearError = useAuth((state) => state.clearError);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const resendConfirmation = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      const { supabase } = await import('./client');
      if (!supabase) throw new Error('Supabase authentication is not configured for this build.');
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw error;
      setNotice('A new verification email has been sent. Use the newest email link.');
    } catch (error) {
      setLocalError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await verifyEmail(email, verificationCode);
    } catch (error) {
      setLocalError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    setLocalError(null);
    clearError();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setLocalError(null);
    try {
      if (mode === 'login') await signIn(email, password);
      if (mode === 'register') {
        await signUp(email, password, displayName);
        setNotice('Check your inbox to verify your email address.');
      }
      if (mode === 'reset') {
        await resetPassword(email);
        setNotice('Password reset instructions have been sent.');
      }
    } catch (error) {
      setLocalError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'pending_email') {
    return (
      <AuthLayout>
        <Mail className="size-6 text-primary" />
        <h1 className="mt-5 text-xl font-semibold">Enter verification code</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a verification code to {user?.email || email || 'your email address'}.
        </p>
        <form className="mt-6 space-y-3" onSubmit={(event) => void verify(event)}>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            minLength={6}
            maxLength={10}
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Enter code"
            className="h-11 text-center text-lg tracking-[0.35em]"
            required
          />
          {(localError || authError) && <p role="alert" className="text-sm text-danger">{localError || authError}</p>}
          {notice && <p role="status" className="text-sm text-success">{notice}</p>}
          <Button type="submit" className="w-full" disabled={busy || verificationCode.length < 6}>
            {busy && <Spinner className="size-4" />}
            Verify email
          </Button>
        </form>
        <Button className="mt-2 w-full" variant="link" onClick={() => void resendConfirmation()} disabled={busy}>
          Resend verification code
        </Button>
        <Button className="mt-1 w-full" variant="secondary" onClick={() => { showSignIn(); changeMode('login'); }}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">
          {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'login'
            ? 'Continue to GitMD'
            : mode === 'register'
              ? 'Create your GitMD account'
              : 'Enter the email linked to your account'}
        </p>
      </div>

      <form className="space-y-4" onSubmit={(event: FormEvent) => void submit(event)}>
        {mode === 'register' && (
          <label className="block text-xs font-medium text-muted">
            Display name
            <span className="relative mt-1.5 block">
              <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                autoComplete="name"
                value={displayName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)}
                className="h-10 pl-9"
                required
              />
            </span>
          </label>
        )}
        <label className="block text-xs font-medium text-muted">
          Email
          <span className="relative mt-1.5 block">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              className="h-10 pl-9"
              required
              autoFocus
            />
          </span>
        </label>
        {mode !== 'reset' && (
          <label className="block text-xs font-medium text-muted">
            Password
            <span className="relative mt-1.5 block">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                minLength={8}
                className="h-10 pl-9"
                required
              />
            </span>
          </label>
        )}

        {(localError || authError) && (
          <p role="alert" className="text-sm text-danger">{localError || authError}</p>
        )}
        {notice && <p role="status" className="text-sm text-success">{notice}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Spinner className="size-4" />}
          {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        {mode === 'login' ? (
          <>
            <Button variant="link" size="sm" className="px-0" onClick={() => changeMode('register')}>
              Create account
            </Button>
            <Button variant="link" size="sm" className="px-0" onClick={() => changeMode('reset')}>
              Forgot password?
            </Button>
          </>
        ) : (
          <Button variant="link" size="sm" className="px-0" onClick={() => changeMode('login')}>
            Back to sign in
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex h-full items-center justify-center overflow-hidden bg-background p-6">
      <TemplePattern className="[mask-image:radial-gradient(ellipse_at_center,black_5%,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Logo size={40} />
          <span className="text-xl font-semibold">Git<span className="text-primary">MD</span></span>
        </div>
        <section className="rounded-lg border border-border bg-surface p-6 shadow-soft">{children}</section>
      </div>
    </main>
  );
}
