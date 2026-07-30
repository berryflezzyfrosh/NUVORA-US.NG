import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { NuvoLogo } from '@/components/NuvoLogo';
import { NUVOVA_CONFIG } from '@/config';
import { Loader2, Mail, Lock, User, AtSign, Sparkles, Phone, ChevronRight, ArrowLeft } from 'lucide-react';

type Mode = 'phone' | 'otp' | 'email';
type AuthTab = 'phone' | 'email';

export function AuthScreen() {
  const { signInWithPhone, verifyOtp, signInWithEmail, signUpWithEmail } = useAuth();
  const [tab, setTab] = useState<AuthTab>('phone');
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signInWithPhone(phone.trim());
    if (error) setError(error);
    else setMode('otp');
    setBusy(false);
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await verifyOtp(phone.trim(), otp.trim());
    if (error) setError(error);
    setBusy(false);
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (isSignup) {
      if (displayName.trim().length < 2) {
        setError('Display name must be at least 2 characters.');
        setBusy(false);
        return;
      }
      const { error } = await signUpWithEmail(email.trim(), password, displayName.trim(), username.trim() || undefined);
      if (error) setError(error);
    } else {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) setError(error);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 via-aqua-50/30 to-ocean-50 dark:from-ink-950 dark:via-ink-900 dark:to-aqua-950/20 p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-aqua-400/20 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-ocean-400/20 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <NuvoLogo size={72} className="drop-shadow-xl" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white">
            {NUVOVA_CONFIG.appName}
          </h1>
          <p className="mt-1 text-sm text-ink-400 dark:text-ink-300">{NUVOVA_CONFIG.tagline}</p>
        </div>

        <div className="bg-white/80 dark:bg-ink-900/70 glass rounded-3xl shadow-2xl ring-1 ring-ink-200/60 dark:ring-ink-800 p-8">
          {mode !== 'otp' && (
            <div className="flex gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => { setTab('phone'); setMode('phone'); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  tab === 'phone'
                    ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm'
                    : 'text-ink-400 dark:text-ink-300'
                }`}
              >
                <Phone size={15} />
                Phone
              </button>
              <button
                type="button"
                onClick={() => { setTab('email'); setMode('email'); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  tab === 'email'
                    ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm'
                    : 'text-ink-400 dark:text-ink-300'
                }`}
              >
                <Mail size={15} />
                Email
              </button>
            </div>
          )}

          {mode === 'otp' ? (
            <form onSubmit={submitOtp} className="space-y-5">
              <button type="button" onClick={() => setMode('phone')} className="flex items-center gap-1 text-sm text-ink-400 hover:text-aqua-500 transition">
                <ArrowLeft size={16} /> Back
              </button>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-1">Verify your number</h2>
                <p className="text-sm text-ink-400">Enter the 6-digit code sent to<br /><span className="font-semibold text-ink-700 dark:text-ink-200">{phone}</span></p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full text-center text-2xl tracking-[0.5em] font-bold px-4 py-4 rounded-2xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 text-ink-900 dark:text-white"
                required
                autoFocus
              />
              {error && <div className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-4 py-2.5">{error}</div>}
              <button type="submit" disabled={busy || otp.length < 6} className="w-full py-3 rounded-2xl bg-gradient-to-r from-aqua-500 to-ocean-500 text-white font-semibold shadow-lg shadow-aqua-500/25 hover:shadow-aqua-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <><ChevronRight size={18} /> Verify</>}
              </button>
            </form>
          ) : tab === 'phone' ? (
            <form onSubmit={submitPhone} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold">Welcome</h2>
                <p className="text-sm text-ink-400">Enter your phone number to get started</p>
              </div>
              <Field icon={<Phone size={18} />}>
                <input
                  type="tel"
                  placeholder="+234 801 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent outline-none text-ink-900 dark:text-white placeholder-ink-300"
                  required
                />
              </Field>
              {error && <div className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-4 py-2.5">{error}</div>}
              <button type="submit" disabled={busy || phone.trim().length < 6} className="w-full py-3 rounded-2xl bg-gradient-to-r from-aqua-500 to-ocean-500 text-white font-semibold shadow-lg shadow-aqua-500/25 hover:shadow-aqua-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <>Continue <ChevronRight size={18} /></>}
              </button>
              <p className="text-xs text-center text-ink-400 mt-3">
                We'll send you a verification code via SMS.
              </p>
            </form>
          ) : (
            <form onSubmit={submitEmail} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">{isSignup ? 'Create Account' : 'Welcome back'}</h2>
                <button type="button" onClick={() => setIsSignup(!isSignup)} className="text-sm font-medium text-aqua-500 hover:text-aqua-600">
                  {isSignup ? 'Sign in' : 'Sign up'}
                </button>
              </div>
              {isSignup && (
                <>
                  <Field icon={<User size={18} />}>
                    <input type="text" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-transparent outline-none text-ink-900 dark:text-white placeholder-ink-300" required />
                  </Field>
                  <Field icon={<AtSign size={18} />}>
                    <input type="text" placeholder="Username (optional)" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} className="w-full bg-transparent outline-none text-ink-900 dark:text-white placeholder-ink-300" />
                  </Field>
                </>
              )}
              <Field icon={<Mail size={18} />}>
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent outline-none text-ink-900 dark:text-white placeholder-ink-300" required />
              </Field>
              <Field icon={<Lock size={18} />}>
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent outline-none text-ink-900 dark:text-white placeholder-ink-300" required minLength={6} />
              </Field>
              {error && <div className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-4 py-2.5">{error}</div>}
              <button type="submit" disabled={busy} className="w-full py-3 rounded-2xl bg-gradient-to-r from-aqua-500 to-ocean-500 text-white font-semibold shadow-lg shadow-aqua-500/25 hover:shadow-aqua-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={18} className="animate-spin" /> : (isSignup ? 'Create Account' : 'Sign In')}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center gap-2 justify-center text-xs text-ink-400 dark:text-ink-500">
            <Sparkles size={14} className="text-aqua-500" />
            <span>Powered by {NUVOVA_CONFIG.aiName}, your built-in AI assistant</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-400 dark:text-ink-600">
          Created by {NUVOVA_CONFIG.creator} · {NUVOVA_CONFIG.version}
        </p>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-ink-100 dark:bg-ink-800/80 ring-1 ring-ink-200 dark:ring-ink-700/60 focus-within:ring-aqua-400 transition">
      <span className="text-ink-400">{icon}</span>
      {children}
    </div>
  );
}
