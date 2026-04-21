'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push('/dashboard');
    }
  };

  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    setError('');
    const result = await login(demoEmail, demoPass);
    setLoading(false);
    if (!result.error) router.push('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 className="login-title">Survei Pasar KTG</h1>
          <p className="login-subtitle">Sistem Kontribusi Pasar Digital</p>
        </div>

        {error && (
          <div className="alert alert-danger mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
              <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="masukkan email anda"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Memproses...</> : 'Masuk'}
          </button>
        </form>

        <div className="mt-6">
          <button
            className="btn btn-ghost btn-full text-sm"
            onClick={() => setShowDemo(!showDemo)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            {showDemo ? 'Sembunyikan' : 'Lihat'} Akun Demo
          </button>

          {showDemo && (
            <div style={{marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {[
                { label: '👤 Admin', email: 'admin@demo.com', color: '#6366f1' },
                { label: '📋 Surveyor', email: 'surveyor@demo.com', color: '#10b981' },
                { label: '✓ Checker', email: 'checker@demo.com', color: '#f59e0b' },
              ].map(a => (
                <button
                  key={a.email}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', borderColor: a.color + '44' }}
                  onClick={() => quickLogin(a.email, 'demo123')}
                >
                  <span>{a.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{a.email}</span>
                </button>
              ))}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                Password: <code style={{ color: 'var(--primary-light)' }}>demo123</code>
              </p>
            </div>
          )}
        </div>

        <p style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Surveyor Pasar KTG v1.0 · Sistem Survei Kontribusi
        </p>
      </div>
    </div>
  );
}
