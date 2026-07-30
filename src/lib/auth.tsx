import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, displayName: string, username?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('Profile load error', error);
      return;
    }
    if (!data) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: uid, display_name: uid.slice(0, 8) })
        .select('*')
        .maybeSingle();
      if (created) setProfile(created);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        if (sess) {
          await loadProfile(sess.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
    return { error: error?.message ?? null };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    return { error: error?.message ?? null };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string, username?: string) => {
    if (username) {
      const { data: existing, error: existingError } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
      if (existingError) return { error: existingError.message };
      if (existing) return { error: 'Username already taken.' };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
        username: username || null,
      });
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInWithPhone, verifyOtp, signInWithEmail, signUpWithEmail, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
