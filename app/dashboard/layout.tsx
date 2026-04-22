'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { initBackgroundSync } from '@/lib/syncService';
import ModernModal from '@/components/ModernModal';
import { User, Settings, Save, X, Camera as CameraIcon, History as HistoryIcon, CheckCircle as CheckIcon, BarChart as ChartIcon, Map as MapIcon, Users as UsersIcon, LogOut as LogoutIcon } from 'lucide-react';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, updateProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialize background sync
    initBackgroundSync();
    
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    // Check pending offline submissions
    import('@/lib/dexieDb').then(({ countPending }) => {
      countPending().then(setPendingCount);
    });
  }, []);

  if (loading || !user) return (
    <div className="loading-overlay">
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Memuat...</p>
    </div>
  );

  const role = user.role;

  const navItems = [
    ...(role === 'surveyor' ? [
      { href: '/dashboard/survey', label: 'Input Survei', icon: CameraIcon },
      { href: '/dashboard/riwayat', label: 'Riwayat Saya', icon: HistoryIcon },
    ] : []),
    ...(role === 'checker' ? [
      { href: '/dashboard/checker', label: 'Verifikasi Data', icon: CheckIcon },
    ] : []),
    ...(role === 'admin' ? [
      { href: '/dashboard/admin', label: 'Dashboard Admin', icon: ChartIcon },
      { href: '/dashboard/markets', label: 'Kelola Pasar', icon: MapIcon },
      { href: '/dashboard/users', label: 'Manajemen User', icon: UsersIcon },
    ] : []),
  ];

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <div className="app-layout">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div>
              <p className="logo-title">Survei Pasar</p>
              <p className="logo-sub">KTG — Digital Recap</p>
            </div>
          </div>
          {/* Sync Status Indicator */}
          <div style={{ marginTop: 16 }}>
            <div className={`sync-bar ${isOnline ? 'online' : 'offline'}`} style={{ borderRadius: 12 }}>
              <div className="sync-dot" />
              <span style={{ fontSize: 11, fontWeight: 700 }}>{isOnline ? 'Sistem Terhubung' : 'Mode Offline Aktif'}</span>
              {pendingCount > 0 && (
                <span className="badge-warning" style={{
                  marginLeft: 'auto', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800
                }}>
                  {pendingCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav custom-scrollbar">
          <p className="nav-section-title">Menu Utama</p>
          {navItems.map(item => (
            <button
              key={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => { router.push(item.href); setSidebarOpen(false); }}
            >
              <item.icon />
              <span>{item.label}</span>
              {pathname === item.href && (
                <div style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
              )}
            </button>
          ))}
          
          <div style={{ margin: '16px 0', height: 1, background: 'var(--border)' }} />
          <p className="nav-section-title">Pengaturan Akun</p>
          <button className="nav-item text-danger" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
            <LogoutIcon />
            <span>Keluar Sesi</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card glass">
            <div className="user-avatar" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
              {(user.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name || 'User Name'}
              </p>
              <span className="user-role" style={{ fontSize: 9 }}>{user.role}</span>
            </div>
            <button 
              className="btn-icon-sm" 
              onClick={() => { setEditName(user.full_name); setIsProfileModalOpen(true); }}
              title="Edit Profil"
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 8 }}
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ overflowX: 'hidden' }}>
        {children}
      </main>

      {/* Profile Modal */}
      <ModernModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Edit Profil Saya"
        description="Perbarui informasi identitas Anda di sistem."
        confirmText="Simpan Perubahan"
        onConfirm={async () => {
          setSavingProfile(true);
          const res = await updateProfile({ full_name: editName });
          setSavingProfile(false);
          if (res.error) {
            setProfileError(res.error);
          } else {
            setIsProfileModalOpen(false);
          }
        }}
        loading={savingProfile}
      >
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Nama Lengkap</label>
          <input 
            type="text" 
            className="form-input" 
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Masukkan nama lengkap..."
            autoFocus
          />
        </div>
      </ModernModal>

      {profileError && (
        <ModernModal
          isOpen={!!profileError}
          onClose={() => setProfileError(null)}
          title="Gagal Perbarui Profil"
          description={profileError}
          type="danger"
          confirmText="Tutup"
          onConfirm={() => setProfileError(null)}
        />
      )}

      {/* Mobile toggle */}
      <button 
        className={`mobile-menu-btn${sidebarOpen ? ' sidebar-open' : ''}`} 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="3" x2="21" y1="6" y2="6"/>
          <line x1="3" x2="21" y1="12" y2="12"/>
          <line x1="3" x2="21" y1="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardContent>{children}</DashboardContent>
  );
}

// End of file
