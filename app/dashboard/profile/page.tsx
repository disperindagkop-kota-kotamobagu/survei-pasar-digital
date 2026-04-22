'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { User, Mail, Lock, Save, Shield, BadgeCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  
  // States for basic info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  // States for security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      // Try to get email from session if not in profile
      const fetchEmail = async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.email) {
          setEmail(data.session.user.email);
        }
      };
      fetchEmail();
    }
  }, [user]);

  const handleUpdateBasic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 1. Update Full Name in profiles table via authContext
      const res = await updateProfile({ full_name: fullName });
      if (res.error) throw new Error(res.error);

      // 2. Update Email in Auth (if changed)
      const { data: sessionData } = await supabase.auth.getSession();
      const currentEmail = sessionData?.session?.user?.email;

      if (email !== currentEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw new Error(`Profil tersimpan, tapi gagal memperbarui email: ${emailError.message}`);
        setMessage({ type: 'success', text: 'Profil diperbarui! Silakan cek email baru Anda untuk konfirmasi perubahan email.' });
      } else {
        setMessage({ type: 'success', text: 'Informasi profil berhasil diperbarui.' });
      }
    } catch (err: any) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'danger', text: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setMessage({ type: 'success', text: 'Password berhasil diperbarui!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="page-body" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <div>
          <h1 className="page-title">Pengaturan Profil</h1>
          <p className="page-subtitle">Kelola informasi identitas dan keamanan akun Anda</p>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type} mb-6`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {message.type === 'success' ? <BadgeCheck size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid-2">
        {/* Info Card */}
        <section className="flex-col gap-6">
          <div className="card-premium p-6">
            <div className="flex-between mb-6">
              <div className="flex-center gap-3">
                <div style={{ background: 'var(--bg-hover)', color: 'var(--primary-light)', padding: 10, borderRadius: 12 }}>
                  <User size={24} />
                </div>
                <h2 className="font-bold text-lg">Informasi Dasar</h2>
              </div>
            </div>

            <form onSubmit={handleUpdateBasic} className="flex-col gap-4">
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    className="form-input" 
                    style={{ paddingLeft: 44 }}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama lengkap Anda..."
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="email"
                    className="form-input" 
                    style={{ paddingLeft: 44 }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Role Akses</label>
                <div className="flex-center gap-2" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <Shield size={16} className="text-secondary" />
                  <span className="font-semibold text-sm" style={{ textTransform: 'capitalize' }}>{user.role} System</span>
                </div>
                <p className="text-xs text-muted mt-2">Izin akses Anda dikelola oleh Administrator.</p>
              </div>

              <button type="submit" className="btn-primary mt-2" disabled={loading}>
                <Save size={18} />
                <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </form>
          </div>

          <div className="card-premium p-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(0,0,0,0))' }}>
            <h3 className="font-bold text-sm mb-2 flex-center gap-2">
              <AlertCircle size={16} className="text-warning" />
              Catatan Penting
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Jika Anda mengubah alamat email, Anda akan menerima email konfirmasi. Perubahan tidak akan aktif sampai Anda mengklik link konfirmasi tersebut.
            </p>
          </div>
        </section>

        {/* Security Card */}
        <section className="flex-col gap-6">
          <div className="card-premium p-6">
            <div className="flex-center gap-3 mb-6">
              <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: 10, borderRadius: 12 }}>
                <Lock size={24} />
              </div>
              <h2 className="font-bold text-lg">Keamanan Akun</h2>
            </div>

            <form onSubmit={handleUpdatePassword} className="flex-col gap-4">
              <div className="form-group">
                <label className="form-label">Password Baru</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    className="form-input" 
                    style={{ paddingLeft: 44, paddingRight: 44 }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter..."
                    required
                    minLength={6}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Konfirmasi Password Baru</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    className="form-input" 
                    style={{ paddingLeft: 44 }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru..."
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary mt-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--danger)', color: 'var(--danger)' }} disabled={loading}>
                <RefreshCw size={18} />
                <span>{loading ? 'Memperbarui...' : 'Ganti Password'}</span>
              </button>
            </form>
          </div>

          <div className="card-premium p-6" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.05), rgba(0,0,0,0))' }}>
            <p className="text-xs text-muted leading-relaxed">
              Gunakan password yang kuat dengan campuran huruf, angka, dan simbol untuk menjaga keamanan data survei Anda.
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        .p-6 { padding: 24px; }
        .text-lg { font-size: 18px; }
        .mb-2 { margin-bottom: 8px; }
        .leading-relaxed { line-height: 1.6; }
      `}</style>
    </div>
  );
}

// Minimal Icons support for this page
import { RefreshCw } from 'lucide-react';
