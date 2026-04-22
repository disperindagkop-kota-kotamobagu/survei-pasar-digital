'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { initBackgroundSync } from '@/lib/syncService';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

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
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ overflowX: 'hidden' }}>
        {children}
      </main>

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

// Icon components
function CameraIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>; }
function HistoryIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.36"/></svg>; }
function CheckIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>; }
function ChartIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>; }
function MapIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" x2="8" y1="2" y2="18"/><line x1="16" x2="16" y1="6" y2="22"/></svg>; }
function UsersIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>; }
function LogoutIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>; }
