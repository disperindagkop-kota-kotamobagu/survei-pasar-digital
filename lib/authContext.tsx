// Auth Context — manages session state globally
'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, Role } from './supabaseClient';
import { DEMO_ACCOUNTS } from './mockData';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: () => {},
  isDemo: true,
});

const SESSION_KEY = 'ktg_survey_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Demo mode
    const found = DEMO_ACCOUNTS.find(
      a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (found) {
      setUser(found.user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(found.user));
      return {};
    }

    // Try real Supabase if configured
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
    ) {
      try {
        const { supabase } = await import('./supabaseClient');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          if (profile) {
            setUser(profile);
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return {};
          }
        }
      } catch (e) {
        return { error: 'Koneksi ke server gagal.' };
      }
    }

    return { error: 'Email atau password salah.' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isDemo: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
