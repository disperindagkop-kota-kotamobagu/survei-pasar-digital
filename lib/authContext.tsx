// Auth Context — manages session state globally
'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, Role } from './supabaseClient';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  updateProfile: (newData: Partial<Profile>) => Promise<{ error?: string }>;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: () => {},
  updateProfile: async () => ({}),
  isDemo: false,
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
    // Try real Supabase if configured
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
    ) {
      try {
        const { supabase } = await import('./supabaseClient');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          console.error('Supabase Auth Error:', error.message);
          if (error.message === 'Invalid login credentials') return { error: 'Email atau password salah.' };
          if (error.message === 'Email not confirmed') return { error: 'Email belum dikonfirmasi. Periksa inbox Anda.' };
          return { error: error.message };
        }

        if (data.user) {
          console.log('Auth success, fetching profile for:', data.user.id);
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error('Profile fetch error:', profileError);
            return { error: 'Akun terdaftar tapi profil belum dibuat. Hubungi admin.' };
          }

          if (profile) {
            setUser(profile);
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return {};
          }
        }
      } catch (e: any) {
        console.error('Login Exception:', e);
        return { error: 'Koneksi ke server gagal: ' + (e.message || 'Unknown error') };
      }
    }

    return { error: 'Email atau password salah.' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const updateProfile = useCallback(async (newData: Partial<Profile>) => {
    if (!user) return { error: 'Sesi tidak ditemukan.' };
    
    // Update local state first for instant feedback (Optimistic Update)
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));

    // Update Supabase if not in demo mode
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
    ) {
      try {
        const { supabase } = await import('./supabaseClient');
        const { error } = await supabase
          .from('profiles')
          .update(newData)
          .eq('id', user.id);
        
        if (error) {
          console.error('Supabase Profile Update Error:', error);
          // Rollback if failed
          setUser(user);
          localStorage.setItem(SESSION_KEY, JSON.stringify(user));
          return { error: 'Gagal memperbarui profil di server: ' + error.message };
        }
      } catch (e: any) {
        return { error: 'Koneksi gagal: ' + e.message };
      }
    }
    return {};
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, isDemo: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
